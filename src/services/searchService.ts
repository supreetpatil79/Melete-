import { tracks } from "@/data/tracks";
import { practiceProblemBank } from "@/data/practiceProblemBank";
import { companyRoadmaps } from "@/data/companyRoadmaps";
import { helpDocs } from "@/data/helpDocs";
import {
  CatalogSearchEngine,
  type SearchHit,
  type SearchOptions,
  type SearchRequestType,
  type SearchSuggestion,
} from "@/shared/catalogSearch";

interface SearchApiPayload {
  query: string;
  tookMs: number;
  total: number;
  results: SearchHit[];
  cache: "hit" | "miss";
  backend?: "local" | "elasticsearch" | "fallback-local";
}

interface SearchSuggestionApiPayload {
  query: string;
  tookMs: number;
  suggestions: SearchSuggestion[];
  cache: "hit" | "miss";
  backend?: "local" | "elasticsearch" | "fallback-local";
}

export interface SearchResponse {
  query: string;
  tookMs: number;
  total: number;
  results: SearchHit[];
  source: "api" | "fallback";
  backend?: "local" | "elasticsearch" | "fallback-local";
}

export interface SearchSuggestionResponse {
  query: string;
  tookMs: number;
  suggestions: SearchSuggestion[];
  source: "api" | "fallback";
  backend?: "local" | "elasticsearch" | "fallback-local";
}

export interface SearchRequest {
  q: string;
  type?: SearchRequestType;
  branch?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface SearchSuggestionRequest {
  q: string;
  type?: SearchRequestType;
  branch?: string;
  limit?: number;
  signal?: AbortSignal;
}

export type UnifiedSearchType = "problem" | "course" | "track" | "roadmap" | "help";

export interface UnifiedSearchHit {
  id: string;
  type: UnifiedSearchType;
  section: string;
  title: string;
  description: string;
  tags: string[];
  difficulty?: string;
  url: string;
  score: number;
  snippet: string;
  highlights: {
    title?: string[];
    description?: string[];
    tags?: string[];
  };
}

export interface UnifiedSearchResponse {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
  results: UnifiedSearchHit[];
  source: "api" | "fallback";
  backend?: "in-memory" | "elasticsearch" | "fallback-in-memory";
}

export interface UnifiedAutocompleteResponse {
  query: string;
  total: number;
  tookMs: number;
  results: UnifiedSearchHit[];
  source: "api" | "fallback";
  backend?: "in-memory" | "elasticsearch" | "fallback-in-memory";
}

interface UnifiedSearchApiPayload {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
  results: UnifiedSearchHit[];
  cache: "hit" | "miss";
  backend?: "in-memory" | "elasticsearch" | "fallback-in-memory";
}

interface UnifiedAutocompleteApiPayload {
  query: string;
  total: number;
  tookMs: number;
  results: UnifiedSearchHit[];
  cache: "hit" | "miss";
  backend?: "in-memory" | "elasticsearch" | "fallback-in-memory";
}

export interface UnifiedSearchRequest {
  q: string;
  page?: number;
  limit?: number;
  type?: UnifiedSearchType | "all";
  difficulty?: string;
  tags?: string[];
  userId?: string;
  signal?: AbortSignal;
}

export interface UnifiedAutocompleteRequest {
  q: string;
  limit?: number;
  type?: UnifiedSearchType | "all";
  userId?: string;
  signal?: AbortSignal;
}

interface UnifiedSearchDocument {
  id: string;
  type: UnifiedSearchType;
  section: string;
  title: string;
  description: string;
  tags: string[];
  difficulty?: string;
  url: string;
  popularity: number;
  userEngagement: number;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? "");
const searchEndpoint = `${apiBaseUrl}/api/search`;
const searchSuggestionEndpoint = `${apiBaseUrl}/api/search/suggest`;
const unifiedSearchEndpoint = `${apiBaseUrl}/search`;
const unifiedAutocompleteEndpoint = `${apiBaseUrl}/search/autocomplete`;
const unifiedReindexEndpoint = `${apiBaseUrl}/search/reindex`;
const searchEngagementEndpoint = `${apiBaseUrl}/search/engagement`;

let fallbackEngine: CatalogSearchEngine | null = null;
let unifiedFallbackDocuments: UnifiedSearchDocument[] | null = null;

const getFallbackEngine = () => {
  if (!fallbackEngine) {
    fallbackEngine = new CatalogSearchEngine(tracks);
  }
  return fallbackEngine;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string): string[] => normalizeText(value).split(" ").filter((token) => token.length > 1);

const synonyms: Record<string, string[]> = {
  dsa: ["data structures", "algorithms", "coding"],
  ai: ["artificial intelligence", "ml", "machine learning"],
  ui: ["frontend", "user interface", "ux"],
  backend: ["server", "api", "database"],
};

const expandTokens = (tokens: string[]): string[] => {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    expanded.add(token);
    for (const synonym of synonyms[token] ?? []) {
      for (const part of tokenize(synonym)) {
        expanded.add(part);
      }
    }
  }
  return [...expanded];
};

