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
}

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
  private readonly vocabulary: string[];
  private readonly averageLength: number;

  constructor(tracks: CatalogTrackRecord[]) {
    const docs = makeSearchDocuments(tracks);
    let weightedLengthSum = 0;

    for (const document of docs) {
      this.documents.set(document.key, document);

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
    this.averageLength = docs.length > 0 ? weightedLengthSum / docs.length : 1;
  }

  search(rawQuery: string, options: SearchOptions = {}): SearchResultSet {
    const query = normalizeText(rawQuery);
    if (!query) {
      return { total: 0, results: [] };
    }

    const requestedType = options.type ?? "all";
    const requestedBranch = options.branch ? normalizeText(options.branch) : undefined;
    const requestedLimit = Math.max(1, Math.min(options.limit ?? 10, 50));

    let queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      queryTokens = query.split(" ").filter(Boolean);
    }
    const expandedTokens = this.expandQueryTokens(queryTokens);
    const phraseQuery = queryTokens.join(" ");
    const compactQuery = query.replace(/\s+/g, "");

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
      if (!document) continue;

      let score = baseScore;
      const coveredTokens = tokenCoverage.get(documentKey)?.size ?? 0;
      score += (coveredTokens / Math.max(1, queryTokens.length)) * 2.4;

      if (document.normalizedTitle === query) score += 7.5;
      if (document.normalizedTitle.startsWith(query)) score += 4.8;
      if (document.normalizedTitle.includes(query)) score += 2.6;
      if (document.normalizedDescription.includes(query)) score += 1.4;
      if (document.normalizedTrackTitle.includes(query) && document.type === "course") score += 1.2;

      if (phraseQuery.length > 3 && queryTokens.length > 1) {
        if (document.normalizedTitle.includes(phraseQuery)) score += 3.2;
        if (document.normalizedDescription.includes(phraseQuery)) score += 1.8;
        if (document.normalizedTrackTitle.includes(phraseQuery)) score += 1.3;
      }

      if (compactQuery.length >= 2 && compactQuery.length <= 8) {
        const titleAcronym = this.acronymFor(document.normalizedTitle);
        const trackAcronym = this.acronymFor(document.normalizedTrackTitle);
        if (titleAcronym.startsWith(compactQuery)) score += 1.9;
        if (trackAcronym.startsWith(compactQuery) && document.type === "course") score += 1.2;
      }

      if (document.type === "track") score += 0.25;
      if (requestedBranch && document.branches.includes(requestedBranch)) score += 0.4;

      scoreByDocument.set(documentKey, score);
    }

    // Phrase-only fallback so short searches still return useful results.
    if (scoreByDocument.size === 0) {
      for (const document of this.documents.values()) {
        if (!this.matchesFilter(document, requestedType, requestedBranch)) continue;
        if (
          document.normalizedTitle.includes(query) ||
          document.normalizedDescription.includes(query) ||
          document.normalizedTrackTitle.includes(query)
        ) {
          const fallbackScore = document.normalizedTitle.includes(query) ? 1.3 : 1;
          scoreByDocument.set(document.key, fallbackScore);
        }
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

  private matchesFilter(
    document: SearchDocument,
    type: SearchRequestType,
    branch?: string,
  ): boolean {
    if (type !== "all" && document.type !== type) return false;
    if (branch && !document.branches.includes(branch)) return false;
    return true;
  }
}
