interface HackerNewsSearchHit {
  objectID?: string;
  title?: string;
  url?: string;
  story_url?: string;
  created_at?: string;
  points?: number;
  num_comments?: number;
}

interface HackerNewsSearchPayload {
  hits?: HackerNewsSearchHit[];
}

export interface TechNewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  score: number;
  relevance: "personalized" | "general";
  query: string;
}

export interface TechNewsRequest {
  branch?: string;
  strongestLanguage?: string;
  focusLanguage?: string;
  topMistakes?: string[];
  recentProblemTitles?: string[];
  techViseTags?: string[];
  maxPersonalized: number;
  maxGeneral: number;
}

export interface TechNewsFeed {
  source: "live" | "fallback";
  personalizedQueries: string[];
  generalQueries: string[];
  personalizedCount: number;
  generalCount: number;
  total: number;
  articles: TechNewsArticle[];
}

interface FallbackNewsSeed {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  tags: string[];
}

const HACKER_NEWS_SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date";

const TECH_RELEVANCE_REGEX =
  /(ai|ml|software|developer|engineering|code|coding|cloud|security|cyber|database|devops|javascript|typescript|python|java|rust|go|kubernetes|docker|linux|open source|chip|semiconductor|gpu|startup|api|web)/i;

const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "that",
  "this",
  "from",
  "into",
  "about",
  "after",
  "before",
  "your",
  "their",
  "have",
  "using",
  "error",
  "errors",
  "wrong",
  "answer",
  "runtime",
  "compile",
  "compilation",
  "time",
  "limit",
]);

const BRANCH_TOPICS: Record<string, string[]> = {
  cse: ["software engineering", "system design", "backend scaling"],
  ece: ["semiconductor", "embedded systems", "chip design"],
  ee: ["power electronics", "firmware", "embedded software"],
  data_science: ["machine learning", "data engineering", "ai tooling"],
};

const GENERAL_TECH_QUERIES = [
  "software engineering",
  "artificial intelligence",
  "cloud infrastructure",
  "cybersecurity",
  "open source",
  "developer tools",
];

const fallbackSeeds: FallbackNewsSeed[] = [
  {
    id: "news-ai-open-models",
    title: "Open-source AI models are reshaping enterprise tooling",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    publishedAt: "2026-02-12T08:30:00.000Z",
    summary: "Teams are integrating open models in coding workflows with tighter infra control.",
    tags: ["ai", "open source", "developer tools", "software engineering"],
  },
  {
    id: "news-cloud-cost",
    title: "Cloud cost optimization becomes a top backend priority",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    publishedAt: "2026-02-11T10:15:00.000Z",
    summary: "Engineering teams focus on observability and autoscaling policies to reduce spend.",
    tags: ["cloud", "backend", "devops", "scaling"],
  },
  {
    id: "news-cyber-zero-trust",
    title: "Zero-trust architecture trends in modern engineering orgs",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    publishedAt: "2026-02-10T12:05:00.000Z",
    summary: "Security-first design is now influencing API and service boundary decisions.",
    tags: ["cybersecurity", "backend", "architecture"],
  },
  {
    id: "news-semiconductor-ai",
    title: "Chip design and AI acceleration enter a new competition cycle",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    publishedAt: "2026-02-09T14:20:00.000Z",
    summary: "Semiconductor and systems engineers see rising demand in AI workloads.",
    tags: ["semiconductor", "chip design", "gpu", "ece"],
  },
  {
    id: "news-web-runtime",
    title: "New web runtime improvements boost full-stack performance",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    publishedAt: "2026-02-08T09:50:00.000Z",
    summary: "Developers report lower latency and faster cold starts in production APIs.",
    tags: ["web", "javascript", "typescript", "backend"],
  },
  {
    id: "news-k8s-platform",
    title: "Platform teams standardize Kubernetes deployment workflows",
    url: "https://news.ycombinator.com/",
    source: "Hacker News",
    publishedAt: "2026-02-07T16:42:00.000Z",
    summary: "Internal developer platforms are reducing deployment friction at scale.",
    tags: ["kubernetes", "devops", "platform engineering", "cloud"],
  },
];

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const unique = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
};

