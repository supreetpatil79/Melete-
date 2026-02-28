export type SearchResultType = "track" | "course";
export type SearchRequestType = "all" | SearchResultType;

export interface CatalogCourseRecord {
  id: string;
  title: string;
  description: string;
  duration: string;
  lessons: number;
}

export interface CatalogTrackRecord {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: string;
  branches: string[];
  courses: CatalogCourseRecord[];
}

export interface SearchHit {
  type: SearchResultType;
  trackId: string;
  courseId?: string;
  title: string;
  description: string;
  trackTitle: string;
  duration: string;
  lessons?: number;
  level?: string;
  branches: string[];
  score: number;
  snippet: string;
}

export interface SearchOptions {
  limit?: number;
  type?: SearchRequestType;
  branch?: string;
}

export interface SearchResultSet {
  total: number;
  results: SearchHit[];
}

export interface SearchSuggestion {
  type: SearchResultType;
  trackId: string;
  courseId?: string;
  title: string;
  trackTitle: string;
  branches: string[];
  score: number;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const TOKEN_PATTERN = /[^a-z0-9+]+/g;
const QUERY_PART_PATTERN = /"([^"]+)"|(\S+)/g;
const BM25_K1 = 1.25;
const BM25_B = 0.75;
const QUERY_SYNONYMS: Record<string, string[]> = {
  js: ["javascript", "node", "nodejs"],
  ts: ["typescript"],
  py: ["python"],
  ml: ["machine", "learning"],
  ai: ["artificial", "intelligence"],
  dsa: ["data", "structures", "algorithms"],
  devops: ["docker", "kubernetes", "ci", "cd"],
  backend: ["api", "server", "database"],
  frontend: ["ui", "react", "web"],
  uiux: ["ui", "ux", "design"],
};
const TRACK_INTENT_TERMS = new Set(["track", "tracks", "path", "paths", "roadmap", "roadmaps"]);
const COURSE_INTENT_TERMS = new Set([
  "course",
  "courses",
  "lesson",
  "lessons",
  "module",
  "modules",
  "tutorial",
  "tutorials",
]);

interface SearchDocument {
  key: string;
  type: SearchResultType;
  trackId: string;
  courseId?: string;
  title: string;
  description: string;
  trackTitle: string;
  duration: string;
  lessons?: number;
  level?: string;
  branches: string[];
  normalizedTitle: string;
  normalizedDescription: string;
  normalizedTrackTitle: string;
  titleNgrams: Set<string>;
  trackTitleNgrams: Set<string>;
}

interface SuggestionDocument {
  key: string;
  type: SearchResultType;
  trackId: string;
  courseId?: string;
  title: string;
  trackTitle: string;
  branches: string[];
  normalizedTitle: string;
  normalizedTrackTitle: string;
  titleTokens: string[];
  trackTitleTokens: string[];
}

interface SuggestionTrieNode {
  children: Map<string, SuggestionTrieNode>;
  candidates: Map<string, number>;
}

const createSuggestionTrieNode = (): SuggestionTrieNode => ({
  children: new Map(),
  candidates: new Map(),
});

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(TOKEN_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
};

const normalizeSuggestionQuery = (value: string): string =>
  normalizeText(value)
    .replace(TOKEN_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueTokens = (tokens: string[]): string[] => [...new Set(tokens)];

const createCharacterNgrams = (value: string, n = 3): Set<string> => {
  const compact = normalizeText(value).replace(/[^a-z0-9+]/g, "");
  if (!compact) return new Set();
  if (compact.length <= n) return new Set([compact]);

  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - n; index += 1) {
    grams.add(compact.slice(index, index + n));
  }

  return grams;
};

interface ParsedSearchQuery {
  normalizedQuery: string;
  queryTokens: string[];
  requiredTokens: string[];
  excludedTokens: string[];
  exactPhrases: string[];
  trackIntent: boolean;
  courseIntent: boolean;
}

