import cors from "@fastify/cors";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import underPressure from "@fastify/under-pressure";
import Fastify from "fastify";
import Redis from "ioredis";
import { z } from "zod";
import { tracks } from "../src/data/tracks";
import { CatalogSearchEngine, type SearchOptions, type SearchResultSet } from "../src/shared/catalogSearch";
import { CodeExecutionClient } from "./codeExecution";
import { serverConfig } from "./config";
import { OpenAiCoachClient } from "./openAiCoach";
import { SearchCache } from "./searchCache";
import { collectCourseQuestions, type CourseQuestion } from "./courseQuestions";
import { getFallbackLearningVideos } from "./youtubeFallback";
import { YouTubeLearningClient, type LearningVideo } from "./youtubeLearning";
import { collectTechNewsFeed, type TechNewsFeed } from "./techNews";
import { buildLearningKnowledgeGraph } from "./knowledgeGraph";

interface SearchResponsePayload extends SearchResultSet {
  query: string;
  tookMs: number;
  cache: "hit" | "miss";
}

interface QuestionRecommendationPayload {
  query: string;
  source: "aggregated" | "fallback";
  sources: string[];
  total: number;
  results: CourseQuestion[];
}

interface TechNewsCachePayload extends TechNewsFeed {
  cache: "hit" | "miss";
}

interface RuntimeMetrics {
  startedAt: number;
  totalRequests: number;
  totalSearchRequests: number;
  totalCodeExecutionRequests: number;
  totalAiProfileRequests: number;
  totalAiGapRequests: number;
  totalAiHintRequests: number;
  totalQuestionRecommendationRequests: number;
  totalLearningVideoRequests: number;
  totalTechNewsRequests: number;
  totalKnowledgeGraphRequests: number;
  techNewsCacheHits: number;
  techNewsCacheMisses: number;
  questionCacheHits: number;
  questionCacheMisses: number;
  cacheHits: number;
  cacheMisses: number;
  totalErrors: number;
}

interface EndpointConcurrencyLimiter {
  name: string;
  limit: number;
  active: number;
  rejected: number;
  peakActive: number;
}

const createLimiter = (name: string, limit: number): EndpointConcurrencyLimiter => ({
  name,
  limit: Math.max(1, limit),
  active: 0,
  rejected: 0,
  peakActive: 0,
});

const limiterSnapshot = (limiter: EndpointConcurrencyLimiter) => ({
  name: limiter.name,
  limit: limiter.limit,
  active: limiter.active,
  rejected: limiter.rejected,
  peakActive: limiter.peakActive,
});

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  type: z.enum(["all", "track", "course"]).optional().default("all"),
  branch: z.string().trim().min(2).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(serverConfig.maxSearchResults).optional().default(12),
});

const codeExecutionTestCaseSchema = z.object({
  input: z.string().max(20_000),
  expectedOutput: z.string().max(20_000).optional(),
});

const codeExecutionRequestSchema = z.object({
  languageId: z.coerce.number().int().positive(),
  sourceCode: z.string().min(1).max(serverConfig.codeExecutionMaxSourceChars),
  testCases: z
    .array(codeExecutionTestCaseSchema)
    .min(1)
    .max(serverConfig.codeExecutionMaxTestCases),
});

const aiMistakePatternSchema = z.object({
  label: z.string().trim().min(2).max(120),
  count: z.coerce.number().int().min(0).max(1_000_000),
});

const aiRecentSessionSchema = z.object({
  problemTitle: z.string().trim().min(2).max(180),
  language: z.string().trim().min(2).max(80),
  passedTests: z.coerce.number().int().min(0).max(1_000),
  totalTests: z.coerce.number().int().min(0).max(1_000),
  tookMs: z.coerce.number().int().min(0).max(300_000),
});

const profileInsightRequestSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  branch: z.string().trim().min(1).max(64),
  acceptanceRate: z.coerce.number().int().min(0).max(100),
  streak: z.coerce.number().int().min(0).max(10_000),
  solvedProblems: z.coerce.number().int().min(0).max(1_000_000),
  strongestLanguage: z.string().trim().max(80).optional(),
  focusLanguage: z.string().trim().max(80).optional(),
  topMistakes: z.array(aiMistakePatternSchema).max(10).default([]),
  recentSessions: z.array(aiRecentSessionSchema).max(25).default([]),
});

const gapAnalysisFailedCaseSchema = z.object({
  testCase: z.coerce.number().int().min(1).max(1_000),
  statusDescription: z.string().trim().min(2).max(120),
  stderr: z.string().max(20_000).optional(),
  compileOutput: z.string().max(20_000).optional(),
  message: z.string().max(20_000).optional(),
});

const gapAnalysisRequestSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  branch: z.string().trim().min(1).max(64),
  problemTitle: z.string().trim().min(2).max(180),
  language: z.string().trim().min(2).max(80),
  runtimeName: z.string().trim().max(120).optional(),
  passedTests: z.coerce.number().int().min(0).max(1_000),
  totalTests: z.coerce.number().int().min(0).max(1_000),
  tookMs: z.coerce.number().int().min(0).max(300_000),
  failedCases: z.array(gapAnalysisFailedCaseSchema).min(1).max(20),
  topMistakes: z.array(aiMistakePatternSchema).max(10).default([]),
});

const hintRequestSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  branch: z.string().trim().min(1).max(64),
  problemTitle: z.string().trim().min(2).max(180),
  language: z.string().trim().min(2).max(80),
  runtimeName: z.string().trim().max(120).optional(),
  sourceCode: z.string().min(1).max(serverConfig.openAiMaxContextChars),
  passedTests: z.coerce.number().int().min(0).max(1_000),
  totalTests: z.coerce.number().int().min(0).max(1_000),
  failedCase: gapAnalysisFailedCaseSchema.optional(),
  topMistakes: z.array(aiMistakePatternSchema).max(10).default([]),
});

const learningVideosRequestSchema = z.object({
  query: z.string().trim().max(140).optional(),
  branch: z.string().trim().max(64).optional(),
  courseTitle: z.string().trim().max(140).optional(),
  trackTitle: z.string().trim().max(140).optional(),
  level: z.string().trim().max(64).optional(),
  focusLanguage: z.string().trim().max(80).optional(),
  focusAreas: z.array(z.string().trim().min(2).max(80)).max(8).default([]),
  maxResults: z.coerce.number().int().min(1).max(12).optional(),
});

