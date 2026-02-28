export type CourseQuestionDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type CourseQuestionType = "coding" | "concept";

export interface CourseQuestion {
  id: string;
  title: string;
  summary: string;
  source: "codeforces" | "stackexchange" | "fallback";
  sourceLabel: string;
  url: string;
  difficulty: CourseQuestionDifficulty;
  tags: string[];
  type: CourseQuestionType;
  languageHints: string[];
}

export interface CourseQuestionRequest {
  branch?: string;
  trackId?: string;
  trackTitle?: string;
  courseId?: string;
  courseTitle?: string;
  keywords?: string[];
  limit: number;
}

export interface CourseQuestionResult {
  query: string;
  source: "aggregated" | "fallback";
  sources: string[];
  results: CourseQuestion[];
}

interface StackExchangeResponse {
  items?: Array<{
    question_id?: number;
    title?: string;
    link?: string;
    tags?: string[];
    score?: number;
    answer_count?: number;
  }>;
}

interface CodeforcesResponse {
  status?: string;
  result?: {
    problems?: Array<{
      contestId?: number;
      index?: string;
      name?: string;
      rating?: number;
      tags?: string[];
    }>;
    problemStatistics?: Array<{
      contestId?: number;
      index?: string;
      solvedCount?: number;
    }>;
  };
}

interface CuratedQuestionSeed {
  id: string;
  title: string;
  summary: string;
  url: string;
  tags: string[];
  difficulty: CourseQuestionDifficulty;
  type: CourseQuestionType;
  languageHints: string[];
}

const DEFAULT_LANGUAGE_HINTS = ["javascript", "python", "sql", "cpp"];
const DEFAULT_QUERY = "software engineering problem solving";

const codingKeywords = new Set([
  "code",
  "coding",
  "algorithm",
  "algorithms",
  "data",
  "structure",
  "structures",
  "javascript",
  "python",
  "sql",
  "java",
  "cpp",
  "c++",
  "typescript",
  "react",
  "node",
  "backend",
  "frontend",
  "devops",
  "cloud",
  "security",
  "dsa",
  "interview",
  "problem",
  "problems",
]);

const codeforcesTagMap: Record<string, string> = {
  array: "implementation",
  arrays: "implementation",
  graph: "graphs",
  graphs: "graphs",
  tree: "trees",
  trees: "trees",
  dp: "dp",
  dynamic: "dp",
  string: "strings",
  strings: "strings",
  math: "math",
  sort: "sortings",
  sorting: "sortings",
  greedy: "greedy",
};