const toSearchParams = (query: string): string => {
  const params = new URLSearchParams({
    query,
    tags: "story",
    hitsPerPage: "16",
  });
  return params.toString();
};

const summarizeTitle = (title: string): string => {
  if (title.length <= 180) return title;
  return `${title.slice(0, 177)}...`;
};

const daysSince = (value: string): number => {
  const publishedAt = Date.parse(value);
  if (!Number.isFinite(publishedAt)) return 999;
  const deltaMs = Date.now() - publishedAt;
  return Math.max(0, deltaMs / (24 * 60 * 60 * 1000));
};

const scoreStory = ({
  title,
  summary,
  queryTokens,
  points,
  comments,
  publishedAt,
  relevanceBoost,
}: {
  title: string;
  summary: string;
  queryTokens: string[];
  points: number;
  comments: number;
  publishedAt: string;
  relevanceBoost: number;
}): number => {
  const loweredTitle = title.toLowerCase();
  const loweredSummary = summary.toLowerCase();
  let score = relevanceBoost;

  for (const token of queryTokens) {
    if (loweredTitle.includes(token)) score += 7;
    if (loweredSummary.includes(token)) score += 3;
  }

  if (TECH_RELEVANCE_REGEX.test(loweredTitle)) {
    score += 8;
  }

  score += Math.min(10, Math.max(0, points) / 40);
  score += Math.min(5, Math.max(0, comments) / 50);
  score += Math.max(0, 6 - daysSince(publishedAt) / 2);

  return Math.round(score * 100) / 100;
};

const safeUrl = (value?: string): string => {
  if (!value) return "https://news.ycombinator.com/";
  return value.trim() || "https://news.ycombinator.com/";
};

