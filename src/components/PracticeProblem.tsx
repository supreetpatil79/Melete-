import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Editor from "@monaco-editor/react";
import { Play, Check, X, Copy, RefreshCw, Lightbulb, Send, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useAuth } from "@/context/AuthContext";
import { safeStorage } from "@/lib/safeStorage";
import { getLearnerDnaSummary } from "@/services/learnerProfileService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  executeCode,
  fetchExecutionLanguages,
  type ExecuteTestResult,
  type ExecutionLanguage,
} from "@/services/codeExecutionService";
import {
  requestGapAnalysis,
  requestHint,
  type GapAnalysisResult,
  type HintResult,
} from "@/services/aiCoachService";

export interface PracticeExecutionPayload {
  problemId: string;
  problemTitle: string;
  topicId?: string;
  topicTitle?: string;
  language: string;
  runtimeName?: string;
  totalTests: number;
  passedTests: number;
  tookMs: number;
  results: ExecuteTestResult[];
}

interface PracticeProblemProps {
  id: string;
  title: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;
  template: string;
  testCases: Array<{
    input: string;
    expected: string;
    explanation?: string;
  }>;
  topicId?: string;
  topicTitle?: string;
  onExecutionComplete?: (payload: PracticeExecutionPayload) => void;
}

const difficultyColor = {
  Easy: "text-green-600",
  Medium: "text-yellow-600",
  Hard: "text-red-600",
} as const;

const DRAFT_STORAGE_PREFIX = "learnpath_practice_draft_";

const normalizeLanguageName = (value: string): string => value.toLowerCase().trim();

const getMonacoLanguage = (runtimeName: string | undefined): string => {
  if (!runtimeName) return "plaintext";
  const normalized = normalizeLanguageName(runtimeName);

  if (normalized.includes("typescript")) return "typescript";
  if (normalized.includes("javascript") || normalized.includes("node.js")) return "javascript";
  if (normalized.includes("python")) return "python";
  if (normalized.includes("java ") || normalized === "java") return "java";
  if (normalized.includes("c++")) return "cpp";
  if (normalized.includes("c#")) return "csharp";
  if (normalized.includes("go")) return "go";
  if (normalized.includes("rust")) return "rust";
  if (normalized.includes("ruby")) return "ruby";
  if (normalized.includes("php")) return "php";
  if (normalized.includes("sql")) return "sql";
  if (normalized.includes("verilog")) return "verilog";
  if (normalized.includes("swift")) return "swift";
  return "plaintext";
};

const runtimeAliases: Record<string, string[]> = {
  javascript: ["javascript", "node.js"],
  python: ["python"],
  sql: ["sql", "sqlite"],
  verilog: ["verilog"],
};

const starterTemplates: Record<string, string> = {
  javascript: `function solve(rawInput) {
  const data = JSON.parse(rawInput);
  // Implement solution and return output object/value.
  return data;
}

const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();
const output = solve(input);
process.stdout.write(typeof output === "string" ? output : JSON.stringify(output));`,
  python: `import sys
import json

def solve(raw_input: str):
    data = json.loads(raw_input)
    # Implement solution and return output object/value.
    return data

raw = sys.stdin.read().strip()
result = solve(raw)
print(result if isinstance(result, str) else json.dumps(result))`,
  sql: `-- SQL execution depends on the problem schema supplied by the test harness.
-- Write your SQL query below:
SELECT 1;`,
  verilog: `module solution;
  initial begin
    // Write your Verilog testbench / solution here.
    $display("Not implemented");
  end
endmodule`,
};

const resolveDefaultLanguageId = (
  languages: ExecutionLanguage[],
  preferredLanguage: string,
): number | null => {
  if (languages.length === 0) return null;
  const preferredAliases = runtimeAliases[preferredLanguage] ?? [preferredLanguage];

  const matched = languages.find((language) => {
    const normalized = normalizeLanguageName(language.name);
    return preferredAliases.some((alias) => normalized.includes(alias));
  });

  return matched?.id ?? languages[0].id;
};