const curatedQuestionSeeds: CuratedQuestionSeed[] = [
  {
    id: "lc-two-sum",
    title: "Two Sum",
    summary: "Hash-map based warmup problem for indexing and pair lookup.",
    url: "https://leetcode.com/problems/two-sum/",
    tags: ["algorithms", "arrays", "hashmap", "dsa", "coding"],
    difficulty: "Beginner",
    type: "coding",
    languageHints: ["javascript", "python", "java", "cpp"],
  },
  {
    id: "lc-merge-sorted-lists",
    title: "Merge Two Sorted Lists",
    summary: "Classic linked-list merge pattern used across interview rounds.",
    url: "https://leetcode.com/problems/merge-two-sorted-lists/",
    tags: ["linked-list", "algorithms", "dsa", "coding"],
    difficulty: "Beginner",
    type: "coding",
    languageHints: ["javascript", "python", "java", "cpp"],
  },
  {
    id: "lc-number-of-islands",
    title: "Number of Islands",
    summary: "DFS/BFS traversal question for grids and connected components.",
    url: "https://leetcode.com/problems/number-of-islands/",
    tags: ["graphs", "dfs", "bfs", "algorithms", "coding"],
    difficulty: "Intermediate",
    type: "coding",
    languageHints: ["javascript", "python", "java", "cpp"],
  },
  {
    id: "lc-lru-cache",
    title: "LRU Cache",
    summary: "Data-structure design question using hashmap + linked list.",
    url: "https://leetcode.com/problems/lru-cache/",
    tags: ["design", "dsa", "cache", "algorithms", "coding"],
    difficulty: "Advanced",
    type: "coding",
    languageHints: ["javascript", "python", "java", "cpp"],
  },
  {
    id: "hr-30-days-datatypes",
    title: "HackerRank 30 Days - Data Types",
    summary: "Structured beginner problem set to build coding rhythm.",
    url: "https://www.hackerrank.com/challenges/30-data-types/problem",
    tags: ["beginner", "coding", "practice", "fundamentals"],
    difficulty: "Beginner",
    type: "coding",
    languageHints: ["javascript", "python", "java", "cpp"],
  },
  {
    id: "hr-ctci-ransom-note",
    title: "Ransom Note",
    summary: "Frequency-count challenge useful for map/dictionary mastery.",
    url: "https://www.hackerrank.com/challenges/ctci-ransom-note/problem",
    tags: ["algorithms", "hashmap", "coding", "interview"],
    difficulty: "Intermediate",
    type: "coding",
    languageHints: ["javascript", "python", "java", "cpp"],
  },
  {
    id: "sqlbolt-select-intro",
    title: "SQLBolt - SELECT Queries Introduction",
    summary: "Guided SQL challenge set for query fundamentals.",
    url: "https://sqlbolt.com/lesson/select_queries_introduction",
    tags: ["sql", "database", "query", "analytics"],
    difficulty: "Beginner",
    type: "coding",
    languageHints: ["sql"],
  },
  {
    id: "sqlzoo-select-basics",
    title: "SQLZoo - SELECT basics",
    summary: "Practice query comprehension with self-paced SQL tasks.",
    url: "https://sqlzoo.net/wiki/SELECT_basics",
    tags: ["sql", "database", "query", "practice"],
    difficulty: "Beginner",
    type: "coding",
    languageHints: ["sql"],
  },
  {
    id: "gfg-dsa-top50",
    title: "GeeksforGeeks - Top 50 Array Interview Questions",
    summary: "Curated DSA question pack with progressive difficulty.",
    url: "https://www.geeksforgeeks.org/top-50-array-coding-problems-for-interviews/",
    tags: ["arrays", "dsa", "interview", "algorithms"],
    difficulty: "Intermediate",
    type: "coding",
    languageHints: ["javascript", "python", "cpp", "java"],
  },
  {
    id: "gfg-system-design",
    title: "GeeksforGeeks - System Design Case Studies",
    summary: "Architecture-style problems for large-scale backend thinking.",
    url: "https://www.geeksforgeeks.org/system-design-tutorial/",
    tags: ["system design", "backend", "scaling", "architecture"],
    difficulty: "Advanced",
    type: "concept",
    languageHints: ["javascript", "python", "go", "java"],
  },
  {
    id: "owasp-top10",
    title: "OWASP Top 10 - Security Risk Scenarios",
    summary: "Security scenario questions and mitigation strategy references.",
    url: "https://owasp.org/www-project-top-ten/",
    tags: ["security", "cybersecurity", "web", "backend"],
    difficulty: "Intermediate",
    type: "concept",
    languageHints: ["javascript", "python", "java"],
  },
  {
    id: "linux-foundation-k8s-questions",
    title: "Kubernetes Concepts - Question Bank",
    summary: "Core K8s architecture and deployment scenario challenges.",
    url: "https://kubernetes.io/docs/concepts/",
    tags: ["kubernetes", "devops", "cloud", "deployment"],
    difficulty: "Advanced",
    type: "concept",
    languageHints: ["yaml", "bash", "go"],
  },
  {
    id: "electronics-se-analog-faq",
    title: "Electronics StackExchange - Analog Design Questions",
    summary: "Community-curated analog and digital electronics challenges.",
    url: "https://electronics.stackexchange.com/questions/tagged/analog",
    tags: ["electronics", "analog", "ece", "circuits"],
    difficulty: "Intermediate",
    type: "concept",
    languageHints: ["matlab", "python"],
  },
  {
    id: "electronics-se-fpga",
    title: "Electronics StackExchange - FPGA Questions",
    summary: "Practical FPGA and HDL design questions for ECE tracks.",
    url: "https://electronics.stackexchange.com/questions/tagged/fpga",
    tags: ["fpga", "verilog", "hdl", "ece"],
    difficulty: "Advanced",
    type: "concept",
    languageHints: ["verilog", "vhdl", "python"],
  },
  {
    id: "kaggle-intro",
    title: "Kaggle - Intro to Machine Learning Exercises",
    summary: "Hands-on ML exercises with notebooks and graded practice.",
    url: "https://www.kaggle.com/learn/intro-to-machine-learning",
    tags: ["machine learning", "data science", "python", "ml"],
    difficulty: "Intermediate",
    type: "coding",
    languageHints: ["python", "sql"],
  },
];

let codeforcesCache:
  | {
      expiresAt: number;
      payload: CodeforcesResponse["result"];
    }
  | null = null;

const toTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

const buildQuery = (request: CourseQuestionRequest): string => {
  const parts = [
    request.courseTitle,
    request.trackTitle,
    ...(request.keywords ?? []),
    request.branch,
  ]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .map((value) => value.trim());

  return parts.join(" ").trim() || DEFAULT_QUERY;
};

const withTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const dedupeQuestions = (questions: CourseQuestion[]): CourseQuestion[] => {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = `${question.title.toLowerCase()}|${question.url.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const scoreTextMatch = (question: { title: string; summary: string; tags: string[] }, tokens: string[]): number => {
  const title = question.title.toLowerCase();
  const summary = question.summary.toLowerCase();
  const tags = question.tags.map((tag) => tag.toLowerCase());
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (summary.includes(token)) score += 4;
    if (tags.some((tag) => tag.includes(token))) score += 5;
  }

  return score;
};

const difficultyFromStackScore = (score: number | undefined): CourseQuestionDifficulty => {
  const value = score ?? 0;
  if (value >= 35) return "Advanced";
  if (value >= 10) return "Intermediate";
  return "Beginner";
};

const difficultyFromCodeforcesRating = (rating: number | undefined): CourseQuestionDifficulty => {
  const value = rating ?? 0;
  if (value >= 1700) return "Advanced";
  if (value >= 1200) return "Intermediate";
  return "Beginner";
};

const siteForRequest = (request: CourseQuestionRequest, tokens: string[]): string => {
  const lowered = [
    request.branch ?? "",
    request.trackTitle ?? "",
    request.courseTitle ?? "",
    ...tokens,
  ]
    .join(" ")
    .toLowerCase();

  if (/(ece|ee|fpga|verilog|embedded|signal|communication|circuit|microcontroller)/.test(lowered)) {
    return "electronics";
  }
  if (/(statistics|machine learning|data science|analytics|ml|nlp|cv)/.test(lowered)) {
    return "stats";
  }
  if (/(security|cyber|owasp|vulnerability|encryption)/.test(lowered)) {
    return "security";
  }
  if (/(devops|docker|kubernetes|cloud|sre|ci|cd)/.test(lowered)) {
    return "serverfault";
  }
  return "stackoverflow";
};

const languageHintsFromText = (text: string): string[] => {
  const lowered = text.toLowerCase();
  if (lowered.includes("sql")) return ["sql"];
  if (lowered.includes("verilog") || lowered.includes("fpga")) return ["verilog", "python"];
  if (lowered.includes("python") || lowered.includes("machine learning")) return ["python", "sql"];
  if (lowered.includes("java")) return ["java", "python"];
  if (lowered.includes("c++") || lowered.includes("cpp")) return ["cpp", "python"];
  return DEFAULT_LANGUAGE_HINTS;
};

const selectCodeforcesTag = (tokens: string[]): string | null => {
  for (const token of tokens) {
    const matched = codeforcesTagMap[token];
    if (matched) return matched;
  }
  return tokens.some((token) => codingKeywords.has(token)) ? "implementation" : null;
};

const fetchStackExchangeQuestions = async (
  request: CourseQuestionRequest,
  query: string,
  tokens: string[],
  limit: number,
): Promise<CourseQuestion[]> => {
  const site = siteForRequest(request, tokens);
  const params = new URLSearchParams({
    order: "desc",
    sort: "votes",
    accepted: "True",
    answers: "1",
    pagesize: String(Math.min(12, limit + 4)),
    site,
    title: query,
  });

  const response = await withTimeout(
    (signal) =>
      fetch(`https://api.stackexchange.com/2.3/search/advanced?${params.toString()}`, {
        signal,
      }),
    8_000,
  );

  if (!response.ok) {
    throw new Error(`StackExchange API failed (${response.status})`);
  }

  const payload = (await response.json()) as StackExchangeResponse;
  const mapped = (payload.items ?? [])
    .filter((item) => item.question_id && item.link && item.title)
    .map((item): CourseQuestion => ({
      id: `se-${item.question_id}`,
      title: item.title ?? "Untitled question",
      summary: `Accepted community question from ${site} with ${item.answer_count ?? 0} answers.`,
      source: "stackexchange",
      sourceLabel: `StackExchange (${site})`,
      url: item.link ?? "",
      difficulty: difficultyFromStackScore(item.score),
      tags: (item.tags ?? []).slice(0, 6),
      type: "concept",
      languageHints: languageHintsFromText(`${item.title ?? ""} ${(item.tags ?? []).join(" ")}`),
    }));

  return mapped
    .map((question, index) => ({
      question,
      score: scoreTextMatch(question, tokens),
      index,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .slice(0, limit)
    .map((entry) => entry.question);
};

const fetchCodeforcesDataset = async (tag: string): Promise<CodeforcesResponse["result"]> => {
  const now = Date.now();
  if (codeforcesCache && now < codeforcesCache.expiresAt) {
    return codeforcesCache.payload;
  }

  const response = await withTimeout(
    (signal) =>
      fetch(`https://codeforces.com/api/problemset.problems?tags=${encodeURIComponent(tag)}`, {
        signal,
      }),
    8_000,
  );

  if (!response.ok) {
    throw new Error(`Codeforces API failed (${response.status})`);
  }

  const payload = (await response.json()) as CodeforcesResponse;
  if (payload.status !== "OK" || !payload.result) {
    throw new Error("Codeforces API returned invalid payload");
  }

  codeforcesCache = {
    payload: payload.result,
    expiresAt: now + 30 * 60 * 1000,
  };
  return payload.result;
};

const fetchCodeforcesQuestions = async (
  query: string,
  tokens: string[],
  limit: number,
): Promise<CourseQuestion[]> => {
  const selectedTag = selectCodeforcesTag(tokens);
  if (!selectedTag) {
    return [];
  }

  const dataset = await fetchCodeforcesDataset(selectedTag);
  const problems = dataset.problems ?? [];
  const stats = dataset.problemStatistics ?? [];
  const solvedMap = new Map<string, number>();

  for (const stat of stats) {
    if (!stat.contestId || !stat.index) continue;
    solvedMap.set(`${stat.contestId}-${stat.index}`, stat.solvedCount ?? 0);
  }

  const mapped = problems
    .filter((problem) => problem.contestId && problem.index && problem.name)
    .map((problem): CourseQuestion => {
      const key = `${problem.contestId}-${problem.index}`;
      const solvedCount = solvedMap.get(key) ?? 0;
      return {
        id: `cf-${problem.contestId}-${problem.index}`,
        title: problem.name ?? "Codeforces Problem",
        summary: `Codeforces problem (${selectedTag}) solved by ${solvedCount.toLocaleString()} users.`,
        source: "codeforces",
        sourceLabel: "Codeforces",
        url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
        difficulty: difficultyFromCodeforcesRating(problem.rating),
        tags: (problem.tags ?? []).slice(0, 8),
        type: "coding",
        languageHints: ["cpp", "python", "java", "javascript"],
      };
    });

  const loweredQuery = query.toLowerCase();
  return mapped
    .map((question, index) => {
      const solvedCount = Number(question.summary.match(/\d[\d,]*/)?.[0].replace(/,/g, "") ?? 0);
      let score = scoreTextMatch(question, tokens);
      if (question.title.toLowerCase().includes(loweredQuery)) {
        score += 10;
      }
      score += Math.min(15, Math.round(solvedCount / 10000));
      return { question, score, index };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .slice(0, limit)
    .map((entry) => entry.question);
};

const fallbackQuestions = (query: string, tokens: string[], limit: number): CourseQuestion[] => {
  const normalized = curatedQuestionSeeds.map((seed): CourseQuestion => ({
    id: `fb-${seed.id}`,
    title: seed.title,
    summary: seed.summary,
    source: "fallback",
    sourceLabel: "Curated Web Questions",
    url: seed.url,
    difficulty: seed.difficulty,
    tags: seed.tags,
    type: seed.type,
    languageHints: seed.languageHints,
  }));

  return normalized
    .map((question, index) => {
      let score = scoreTextMatch(question, tokens);
      if (question.title.toLowerCase().includes(query.toLowerCase())) {
        score += 8;
      }
      return { question, score, index };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.index - right.index;
    })
    .slice(0, limit)
    .map((entry) => entry.question);
};

export const collectCourseQuestions = async (
  request: CourseQuestionRequest,
): Promise<CourseQuestionResult> => {
  const query = buildQuery(request);
  const tokens = toTokens(`${query} ${(request.keywords ?? []).join(" ")}`);
  const safeLimit = Math.max(1, Math.min(20, request.limit));

  const [stackExchangeResult, codeforcesResult] = await Promise.allSettled([
    fetchStackExchangeQuestions(request, query, tokens, safeLimit),
    fetchCodeforcesQuestions(query, tokens, safeLimit),
  ]);

  const external: CourseQuestion[] = [];
  const sources: string[] = [];

  if (stackExchangeResult.status === "fulfilled" && stackExchangeResult.value.length > 0) {
    external.push(...stackExchangeResult.value);
    sources.push("stackexchange");
  }
  if (codeforcesResult.status === "fulfilled" && codeforcesResult.value.length > 0) {
    external.push(...codeforcesResult.value);
    sources.push("codeforces");
  }

  const curated = fallbackQuestions(query, tokens, safeLimit);
  const merged = dedupeQuestions([...external, ...curated]).slice(0, safeLimit);

  return {
    query,
    source: external.length > 0 ? "aggregated" : "fallback",
    sources: external.length > 0 ? sources : ["fallback"],
    results: merged,
  };
};
