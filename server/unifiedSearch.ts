import type { UnifiedSearchDocument, UnifiedSearchType } from "./searchDocuments";

interface UnifiedSearchClientOptions {
  url: string;
  index: string;
  apiKey?: string;
  username?: string;
  password?: string;
  requestTimeoutMs: number;
}

export interface UnifiedSearchRequest {
  q: string;
  page?: number;
  limit?: number;
  type?: UnifiedSearchType | "all";
  difficulty?: string;
  tags?: string[];
  userTypeBoosts?: Partial<Record<UnifiedSearchType, number>>;
}

export interface UnifiedAutocompleteRequest {
  q: string;
  limit?: number;
  type?: UnifiedSearchType | "all";
  userTypeBoosts?: Partial<Record<UnifiedSearchType, number>>;
}

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
}

export interface UnifiedAutocompleteResponse {
  query: string;
  total: number;
  tookMs: number;
  results: UnifiedSearchHit[];
}

interface ElasticsearchHitsResponse {
  took?: number;
  hits?: {
    total?: { value?: number } | number;
    hits?: Array<{
      _score?: number;
      _source?: UnifiedSearchDocument;
      highlight?: {
        title?: string[];
        description?: string[];
        tags?: string[];
      };
    }>;
  };
}

interface ElasticsearchBulkResponse {
  errors?: boolean;
  items?: Array<{
    index?: {
      error?: {
        type?: string;
        reason?: string;
      };
    };
  }>;
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

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

const unique = (values: string[]): string[] => [...new Set(values)];

const normalizeTags = (tags: string[] = []): string[] =>
  unique(tags.map((tag) => normalizeText(tag)).filter(Boolean));

const truncate = (value: string, size: number): string =>
  value.length > size ? `${value.slice(0, size - 3)}...` : value;

const stripHighlightTags = (value: string): string => value.replace(/<\/?em>/g, "");

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text: string, tokens: string[]): string => {
  if (!tokens.length) return text;
  let highlighted = text;
  for (const token of tokens) {
    const normalized = token.trim();
    if (normalized.length < 2) continue;
    const pattern = new RegExp(`(${escapeRegExp(normalized)})`, "ig");
    highlighted = highlighted.replace(pattern, "<em>$1</em>");
  }
  return highlighted;
};

const toTotal = (value: ElasticsearchHitsResponse["hits"] extends infer T ? T : never): number => {
  if (!value || !("total" in value) || value.total === undefined) return 0;
  if (typeof value.total === "number") return value.total;
  return Number(value.total?.value ?? 0);
};

const toSearchHit = (
  source: UnifiedSearchDocument,
  score: number,
  highlight?: {
    title?: string[];
    description?: string[];
    tags?: string[];
  },
): UnifiedSearchHit => {
  const highlightedDescription = highlight?.description?.[0];
  return {
    id: source.id,
    type: source.type,
    section: source.section,
    title: source.title,
    description: source.description,
    tags: source.tags,
    difficulty: source.difficulty,
    url: source.url,
    score: Number(score.toFixed(5)),
    snippet: truncate(stripHighlightTags(highlightedDescription ?? source.description), 220),
    highlights: {
      title: highlight?.title,
      description: highlight?.description,
      tags: highlight?.tags,
    },
  };
};

const SYNONYMS = [
  "dsa, data structures, data structure, algorithms",
  "ai, artificial intelligence",
  "ml, machine learning",
  "ui, user interface",
  "ux, user experience",
  "frontend, front-end, web ui",
  "backend, back-end, server side",
  "devops, ci/cd, continuous integration, continuous delivery",
  "oop, object oriented programming",
  "db, database, sql",
  "js, javascript, node",
  "ts, typescript",
];

const sectionTypeMap: Record<string, UnifiedSearchType> = {
  Problems: "problem",
  Courses: "course",
  Tracks: "track",
  Roadmaps: "roadmap",
  "Help Docs": "help",
};