const parseSearchQuery = (rawQuery: string): ParsedSearchQuery => {
  const normalizedQuery = normalizeSuggestionQuery(rawQuery);
  if (!normalizedQuery) {
    return {
      normalizedQuery: "",
      queryTokens: [],
      requiredTokens: [],
      excludedTokens: [],
      exactPhrases: [],
      trackIntent: false,
      courseIntent: false,
    };
  }

  const queryTokens: string[] = [];
  const requiredTokens: string[] = [];
  const excludedTokens: string[] = [];
  const exactPhrases: string[] = [];
  const rawIntentTerms: string[] = [];

  for (const match of rawQuery.matchAll(QUERY_PART_PATTERN)) {
    const phrasePart = match[1];
    const tokenPart = match[2];

    if (phrasePart) {
      const normalizedPhrase = normalizeSuggestionQuery(phrasePart);
      if (!normalizedPhrase) continue;
      exactPhrases.push(normalizedPhrase);
      const phraseTokens = tokenize(normalizedPhrase);
      queryTokens.push(...phraseTokens);
      requiredTokens.push(...phraseTokens);
      rawIntentTerms.push(...normalizedPhrase.split(" "));
      continue;
    }

    if (!tokenPart) continue;
    const token = tokenPart.trim();
    if (!token) continue;

    const isExcluded = token.startsWith("-") && token.length > 1;
    const isRequired = token.startsWith("+") && token.length > 1;
    const normalizedToken = normalizeSuggestionQuery(
      isExcluded || isRequired ? token.slice(1) : token,
    );
    if (!normalizedToken) continue;

    rawIntentTerms.push(...normalizedToken.split(" "));
    const parsedTokens = tokenize(normalizedToken);
    if (parsedTokens.length === 0) continue;

    if (isExcluded) {
      excludedTokens.push(...parsedTokens);
      continue;
    }

    queryTokens.push(...parsedTokens);
    if (isRequired) {
      requiredTokens.push(...parsedTokens);
    }
  }

  if (queryTokens.length === 0) {
    queryTokens.push(...tokenize(normalizedQuery));
  }

  return {
    normalizedQuery,
    queryTokens: uniqueTokens(queryTokens),
    requiredTokens: uniqueTokens(requiredTokens),
    excludedTokens: uniqueTokens(excludedTokens),
    exactPhrases: uniqueTokens(exactPhrases),
    trackIntent: rawIntentTerms.some((term) => TRACK_INTENT_TERMS.has(term)),
    courseIntent: rawIntentTerms.some((term) => COURSE_INTENT_TERMS.has(term)),
  };
};