const highlightText = (text: string, rawTokens: string[]): string => {
  if (!text) return text;
  let result = text;
  for (const token of rawTokens) {
    const normalized = token.trim();
    if (normalized.length < 2) continue;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(${escaped})`, "ig"), "<em>$1</em>");
  }
  return result;
};

const mapRequestToOptions = (request: Pick<SearchRequest, "type" | "branch" | "limit">): SearchOptions => ({
  type: request.type,
  branch: request.branch,
  limit: request.limit,
});

const buildUnifiedFallbackDocuments = (): UnifiedSearchDocument[] => {
  const docs: UnifiedSearchDocument[] = [];
  for (const track of tracks) {
    docs.push({
      id: `track:${track.id}`,
      type: "track",
      section: "Tracks",
      title: track.title,
      description: track.description,
      tags: ["track", track.level, ...track.branches],
      difficulty: track.level,
      url: `/tracks/${track.id}`,
      popularity: Math.min(95, 52 + track.courses.length * 4),
      userEngagement: Math.min(90, 40 + track.courses.length * 3),
    });
    for (const course of track.courses) {
      docs.push({
        id: `course:${track.id}:${course.id}`,
        type: "course",
        section: "Courses",
        title: course.title,
        description: course.description,
        tags: ["course", track.level, ...track.branches],
        difficulty: track.level,
        url: `/tracks/${track.id}/courses/${course.id}`,
        popularity: Math.min(95, 48 + course.lessons * 4),
        userEngagement: Math.min(90, 36 + course.lessons * 3),
      });
    }
  }

  for (const problem of practiceProblemBank) {
    docs.push({
      id: `problem:${problem.id}`,
      type: "problem",
      section: "Problems",
      title: problem.title,
      description: problem.description,
      tags: ["problem", ...problem.tags],
      difficulty: problem.difficulty,
      url: `/practice?problemId=${encodeURIComponent(problem.id)}`,
      popularity: problem.difficulty === "Easy" ? 86 : problem.difficulty === "Medium" ? 82 : 78,
      userEngagement: 58,
    });
  }

  for (const roadmap of companyRoadmaps) {
    docs.push({
      id: `roadmap:${roadmap.id}`,
      type: "roadmap",
      section: "Roadmaps",
      title: `${roadmap.company} Roadmap`,
      description: roadmap.tagline,
      tags: ["roadmap", roadmap.company, ...roadmap.coreSkills.map((skill) => normalizeText(skill))],
      difficulty: "Intermediate",
      url: `/roadmaps?company=${encodeURIComponent(roadmap.id)}`,
      popularity: 77,
      userEngagement: 60,
    });
  }

  for (const doc of helpDocs) {
    docs.push({
      id: `help:${doc.id}`,
      type: "help",
      section: "Help Docs",
      title: doc.title,
      description: doc.description,
      tags: ["help", ...doc.tags],
      url: doc.url,
      popularity: doc.popularity,
      userEngagement: Math.round(doc.popularity * 0.8),
    });
  }

  return docs;
};

const getUnifiedFallbackDocuments = (): UnifiedSearchDocument[] => {
  if (!unifiedFallbackDocuments) {
    unifiedFallbackDocuments = buildUnifiedFallbackDocuments();
  }
  return unifiedFallbackDocuments;
};

const scoreDocument = (
  document: UnifiedSearchDocument,
  query: string,
  expandedTokens: string[],
): number => {
  let score = 0;
  const title = normalizeText(document.title);
  const description = normalizeText(document.description);
  const tags = document.tags.map((tag) => normalizeText(tag));
  const normalizedQuery = normalizeText(query);

  if (title.includes(normalizedQuery)) score += 10;
  if (description.includes(normalizedQuery)) score += 4;
  if (tags.some((tag) => tag.includes(normalizedQuery))) score += 5;

  for (const token of expandedTokens) {
    if (title.includes(token)) score += 2.6;
    if (description.includes(token)) score += 1.4;
    if (tags.some((tag) => tag.includes(token))) score += 2.1;
  }

  score += document.popularity * 0.03;
  score += document.userEngagement * 0.025;

  return score;
};

const fallbackUnifiedSearch = (request: UnifiedSearchRequest): UnifiedSearchResponse => {
  const startedAt = Date.now();
  const query = request.q.trim();
  if (!query) {
    return {
      query: "",
      total: 0,
      page: 1,
      pageSize: 10,
      tookMs: 0,
      results: [],
      source: "fallback",
      backend: "in-memory",
    };
  }

  const page = clamp(request.page ?? 1, 1, 100);
  const pageSize = clamp(request.limit ?? 10, 1, 10);
  const tokens = tokenize(query);
  const expandedTokens = expandTokens(tokens);
  const normalizedTags = (request.tags ?? []).map((tag) => normalizeText(tag));

  const filtered = getUnifiedFallbackDocuments().filter((document) => {
    if (request.type && request.type !== "all" && document.type !== request.type) return false;
    if (request.difficulty && document.difficulty !== request.difficulty) return false;
    if (normalizedTags.length > 0) {
      const docTags = document.tags.map((tag) => normalizeText(tag));
      if (!normalizedTags.some((tag) => docTags.includes(tag))) {
        return false;
      }
    }
    return true;
  });

  const ranked = filtered
    .map((document) => ({
      document,
      score: scoreDocument(document, query, expandedTokens),
    }))
    .filter((entry) => entry.score > 0.2)
    .sort((left, right) => right.score - left.score);

  const start = (page - 1) * pageSize;
  const results = ranked.slice(start, start + pageSize).map(({ document, score }) => ({
    id: document.id,
    type: document.type,
    section: document.section,
    title: document.title,
    description: document.description,
    tags: document.tags,
    difficulty: document.difficulty,
    url: document.url,
    score: Number(score.toFixed(5)),
    snippet: document.description.length > 220 ? `${document.description.slice(0, 217)}...` : document.description,
    highlights: {
      title: [highlightText(document.title, expandedTokens)],
      description: [highlightText(document.description, expandedTokens)],
      tags: document.tags.map((tag) => highlightText(tag, expandedTokens)),
    },
  }));

  return {
    query,
    total: ranked.length,
    page,
    pageSize,
    tookMs: Date.now() - startedAt,
    results,
    source: "fallback",
    backend: "in-memory",
  };
};

const fallbackUnifiedAutocomplete = (
  request: UnifiedAutocompleteRequest,
): UnifiedAutocompleteResponse => {
  const searchResponse = fallbackUnifiedSearch({
    q: request.q,
    limit: clamp(request.limit ?? 10, 1, 10),
    page: 1,
    type: request.type,
  });

  return {
    query: searchResponse.query,
    total: searchResponse.results.length,
    tookMs: searchResponse.tookMs,
    results: searchResponse.results,
    source: "fallback",
    backend: "in-memory",
  };
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // Ignore JSON parsing failures.
  }
  return `Request failed (${response.status})`;
};

export const suggestCatalog = async (
  request: SearchSuggestionRequest,
): Promise<SearchSuggestionResponse> => {
  const trimmedQuery = request.q.trim();
  if (!trimmedQuery) {
    return {
      query: "",
      tookMs: 0,
      suggestions: [],
      source: "api",
    };
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
  });

  if (request.type && request.type !== "all") {
    params.set("type", request.type);
  }
  if (request.branch) {
    params.set("branch", request.branch);
  }
  if (request.limit) {
    params.set("limit", String(request.limit));
  }

  try {
    const response = await fetch(`${searchSuggestionEndpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: request.signal,
    });

    if (!response.ok) {
      throw new Error(`Search suggest API failed with status ${response.status}`);
    }

    const payload = (await response.json()) as SearchSuggestionApiPayload;
    return {
      query: payload.query,
      tookMs: payload.tookMs,
      suggestions: payload.suggestions,
      source: "api",
      backend: payload.backend,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    const startedAt = Date.now();
    const fallbackSuggestions = getFallbackEngine().suggest(trimmedQuery, mapRequestToOptions(request));
    return {
      query: trimmedQuery,
      tookMs: Date.now() - startedAt,
      suggestions: fallbackSuggestions,
      source: "fallback",
      backend: "local",
    };
  }
};