const normalizeUserBoosts = (
  boosts?: Partial<Record<UnifiedSearchType, number>>,
): Partial<Record<UnifiedSearchType, number>> => {
  if (!boosts) return {};
  return Object.fromEntries(
    Object.entries(boosts)
      .map(([key, value]) => [key, clamp(Number(value ?? 1), 0.5, 6)])
      .filter(([, value]) => Number.isFinite(value)),
  ) as Partial<Record<UnifiedSearchType, number>>;
};

export class UnifiedSearchClient {
  private readonly baseUrl: string;
  private readonly index: string;
  private readonly timeoutMs: number;
  private readonly authHeader?: string;
  private readonly authBasic?: string;

  constructor(private readonly options: UnifiedSearchClientOptions) {
    this.baseUrl = trimTrailingSlash(options.url);
    this.index = options.index;
    this.timeoutMs = Math.max(500, options.requestTimeoutMs);

    if (options.apiKey) {
      this.authHeader = `ApiKey ${options.apiKey}`;
    } else if (options.username && options.password) {
      this.authBasic = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
    }
  }

  async reindex(documents: UnifiedSearchDocument[]): Promise<number> {
    await this.ensureIndex();
    await this.replaceAllDocuments(documents);
    return documents.length;
  }

  async search(request: UnifiedSearchRequest): Promise<UnifiedSearchResponse> {
    const query = request.q.trim();
    if (!query) {
      return {
        query: "",
        total: 0,
        page: 1,
        pageSize: 10,
        tookMs: 0,
        results: [],
      };
    }

    const page = clamp(request.page ?? 1, 1, 100);
    const pageSize = clamp(request.limit ?? 10, 1, 20);
    const from = (page - 1) * pageSize;
    const userBoosts = normalizeUserBoosts(request.userTypeBoosts);
    const tags = normalizeTags(request.tags);

    const filters: unknown[] = [];
    if (request.type && request.type !== "all") {
      filters.push({ term: { type: request.type } });
    }
    if (request.difficulty) {
      filters.push({ term: { difficulty: request.difficulty } });
    }
    if (tags.length > 0) {
      filters.push({
        terms: {
          "tags.keyword": tags,
        },
      });
    }

    const scoringFunctions: Array<Record<string, unknown>> = [
      {
        field_value_factor: {
          field: "popularity",
          factor: 0.06,
          modifier: "sqrt",
          missing: 1,
        },
      },
      {
        field_value_factor: {
          field: "user_engagement",
          factor: 0.05,
          modifier: "sqrt",
          missing: 1,
        },
      },
      {
        gauss: {
          updated_at: {
            origin: "now",
            offset: "7d",
            scale: "45d",
            decay: 0.6,
          },
        },
      },
      {
        filter: {
          match_phrase: {
            title: {
              query,
            },
          },
        },
        weight: 5,
      },
    ];

    for (const [type, boost] of Object.entries(userBoosts)) {
      if (!(type in sectionTypeMap) && !["problem", "course", "track", "roadmap", "help"].includes(type)) {
        continue;
      }
      scoringFunctions.push({
        filter: { term: { type } },
        weight: clamp(boost, 1, 6),
      });
    }

    const payload = await this.requestJson<ElasticsearchHitsResponse>(`/${this.index}/_search`, {
      method: "POST",
      body: JSON.stringify({
        from,
        size: pageSize,
        track_total_hits: true,
        query: {
          function_score: {
            score_mode: "sum",
            boost_mode: "sum",
            functions: scoringFunctions,
            query: {
              bool: {
                filter: filters,
                must: [
                  {
                    multi_match: {
                      query,
                      type: "cross_fields",
                      fields: ["title^7", "description^3", "tags^4", "section^1.5"],
                      operator: "or",
                      minimum_should_match: "70%",
                    },
                  },
                ],
                should: [
                  {
                    multi_match: {
                      query,
                      type: "bool_prefix",
                      fields: ["title.autocomplete^8", "title^6", "tags^3", "section^2"],
                    },
                  },
                  {
                    multi_match: {
                      query,
                      type: "best_fields",
                      fields: ["title^4", "description^2.5", "tags^3"],
                      fuzziness: "AUTO",
                    },
                  },
                  {
                    match_phrase: {
                      title: {
                        query,
                        boost: 8,
                      },
                    },
                  },
                  {
                    match_phrase: {
                      description: {
                        query,
                        boost: 2.5,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        highlight: {
          pre_tags: ["<em>"],
          post_tags: ["</em>"],
          fields: {
            title: { number_of_fragments: 0 },
            description: { fragment_size: 180, number_of_fragments: 1, no_match_size: 150 },
            tags: { number_of_fragments: 3 },
          },
        },
      }),
    });

    const hits = payload.hits?.hits ?? [];
    return {
      query,
      total: toTotal(payload.hits),
      page,
      pageSize,
      tookMs: Number(payload.took ?? 0),
      results: hits
        .map((hit) => (hit._source ? toSearchHit(hit._source, Number(hit._score ?? 0), hit.highlight) : null))
        .filter((entry): entry is UnifiedSearchHit => Boolean(entry)),
    };
  }

  async autocomplete(request: UnifiedAutocompleteRequest): Promise<UnifiedAutocompleteResponse> {
    const query = request.q.trim();
    if (!query) {
      return {
        query: "",
        total: 0,
        tookMs: 0,
        results: [],
      };
    }

    const size = clamp(request.limit ?? 10, 1, 15);
    const userBoosts = normalizeUserBoosts(request.userTypeBoosts);
    const filters: unknown[] = [];
    if (request.type && request.type !== "all") {
      filters.push({ term: { type: request.type } });
    }

    const scoringFunctions: Array<Record<string, unknown>> = [];
    for (const [type, boost] of Object.entries(userBoosts)) {
      scoringFunctions.push({
        filter: { term: { type } },
        weight: clamp(boost, 1, 6),
      });
    }

    const payload = await this.requestJson<ElasticsearchHitsResponse>(`/${this.index}/_search`, {
      method: "POST",
      body: JSON.stringify({
        size,
        query: {
          function_score: {
            score_mode: "sum",
            boost_mode: "sum",
            functions: scoringFunctions,
            query: {
              bool: {
                filter: filters,
                should: [
                  {
                    multi_match: {
                      query,
                      type: "bool_prefix",
                      fields: ["title.autocomplete^9", "title^7", "tags^4", "section^2"],
                    },
                  },
                  {
                    multi_match: {
                      query,
                      type: "best_fields",
                      fields: ["title^6", "tags^3", "description^2"],
                      fuzziness: "AUTO",
                      operator: "or",
                    },
                  },
                ],
                minimum_should_match: 1,
              },
            },
          },
        },
        highlight: {
          pre_tags: ["<em>"],
          post_tags: ["</em>"],
          fields: {
            title: { number_of_fragments: 0 },
            tags: { number_of_fragments: 1 },
          },
        },
      }),
    });

    const hits = payload.hits?.hits ?? [];
    return {
      query,
      total: hits.length,
      tookMs: Number(payload.took ?? 0),
      results: hits
        .map((hit) => (hit._source ? toSearchHit(hit._source, Number(hit._score ?? 0), hit.highlight) : null))
        .filter((entry): entry is UnifiedSearchHit => Boolean(entry)),
    };
  }

  private async ensureIndex(): Promise<void> {
    const existsResponse = await this.request(`/${this.index}`, {
      method: "HEAD",
    });

    if (existsResponse.status === 200) {
      return;
    }
    if (existsResponse.status !== 404) {
      throw new Error(`Elasticsearch index check failed (${existsResponse.status})`);
    }

    await this.requestJson(`/${this.index}`, {
      method: "PUT",
      body: JSON.stringify({
        settings: {
          analysis: {
            filter: {
              melete_edge_ngram: {
                type: "edge_ngram",
                min_gram: 2,
                max_gram: 20,
              },
              melete_synonym_filter: {
                type: "synonym_graph",
                synonyms: SYNONYMS,
              },
            },
            analyzer: {
              melete_autocomplete_index: {
                tokenizer: "standard",
                filter: ["lowercase", "melete_edge_ngram"],
              },
              melete_autocomplete_search: {
                tokenizer: "standard",
                filter: ["lowercase"],
              },
              melete_english_synonym: {
                tokenizer: "standard",
                filter: ["lowercase", "stop", "kstem", "melete_synonym_filter"],
              },
            },
          },
        },
        mappings: {
          dynamic: "strict",
          properties: {
            id: { type: "keyword" },
            title: {
              type: "text",
              analyzer: "melete_english_synonym",
              search_analyzer: "melete_english_synonym",
              fields: {
                keyword: { type: "keyword", ignore_above: 256 },
                autocomplete: {
                  type: "text",
                  analyzer: "melete_autocomplete_index",
                  search_analyzer: "melete_autocomplete_search",
                },
              },
            },
            description: {
              type: "text",
              analyzer: "melete_english_synonym",
              search_analyzer: "melete_english_synonym",
            },
            tags: {
              type: "text",
              analyzer: "melete_english_synonym",
              search_analyzer: "melete_english_synonym",
              fields: {
                keyword: { type: "keyword" },
              },
            },
            type: { type: "keyword" },
            section: { type: "keyword" },
            popularity: { type: "float" },
            user_engagement: { type: "float" },
            difficulty: { type: "keyword" },
            url: { type: "keyword" },
            updated_at: { type: "date" },
            track_id: { type: "keyword" },
            course_id: { type: "keyword" },
            problem_id: { type: "keyword" },
            roadmap_id: { type: "keyword" },
            help_id: { type: "keyword" },
          },
        },
      }),
    });
  }

  private async replaceAllDocuments(documents: UnifiedSearchDocument[]): Promise<void> {
    await this.requestJson(`/${this.index}/_delete_by_query?conflicts=proceed&refresh=true`, {
      method: "POST",
      body: JSON.stringify({
        query: {
          match_all: {},
        },
      }),
    });

    if (documents.length === 0) return;

    const lines: string[] = [];
    for (const document of documents) {
      lines.push(JSON.stringify({ index: { _index: this.index, _id: document.id } }));
      lines.push(JSON.stringify(document));
    }

    const payload = await this.requestJson<ElasticsearchBulkResponse>(
      "/_bulk?refresh=wait_for",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-ndjson",
        },
        body: `${lines.join("\n")}\n`,
      },
    );

    if (!payload.errors) return;

    const firstError = payload.items
      ?.map((item) => item.index?.error)
      .find((entry) => entry?.reason);
    if (firstError) {
      throw new Error(
        `Elasticsearch bulk index failed (${firstError.type ?? "unknown"}): ${firstError.reason ?? "unknown error"}`,
      );
    }
    throw new Error("Elasticsearch bulk index reported errors");
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(path, init);
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Elasticsearch request failed (${response.status}): ${raw.slice(0, 300)}`);
    }
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(init.headers ?? {});

    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }
    if (!headers.has("content-type") && init.body && !headers.has("Content-Type")) {
      headers.set("content-type", "application/json");
    }
    if (this.authHeader) {
      headers.set("authorization", this.authHeader);
    } else if (this.authBasic) {
      headers.set("authorization", this.authBasic);
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}

const maybeInclude = (source: string, token: string): boolean => {
  if (!source) return false;
  if (source.includes(token)) return true;
  if (token.length <= 2) return false;
  const distance = Math.abs(source.length - token.length);
  return distance <= 2 && (source.startsWith(token.slice(0, 2)) || token.startsWith(source.slice(0, 2)));
};

const computeInMemoryScore = (
  document: UnifiedSearchDocument,
  normalizedQuery: string,
  tokens: string[],
  boosts: Partial<Record<UnifiedSearchType, number>>,
): number => {
  let score = 0;
  const normalizedTitle = normalizeText(document.title);
  const normalizedDescription = normalizeText(document.description);
  const normalizedTags = document.tags.map((tag) => normalizeText(tag));

  if (normalizedTitle.includes(normalizedQuery)) score += 9;
  if (normalizedDescription.includes(normalizedQuery)) score += 3.5;
  if (normalizedTags.some((tag) => tag.includes(normalizedQuery))) score += 4;

  for (const token of tokens) {
    if (normalizedTitle.includes(token)) score += 2.4;
    if (normalizedDescription.includes(token)) score += 1.1;
    if (normalizedTags.some((tag) => maybeInclude(tag, token))) score += 1.6;
  }

  score += document.popularity * 0.03;
  score += document.user_engagement * 0.025;
  score *= boosts[document.type] ?? 1;

  return score;
};

export const searchInMemoryDocuments = (
  documents: UnifiedSearchDocument[],
  request: UnifiedSearchRequest,
): UnifiedSearchResponse => {
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
    };
  }

  const page = clamp(request.page ?? 1, 1, 100);
  const pageSize = clamp(request.limit ?? 10, 1, 20);
  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(query);
  const tags = normalizeTags(request.tags);
  const boosts = normalizeUserBoosts(request.userTypeBoosts);

  const filtered = documents.filter((document) => {
    if (request.type && request.type !== "all" && document.type !== request.type) return false;
    if (request.difficulty && document.difficulty !== request.difficulty) return false;
    if (tags.length > 0 && !document.tags.some((tag) => tags.includes(normalizeText(tag)))) return false;
    return true;
  });

  const ranked = filtered
    .map((document) => ({
      document,
      score: computeInMemoryScore(document, normalizedQuery, tokens, boosts),
    }))
    .filter((entry) => entry.score > 0.15)
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
    snippet: truncate(document.description, 220),
    highlights: {
      title: [highlightText(document.title, tokens)],
      description: [highlightText(truncate(document.description, 220), tokens)],
    },
  }));

  return {
    query,
    total: ranked.length,
    page,
    pageSize,
    tookMs: Date.now() - startedAt,
    results,
  };
};

export const autocompleteInMemoryDocuments = (
  documents: UnifiedSearchDocument[],
  request: UnifiedAutocompleteRequest,
): UnifiedAutocompleteResponse => {
  const startedAt = Date.now();
  const query = request.q.trim();
  if (!query) {
    return {
      query: "",
      total: 0,
      tookMs: 0,
      results: [],
    };
  }

  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(query);
  const boosts = normalizeUserBoosts(request.userTypeBoosts);

  const filtered = documents
    .filter((document) => {
      if (request.type && request.type !== "all" && document.type !== request.type) return false;
      const title = normalizeText(document.title);
      const tags = document.tags.map((tag) => normalizeText(tag));
      return (
        title.includes(normalizedQuery) ||
        tags.some((tag) => tag.includes(normalizedQuery)) ||
        tokens.some((token) => title.startsWith(token))
      );
    })
    .map((document) => ({
      document,
      score: computeInMemoryScore(document, normalizedQuery, tokens, boosts),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, clamp(request.limit ?? 10, 1, 15));

  return {
    query,
    total: filtered.length,
    tookMs: Date.now() - startedAt,
    results: filtered.map(({ document, score }) => ({
      id: document.id,
      type: document.type,
      section: document.section,
      title: document.title,
      description: document.description,
      tags: document.tags,
      difficulty: document.difficulty,
      url: document.url,
      score: Number(score.toFixed(5)),
      snippet: truncate(document.description, 160),
      highlights: {
        title: [highlightText(document.title, tokens)],
      },
    })),
  };
};
