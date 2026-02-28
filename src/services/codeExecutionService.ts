const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? "");
const codeApiBase = `${apiBaseUrl}/api/code`;

export interface ExecutionLanguage {
  id: number;
  name: string;
}

export interface ExecutionTestCase {
  input: string;
  expectedOutput?: string;
}

export interface ExecuteCodeRequest {
  languageId: number;
  sourceCode: string;
  testCases: ExecutionTestCase[];
}

export interface ExecuteTestResult {
  testCase: number;
  passed: boolean;
  statusId: number;
  statusDescription: string;
  input: string;
  expectedOutput?: string;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  message?: string;
  time?: string;
  memory?: number;
  diagnostic?: ExecutionDiagnostic;
}

export interface ExecutionDiagnostic {
  category:
    | "success"
    | "compilation"
    | "runtime"
    | "wrong-answer"
    | "timeout"
    | "resource"
    | "system";
  severity: "info" | "warning" | "error";
  summary: string;
  likelyCauses: string[];
  suggestedFixes: string[];
  lineHints: number[];
  confidence: number;
}

export interface ExecuteCodeResponse {
  total: number;
  passedCount: number;
  tookMs: number;
  provider?: string;
  fallbackFrom?: string;
  results: ExecuteTestResult[];
}

export interface CodeSubmissionRequest {
  userId: string;
  problemId: string;
  problemTitle: string;
  language: string;
  runtimeName?: string;
  sourceCode: string;
  totalTests: number;
  passedTests: number;
  tookMs: number;
}

export interface CodeSubmissionResponse {
  id: string;
  submittedAt: string;
  passedTests: number;
  totalTests: number;
  tookMs: number;
  status: "accepted" | "partial";
}

export interface CodeSubmissionRow {
  id: string;
  problemId: string;
  problemTitle: string;
  language: string;
  runtimeName?: string;
  passedTests: number;
  totalTests: number;
  tookMs: number;
  submittedAt: string;
  status: "accepted" | "partial";
}

interface CodeSubmissionListPayload {
  total: number;
  rows: CodeSubmissionRow[];
}

interface LanguagesPayload {
  total: number;
  provider?: string;
  fallbackFrom?: string;
  languages: ExecutionLanguage[];
}

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

export const fetchExecutionLanguages = async (): Promise<ExecutionLanguage[]> => {
  const response = await fetch(`${codeApiBase}/languages`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as LanguagesPayload;
  return payload.languages;
};

export const executeCode = async (request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> => {
  const response = await fetch(`${codeApiBase}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as ExecuteCodeResponse;
};

export const submitCode = async (request: CodeSubmissionRequest): Promise<CodeSubmissionResponse> => {
  const response = await fetch(`${codeApiBase}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as CodeSubmissionResponse;
};

export const fetchCodeSubmissions = async (request: {
  userId: string;
  limit?: number;
  problemId?: string;
}): Promise<CodeSubmissionRow[]> => {
  const params = new URLSearchParams({
    userId: request.userId,
  });
  if (request.limit) {
    params.set("limit", String(request.limit));
  }
  if (request.problemId) {
    params.set("problemId", request.problemId);
  }

  const response = await fetch(`${codeApiBase}/submissions?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as CodeSubmissionListPayload;
  return payload.rows;
};