const templateForLanguage = (runtimeName: string | undefined, fallback: string): string => {
  if (!runtimeName) return fallback;
  const normalized = normalizeLanguageName(runtimeName);

  if (normalized.includes("typescript")) {
    return starterTemplates.javascript;
  }
  if (normalized.includes("javascript") || normalized.includes("node.js")) {
    return starterTemplates.javascript;
  }
  if (normalized.includes("python")) {
    return starterTemplates.python;
  }
  if (normalized.includes("sql")) {
    return starterTemplates.sql;
  }
  if (normalized.includes("verilog")) {
    return starterTemplates.verilog;
  }

  return fallback;
};

const fallbackHint = (failedResult?: ExecuteTestResult): HintResult => {
  const hasCompileIssue = Boolean(failedResult?.compileOutput);
  const hasRuntimeIssue = Boolean(failedResult?.stderr);

  return {
    hint: hasCompileIssue
      ? "Compiler output indicates a syntax/structure issue. Fix parsing and syntax first before logic."
      : "Your logic likely misses an edge case. Validate input assumptions and output shape before optimizing.",
    nudges: [
      hasRuntimeIssue
        ? "Trace the failing path with a tiny print/debug trace for one failing test."
        : "Compare expected output and actual output for one failing test and identify the first mismatch.",
      "Break the solution into steps: parse -> transform -> output.",
      "Test one edge case manually (empty input, duplicates, or smallest size).",
    ],
    checklist: [
      "Input parsing exactly matches test-case format.",
      "Output formatting exactly matches expected output.",
      "Branch conditions handle edge cases and duplicates.",
    ],
  };
};