const boundedLevenshtein = (left: string, right: string, maxDistance: number): number | null => {
  if (left === right) return 0;
  const leftLength = left.length;
  const rightLength = right.length;

  if (Math.abs(leftLength - rightLength) > maxDistance) {
    return null;
  }

  const previous = new Array<number>(rightLength + 1);
  const current = new Array<number>(rightLength + 1);

  for (let j = 0; j <= rightLength; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= leftLength; i += 1) {
    current[0] = i;
    let rowMin = current[0];

    for (let j = 1; j <= rightLength; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
      rowMin = Math.min(rowMin, current[j]);
    }

    if (rowMin > maxDistance) {
      return null;
    }

    for (let j = 0; j <= rightLength; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[rightLength] <= maxDistance ? previous[rightLength] : null;
};

const makeSnippet = (description: string, query: string): string => {
  if (!description) return "";
  if (!query) {
    return description.length > 148 ? `${description.slice(0, 145)}...` : description;
  }

  const normalizedDescription = normalizeText(description);
  const startIndex = normalizedDescription.indexOf(query);
  if (startIndex === -1) {
    return description.length > 148 ? `${description.slice(0, 145)}...` : description;
  }

  const snippetStart = Math.max(0, startIndex - 48);
  const snippetEnd = Math.min(description.length, startIndex + query.length + 92);

  let snippet = description.slice(snippetStart, snippetEnd).trim();
  if (snippetStart > 0) snippet = `...${snippet}`;
  if (snippetEnd < description.length) snippet = `${snippet}...`;

  return snippet;
};

const makeSearchDocuments = (tracks: CatalogTrackRecord[]): SearchDocument[] => {
  const documents: SearchDocument[] = [];

  for (const track of tracks) {
    documents.push({
      key: `track:${track.id}`,
      type: "track",
      trackId: track.id,
      title: track.title,
      description: track.description,
      trackTitle: track.title,
      duration: track.duration,
      level: track.level,
      branches: track.branches,
      normalizedTitle: normalizeText(track.title),
      normalizedDescription: normalizeText(track.description),
      normalizedTrackTitle: normalizeText(track.title),
      titleNgrams: createCharacterNgrams(track.title),
      trackTitleNgrams: createCharacterNgrams(track.title),
    });

    for (const course of track.courses) {
      documents.push({
        key: `course:${track.id}:${course.id}`,
        type: "course",
        trackId: track.id,
        courseId: course.id,
        title: course.title,
        description: course.description,
        trackTitle: track.title,
        duration: course.duration,
        lessons: course.lessons,
        level: track.level,
        branches: track.branches,
        normalizedTitle: normalizeText(course.title),
        normalizedDescription: normalizeText(course.description),
        normalizedTrackTitle: normalizeText(track.title),
        titleNgrams: createCharacterNgrams(course.title),
        trackTitleNgrams: createCharacterNgrams(track.title),
      });
    }
  }

  return documents;
};

interface AlternativeToken {
  token: string;
  qualityBoost: number;
}

interface ExpandedQueryToken {
  token: string;
  source: string;
  tokenBoost: number;
}

export class CatalogSearchEngine {
  private readonly documents = new Map<string, SearchDocument>();
  private readonly postings = new Map<string, Map<string, number>>();
  private readonly lengths = new Map<string, number>();
  private readonly suggestionTrie = createSuggestionTrieNode();
  private readonly suggestionEntries = new Map<string, SuggestionDocument>();
  private readonly suggestionTokenPostings = new Map<string, Map<string, number>>();
  private readonly vocabulary: string[];
  private readonly suggestionTokenVocabulary: string[];
  private readonly averageLength: number;

  constructor(tracks: CatalogTrackRecord[]) {
    const docs = makeSearchDocuments(tracks);
    let weightedLengthSum = 0;

    for (const document of docs) {
      this.documents.set(document.key, document);
      this.indexSuggestionDocument(document);

      const weightedTerms = new Map<string, number>();
      this.collectTerms(weightedTerms, document.title, 4.8);
      this.collectTerms(weightedTerms, document.description, 2.7);
      this.collectTerms(weightedTerms, document.trackTitle, 1.8);
      this.collectTerms(weightedTerms, document.level ?? "", 1.2);
      this.collectTerms(weightedTerms, document.branches.join(" "), 0.9);

      let totalWeight = 0;
      for (const [token, frequency] of weightedTerms.entries()) {
        totalWeight += frequency;

        if (!this.postings.has(token)) {
          this.postings.set(token, new Map());
        }
        this.postings.get(token)?.set(document.key, frequency);
      }

      this.lengths.set(document.key, totalWeight);
      weightedLengthSum += totalWeight;
    }

    this.vocabulary = [...this.postings.keys()];
    this.suggestionTokenVocabulary = [...this.suggestionTokenPostings.keys()];
    this.averageLength = docs.length > 0 ? weightedLengthSum / docs.length : 1;
  }

  search(rawQuery: string, options: SearchOptions = {}): SearchResultSet {
    const parsedQuery = parseSearchQuery(rawQuery);
    const query = parsedQuery.normalizedQuery;
    if (!query) {
      return { total: 0, results: [] };
    }

    const requestedType = options.type ?? "all";
    const requestedBranch = options.branch ? normalizeText(options.branch) : undefined;
    const requestedLimit = Math.max(1, Math.min(options.limit ?? 10, 50));

    let queryTokens = parsedQuery.queryTokens;
    if (queryTokens.length === 0) {
      queryTokens = query.split(" ").filter(Boolean);
    }
    const expandedTokens = this.expandQueryTokens(queryTokens);
    const phraseQuery = queryTokens.join(" ");
    const compactQuery = query.replace(/\s+/g, "");
    const queryNgrams = createCharacterNgrams(query);
    const requiredTokenSources = new Set(parsedQuery.requiredTokens);

    const scoreByDocument = new Map<string, number>();
    const tokenCoverage = new Map<string, Set<string>>();

    for (const queryToken of expandedTokens) {
      const alternatives = this.getAlternatives(queryToken.token);
      for (const alternative of alternatives) {
        const tokenPostings = this.postings.get(alternative.token);
        if (!tokenPostings) continue;

        const df = tokenPostings.size;
        const idf = Math.log(1 + (this.documents.size - df + 0.5) / (df + 0.5));

        for (const [documentKey, termFrequency] of tokenPostings.entries()) {
          const document = this.documents.get(documentKey);
          if (!document) continue;
          if (!this.matchesFilter(document, requestedType, requestedBranch)) continue;

          const documentLength = this.lengths.get(documentKey) ?? 1;
          const denominator =
            termFrequency +
            BM25_K1 * (1 - BM25_B + BM25_B * (documentLength / this.averageLength));

          const bm25 = idf * ((termFrequency * (BM25_K1 + 1)) / denominator);
          const boostedScore = bm25 * alternative.qualityBoost * queryToken.tokenBoost;

          scoreByDocument.set(documentKey, (scoreByDocument.get(documentKey) ?? 0) + boostedScore);

          if (!tokenCoverage.has(documentKey)) {
            tokenCoverage.set(documentKey, new Set());
          }
          tokenCoverage.get(documentKey)?.add(queryToken.source);
        }
      }
    }

    for (const [documentKey, baseScore] of scoreByDocument.entries()) {
      const document = this.documents.get(documentKey);
      if (!document) {
        scoreByDocument.delete(documentKey);
        continue;
      }
      if (!this.matchesQueryConstraints(document, parsedQuery)) {
        scoreByDocument.delete(documentKey);
        continue;
      }

      let score = baseScore;
      const coveredSourceTokens = tokenCoverage.get(documentKey) ?? new Set<string>();
      if (!this.hasRequiredCoverage(requiredTokenSources, coveredSourceTokens)) {
        scoreByDocument.delete(documentKey);
        continue;
      }

      const coveredTokens = coveredSourceTokens.size;
      score += (coveredTokens / Math.max(1, queryTokens.length)) * 2.4;

      if (document.normalizedTitle === query) score += 7.5;
      if (document.normalizedTitle.startsWith(query)) score += 4.8;
      if (document.normalizedTitle.includes(query)) score += 2.6;
      if (document.normalizedDescription.includes(query)) score += 1.4;
      if (document.normalizedTrackTitle.includes(query) && document.type === "course") score += 1.2;

      for (const phrase of parsedQuery.exactPhrases) {
        if (document.normalizedTitle.includes(phrase)) score += 4.1;
        if (document.normalizedDescription.includes(phrase)) score += 2.2;
        if (document.normalizedTrackTitle.includes(phrase)) score += 1.8;
      }

      if (phraseQuery.length > 3 && queryTokens.length > 1) {
        if (document.normalizedTitle.includes(phraseQuery)) score += 3.2;
        if (document.normalizedDescription.includes(phraseQuery)) score += 1.8;
        if (document.normalizedTrackTitle.includes(phraseQuery)) score += 1.3;
      }

      score += this.ngramDiceSimilarity(queryNgrams, document.titleNgrams) * 2.6;
      if (document.type === "course") {
        score += this.ngramDiceSimilarity(queryNgrams, document.trackTitleNgrams) * 1.25;
      }

      if (compactQuery.length >= 2 && compactQuery.length <= 8) {
        const titleAcronym = this.acronymFor(document.normalizedTitle);
        const trackAcronym = this.acronymFor(document.normalizedTrackTitle);
        if (titleAcronym.startsWith(compactQuery)) score += 1.9;
        if (trackAcronym.startsWith(compactQuery) && document.type === "course") score += 1.2;
      }

      if (parsedQuery.trackIntent && !parsedQuery.courseIntent && document.type === "track") {
        score += 1.25;
      }
      if (parsedQuery.courseIntent && !parsedQuery.trackIntent && document.type === "course") {
        score += 1.25;
      }

      if (document.type === "track") score += 0.25;
      if (requestedBranch && document.branches.includes(requestedBranch)) score += 0.4;

      scoreByDocument.set(documentKey, score);
    }

    // Fallback for sparse matches (e.g., complex phrase/exclusion combinations).
    if (scoreByDocument.size === 0) {
      for (const document of this.documents.values()) {
        if (!this.matchesFilter(document, requestedType, requestedBranch)) continue;
        if (!this.matchesQueryConstraints(document, parsedQuery)) continue;
        if (
          requiredTokenSources.size > 0 &&
          !parsedQuery.requiredTokens.every((token) => this.documentContainsToken(document, token))
        ) {
          continue;
        }

        const exactMatch =
          document.normalizedTitle.includes(query) ||
          document.normalizedDescription.includes(query) ||
          document.normalizedTrackTitle.includes(query);

        const tokenMatches = queryTokens.filter((token) => this.documentContainsToken(document, token)).length;
        const ngramFallback = this.ngramDiceSimilarity(queryNgrams, document.titleNgrams);

        if (!exactMatch && tokenMatches === 0 && ngramFallback < 0.16) continue;

        let fallbackScore = exactMatch ? 1.3 : 0.85;
        fallbackScore += (tokenMatches / Math.max(1, queryTokens.length)) * 0.8;
        fallbackScore += ngramFallback * 1.4;
        if (document.type === "track") fallbackScore += 0.15;
        scoreByDocument.set(document.key, fallbackScore);
      }
    }

    const ranked = [...scoreByDocument.entries()]
      .map(([documentKey, score]) => {
        const document = this.documents.get(documentKey);
        return document
          ? {
              score,
              document,
            }
          : null;
      })
      .filter((entry): entry is { score: number; document: SearchDocument } => Boolean(entry))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.document.type !== right.document.type) {
          return left.document.type === "track" ? -1 : 1;
        }
        return left.document.title.localeCompare(right.document.title);
      });

    const total = ranked.length;
    const results = ranked.slice(0, requestedLimit).map(({ document, score }) => ({
      type: document.type,
      trackId: document.trackId,
      courseId: document.courseId,
      title: document.title,
      description: document.description,
      trackTitle: document.trackTitle,
      duration: document.duration,
      lessons: document.lessons,
      level: document.level,
      branches: document.branches,
      score: Number(score.toFixed(5)),
      snippet: makeSnippet(document.description, query),
    }));

    return { total, results };
  }

  suggest(rawQuery: string, options: SearchOptions = {}): SearchSuggestion[] {
    const query = normalizeSuggestionQuery(rawQuery);
    if (!query) {
      return [];
    }

    const requestedType = options.type ?? "all";
    const requestedBranch = options.branch ? normalizeText(options.branch) : undefined;
    const requestedLimit = Math.max(1, Math.min(options.limit ?? 6, 20));
    const rawQueryTokens = query.split(" ").filter(Boolean);
    const normalizedQueryTokens = tokenize(query);
    const queryTokens = uniqueTokens(
      normalizedQueryTokens.length > 0 ? normalizedQueryTokens : rawQueryTokens,
    );
    const phraseTokens = rawQueryTokens.length > 0 ? rawQueryTokens : queryTokens;
    const queryPhrase = queryTokens.join(" ");
    const lastQueryToken = queryTokens.at(-1);

    const scoreByDocument = new Map<string, number>();
    const coveredSourcesByDocument = new Map<string, Set<string>>();

    const addScore = (documentKey: string, delta: number): void => {
      scoreByDocument.set(documentKey, (scoreByDocument.get(documentKey) ?? 0) + delta);
    };

    const markCoverage = (documentKey: string, sourceToken: string): void => {
      if (!sourceToken) return;
      if (!coveredSourcesByDocument.has(documentKey)) {
        coveredSourcesByDocument.set(documentKey, new Set());
      }
      coveredSourcesByDocument.get(documentKey)?.add(sourceToken);
    };

    const seedFromTrie = (prefix: string, multiplier: number): void => {
      const trieNode = this.findSuggestionNode(prefix);
      if (!trieNode) return;
      for (const [documentKey, prefixScore] of trieNode.candidates.entries()) {
        addScore(documentKey, prefixScore * multiplier);
      }
    };

    seedFromTrie(query, 1.28);
    if (phraseTokens.length > 1) {
      for (let index = 1; index < phraseTokens.length; index += 1) {
        const suffix = phraseTokens.slice(index).join(" ");
        if (!suffix) continue;
        seedFromTrie(suffix, Math.max(0.5, 1 - index * 0.18));
      }
    }
    if (lastQueryToken && lastQueryToken.length >= 2) {
      seedFromTrie(lastQueryToken, phraseTokens.length > 1 ? 0.8 : 0.96);
    }

    for (const expandedToken of this.expandQueryTokens(queryTokens)) {
      for (const alternative of this.getSuggestionAlternatives(expandedToken.token)) {
        const postings = this.suggestionTokenPostings.get(alternative.token);
        if (!postings) continue;

        const tokenContribution = alternative.qualityBoost * expandedToken.tokenBoost * 0.9;
        for (const [documentKey, tokenWeight] of postings.entries()) {
          addScore(documentKey, tokenWeight * tokenContribution);
          markCoverage(documentKey, expandedToken.source);
        }
      }
    }

    if (scoreByDocument.size === 0) {
      for (const [documentKey, document] of this.suggestionEntries.entries()) {
        if (!this.matchesSuggestionFilter(document, requestedType, requestedBranch)) continue;
        if (
          !document.normalizedTitle.includes(query) &&
          !(document.type === "course" && document.normalizedTrackTitle.includes(query))
        ) {
          continue;
        }
        addScore(documentKey, 0.42);
      }
    }

    const ranked = [...scoreByDocument.entries()]
      .map(([documentKey, seedScore]) => {
        const document = this.suggestionEntries.get(documentKey);
        if (!document) return null;
        if (!this.matchesSuggestionFilter(document, requestedType, requestedBranch)) return null;

        const coveredSources = new Set(coveredSourcesByDocument.get(documentKey) ?? []);
        for (const token of queryTokens) {
          if (this.documentContainsSuggestionToken(document, token)) {
            coveredSources.add(token);
          }
        }

        if (queryTokens.length > 1 && coveredSources.size === 0) {
          return null;
        }

        let score = seedScore;
        const coverageRatio = coveredSources.size / Math.max(1, queryTokens.length);
        if (queryTokens.length >= 3 && coverageRatio < 0.34) {
          return null;
        }
        score += coverageRatio * 2.2;

        if (document.normalizedTitle === query) {
          score += 3.8;
        } else if (document.normalizedTitle.startsWith(query)) {
          score += 2.9;
        } else if (document.normalizedTitle.includes(` ${query}`)) {
          score += 1.9;
        } else if (document.normalizedTitle.includes(query)) {
          score += 1.25;
        }

        if (queryPhrase.length > 3 && queryTokens.length > 1) {
          if (document.normalizedTitle.includes(queryPhrase)) score += 2.1;
          if (document.normalizedTrackTitle.includes(queryPhrase) && document.type === "course") score += 1.2;
        }

        if (lastQueryToken && lastQueryToken.length >= 2) {
          if (document.titleTokens.some((token) => token.startsWith(lastQueryToken))) {
            score += 0.95;
          }
          if (
            document.type === "course" &&
            document.trackTitleTokens.some((token) => token.startsWith(lastQueryToken))
          ) {
            score += 0.45;
          }
        }

        if (document.type === "course" && document.normalizedTrackTitle.includes(query)) {
          score += 0.9;
        }

        const compactQuery = query.replace(/\s+/g, "");
        if (compactQuery.length >= 2 && compactQuery.length <= 8) {
          if (this.acronymFor(document.normalizedTitle).startsWith(compactQuery)) score += 0.9;
          if (
            document.type === "course" &&
            this.acronymFor(document.normalizedTrackTitle).startsWith(compactQuery)
          ) {
            score += 0.45;
          }
        }

        if (document.type === "track") score += 0.22;
        if (requestedBranch && document.branches.includes(requestedBranch)) score += 0.35;

        return { score, document };
      })
      .filter((entry): entry is { score: number; document: SuggestionDocument } => Boolean(entry))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.document.type !== right.document.type) {
          return left.document.type === "track" ? -1 : 1;
        }
        return left.document.title.localeCompare(right.document.title);
      });

    return ranked.slice(0, requestedLimit).map(({ score, document }) => ({
      type: document.type,
      trackId: document.trackId,
      courseId: document.courseId,
      title: document.title,
      trackTitle: document.trackTitle,
      branches: document.branches,
      score: Number(score.toFixed(5)),
    }));
  }

  private indexSuggestionDocument(document: SearchDocument): void {
    const normalizedTitle = normalizeSuggestionQuery(document.title);
    const normalizedTrackTitle = normalizeSuggestionQuery(document.trackTitle);
    if (!normalizedTitle) {
      return;
    }

    const titleTokens = normalizedTitle.split(" ").filter(Boolean);
    const trackTitleTokens = normalizedTrackTitle.split(" ").filter(Boolean);

    this.suggestionEntries.set(document.key, {
      key: document.key,
      type: document.type,
      trackId: document.trackId,
      courseId: document.courseId,
      title: document.title,
      trackTitle: document.trackTitle,
      branches: document.branches,
      normalizedTitle,
      normalizedTrackTitle,
      titleTokens,
      trackTitleTokens,
    });

    if (titleTokens.length === 0) {
      return;
    }

    const entityBoost = document.type === "track" ? 1.22 : 1;

    for (let start = 0; start < titleTokens.length; start += 1) {
      const phrase = titleTokens.slice(start).join(" ");
      if (!phrase) continue;

      const suffixPenalty = Math.max(0.56, 1 - start * 0.16);
      this.insertSuggestionPrefix(phrase, document.key, entityBoost * suffixPenalty);
    }

    for (let index = 0; index < titleTokens.length; index += 1) {
      const tokenBoost = Math.max(0.58, 1 - index * 0.1);
      this.insertSuggestionToken(titleTokens[index], document.key, entityBoost * tokenBoost);
    }

    if (document.type === "course") {
      for (let index = 0; index < trackTitleTokens.length; index += 1) {
        const trackBoost = Math.max(0.35, 0.6 - index * 0.06);
        this.insertSuggestionToken(trackTitleTokens[index], document.key, trackBoost);
      }
    }
  }

  private insertSuggestionPrefix(prefix: string, documentKey: string, weight: number): void {
    let node = this.suggestionTrie;

    for (const character of prefix) {
      if (!node.children.has(character)) {
        node.children.set(character, createSuggestionTrieNode());
      }
      const child = node.children.get(character);
      if (!child) {
        return;
      }

      const existingWeight = child.candidates.get(documentKey);
      if (!existingWeight || weight > existingWeight) {
        child.candidates.set(documentKey, weight);
      }
      node = child;
    }
  }

  private insertSuggestionToken(token: string, documentKey: string, weight: number): void {
    const normalizedToken = normalizeSuggestionQuery(token).replace(/\s+/g, "");
    if (!normalizedToken) return;

    if (!this.suggestionTokenPostings.has(normalizedToken)) {
      this.suggestionTokenPostings.set(normalizedToken, new Map());
    }

    const tokenPostings = this.suggestionTokenPostings.get(normalizedToken);
    if (!tokenPostings) return;

    const existingWeight = tokenPostings.get(documentKey);
    if (!existingWeight || weight > existingWeight) {
      tokenPostings.set(documentKey, weight);
    }
  }

  private findSuggestionNode(prefix: string): SuggestionTrieNode | null {
    let node = this.suggestionTrie;
    for (const character of prefix) {
      const child = node.children.get(character);
      if (!child) {
        return null;
      }
      node = child;
    }
    return node;
  }

  private collectTerms(target: Map<string, number>, text: string, weight: number): void {
    for (const token of tokenize(text)) {
      target.set(token, (target.get(token) ?? 0) + weight);
    }
  }

  private expandQueryTokens(tokens: string[]): ExpandedQueryToken[] {
    const expanded: ExpandedQueryToken[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      const baseKey = `${token}|${token}`;
      if (!seen.has(baseKey)) {
        expanded.push({
          token,
          source: token,
          tokenBoost: 1,
        });
        seen.add(baseKey);
      }

      const synonyms = QUERY_SYNONYMS[token];
      if (!synonyms) continue;
      for (const synonym of synonyms) {
        const normalizedSynonym = normalizeText(synonym);
        if (!normalizedSynonym) continue;
        const expandedTokens = tokenize(normalizedSynonym);
        for (const expandedToken of expandedTokens) {
          const key = `${token}|${expandedToken}`;
          if (seen.has(key)) continue;
          seen.add(key);
          expanded.push({
            token: expandedToken,
            source: token,
            tokenBoost: 0.66,
          });
        }
      }
    }

    return expanded;
  }

  private acronymFor(value: string): string {
    const parts = value.split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    return parts.map((part) => part[0]).join("");
  }

  private getAlternatives(queryToken: string): AlternativeToken[] {
    const exact = this.postings.get(queryToken);
    if (exact) {
      return [{ token: queryToken, qualityBoost: 1 }];
    }

    const alternatives: AlternativeToken[] = [];
    for (const candidate of this.vocabulary) {
      if (Math.abs(candidate.length - queryToken.length) > 2) continue;
      if (candidate === queryToken) continue;

      if (candidate.startsWith(queryToken) || queryToken.startsWith(candidate)) {
        alternatives.push({ token: candidate, qualityBoost: 0.82 });
        continue;
      }

      const maxDistance = queryToken.length >= 8 ? 2 : 1;
      const distance = boundedLevenshtein(queryToken, candidate, maxDistance);
      if (distance !== null) {
        const qualityBoost = distance === 0 ? 1 : distance === 1 ? 0.72 : 0.62;
        alternatives.push({ token: candidate, qualityBoost });
      }
    }

    alternatives.sort((left, right) => right.qualityBoost - left.qualityBoost);
    return alternatives.slice(0, 5);
  }

  private getSuggestionAlternatives(queryToken: string): AlternativeToken[] {
    const normalizedToken = normalizeSuggestionQuery(queryToken).replace(/\s+/g, "");
    if (!normalizedToken) return [];

    const exact = this.suggestionTokenPostings.get(normalizedToken);
    if (exact) {
      return [{ token: normalizedToken, qualityBoost: 1 }];
    }

    const alternatives: AlternativeToken[] = [];
    for (const candidate of this.suggestionTokenVocabulary) {
      if (candidate === normalizedToken) continue;
      if (Math.abs(candidate.length - normalizedToken.length) > 2) continue;

      if (candidate.startsWith(normalizedToken) || normalizedToken.startsWith(candidate)) {
        alternatives.push({ token: candidate, qualityBoost: 0.86 });
        continue;
      }

      const maxDistance = normalizedToken.length >= 8 ? 2 : 1;
      const distance = boundedLevenshtein(normalizedToken, candidate, maxDistance);
      if (distance !== null) {
        const qualityBoost = distance === 1 ? 0.72 : 0.63;
        alternatives.push({ token: candidate, qualityBoost });
      }
    }

    alternatives.sort((left, right) => right.qualityBoost - left.qualityBoost);
    return alternatives.slice(0, 6);
  }

  private documentContainsToken(document: SearchDocument, token: string): boolean {
    return (
      document.normalizedTitle.includes(token) ||
      document.normalizedDescription.includes(token) ||
      document.normalizedTrackTitle.includes(token)
    );
  }

  private matchesQueryConstraints(document: SearchDocument, query: ParsedSearchQuery): boolean {
    if (query.excludedTokens.some((token) => this.documentContainsToken(document, token))) {
      return false;
    }

    for (const phrase of query.exactPhrases) {
      if (
        !document.normalizedTitle.includes(phrase) &&
        !document.normalizedDescription.includes(phrase) &&
        !document.normalizedTrackTitle.includes(phrase)
      ) {
        return false;
      }
    }

    return true;
  }

  private hasRequiredCoverage(
    requiredTokenSources: Set<string>,
    coveredSources: Set<string>,
  ): boolean {
    for (const token of requiredTokenSources) {
      if (!coveredSources.has(token)) {
        return false;
      }
    }
    return true;
  }

  private ngramDiceSimilarity(left: Set<string>, right: Set<string>): number {
    if (left.size === 0 || right.size === 0) return 0;

    const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
    let overlap = 0;
    for (const gram of smaller) {
      if (larger.has(gram)) overlap += 1;
    }

    const denominator = left.size + right.size;
    return denominator === 0 ? 0 : (2 * overlap) / denominator;
  }

  private matchesFilter(
    document: SearchDocument,
    type: SearchRequestType,
    branch?: string,
  ): boolean {
    if (type !== "all" && document.type !== type) return false;
    if (branch && !document.branches.includes(branch)) return false;
    return true;
  }

  private matchesSuggestionFilter(
    document: SuggestionDocument,
    type: SearchRequestType,
    branch?: string,
  ): boolean {
    if (type !== "all" && document.type !== type) return false;
    if (branch && !document.branches.includes(branch)) return false;
    return true;
  }

  private documentContainsSuggestionToken(document: SuggestionDocument, token: string): boolean {
    if (!token) return false;
    const normalizedToken = normalizeSuggestionQuery(token).replace(/\s+/g, "");
    if (!normalizedToken) return false;

    if (document.titleTokens.some((candidate) => candidate.startsWith(normalizedToken))) {
      return true;
    }
    if (
      document.type === "course" &&
      document.trackTitleTokens.some((candidate) => candidate.startsWith(normalizedToken))
    ) {
      return true;
    }

    return (
      document.normalizedTitle.startsWith(normalizedToken) ||
      document.normalizedTitle.includes(` ${normalizedToken}`) ||
      (document.type === "course" &&
        (document.normalizedTrackTitle.startsWith(normalizedToken) ||
          document.normalizedTrackTitle.includes(` ${normalizedToken}`)))
    );
  }
}
