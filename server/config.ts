const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const asProvider = (
  value: string | undefined,
  fallback: "judge0" | "rapidapi-judge0" | "piston" | "local-js" = "judge0",
): "judge0" | "rapidapi-judge0" | "piston" | "local-js" => {
  if (value === "local-js") return "local-js";
  if (value === "piston") return "piston";
  if (value === "rapidapi-judge0") return "rapidapi-judge0";
  if (value === "judge0") return "judge0";
  return fallback;
};

export const serverConfig = {
  host: process.env.HOST ?? "0.0.0.0",
  port: toNumber(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  requestTimeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 12_000),
  keepAliveTimeoutMs: toNumber(process.env.KEEP_ALIVE_TIMEOUT_MS, 72_000),
  maxSearchResults: toNumber(process.env.MAX_SEARCH_RESULTS, 50),
  searchCacheTtlMs: toNumber(process.env.SEARCH_CACHE_TTL_MS, 30_000),
  searchCacheMaxEntries: toNumber(process.env.SEARCH_CACHE_MAX_ENTRIES, 2_000),
  searchCacheRedisKeyPrefix: process.env.SEARCH_CACHE_REDIS_KEY_PREFIX ?? "search:",
  rateLimitMaxPerMinute: toNumber(process.env.RATE_LIMIT_MAX_PER_MINUTE, 300),
  maxConcurrentCodeExecRequests: toNumber(process.env.MAX_CONCURRENT_CODE_EXEC_REQUESTS, 36),
  maxConcurrentAiRequests: toNumber(process.env.MAX_CONCURRENT_AI_REQUESTS, 24),
  maxConcurrentVideoRequests: toNumber(process.env.MAX_CONCURRENT_VIDEO_REQUESTS, 28),
  maxConcurrentTechNewsRequests: toNumber(process.env.MAX_CONCURRENT_TECH_NEWS_REQUESTS, 18),
  maxConcurrentQuestionRequests: toNumber(process.env.MAX_CONCURRENT_QUESTION_REQUESTS, 20),
  redisUrl: process.env.REDIS_URL,
  codeExecutionProvider: asProvider(process.env.CODE_EXEC_PROVIDER, "judge0"),
  codeExecutionFallbackProvider: asProvider(process.env.CODE_EXEC_FALLBACK_PROVIDER, "local-js"),
  codeExecutionApiUrl: process.env.CODE_EXEC_API_URL ?? "",
  codeExecutionFallbackEnabled: toBoolean(
    process.env.CODE_EXEC_ENABLE_FALLBACK,
    process.env.NODE_ENV !== "test",
  ),
  codeExecutionFallbackApiUrl:
    process.env.CODE_EXEC_FALLBACK_API_URL ?? "",
  codeExecutionApiKey: process.env.CODE_EXEC_API_KEY,
  codeExecutionApiHost: process.env.CODE_EXEC_API_HOST,
  codeExecutionRequestTimeoutMs: toNumber(process.env.CODE_EXEC_REQUEST_TIMEOUT_MS, 12_000),
  codeExecutionPollIntervalMs: toNumber(process.env.CODE_EXEC_POLL_INTERVAL_MS, 700),
  codeExecutionPollAttempts: toNumber(process.env.CODE_EXEC_POLL_ATTEMPTS, 20),
  codeExecutionMaxTestCases: toNumber(process.env.CODE_EXEC_MAX_TEST_CASES, 20),
  codeExecutionMaxSourceChars: toNumber(process.env.CODE_EXEC_MAX_SOURCE_CHARS, 20_000),
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiApiUrl: process.env.OPENAI_API_URL ?? "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openAiRequestTimeoutMs: toNumber(process.env.OPENAI_REQUEST_TIMEOUT_MS, 18_000),
  openAiMaxContextChars: toNumber(process.env.OPENAI_MAX_CONTEXT_CHARS, 12_000),
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  youtubeApiUrl: process.env.YOUTUBE_API_URL ?? "https://www.googleapis.com/youtube/v3",
  youtubeDefaultMaxResults: toNumber(process.env.YOUTUBE_DEFAULT_MAX_RESULTS, 6),
  youtubeRequestTimeoutMs: toNumber(process.env.YOUTUBE_REQUEST_TIMEOUT_MS, 10_000),
};