const courseQuestionRequestSchema = z.object({
  branch: z.string().trim().max(64).optional(),
  trackId: z.string().trim().max(120).optional(),
  trackTitle: z.string().trim().max(160).optional(),
  courseId: z.string().trim().max(120).optional(),
  courseTitle: z.string().trim().max(160).optional(),
  keywords: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const techNewsRequestSchema = z.object({
  branch: z.string().trim().max(64).optional(),
  strongestLanguage: z.string().trim().max(80).optional(),
  focusLanguage: z.string().trim().max(80).optional(),
  topMistakes: z.array(z.string().trim().min(2).max(120)).max(12).default([]),
  recentProblemTitles: z.array(z.string().trim().min(2).max(180)).max(16).default([]),
  techViseTags: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  maxPersonalized: z.coerce.number().int().min(2).max(20).optional().default(8),
  maxGeneral: z.coerce.number().int().min(2).max(20).optional().default(8),
});

const knowledgeGraphRecentSessionSchema = z.object({
  problemId: z.string().trim().max(140).optional(),
  problemTitle: z.string().trim().min(2).max(180),
  topicId: z.string().trim().max(120).optional(),
  topicTitle: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(80),
  passedTests: z.coerce.number().int().min(0).max(1_000),
  totalTests: z.coerce.number().int().min(0).max(1_000),
  tookMs: z.coerce.number().int().min(0).max(300_000),
});

const knowledgeGraphRequestSchema = z.object({
  userId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  branch: z.string().trim().min(1).max(64),
  strongestLanguage: z.string().trim().max(80).optional(),
  focusLanguage: z.string().trim().max(80).optional(),
  topMistakes: z.array(aiMistakePatternSchema).max(20).default([]),
  recentSessions: z.array(knowledgeGraphRecentSessionSchema).max(40).default([]),
  techViseTags: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
  targetCompanies: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  solvedProblems: z.coerce.number().int().min(0).max(1_000_000).optional(),
  totalRuns: z.coerce.number().int().min(0).max(1_000_000).optional(),
  acceptanceRate: z.coerce.number().int().min(0).max(100).optional(),
});

export const buildServer = async () => {
  const app = Fastify({
    logger: {
      level: serverConfig.nodeEnv === "production" ? "info" : "debug",
    },
    trustProxy: true,
    requestTimeout: serverConfig.requestTimeoutMs,
    keepAliveTimeout: serverConfig.keepAliveTimeoutMs,
    routerOptions: {
      maxParamLength: 128,
    },
  });

  let redisClient: Redis | null = null;
  if (serverConfig.redisUrl) {
    try {
      redisClient = new Redis(serverConfig.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
      });

      await redisClient.ping();
      app.log.info("Redis connected for distributed cache/rate limiting");
    } catch (error) {
      app.log.warn(
        { err: error },
        "Redis connection failed. Continuing with in-memory-only stability mode.",
      );
      if (redisClient) {
        await redisClient.quit().catch(() => undefined);
      }
      redisClient = null;
    }
  }

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    maxAge: 3600,
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(compress, {
    global: true,
    encodings: ["gzip", "deflate", "br"],
    threshold: 1024,
  });

  await app.register(rateLimit, {
    global: true,
    max: serverConfig.rateLimitMaxPerMinute,
    timeWindow: "1 minute",
    ...(redisClient ? { redis: redisClient } : {}),
  });

  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 512 * 1024 * 1024,
    maxRssBytes: 1024 * 1024 * 1024,
    message: "Server is busy. Please retry shortly.",
    retryAfter: 30,
    exposeStatusRoute: false,
  });

  const metrics: RuntimeMetrics = {
    startedAt: Date.now(),
    totalRequests: 0,
    totalSearchRequests: 0,
    totalCodeExecutionRequests: 0,
    totalAiProfileRequests: 0,
    totalAiGapRequests: 0,
    totalAiHintRequests: 0,
    totalQuestionRecommendationRequests: 0,
    totalLearningVideoRequests: 0,
    totalTechNewsRequests: 0,
    totalKnowledgeGraphRequests: 0,
    techNewsCacheHits: 0,
    techNewsCacheMisses: 0,
    questionCacheHits: 0,
    questionCacheMisses: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalErrors: 0,
  };

  const explicitExecutionUrl = serverConfig.codeExecutionApiUrl.trim();
  const fallbackExecutionUrl = serverConfig.codeExecutionFallbackApiUrl.trim();
  const usingFallbackProvider =
    explicitExecutionUrl.length === 0 &&
    serverConfig.codeExecutionFallbackEnabled &&
    fallbackExecutionUrl.length > 0;
  const usingLocalExecutionOnly =
    explicitExecutionUrl.length === 0 &&
    (!serverConfig.codeExecutionFallbackEnabled || fallbackExecutionUrl.length === 0);

  const resolvedExecutionProvider = explicitExecutionUrl
    ? serverConfig.codeExecutionProvider
    : usingFallbackProvider
      ? serverConfig.codeExecutionFallbackProvider
      : "local-js";
  const resolvedExecutionApiUrl = explicitExecutionUrl
    ? explicitExecutionUrl
    : usingFallbackProvider
      ? fallbackExecutionUrl
      : serverConfig.codeExecutionFallbackEnabled
        ? "local://javascript-sandbox"
        : "";

  const codeExecutionClient = resolvedExecutionApiUrl
    ? new CodeExecutionClient({
        provider: resolvedExecutionProvider,
        apiUrl: resolvedExecutionApiUrl,
        apiKey: serverConfig.codeExecutionApiKey,
        apiHost: serverConfig.codeExecutionApiHost,
        requestTimeoutMs: serverConfig.codeExecutionRequestTimeoutMs,
        pollIntervalMs: serverConfig.codeExecutionPollIntervalMs,
        pollAttempts: serverConfig.codeExecutionPollAttempts,
      })
    : null;
  const localExecutionFallbackClient =
    serverConfig.codeExecutionFallbackEnabled && resolvedExecutionProvider !== "local-js"
      ? new CodeExecutionClient({
          provider: "local-js",
          apiUrl: "local://javascript-sandbox",
          requestTimeoutMs: serverConfig.codeExecutionRequestTimeoutMs,
          pollIntervalMs: serverConfig.codeExecutionPollIntervalMs,
          pollAttempts: serverConfig.codeExecutionPollAttempts,
        })
      : null;

  const executionProviders = [
    ...(codeExecutionClient ? [resolvedExecutionProvider] : []),
    ...(localExecutionFallbackClient ? ["local-js"] : []),
  ];
  const executionLanguageNameCache = new Map<number, string>();

  if (usingFallbackProvider || usingLocalExecutionOnly) {
    app.log.info(
      { provider: resolvedExecutionProvider, apiUrl: resolvedExecutionApiUrl, fallbackChain: executionProviders },
      "Code execution fallback enabled",
    );
  }
  const aiCoachClient = serverConfig.openAiApiKey
    ? new OpenAiCoachClient({
        apiUrl: serverConfig.openAiApiUrl,
        apiKey: serverConfig.openAiApiKey,
        model: serverConfig.openAiModel,
        requestTimeoutMs: serverConfig.openAiRequestTimeoutMs,
        maxContextChars: serverConfig.openAiMaxContextChars,
      })
    : null;
  const youTubeLearningClient = serverConfig.youtubeApiKey
    ? new YouTubeLearningClient({
        apiUrl: serverConfig.youtubeApiUrl,
        apiKey: serverConfig.youtubeApiKey,
        defaultMaxResults: serverConfig.youtubeDefaultMaxResults,
        requestTimeoutMs: serverConfig.youtubeRequestTimeoutMs,
      })
    : null;

  const searchEngine = new CatalogSearchEngine(tracks);
  const searchCache = new SearchCache<SearchResponsePayload>({
    maxEntries: serverConfig.searchCacheMaxEntries,
    ttlMs: serverConfig.searchCacheTtlMs,
    redis: redisClient ?? undefined,
    redisKeyPrefix: serverConfig.searchCacheRedisKeyPrefix,
  });
  const questionCache = new SearchCache<QuestionRecommendationPayload>({
    maxEntries: Math.max(200, Math.floor(serverConfig.searchCacheMaxEntries / 2)),
    ttlMs: Math.max(60_000, serverConfig.searchCacheTtlMs * 3),
    redis: redisClient ?? undefined,
    redisKeyPrefix: "questions:",
  });
  const techNewsCache = new SearchCache<TechNewsCachePayload>({
    maxEntries: Math.max(200, Math.floor(serverConfig.searchCacheMaxEntries / 3)),
    ttlMs: Math.max(120_000, serverConfig.searchCacheTtlMs * 6),
    redis: redisClient ?? undefined,
    redisKeyPrefix: "tech-news:",
  });
  const codeExecutionLimiter = createLimiter(
    "code-execution",
    serverConfig.maxConcurrentCodeExecRequests,
  );
  const aiLimiter = createLimiter("ai-coach", serverConfig.maxConcurrentAiRequests);
  const videoLimiter = createLimiter("learning-videos", serverConfig.maxConcurrentVideoRequests);
  const techNewsLimiter = createLimiter("tech-news", serverConfig.maxConcurrentTechNewsRequests);
  const questionLimiter = createLimiter(
    "question-recommendations",
    serverConfig.maxConcurrentQuestionRequests,
  );

  const tryEnterLimiter = (limiter: EndpointConcurrencyLimiter): boolean => {
    if (limiter.active >= limiter.limit) {
      limiter.rejected += 1;
      return false;
    }

    limiter.active += 1;
    limiter.peakActive = Math.max(limiter.peakActive, limiter.active);
    return true;
  };

  const leaveLimiter = (limiter: EndpointConcurrencyLimiter): void => {
    limiter.active = Math.max(0, limiter.active - 1);
  };

  let ready = true;

  app.addHook("onRequest", async () => {
    metrics.totalRequests += 1;
  });

  app.setErrorHandler((error, request, reply) => {
    metrics.totalErrors += 1;
    request.log.error({ err: error }, "Request failed");
    if (reply.sent) {
      return;
    }

    reply.code(500).send({
      error: "Internal server error",
    });
  });

  app.get("/healthz", async () => ({
    status: "ok",
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  }));

  app.get("/readyz", async (_, reply) => {
    if (!ready) {
      return reply.code(503).send({
        status: "not_ready",
      });
    }

    return {
      status: "ready",
      indexedTracks: tracks.length,
      cacheEntries: searchCache.size(),
      questionCacheEntries: questionCache.size(),
      techNewsCacheEntries: techNewsCache.size(),
      cacheMode: searchCache.kind(),
      redisConnected: Boolean(redisClient),
      codeExecutionConfigured: Boolean(codeExecutionClient || localExecutionFallbackClient),
      codeExecutionProvider: codeExecutionClient
        ? resolvedExecutionProvider
        : localExecutionFallbackClient
          ? "local-js"
          : null,
      codeExecutionFallbackChain: executionProviders,
      aiCoachConfigured: Boolean(aiCoachClient),
      youTubeConfigured: Boolean(youTubeLearningClient),
      limiterStatus: [
        limiterSnapshot(codeExecutionLimiter),
        limiterSnapshot(aiLimiter),
        limiterSnapshot(videoLimiter),
        limiterSnapshot(techNewsLimiter),
        limiterSnapshot(questionLimiter),
      ],
    };
  });

  app.get("/metrics", async () => ({
    uptimeSec: Math.round((Date.now() - metrics.startedAt) / 1000),
    ...metrics,
    cacheEntries: searchCache.size(),
    questionCacheEntries: questionCache.size(),
    techNewsCacheEntries: techNewsCache.size(),
    cacheMode: searchCache.kind(),
    redisConnected: Boolean(redisClient),
    codeExecutionConfigured: Boolean(codeExecutionClient || localExecutionFallbackClient),
    codeExecutionProvider: codeExecutionClient
      ? resolvedExecutionProvider
      : localExecutionFallbackClient
        ? "local-js"
        : null,
    codeExecutionFallbackChain: executionProviders,
    aiCoachConfigured: Boolean(aiCoachClient),
    youTubeConfigured: Boolean(youTubeLearningClient),
    limiterStatus: [
      limiterSnapshot(codeExecutionLimiter),
      limiterSnapshot(aiLimiter),
      limiterSnapshot(videoLimiter),
      limiterSnapshot(techNewsLimiter),
      limiterSnapshot(questionLimiter),
    ],
  }));

  app.get("/api/search", async (request, reply) => {
    metrics.totalSearchRequests += 1;

    const parsedQuery = searchQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "Invalid query parameters",
        details: parsedQuery.error.flatten(),
      });
    }

    const { q, type, branch, limit } = parsedQuery.data;
    const normalizedBranch = branch?.toLowerCase();
    const cacheKey = `${q.toLowerCase()}|${type}|${normalizedBranch ?? ""}|${limit}`;

    const cached = await searchCache.get(cacheKey);
    if (cached) {
      metrics.cacheHits += 1;
      return {
        ...cached,
        cache: "hit" as const,
      };
    }

    metrics.cacheMisses += 1;
    const startedAt = Date.now();
    const searchOptions: SearchOptions = {
      type,
      branch: normalizedBranch,
      limit,
    };
    const result = searchEngine.search(q, searchOptions);

    const payload: SearchResponsePayload = {
      query: q,
      tookMs: Date.now() - startedAt,
      total: result.total,
      results: result.results,
      cache: "miss",
    };

    await searchCache.set(cacheKey, payload);
    return payload;
  });

  app.get("/api/code/languages", async (_, reply) => {
    if (!codeExecutionClient && !localExecutionFallbackClient) {
      return reply.code(503).send({
        error: "Code execution provider is not configured",
        hint: "Set CODE_EXEC_API_URL and optional key env vars.",
      });
    }

    const cacheLanguages = (languages: Array<{ id: number; name: string }>) => {
      executionLanguageNameCache.clear();
      for (const language of languages) {
        executionLanguageNameCache.set(language.id, language.name);
      }
    };

    try {
      if (codeExecutionClient) {
        const languages = await codeExecutionClient.listLanguages();
        cacheLanguages(languages);
        return {
          total: languages.length,
          provider: resolvedExecutionProvider,
          languages,
        };
      }

      if (localExecutionFallbackClient) {
        const languages = await localExecutionFallbackClient.listLanguages();
        cacheLanguages(languages);
        return {
          total: languages.length,
          provider: "local-js",
          languages,
        };
      }

      throw new Error("No execution providers available");
    } catch (primaryError) {
      app.log.warn({ err: primaryError }, "Primary execution provider language fetch failed");
      if (!localExecutionFallbackClient) {
        app.log.error({ err: primaryError }, "Failed to fetch execution languages");
        return reply.code(502).send({
          error: "Execution provider unavailable",
        });
      }

      try {
        const fallbackLanguages = await localExecutionFallbackClient.listLanguages();
        cacheLanguages(fallbackLanguages);
        return {
          total: fallbackLanguages.length,
          provider: "local-js",
          fallbackFrom: resolvedExecutionProvider,
          languages: fallbackLanguages,
        };
      } catch (fallbackError) {
        app.log.error(
          { err: fallbackError, primaryErr: primaryError },
          "Failed to fetch execution languages from all providers",
        );
        return reply.code(502).send({
          error: "Execution provider unavailable",
        });
      }
    }
  });

  const isJavaScriptLanguage = (languageName?: string): boolean => {
    if (!languageName) return false;
    const normalized = languageName.toLowerCase();
    return normalized.includes("javascript") || normalized.includes("node.js");
  };

  app.post("/api/code/execute", async (request, reply) => {
    metrics.totalCodeExecutionRequests += 1;

    if (!codeExecutionClient && !localExecutionFallbackClient) {
      return reply.code(503).send({
        error: "Code execution provider is not configured",
        hint: "Set CODE_EXEC_API_URL and optional key env vars.",
      });
    }

    const parsedPayload = codeExecutionRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid execution request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(codeExecutionLimiter)) {
      return reply.code(503).header("Retry-After", "2").send({
        error: "Code execution is handling high load. Retry shortly.",
      });
    }

    const payload = parsedPayload.data;
    const startedAt = Date.now();

    try {
      let selectedLanguageName = executionLanguageNameCache.get(payload.languageId);

      if (!selectedLanguageName && codeExecutionClient) {
        try {
          const languages = await codeExecutionClient.listLanguages();
          executionLanguageNameCache.clear();
          for (const language of languages) {
            executionLanguageNameCache.set(language.id, language.name);
          }
          selectedLanguageName = executionLanguageNameCache.get(payload.languageId);
        } catch (languageWarmupError) {
          app.log.warn({ err: languageWarmupError }, "Language metadata warmup failed before execution");
        }
      }

      try {
        if (!codeExecutionClient) {
          throw new Error("Primary provider unavailable");
        }
        const results = await codeExecutionClient.execute({
          languageId: payload.languageId,
          sourceCode: payload.sourceCode,
          testCases: payload.testCases,
        });

        const passedCount = results.filter((result) => result.passed).length;
        return {
          total: results.length,
          passedCount,
          tookMs: Date.now() - startedAt,
          provider: resolvedExecutionProvider,
          results,
        };
      } catch (primaryError) {
        app.log.warn({ err: primaryError }, "Primary code execution failed");

        if (!localExecutionFallbackClient) {
          app.log.error({ err: primaryError }, "Code execution failed");
          return reply.code(502).send({
            error: "Code execution failed",
          });
        }

        const canRunOnLocal =
          payload.languageId === 1 || isJavaScriptLanguage(selectedLanguageName);
        if (!canRunOnLocal) {
          return reply.code(502).send({
            error:
              "Primary compiler failed and local fallback only supports JavaScript runtimes. Retry with JavaScript or restore provider connectivity.",
          });
        }

        try {
          const results = await localExecutionFallbackClient.execute({
            languageId: 1,
            sourceCode: payload.sourceCode,
            testCases: payload.testCases,
          });
          const passedCount = results.filter((result) => result.passed).length;
          return {
            total: results.length,
            passedCount,
            tookMs: Date.now() - startedAt,
            provider: "local-js",
            fallbackFrom: resolvedExecutionProvider,
            results,
          };
        } catch (fallbackError) {
          app.log.error(
            { err: fallbackError, primaryErr: primaryError },
            "Code execution failed on all providers",
          );
          return reply.code(502).send({
            error: "Code execution failed",
          });
        }
      }
    } finally {
      leaveLimiter(codeExecutionLimiter);
    }
  });

  app.post("/api/news/tech", async (request, reply) => {
    metrics.totalTechNewsRequests += 1;

    const parsedPayload = techNewsRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid tech news request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(techNewsLimiter)) {
      return reply.code(503).header("Retry-After", "3").send({
        error: "Tech news feed is under high load. Retry in a moment.",
      });
    }

    try {
      const payload = parsedPayload.data;
      const cacheKey = JSON.stringify({
        branch: payload.branch ?? "",
        strongestLanguage: payload.strongestLanguage ?? "",
        focusLanguage: payload.focusLanguage ?? "",
        topMistakes: payload.topMistakes,
        recentProblemTitles: payload.recentProblemTitles,
        techViseTags: payload.techViseTags,
        maxPersonalized: payload.maxPersonalized,
        maxGeneral: payload.maxGeneral,
      });

      const cached = await techNewsCache.get(cacheKey);
      if (cached) {
        metrics.techNewsCacheHits += 1;
        return {
          ...cached,
          cache: "hit" as const,
        };
      }

      metrics.techNewsCacheMisses += 1;
      try {
        const feed = await collectTechNewsFeed({
          request: {
            branch: payload.branch,
            strongestLanguage: payload.strongestLanguage,
            focusLanguage: payload.focusLanguage,
            topMistakes: payload.topMistakes,
            recentProblemTitles: payload.recentProblemTitles,
            techViseTags: payload.techViseTags,
            maxPersonalized: payload.maxPersonalized,
            maxGeneral: payload.maxGeneral,
          },
          requestTimeoutMs: Math.min(8_000, serverConfig.requestTimeoutMs),
        });

        const responsePayload: TechNewsCachePayload = {
          ...feed,
          cache: "miss",
        };

        await techNewsCache.set(cacheKey, responsePayload);
        return responsePayload;
      } catch (error) {
        app.log.error({ err: error }, "Tech news feed generation failed");
        return reply.code(502).send({
          error: "Tech news feed unavailable",
        });
      }
    } finally {
      leaveLimiter(techNewsLimiter);
    }
  });

  app.post("/api/graph/learning", async (request, reply) => {
    metrics.totalKnowledgeGraphRequests += 1;

    const parsedPayload = knowledgeGraphRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid knowledge graph request",
        details: parsedPayload.error.flatten(),
      });
    }

    try {
      const graph = buildLearningKnowledgeGraph(parsedPayload.data);
      return graph;
    } catch (error) {
      app.log.error({ err: error }, "Knowledge graph generation failed");
      return reply.code(502).send({
        error: "Knowledge graph generation failed",
      });
    }
  });

  app.post("/api/ai/profile-insight", async (request, reply) => {
    metrics.totalAiProfileRequests += 1;

    if (!aiCoachClient) {
      return reply.code(503).send({
        error: "AI coach is not configured",
        hint: "Set OPENAI_API_KEY and optional OPENAI_* env vars.",
      });
    }

    const parsedPayload = profileInsightRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid profile insight request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(aiLimiter)) {
      return reply.code(503).header("Retry-After", "2").send({
        error: "AI coach is handling high load. Retry shortly.",
      });
    }

    try {
      const profile = await aiCoachClient.generateProfileInsight(parsedPayload.data);
      return {
        profile,
      };
    } catch (error) {
      app.log.error({ err: error }, "AI profile insight generation failed");
      return reply.code(502).send({
        error: "AI profile insight unavailable",
      });
    } finally {
      leaveLimiter(aiLimiter);
    }
  });

  app.post("/api/ai/gap-analysis", async (request, reply) => {
    metrics.totalAiGapRequests += 1;

    if (!aiCoachClient) {
      return reply.code(503).send({
        error: "AI coach is not configured",
        hint: "Set OPENAI_API_KEY and optional OPENAI_* env vars.",
      });
    }

    const parsedPayload = gapAnalysisRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid gap analysis request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(aiLimiter)) {
      return reply.code(503).header("Retry-After", "2").send({
        error: "AI coach is handling high load. Retry shortly.",
      });
    }

    try {
      const analysis = await aiCoachClient.generateGapAnalysis(parsedPayload.data);
      return {
        analysis,
      };
    } catch (error) {
      app.log.error({ err: error }, "AI gap analysis generation failed");
      return reply.code(502).send({
        error: "AI gap analysis unavailable",
      });
    } finally {
      leaveLimiter(aiLimiter);
    }
  });

  app.post("/api/ai/hint", async (request, reply) => {
    metrics.totalAiHintRequests += 1;

    if (!aiCoachClient) {
      return reply.code(503).send({
        error: "AI coach is not configured",
        hint: "Set OPENAI_API_KEY and optional OPENAI_* env vars.",
      });
    }

    const parsedPayload = hintRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid hint request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(aiLimiter)) {
      return reply.code(503).header("Retry-After", "2").send({
        error: "AI coach is handling high load. Retry shortly.",
      });
    }

    try {
      const hint = await aiCoachClient.generateHint(parsedPayload.data);
      return {
        hint,
      };
    } catch (error) {
      app.log.error({ err: error }, "AI hint generation failed");
      return reply.code(502).send({
        error: "AI hint unavailable",
      });
    } finally {
      leaveLimiter(aiLimiter);
    }
  });

  app.post("/api/learning/videos", async (request, reply) => {
    metrics.totalLearningVideoRequests += 1;

    const parsedPayload = learningVideosRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid learning videos request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(videoLimiter)) {
      return reply.code(503).header("Retry-After", "2").send({
        error: "Learning videos are under high load. Retry shortly.",
      });
    }

    try {
      const {
        query,
        branch,
        courseTitle,
        trackTitle,
        level,
        focusLanguage,
        focusAreas,
        maxResults,
      } = parsedPayload.data;

      const baseTerms = [
        courseTitle,
        trackTitle,
        focusLanguage,
        focusAreas[0],
        focusAreas[1],
        branch,
        level,
      ]
        .filter((value): value is string => Boolean(value && value.trim().length > 0))
        .map((value) => value.trim());

      const fallbackCore = baseTerms.join(" ").trim();
      const fallbackQuery = fallbackCore
        ? `${fallbackCore} tutorial`
        : `${branch?.trim() || "software engineering"} coding tutorial`;

      const candidateQueries = Array.from(
        new Set(
          [
            query?.trim(),
            courseTitle ? `${courseTitle} ${focusLanguage ?? ""} tutorial`.trim() : "",
            trackTitle ? `${trackTitle} practical project tutorial`.trim() : "",
            `${focusLanguage ?? "programming"} ${focusAreas[0] ?? "problem solving"} tutorial`.trim(),
            fallbackQuery,
          ].filter((value): value is string => Boolean(value && value.length > 0)),
        ),
      );

      const requestedCount = maxResults ?? serverConfig.youtubeDefaultMaxResults;
      const primaryQuery = candidateQueries[0] ?? fallbackQuery;
      const fallbackVideos = getFallbackLearningVideos({
        query: primaryQuery,
        branch,
        courseTitle,
        trackTitle,
        level,
        focusLanguage,
        focusAreas,
        maxResults: requestedCount,
      });

      if (!youTubeLearningClient) {
        return {
          query: primaryQuery,
          queriesUsed: candidateQueries,
          source: "fallback",
          total: fallbackVideos.length,
          videos: fallbackVideos,
        };
      }

      try {
        const mergedVideos: LearningVideo[] = [];
        const seen = new Set<string>();

        for (const [index, candidateQuery] of candidateQueries.entries()) {
          if (mergedVideos.length >= requestedCount) break;

          const candidateVideos = await youTubeLearningClient.searchVideos({
            query: candidateQuery,
            maxResults: Math.min(12, requestedCount + 4),
            videoDuration: index === 0 ? "medium" : "any",
          });

          for (const video of candidateVideos) {
            if (seen.has(video.videoId)) continue;
            seen.add(video.videoId);
            mergedVideos.push(video);
            if (mergedVideos.length >= requestedCount) break;
          }
        }
        for (const fallback of fallbackVideos) {
          if (seen.has(fallback.videoId)) continue;
          seen.add(fallback.videoId);
          mergedVideos.push(fallback);
          if (mergedVideos.length >= requestedCount) break;
        }

        return {
          query: primaryQuery,
          queriesUsed: candidateQueries,
          source: "youtube",
          total: mergedVideos.length,
          videos: mergedVideos.slice(0, requestedCount),
        };
      } catch (error) {
        app.log.error({ err: error }, "YouTube learning video fetch failed");
        return {
          query: primaryQuery,
          queriesUsed: candidateQueries,
          source: "fallback",
          total: fallbackVideos.length,
          videos: fallbackVideos,
        };
      }
    } finally {
      leaveLimiter(videoLimiter);
    }
  });

  app.post("/api/questions/recommendations", async (request, reply) => {
    metrics.totalQuestionRecommendationRequests += 1;

    const parsedPayload = courseQuestionRequestSchema.safeParse(request.body);
    if (!parsedPayload.success) {
      return reply.code(400).send({
        error: "Invalid question recommendation request",
        details: parsedPayload.error.flatten(),
      });
    }

    if (!tryEnterLimiter(questionLimiter)) {
      return reply.code(503).header("Retry-After", "2").send({
        error: "Question recommendations are under high load. Retry shortly.",
      });
    }

    try {
      const normalizedKeywords = [...parsedPayload.data.keywords]
        .map((entry) => entry.toLowerCase())
        .sort();
      const cacheKey = JSON.stringify({
        branch: parsedPayload.data.branch?.toLowerCase() ?? "",
        trackId: parsedPayload.data.trackId ?? "",
        trackTitle: parsedPayload.data.trackTitle?.toLowerCase() ?? "",
        courseId: parsedPayload.data.courseId ?? "",
        courseTitle: parsedPayload.data.courseTitle?.toLowerCase() ?? "",
        keywords: normalizedKeywords,
        limit: parsedPayload.data.limit ?? 10,
      });

      const cached = await questionCache.get(cacheKey);
      if (cached) {
        metrics.questionCacheHits += 1;
        return cached;
      }
      metrics.questionCacheMisses += 1;

      try {
        const result = await collectCourseQuestions({
          branch: parsedPayload.data.branch,
          trackId: parsedPayload.data.trackId,
          trackTitle: parsedPayload.data.trackTitle,
          courseId: parsedPayload.data.courseId,
          courseTitle: parsedPayload.data.courseTitle,
          keywords: parsedPayload.data.keywords,
          limit: parsedPayload.data.limit ?? 10,
        });

        const payload: QuestionRecommendationPayload = {
          query: result.query,
          source: result.source,
          sources: result.sources,
          total: result.results.length,
          results: result.results,
        };
        await questionCache.set(cacheKey, payload);
        return payload;
      } catch (error) {
        app.log.error({ err: error }, "Question recommendation fetch failed");
        return reply.code(502).send({
          error: "Question recommendations unavailable",
        });
      }
    } finally {
      leaveLimiter(questionLimiter);
    }
  });

  app.addHook("onClose", async () => {
    ready = false;
    if (redisClient) {
      await redisClient.quit().catch(() => undefined);
      redisClient = null;
    }
  });

  return app;
};