const PracticeProblem = ({
  id,
  title,
  description,
  difficulty,
  language,
  template,
  testCases,
  topicId,
  topicTitle,
  onExecutionComplete,
}: PracticeProblemProps) => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [code, setCode] = useState(template);
  const [testResults, setTestResults] = useState<ExecuteTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [activeHint, setActiveHint] = useState<HintResult | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(null);
  const [isLoadingGapAnalysis, setIsLoadingGapAnalysis] = useState(false);
  const [languages, setLanguages] = useState<ExecutionLanguage[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<number | null>(null);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [runAttempts, setRunAttempts] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const loadLanguages = async () => {
      setIsLoadingLanguages(true);
      setRuntimeError(null);

      try {
        const availableLanguages = await fetchExecutionLanguages();
        if (isCancelled) return;

        setLanguages(availableLanguages);
        const defaultLanguageId = resolveDefaultLanguageId(availableLanguages, language);
        setSelectedLanguageId(defaultLanguageId);
      } catch (error) {
        if (isCancelled) return;
        const message =
          error instanceof Error ? error.message : "Failed to load compiler languages";
        setRuntimeError(message);
      } finally {
        if (!isCancelled) {
          setIsLoadingLanguages(false);
        }
      }
    };

    void loadLanguages();
    return () => {
      isCancelled = true;
    };
  }, [language, template]);

  const selectedLanguage = useMemo(
    () => languages.find((item) => item.id === selectedLanguageId),
    [languages, selectedLanguageId],
  );
  const monacoLanguage = getMonacoLanguage(selectedLanguage?.name);
  const editorTheme = resolvedTheme === "dark" ? "vs-dark" : "light";
  const draftStorageKey = useMemo(
    () =>
      selectedLanguageId
        ? `${DRAFT_STORAGE_PREFIX}${id}_${selectedLanguageId}`
        : null,
    [id, selectedLanguageId],
  );

  useEffect(() => {
    if (!draftStorageKey) return;
    const saved = safeStorage.getItem(draftStorageKey);
    if (!saved) {
      setCode(templateForLanguage(selectedLanguage?.name, template));
      setRestoredFromDraft(false);
      setLastSavedAt(null);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as {
        code?: string;
        updatedAt?: string;
      };
      if (typeof parsed.code === "string") {
        setCode(parsed.code);
        setRestoredFromDraft(true);
        setLastSavedAt(typeof parsed.updatedAt === "string" ? parsed.updatedAt : null);
        return;
      }
    } catch {
      // Ignore malformed draft payloads.
    }

    setCode(templateForLanguage(selectedLanguage?.name, template));
    setRestoredFromDraft(false);
    setLastSavedAt(null);
  }, [draftStorageKey, selectedLanguage?.name, template]);

  useEffect(() => {
    if (!draftStorageKey) return;

    const timeoutId = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      safeStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          code,
          updatedAt,
        }),
      );
      setLastSavedAt(updatedAt);
    }, 280);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [code, draftStorageKey]);

  const handleRunTests = useCallback(async () => {
    if (!selectedLanguageId) {
      toast.error("Choose a language runtime first");
      return;
    }

    setIsRunning(true);
    setRuntimeError(null);
    setGapAnalysis(null);
    setActiveHint(null);
    setShowHint(false);
    setRunAttempts((previous) => previous + 1);

    try {
      const response = await executeCode({
        languageId: selectedLanguageId,
        sourceCode: code,
        testCases: testCases.map((testCase) => ({
          input: testCase.input,
          expectedOutput: testCase.expected,
        })),
      });

      setTestResults(response.results);
      onExecutionComplete?.({
        problemId: id,
        problemTitle: title,
        topicId,
        topicTitle,
        language,
        runtimeName: selectedLanguage?.name,
        totalTests: response.total,
        passedTests: response.passedCount,
        tookMs: response.tookMs,
        results: response.results,
      });

      const failedCases = response.results
        .filter((result) => !result.passed)
        .slice(0, 6)
        .map((result) => ({
          testCase: result.testCase,
          statusDescription: result.statusDescription,
          stderr: result.stderr,
          compileOutput: result.compileOutput,
          message: result.message,
        }));

      if (user && failedCases.length > 0) {
        setIsLoadingGapAnalysis(true);
        try {
          const dna = getLearnerDnaSummary(user.id, user.branch);
          const analysis = await requestGapAnalysis({
            userId: user.id,
            branch: user.branch,
            problemTitle: title,
            language,
            runtimeName: selectedLanguage?.name,
            passedTests: response.passedCount,
            totalTests: response.total,
            tookMs: response.tookMs,
            failedCases,
            topMistakes: dna.topMistakes.map((mistake) => ({
              label: mistake.label,
              count: mistake.count,
            })),
          });
          setGapAnalysis(analysis);
        } catch {
          setGapAnalysis(null);
        } finally {
          setIsLoadingGapAnalysis(false);
        }
      }

      toast.success(
        `${response.passedCount}/${response.total} tests passed in ${response.tookMs}ms${
          response.provider ? ` (${response.provider})` : ""
        }`,
      );
      if (response.fallbackFrom) {
        toast.info(
          `Primary compiler provider was unavailable. Executed using local fallback (${response.provider}).`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to execute code";
      setRuntimeError(message);
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  }, [
    code,
    id,
    language,
    onExecutionComplete,
    selectedLanguage?.name,
    selectedLanguageId,
    testCases,
    title,
    topicId,
    topicTitle,
    user,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const withinEditor = Boolean(target?.closest(".monaco-editor"));
      if (!withinEditor) {
        return;
      }

      event.preventDefault();
      if (!isRunning && selectedLanguageId) {
        void handleRunTests();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleRunTests, isRunning, selectedLanguageId]);

  const fetchAdaptiveHint = async () => {
    const failedResult = testResults.find((result) => !result.passed);
    if (!failedResult) {
      toast.info("Run tests first to get a targeted hint");
      return;
    }

    if (!user) {
      const fallback = fallbackHint(failedResult);
      setActiveHint(fallback);
      setShowHint(true);
      return;
    }

    setIsLoadingHint(true);

    try {
      const dna = getLearnerDnaSummary(user.id, user.branch);
      const hint = await requestHint({
        userId: user.id,
        branch: user.branch,
        problemTitle: title,
        language,
        runtimeName: selectedLanguage?.name,
        sourceCode: code,
        passedTests,
        totalTests: testResults.length,
        failedCase: {
          testCase: failedResult.testCase,
          statusDescription: failedResult.statusDescription,
          stderr: failedResult.stderr,
          compileOutput: failedResult.compileOutput,
          message: failedResult.message,
        },
        topMistakes: dna.topMistakes.map((mistake) => ({
          label: mistake.label,
          count: mistake.count,
        })),
      });

      setActiveHint(hint);
      setShowHint(true);
      toast.success("Adaptive hint generated");
    } catch (error) {
      const fallback = fallbackHint(failedResult);
      setActiveHint(fallback);
      setShowHint(true);
      const message =
        error instanceof Error ? error.message : "Hint service unavailable. Showing fallback hint.";
      toast.error(message);
    } finally {
      setIsLoadingHint(false);
    }
  };

  const handleHintAction = () => {
    if (showHint) {
      setShowHint(false);
      return;
    }

    if (activeHint) {
      setShowHint(true);
      return;
    }

    void fetchAdaptiveHint();
  };

  const handleReset = () => {
    setTestResults([]);
    setShowHint(false);
    setActiveHint(null);
    setGapAnalysis(null);
    setRuntimeError(null);
    setCode(templateForLanguage(selectedLanguage?.name, template));
    setRunAttempts(0);
    if (draftStorageKey) {
      safeStorage.removeItem(draftStorageKey);
      setRestoredFromDraft(false);
      setLastSavedAt(null);
    }
  };

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const handleLanguageChange = (value: string) => {
    const languageId = Number(value);
    setSelectedLanguageId(languageId);
    setTestResults([]);
    setShowHint(false);
    setActiveHint(null);
    setGapAnalysis(null);
    setRuntimeError(null);
    setRunAttempts(0);
  };

  const passedTests = testResults.filter((result) => result.passed).length;
  const allTestsPassed = testResults.length > 0 && passedTests === testResults.length;
  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 bg-gradient-card p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            <p className={`mt-2 text-sm font-semibold ${difficultyColor[difficulty]}`}>
              {difficulty} • {selectedLanguage?.name ?? language.toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Problem ID: {id}</p>
          </div>
          {allTestsPassed && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">Solved</span>
            </div>
          )}
        </div>
        <p className="text-muted-foreground">{description}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border border-border/50 bg-muted/30 p-6">
            <h3 className="mb-4 font-semibold text-foreground">Problem Details</h3>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <h4 className="mb-2 font-medium text-foreground">Input</h4>
                <p>Read from standard input. Use each test case input exactly as provided.</p>
              </div>
              <div>
                <h4 className="mb-2 font-medium text-foreground">Output</h4>
                <p>Print only the expected value per test case.</p>
              </div>
              <div>
                <h4 className="mb-2 font-medium text-foreground">Test Cases</h4>
                <ul className="list-disc list-inside space-y-1">
                  {testCases.map((testCase, index) => (
                    <li key={`${index}-${testCase.input.slice(0, 20)}`}>
                      Case {index + 1}: expected {testCase.expected}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border/50 bg-blue-500/5 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleHintAction}
                disabled={isLoadingHint}
                className="flex items-center gap-2 font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoadingHint ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
                {showHint ? "Hide Hint" : activeHint ? "Show Hint" : "Get Adaptive Hint"}
              </button>

              {testResults.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => void fetchAdaptiveHint()} disabled={isLoadingHint}>
                  Refresh Hint
                </Button>
              )}
            </div>

            {showHint && activeHint && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 space-y-2 text-sm text-muted-foreground"
              >
                <p>{activeHint.hint}</p>
                <div>
                  <p className="font-medium text-foreground">Nudges</p>
                  <ul className="mt-1 list-disc list-inside">
                    {activeHint.nudges.map((nudge) => (
                      <li key={nudge}>{nudge}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground">Checklist</p>
                  <ul className="mt-1 list-disc list-inside">
                    {activeHint.checklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 border border-border/50 bg-gradient-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">IDE</h3>
              <div className="flex flex-wrap items-center gap-2">
                {isLoadingLanguages ? (
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading runtimes...
                  </div>
                ) : (
                  <Select
                    value={selectedLanguageId ? String(selectedLanguageId) : undefined}
                    onValueChange={handleLanguageChange}
                    disabled={languages.length === 0}
                  >
                    <SelectTrigger className="h-8 w-[220px]">
                      <SelectValue placeholder="Choose language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((runtime) => (
                        <SelectItem key={runtime.id} value={String(runtime.id)}>
                          {runtime.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button size="sm" variant="outline" onClick={handleCopyTemplate} className="gap-2">
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button size="sm" variant="outline" onClick={handleReset} className="gap-2">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>{restoredFromDraft ? "Draft restored" : "Fresh template loaded"}</span>
              <span>{lastSavedLabel ? `Autosaved at ${lastSavedLabel}` : "Autosave enabled"}</span>
              <span>Run with Cmd/Ctrl + Enter</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <Editor
                height="340px"
                language={monacoLanguage}
                theme={editorTheme}
                value={code}
                onChange={(value) => setCode(value ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontLigatures: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                }}
              />
            </div>

            {runtimeError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-600">
                {runtimeError}
              </div>
            )}

            <Button
              onClick={handleRunTests}
              disabled={isRunning || !selectedLanguageId}
              className="w-full transition-transform hover:scale-[1.01]"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Tests
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Attempts this session: {runAttempts}
            </p>
          </Card>
        </div>
      </div>

      {testResults.length > 0 && (
        <Card className="border border-border/50 bg-gradient-card p-6">
          <h3 className="mb-4 font-semibold text-foreground">
            Test Results: {passedTests}/{testResults.length} Passed
          </h3>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <motion.div
                key={`${result.testCase}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-lg border p-4 ${
                  result.passed
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className="font-medium text-foreground">Test Case {result.testCase}</span>
                    <p className="text-xs text-muted-foreground">
                      Status: {result.statusDescription}
                      {result.time ? ` • ${result.time}s` : ""}
                      {result.memory ? ` • ${result.memory} KB` : ""}
                    </p>
                  </div>
                  {result.passed ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Passed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <X className="h-4 w-4" />
                      Failed
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Input:</span> {result.input}
                  </p>
                  {result.expectedOutput !== undefined && (
                    <p>
                      <span className="font-medium text-foreground">Expected:</span>{" "}
                      {result.expectedOutput}
                    </p>
                  )}
                  {result.stdout !== undefined && (
                    <p>
                      <span className="font-medium text-foreground">Output:</span> {result.stdout}
                    </p>
                  )}
                  {result.stderr && (
                    <p>
                      <span className="font-medium text-foreground">Stderr:</span> {result.stderr}
                    </p>
                  )}
                  {result.compileOutput && (
                    <p>
                      <span className="font-medium text-foreground">Compile:</span>{" "}
                      {result.compileOutput}
                    </p>
                  )}
                  {result.message && (
                    <p>
                      <span className="font-medium text-foreground">Message:</span> {result.message}
                    </p>
                  )}
                  {result.diagnostic && !result.passed && (
                    <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                        Compiler Insight ({result.diagnostic.category})
                      </p>
                      <p className="mt-1 text-sm text-foreground">{result.diagnostic.summary}</p>
                      {result.diagnostic.lineHints.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Line hints: {result.diagnostic.lineHints.join(", ")}
                        </p>
                      )}
                      {result.diagnostic.likelyCauses.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-foreground">Likely causes</p>
                          <ul className="mt-1 list-disc list-inside text-xs text-muted-foreground">
                            {result.diagnostic.likelyCauses.map((cause) => (
                              <li key={`${result.testCase}-${cause}`}>{cause}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.diagnostic.suggestedFixes.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-foreground">Suggested fixes</p>
                          <ul className="mt-1 list-disc list-inside text-xs text-muted-foreground">
                            {result.diagnostic.suggestedFixes.map((fix) => (
                              <li key={`${result.testCase}-${fix}`}>{fix}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {isLoadingGapAnalysis && (
        <Card className="border border-border/50 bg-gradient-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing your learning gap...
          </div>
        </Card>
      )}

      {gapAnalysis && (
        <Card className="border border-border/50 bg-gradient-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Adaptive Gap Analysis</h3>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              confidence: {gapAnalysis.confidence}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{gapAnalysis.summary}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Root Causes
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {gapAnalysis.rootCauses.map((cause) => (
                  <li key={cause}>{cause}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Practice Plan
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {gapAnalysis.practicePlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {allTestsPassed && (
        <Button className="h-11 w-full shadow-glow transition-transform hover:scale-[1.01]" size="lg">
          <Send className="mr-2 h-4 w-4" />
          Submit Solution
        </Button>
      )}
    </div>
  );
};

export default PracticeProblem;
