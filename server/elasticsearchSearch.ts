import type {
  CatalogTrackRecord,
  SearchHit,
  SearchOptions,
  SearchResultSet,
  SearchSuggestion,
} from "../src/shared/catalogSearch";

interface ElasticsearchCatalogClientOptions {
  url: string;
  index: string;
  apiKey?: string;
  username?: string;
  password?: string;
  requestTimeoutMs: number;
}

interface ElasticCatalogDocument {
  id: string;
  documentType: "track" | "course";
  trackId: string;
  courseId?: string;
  title: string;
  titleKeyword: string;
  description: string;
  trackTitle: string;
  duration: string;
  lessons?: number;
  level?: string;
  branches: string[];
}

interface ElasticsearchHitsResponse {
  hits?: {
    total?: { value?: number } | number;
    hits?: Array<{
      _score?: number;
      _source?: ElasticCatalogDocument;
      highlight?: {
        title?: string[];
        trackTitle?: string[];
        description?: string[];
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
const QUERY_PART_PATTERN = /"([^"]+)"|(\S+)/g;
const TOKEN_PATTERN = /[^a-z0-9+]+/g;

interface ParsedElasticQuery {
  normalizedQuery: string;
  positiveTerms: string[];
  requiredTerms: string[];
  excludedTerms: string[];
  exactPhrases: string[];
}

const makeSnippet = (description: string, highlight?: string): string => {
  if (highlight && highlight.trim().length > 0) {
    return highlight.replace(/<\/?em>/g, "");
  }

  return description.length > 148 ? `${description.slice(0, 145)}...` : description;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const unique = (values: string[]): string[] => [...new Set(values)];

const normalizeTerm = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(TOKEN_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string): string[] =>
  normalizeTerm(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

const parseElasticQuery = (rawQuery: string): ParsedElasticQuery => {
  const normalizedQuery = normalizeTerm(rawQuery);
  if (!normalizedQuery) {
    return {
      normalizedQuery: "",
      positiveTerms: [],
      requiredTerms: [],
      excludedTerms: [],
      exactPhrases: [],
    };
  }

  const positiveTerms: string[] = [];
  const requiredTerms: string[] = [];
  const excludedTerms: string[] = [];
  const exactPhrases: string[] = [];

  for (const match of rawQuery.matchAll(QUERY_PART_PATTERN)) {
    const phrasePart = match[1];
    const tokenPart = match[2];

    if (phrasePart) {
      const normalizedPhrase = normalizeTerm(phrasePart);
      if (!normalizedPhrase) continue;
      exactPhrases.push(normalizedPhrase);
      const phraseTokens = tokenize(normalizedPhrase);
      positiveTerms.push(...phraseTokens);
      requiredTerms.push(...phraseTokens);
      continue;
    }

    if (!tokenPart) continue;
    const token = tokenPart.trim();
    if (!token) continue;

    const isExcluded = token.startsWith("-") && token.length > 1;
    const isRequired = token.startsWith("+") && token.length > 1;
    const cleaned = normalizeTerm(isExcluded || isRequired ? token.slice(1) : token);
    if (!cleaned) continue;

    const parsedTokens = tokenize(cleaned);
    if (parsedTokens.length === 0) continue;

    if (isExcluded) {
      excludedTerms.push(...parsedTokens);
      continue;
    }

    positiveTerms.push(...parsedTokens);
    if (isRequired) {
      requiredTerms.push(...parsedTokens);
    }
  }

  if (positiveTerms.length === 0) {
    positiveTerms.push(...tokenize(normalizedQuery));
  }

  return {
    normalizedQuery,
    positiveTerms: unique(positiveTerms),
    requiredTerms: unique(requiredTerms),
    excludedTerms: unique(excludedTerms),
    exactPhrases: unique(exactPhrases),
  };
};

const trackToDocument = (track: CatalogTrackRecord): ElasticCatalogDocument => ({
  id: `track:${track.id}`,
  documentType: "track",
  trackId: track.id,
  title: track.title,
  titleKeyword: track.title,
  description: track.description,
  trackTitle: track.title,
  duration: track.duration,
  level: track.level,
  branches: track.branches,
});

const courseToDocument = (
  track: CatalogTrackRecord,
  course: CatalogTrackRecord["courses"][number],
): ElasticCatalogDocument => ({
  id: `course:${track.id}:${course.id}`,
  documentType: "course",
  trackId: track.id,
  courseId: course.id,
  title: course.title,
  titleKeyword: course.title,
  description: course.description,
  trackTitle: track.title,
  duration: course.duration,
  lessons: course.lessons,
  level: track.level,
  branches: track.branches,
});

const flattenCatalog = (tracks: CatalogTrackRecord[]): ElasticCatalogDocument[] => {
  const documents: ElasticCatalogDocument[] = [];

  for (const track of tracks) {
    documents.push(trackToDocument(track));
    for (const course of track.courses) {
      documents.push(courseToDocument(track, course));
    }
  }

  return documents;
};

export class ElasticsearchCatalogClient {
  private readonly baseUrl: string;
  private readonly index: string;
  private readonly timeoutMs: number;
  private readonly authHeader?: string;
  private readonly authBasic?: string;

  constructor(private readonly options: ElasticsearchCatalogClientOptions) {
    this.baseUrl = trimTrailingSlash(options.url);
    this.index = options.index;
    this.timeoutMs = Math.max(500, options.requestTimeoutMs);

    if (options.apiKey) {
      this.authHeader = `ApiKey ${options.apiKey}`;
    } else if (options.username && options.password) {
      this.authBasic = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
    }
  }

  async bootstrapCatalog(tracks: CatalogTrackRecord[]): Promise<number> {
    await this.ensureIndex();
    const documents = flattenCatalog(tracks);
    await this.replaceCatalog(documents);
    return documents.length;
  }

  async countDocuments(): Promise<number | null> {
    try {
      const payload = await this.requestJson<{ count?: number }>(`/${this.index}/_count`, {
        method: "GET",
      });
      return Number.isFinite(payload.count) ? Number(payload.count) : null;
    } catch {
      return null;
    }
  }

  async search(rawQuery: string, options: SearchOptions): Promise<SearchResultSet> {
    const parsedQuery = parseElasticQuery(rawQuery);
    const query = parsedQuery.normalizedQuery;
    if (!query) {
      return { total: 0, results: [] };
    }

    const normalizedBranch = options.branch?.trim().toLowerCase();
    const requestedType = options.type ?? "all";
    const requestedLimit = clamp(options.limit ?? 10, 1, 50);
    const filters: unknown[] = [];
    const mustClauses: unknown[] = [];
    const shouldClauses: unknown[] = [];
    const mustNotClauses: unknown[] = [];
    const queryFields = ["title^6", "trackTitle^2.6", "description^1.8", "level^1.1", "branches"];
    const prefixFields = ["title^8", "title._2gram^5", "title._3gram^4", "trackTitle^3"];

    if (requestedType !== "all") {
      filters.push({ term: { documentType: requestedType } });
    }
    if (normalizedBranch) {
      filters.push({ term: { branches: normalizedBranch } });
    }

    if (parsedQuery.positiveTerms.length > 0) {
      const positiveQuery = parsedQuery.positiveTerms.join(" ");
      const minimumShouldMatch =
        parsedQuery.positiveTerms.length >= 5
          ? "60%"
          : parsedQuery.positiveTerms.length >= 3
            ? "75%"
            : "100%";

      mustClauses.push({
        multi_match: {
          query: positiveQuery,
          type: "best_fields",
          fields: queryFields,
          fuzziness: "AUTO",
          operator: parsedQuery.requiredTerms.length > 0 ? "or" : "and",
          minimum_should_match: minimumShouldMatch,
        },
      });

      shouldClauses.push({
        multi_match: {
          query: positiveQuery,
          type: "bool_prefix",
          fields: prefixFields,
        },
      });
      shouldClauses.push({
        match_phrase: {
          title: {
            query: positiveQuery,
            boost: 7.2,
          },
        },
      });
      shouldClauses.push({
        match_phrase_prefix: {
          title: {
            query: positiveQuery,
            boost: 4.8,
          },
        },
      });
      shouldClauses.push({
        match_phrase: {
          trackTitle: {
            query: positiveQuery,
            boost: 2.4,
          },
        },
      });
    }

    for (const requiredTerm of parsedQuery.requiredTerms) {
      mustClauses.push({
        multi_match: {
          query: requiredTerm,
          fields: queryFields,
          type: "best_fields",
          fuzziness: "AUTO",
          operator: "or",
        },
      });
    }

    for (const phrase of parsedQuery.exactPhrases) {
      mustClauses.push({
        bool: {
          should: [
            { match_phrase: { title: { query: phrase, boost: 8.5 } } },
            { match_phrase: { trackTitle: { query: phrase, boost: 5.3 } } },
            { match_phrase: { description: { query: phrase, boost: 3.5 } } },
          ],
          minimum_should_match: 1,
        },
      });
    }

    for (const excludedTerm of parsedQuery.excludedTerms) {
      mustNotClauses.push({
        multi_match: {
          query: excludedTerm,
          fields: ["title^5", "trackTitle^3", "description^2", "level", "branches"],
          operator: "or",
        },
      });
    }

    shouldClauses.push({
      constant_score: {
        filter: { term: { documentType: "track" } },
        boost: 0.22,
      },
    });

    if (mustClauses.length === 0) {
      mustClauses.push({
        multi_match: {
          query,
          type: "best_fields",
          fields: queryFields,
          operator: "or",
        },
      });
    }

    const payload = await this.requestJson<ElasticsearchHitsResponse>(
      `/${this.index}/_search`,
      {
        method: "POST",
        body: JSON.stringify({
          size: requestedLimit,
          track_total_hits: true,
          query: {
            bool: {
              must: mustClauses,
              should: shouldClauses,
              filter: filters,
              must_not: mustNotClauses,
              minimum_should_match: 0,
            },
          },
          highlight: {
            fields: {
              title: {
                number_of_fragments: 1,
                fragment_size: 120,
              },
              trackTitle: {
                number_of_fragments: 1,
                fragment_size: 120,
              },
              description: {
                number_of_fragments: 1,
                fragment_size: 140,
              },
            },
          },
        }),
      },
    );

    const rawHits = payload.hits?.hits ?? [];
    const totalValue =
      typeof payload.hits?.total === "number"
        ? payload.hits.total
        : payload.hits?.total?.value ?? rawHits.length;

    const results: SearchHit[] = rawHits
      .map((hit) => {
        const source = hit._source;
        if (!source) return null;
        const highlightSnippet =
          hit.highlight?.description?.[0] ??
          hit.highlight?.title?.[0] ??
          hit.highlight?.trackTitle?.[0];

        return {
          type: source.documentType,
          trackId: source.trackId,
          courseId: source.courseId,
          title: source.title,
          description: source.description,
          trackTitle: source.trackTitle,
          duration: source.duration,
          lessons: source.lessons,
          level: source.level,
          branches: source.branches,
          score: Number((hit._score ?? 0).toFixed(5)),
          snippet: makeSnippet(source.description, highlightSnippet),
        };
      })
      .filter((item): item is SearchHit => Boolean(item));

    return {
      total: Number.isFinite(totalValue) ? Number(totalValue) : results.length,
      results,
    };
  }

  async suggest(rawQuery: string, options: SearchOptions): Promise<SearchSuggestion[]> {
    const parsedQuery = parseElasticQuery(rawQuery);
    const query = parsedQuery.normalizedQuery;
    if (!query) {
      return [];
    }

    const normalizedBranch = options.branch?.trim().toLowerCase();
    const requestedType = options.type ?? "all";
    const requestedLimit = clamp(options.limit ?? 6, 1, 20);
    const filters: unknown[] = [];
    const mustClauses: unknown[] = [];
    const shouldClauses: unknown[] = [];
    const mustNotClauses: unknown[] = [];
    const positiveQuery =
      parsedQuery.positiveTerms.length > 0 ? parsedQuery.positiveTerms.join(" ") : query;

    if (requestedType !== "all") {
      filters.push({ term: { documentType: requestedType } });
    }
    if (normalizedBranch) {
      filters.push({ term: { branches: normalizedBranch } });
    }

    shouldClauses.push({
      multi_match: {
        query: positiveQuery,
        type: "bool_prefix",
        fields: ["title^8", "title._2gram^5", "title._3gram^4", "trackTitle^3"],
      },
    });
    shouldClauses.push({
      match_phrase_prefix: {
        title: {
          query: positiveQuery,
          boost: 7.5,
        },
      },
    });
    shouldClauses.push({
      match_phrase_prefix: {
        trackTitle: {
          query: positiveQuery,
          boost: 2.8,
        },
      },
    });
    shouldClauses.push({
      multi_match: {
        query: positiveQuery,
        type: "best_fields",
        fields: ["title^6", "trackTitle^2.6", "description^1.8", "level^1.1", "branches"],
        fuzziness: "AUTO",
        operator: "or",
      },
    });
    shouldClauses.push({
      constant_score: {
        filter: { term: { documentType: "track" } },
        boost: 0.22,
      },
    });

    for (const phrase of parsedQuery.exactPhrases) {
      shouldClauses.push({
        match_phrase: {
          title: {
            query: phrase,
            boost: 8.6,
          },
        },
      });
      shouldClauses.push({
        match_phrase: {
          trackTitle: {
            query: phrase,
            boost: 4.2,
          },
        },
      });
    }

    for (const requiredTerm of parsedQuery.requiredTerms) {
      mustClauses.push({
        multi_match: {
          query: requiredTerm,
          fields: ["title^6", "trackTitle^3", "description^2"],
          type: "best_fields",
          fuzziness: "AUTO",
          operator: "or",
        },
      });
    }

    for (const excludedTerm of parsedQuery.excludedTerms) {
      mustNotClauses.push({
        multi_match: {
          query: excludedTerm,
          fields: ["title^5", "trackTitle^3", "description^2", "level", "branches"],
          operator: "or",
        },
      });
    }

    const payload = await this.requestJson<ElasticsearchHitsResponse>(
      `/${this.index}/_search`,
      {
        method: "POST",
        body: JSON.stringify({
          size: requestedLimit * 2,
          track_total_hits: false,
          query: {
            bool: {
              must: mustClauses,
              should: shouldClauses,
              filter: filters,
              must_not: mustNotClauses,
              minimum_should_match: shouldClauses.length > 0 ? 1 : 0,
            },
          },
        }),
      },
    );

    const rawHits = payload.hits?.hits ?? [];
    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];

    for (const hit of rawHits) {
      const source = hit._source;
      if (!source) continue;

      const key = `${source.documentType}:${source.trackId}:${source.courseId ?? "track"}`;
      if (seen.has(key)) continue;
      seen.add(key);

      suggestions.push({
        type: source.documentType,
        trackId: source.trackId,
        courseId: source.courseId,
        title: source.title,
        trackTitle: source.trackTitle,
        branches: source.branches,
        score: Number((hit._score ?? 0).toFixed(5)),
      });

      if (suggestions.length >= requestedLimit) {
        break;
      }
    }

    return suggestions;
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
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          dynamic: "strict",
          properties: {
            documentType: { type: "keyword" },
            trackId: { type: "keyword" },
            courseId: { type: "keyword" },
            title: { type: "search_as_you_type" },
            titleKeyword: { type: "keyword" },
            description: { type: "text" },
            trackTitle: { type: "text" },
            duration: { type: "keyword" },
            lessons: { type: "integer" },
            level: { type: "keyword" },
            branches: { type: "keyword" },
          },
        },
      }),
    });
  }

  private async replaceCatalog(documents: ElasticCatalogDocument[]): Promise<void> {
    await this.requestJson(`/${this.index}/_delete_by_query?refresh=true&conflicts=proceed`, {
      method: "POST",
      body: JSON.stringify({
        query: { match_all: {} },
      }),
    });

    if (documents.length === 0) {
      return;
    }

    const bulkBody = documents
      .map((document) => {
        const { id, ...source } = document;
        return `${JSON.stringify({ index: { _id: id } })}\n${JSON.stringify(source)}`;
      })
      .join("\n")
      .concat("\n");

    const payload = await this.requestJson<ElasticsearchBulkResponse>(
      `/${this.index}/_bulk?refresh=wait_for`,
      {
        method: "POST",
        body: bulkBody,
        contentType: "application/x-ndjson",
      },
    );

    if (!payload.errors) {
      return;
    }

    const firstError = payload.items?.find((item) => item.index?.error)?.index?.error;
    if (firstError) {
      throw new Error(
        `Elasticsearch bulk index failed (${firstError.type ?? "unknown"}): ${firstError.reason ?? "unknown error"}`,
      );
    }

    throw new Error("Elasticsearch bulk index reported errors");
  }

  private async requestJson<T = unknown>(
    path: string,
    options: {
      method: string;
      body?: string;
      contentType?: string;
    },
  ): Promise<T> {
    const response = await this.request(path, options);
    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Elasticsearch request failed (${response.status}): ${raw.slice(0, 400)}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  private async request(
    path: string,
    options: {
      method: string;
      body?: string;
      contentType?: string;
    },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers: {
          ...(this.authHeader ? { Authorization: this.authHeader } : {}),
          ...(this.authBasic ? { Authorization: this.authBasic } : {}),
          ...(options.body
            ? { "Content-Type": options.contentType ?? "application/json" }
            : {}),
        },
        body: options.body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