const fetchHackerNews = async ({
  query,
  relevance,
  timeoutMs,
}: {
  query: string;
  relevance: "personalized" | "general";
  timeoutMs: number;
}): Promise<TechNewsArticle[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${HACKER_NEWS_SEARCH_URL}?${toSearchParams(query)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as HackerNewsSearchPayload;
    const queryTokens = tokenize(query);

    return (payload.hits ?? [])
      .filter((hit) => typeof hit.title === "string" && hit.title.trim().length > 0)
      .map((hit) => {
        const title = hit.title?.trim() ?? "Untitled";
        const summary = summarizeTitle(title);
        const publishedAt = hit.created_at ?? new Date().toISOString();
        const points = Number.isFinite(hit.points) ? Number(hit.points) : 0;
        const comments = Number.isFinite(hit.num_comments) ? Number(hit.num_comments) : 0;

        return {
          id: `hn-${hit.objectID ?? Math.random().toString(36).slice(2, 10)}`,
          title,
          url: safeUrl(hit.url ?? hit.story_url),
          source: "Hacker News",
          publishedAt,
          summary,
          score: scoreStory({
            title,
            summary,
            queryTokens,
            points,
            comments,
            publishedAt,
            relevanceBoost: relevance === "personalized" ? 14 : 8,
          }),
          relevance,
          query,
        } satisfies TechNewsArticle;
      })
      .filter((article) => TECH_RELEVANCE_REGEX.test(`${article.title} ${article.summary}`))
      .sort((left, right) => right.score - left.score);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const extractRecentTopicTerms = (titles: string[]): string[] =>
  unique(
    titles
      .slice(0, 8)
      .flatMap((title) => tokenize(title))
      .filter((token) => token.length > 3),
  ).slice(0, 6);

const buildPersonalizedQueries = (request: TechNewsRequest): string[] => {
  const branchKey = request.branch?.trim().toLowerCase().replace(/-/g, "_") ?? "";
  const branchTopics = BRANCH_TOPICS[branchKey] ?? [];

  const directSignals = [
    request.focusLanguage,
    request.strongestLanguage,
    ...branchTopics,
    ...(request.techViseTags ?? []),
    ...(request.topMistakes ?? []),
    ...extractRecentTopicTerms(request.recentProblemTitles ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 2));

  return unique(
    directSignals.map((signal) => {
      if (signal.includes("news")) return signal;
      return `${signal} software engineering news`;
    }),
  ).slice(0, 7);
};

const fallbackArticlesForQuery = ({
  queries,
  relevance,
}: {
  queries: string[];
  relevance: "personalized" | "general";
}): TechNewsArticle[] => {
  const queryTokens = queries.flatMap((query) => tokenize(query));

  return fallbackSeeds
    .map((seed) => {
      const summary = seed.summary;
      const score = scoreStory({
        title: seed.title,
        summary,
        queryTokens,
        points: 120,
        comments: 44,
        publishedAt: seed.publishedAt,
        relevanceBoost: relevance === "personalized" ? 12 : 6,
      });

      return {
        id: seed.id,
        title: seed.title,
        url: seed.url,
        source: seed.source,
        publishedAt: seed.publishedAt,
        summary,
        score,
        relevance,
        query: queries[0] ?? "technology",
      } satisfies TechNewsArticle;
    })
    .sort((left, right) => right.score - left.score);
};

export const collectTechNewsFeed = async ({
  request,
  requestTimeoutMs,
}: {
  request: TechNewsRequest;
  requestTimeoutMs: number;
}): Promise<TechNewsFeed> => {
  const personalizedQueries = buildPersonalizedQueries(request);
  const generalQueries = GENERAL_TECH_QUERIES.slice(0, 5);
  const maxPersonalized = Math.max(2, Math.min(20, request.maxPersonalized));
  const maxGeneral = Math.max(2, Math.min(20, request.maxGeneral));

  const seen = new Set<string>();
  const personalized: TechNewsArticle[] = [];
  const general: TechNewsArticle[] = [];

  const pushUnique = (target: TechNewsArticle[], article: TechNewsArticle): void => {
    const key = `${article.url}|${article.title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    target.push(article);
  };

  const [personalizedSettled, generalSettled] = await Promise.all([
    Promise.allSettled(
      personalizedQueries.map((query) =>
        fetchHackerNews({
          query,
          relevance: "personalized",
          timeoutMs: requestTimeoutMs,
        }),
      ),
    ),
    Promise.allSettled(
      generalQueries.map((query) =>
        fetchHackerNews({
          query,
          relevance: "general",
          timeoutMs: requestTimeoutMs,
        }),
      ),
    ),
  ]);

  for (const result of personalizedSettled) {
    if (personalized.length >= maxPersonalized) break;
    if (result.status !== "fulfilled") continue;
    for (const story of result.value) {
      if (personalized.length >= maxPersonalized) break;
      pushUnique(personalized, story);
    }
  }

  for (const result of generalSettled) {
    if (general.length >= maxGeneral) break;
    if (result.status !== "fulfilled") continue;
    for (const story of result.value) {
      if (general.length >= maxGeneral) break;
      pushUnique(general, story);
    }
  }

  let source: "live" | "fallback" = "live";
  if (personalized.length === 0) {
    source = "fallback";
    for (const article of fallbackArticlesForQuery({
      queries: personalizedQueries.length > 0 ? personalizedQueries : ["software engineering"],
      relevance: "personalized",
    })) {
      if (personalized.length >= maxPersonalized) break;
      pushUnique(personalized, article);
    }
  }

  if (general.length === 0) {
    source = "fallback";
    for (const article of fallbackArticlesForQuery({
      queries: generalQueries,
      relevance: "general",
    })) {
      if (general.length >= maxGeneral) break;
      pushUnique(general, article);
    }
  }

  const articles = [...personalized, ...general].sort((left, right) => {
    if (left.relevance !== right.relevance) {
      return left.relevance === "personalized" ? -1 : 1;
    }
    if (right.score !== left.score) return right.score - left.score;
    return right.publishedAt.localeCompare(left.publishedAt);
  });

  return {
    source,
    personalizedQueries,
    generalQueries,
    personalizedCount: personalized.length,
    generalCount: general.length,
    total: articles.length,
    articles,
  };
};
