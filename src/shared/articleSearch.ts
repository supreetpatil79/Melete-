import type { TechNewsArticle } from "@/services/techNewsService";

const QUERY_PART_PATTERN = /"([^"]+)"|(\S+)/g;
const TOKEN_PATTERN = /[^a-z0-9+#.]+/g;
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
  "news",
  "tech",
]);

interface ParsedArticleQuery {
  normalizedQuery: string;
  tokens: string[];
  requiredTokens: string[];
  excludedTokens: string[];
  exactPhrases: string[];
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(TOKEN_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const unique = (values: string[]): string[] => [...new Set(values)];

const createNgrams = (value: string, n = 3): Set<string> => {
  const compact = normalizeText(value).replace(/[^a-z0-9+#.]/g, "");
  if (!compact) return new Set();
  if (compact.length <= n) return new Set([compact]);

  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - n; index += 1) {
    grams.add(compact.slice(index, index + n));
  }
  return grams;
};

const diceSimilarity = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 || right.size === 0) return 0;
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];

  let overlap = 0;
  for (const gram of smaller) {
    if (larger.has(gram)) overlap += 1;
  }

  return (2 * overlap) / (left.size + right.size);
};

const parseQuery = (rawQuery: string): ParsedArticleQuery => {
  const normalizedQuery = normalizeText(rawQuery);
  if (!normalizedQuery) {
    return {
      normalizedQuery: "",
      tokens: [],
      requiredTokens: [],
      excludedTokens: [],
      exactPhrases: [],
    };
  }

  const tokens: string[] = [];
  const requiredTokens: string[] = [];
  const excludedTokens: string[] = [];
  const exactPhrases: string[] = [];

  for (const match of rawQuery.matchAll(QUERY_PART_PATTERN)) {
    const phrasePart = match[1];
    const tokenPart = match[2];

    if (phrasePart) {
      const normalizedPhrase = normalizeText(phrasePart);
      if (!normalizedPhrase) continue;
      exactPhrases.push(normalizedPhrase);
      const phraseTokens = tokenize(normalizedPhrase);
      tokens.push(...phraseTokens);
      requiredTokens.push(...phraseTokens);
      continue;
    }

    if (!tokenPart) continue;
    const token = tokenPart.trim();
    if (!token) continue;

    const isExcluded = token.startsWith("-") && token.length > 1;
    const isRequired = token.startsWith("+") && token.length > 1;
    const cleaned = normalizeText(isExcluded || isRequired ? token.slice(1) : token);
    if (!cleaned) continue;

    const parsedTokens = tokenize(cleaned);
    if (parsedTokens.length === 0) continue;

    if (isExcluded) {
      excludedTokens.push(...parsedTokens);
      continue;
    }

    tokens.push(...parsedTokens);
    if (isRequired) {
      requiredTokens.push(...parsedTokens);
    }
  }

  if (tokens.length === 0) {
    tokens.push(...tokenize(normalizedQuery));
  }

  return {
    normalizedQuery,
    tokens: unique(tokens),
    requiredTokens: unique(requiredTokens),
    excludedTokens: unique(excludedTokens),
    exactPhrases: unique(exactPhrases),
  };
};

const daysSince = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 999;
  return Math.max(0, (Date.now() - parsed) / (24 * 60 * 60 * 1000));
};

const articleMatchesConstraints = (
  article: TechNewsArticle,
  parsedQuery: ParsedArticleQuery,
): boolean => {
  const normalizedTitle = normalizeText(article.title);
  const normalizedSummary = normalizeText(article.summary);
  const normalizedSource = normalizeText(article.source);
  const normalizedQueryText = normalizeText(article.query);
  const fullText = `${normalizedTitle} ${normalizedSummary} ${normalizedSource} ${normalizedQueryText}`;

  if (parsedQuery.excludedTokens.some((token) => fullText.includes(token))) {
    return false;
  }

  if (parsedQuery.requiredTokens.some((token) => !fullText.includes(token))) {
    return false;
  }

  for (const phrase of parsedQuery.exactPhrases) {
    if (
      !normalizedTitle.includes(phrase) &&
      !normalizedSummary.includes(phrase) &&
      !normalizedQueryText.includes(phrase)
    ) {
      return false;
    }
  }

  return true;
};

const scoreArticle = (article: TechNewsArticle, parsedQuery: ParsedArticleQuery): number => {
  const normalizedTitle = normalizeText(article.title);
  const normalizedSummary = normalizeText(article.summary);
  const normalizedSource = normalizeText(article.source);
  const normalizedQueryText = normalizeText(article.query);

  const compactArticleText = `${normalizedTitle} ${normalizedSummary} ${normalizedQueryText}`;
  let score = 0;
  let tokenHits = 0;

  for (const token of parsedQuery.tokens) {
    if (normalizedTitle.includes(token)) {
      score += 5.1;
      tokenHits += 1;
    }
    if (normalizedSummary.includes(token)) {
      score += 2.2;
      tokenHits += 1;
    }
    if (normalizedQueryText.includes(token)) {
      score += 3.6;
      tokenHits += 1;
    }
    if (normalizedSource.includes(token)) {
      score += 1.1;
      tokenHits += 1;
    }
  }

  for (const phrase of parsedQuery.exactPhrases) {
    if (normalizedTitle.includes(phrase)) score += 6.2;
    if (normalizedSummary.includes(phrase)) score += 3.1;
    if (normalizedQueryText.includes(phrase)) score += 4.2;
  }

  if (compactArticleText.includes(parsedQuery.normalizedQuery)) {
    score += 3;
  }
  if (normalizedTitle.startsWith(parsedQuery.normalizedQuery)) {
    score += 3.8;
  }

  const queryNgrams = createNgrams(parsedQuery.normalizedQuery);
  score += diceSimilarity(queryNgrams, createNgrams(normalizedTitle)) * 2.6;
  score += diceSimilarity(queryNgrams, createNgrams(normalizedSummary)) * 1.2;
  score += (tokenHits / Math.max(1, parsedQuery.tokens.length)) * 2.1;

  score += Math.max(0, 1.8 - daysSince(article.publishedAt) / 4.5);
  score += Math.min(3.5, article.score / 40);

  return Number(score.toFixed(5));
};

export const searchTechNewsArticles = (
  articles: TechNewsArticle[],
  rawQuery: string,
  limit = 80,
): TechNewsArticle[] => {
  const parsedQuery = parseQuery(rawQuery);
  if (!parsedQuery.normalizedQuery) {
    return articles.slice(0, Math.max(1, limit));
  }

  const ranked = articles
    .filter((article) => articleMatchesConstraints(article, parsedQuery))
    .map((article) => ({
      article,
      score: scoreArticle(article, parsedQuery),
    }))
    .filter((entry) => entry.score > 0.2)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return Date.parse(right.article.publishedAt) - Date.parse(left.article.publishedAt);
    });

  return ranked.slice(0, Math.max(1, limit)).map((entry) => entry.article);
};