export const searchCatalog = async (request: SearchRequest): Promise<SearchResponse> => {
  const trimmedQuery = request.q.trim();
  if (!trimmedQuery) {
    return {
      query: "",
      tookMs: 0,
      total: 0,
      results: [],
      source: "api",
    };
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
  });

  if (request.type && request.type !== "all") {
    params.set("type", request.type);
  }
  if (request.branch) {
    params.set("branch", request.branch);
  }
  if (request.limit) {
    params.set("limit", String(request.limit));
  }

  try {
    const response = await fetch(`${searchEndpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: request.signal,
    });

    if (!response.ok) {
      throw new Error(`Search API failed with status ${response.status}`);
    }

    const payload = (await response.json()) as SearchApiPayload;
    return {
      query: payload.query,
      tookMs: payload.tookMs,
      total: payload.total,
      results: payload.results,
      source: "api",
      backend: payload.backend,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    const startedAt = Date.now();
    const fallbackResult = getFallbackEngine().search(trimmedQuery, mapRequestToOptions(request));
    return {
      query: trimmedQuery,
      tookMs: Date.now() - startedAt,
      total: fallbackResult.total,
      results: fallbackResult.results,
      source: "fallback",
      backend: "local",
    };
  }
};

export const autocompleteUnifiedCatalog = async (
  request: UnifiedAutocompleteRequest,
): Promise<UnifiedAutocompleteResponse> => {
  const trimmedQuery = request.q.trim();
  if (!trimmedQuery) {
    return {
      query: "",
      total: 0,
      tookMs: 0,
      results: [],
      source: "api",
    };
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    limit: String(clamp(request.limit ?? 10, 1, 10)),
    type: request.type ?? "all",
  });
  if (request.userId) {
    params.set("userId", request.userId);
  }

  try {
    const response = await fetch(`${unifiedAutocompleteEndpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: request.signal,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const payload = (await response.json()) as UnifiedAutocompleteApiPayload;
    return {
      query: payload.query,
      total: payload.total,
      tookMs: payload.tookMs,
      results: payload.results,
      source: "api",
      backend: payload.backend,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return fallbackUnifiedAutocomplete(request);
  }
};

export const searchUnifiedCatalog = async (
  request: UnifiedSearchRequest,
): Promise<UnifiedSearchResponse> => {
  const trimmedQuery = request.q.trim();
  if (!trimmedQuery) {
    return {
      query: "",
      total: 0,
      page: 1,
      pageSize: 10,
      tookMs: 0,
      results: [],
      source: "api",
    };
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    page: String(clamp(request.page ?? 1, 1, 100)),
    limit: String(clamp(request.limit ?? 10, 1, 10)),
    type: request.type ?? "all",
  });
  if (request.difficulty) {
    params.set("difficulty", request.difficulty);
  }
  if (request.tags && request.tags.length > 0) {
    params.set("tags", request.tags.join(","));
  }
  if (request.userId) {
    params.set("userId", request.userId);
  }

  try {
    const response = await fetch(`${unifiedSearchEndpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: request.signal,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    const payload = (await response.json()) as UnifiedSearchApiPayload;
    return {
      query: payload.query,
      total: payload.total,
      page: payload.page,
      pageSize: payload.pageSize,
      tookMs: payload.tookMs,
      results: payload.results,
      source: "api",
      backend: payload.backend,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return fallbackUnifiedSearch(request);
  }
};

export const reindexUnifiedSearch = async (reason?: string): Promise<{
  status: string;
  index: string;
  indexedDocuments: number;
  version: number;
}> => {
  const response = await fetch(unifiedReindexEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as {
    status: string;
    index: string;
    indexedDocuments: number;
    version: number;
  };
};

export const trackSearchEngagement = async (payload: {
  userId: string;
  type: UnifiedSearchType;
  tags?: string[];
  resultId?: string;
  query?: string;
}): Promise<void> => {
  try {
    await fetch(searchEngagementEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking engagement tracking.
  }
};
