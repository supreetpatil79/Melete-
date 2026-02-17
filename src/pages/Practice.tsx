import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Code2,
  Filter,
  Search,
  Sparkles,
  Target,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { branches } from "../data/branches";
import {
  practiceTopics,
  type PracticeTier,
  type PracticeTopic,
} from "@/data/practiceTopics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PracticeProblem, {
  type PracticeExecutionPayload,
} from "../components/PracticeProblem";
import {
  getLearnerDnaSummary,
  getLearnerProfile,
  recordPracticeExecution,
} from "@/services/learnerProfileService";
import { completeTodayMissionTask, getTodayMission } from "@/services/missionEngine";

const sampleProblem = {
  id: "problem-1",
  title: "Two Sum",
  description:
    "Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.",
  difficulty: "Easy" as const,
  language: "javascript" as const,
  template: `function twoSum(nums, target) {
  // Your solution here
  return [];
}

const fs = require("fs");
const rawInput = fs.readFileSync(0, "utf8").trim();

if (rawInput) {
  const { nums, target } = JSON.parse(rawInput);
  const result = twoSum(nums, target);
  process.stdout.write(JSON.stringify(result));
}`,
  testCases: [
    {
      input: "{\"nums\":[2,7,11,15],\"target\":9}",
      expected: "[0,1]",
      explanation: "nums[0] + nums[1] == 9",
    },
    {
      input: "{\"nums\":[3,2,4],\"target\":6}",
      expected: "[1,2]",
      explanation: "nums[1] + nums[2] == 6",
    },
    {
      input: "{\"nums\":[3,3],\"target\":6}",
      expected: "[0,1]",
      explanation: "nums[0] + nums[1] == 6",
    },
  ],
};

type SortMode = "recommended" | "problems-desc" | "problems-asc";

const tierLabels: Array<{ value: PracticeTier | "all"; label: string }> = [
  { value: "all", label: "All tiers" },
  { value: "foundation", label: "Foundation" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const matchesBranch = (topic: PracticeTopic, selectedBranch: string): boolean => {
  if (!selectedBranch) return true;
  if (selectedBranch === "ece") {
    return topic.language === "verilog" || topic.language === "python";
  }
  if (selectedBranch === "data-science") {
    return topic.language === "python" || topic.language === "sql";
  }
  if (selectedBranch === "cse") {
    return topic.language !== "verilog";
  }
  return true;
};

const scoreTopic = (
  topic: PracticeTopic,
  args: {
    focusLanguage?: string;
    strongestLanguage?: string;
    acceptanceRate: number;
    streak: number;
    missionTopicIds: Set<string>;
  },
): number => {
  let score = 0;

  if (args.missionTopicIds.has(topic.id)) {
    score += 8;
  }
  if (args.focusLanguage && args.focusLanguage === topic.language) {
    score += 6;
  }
  if (args.strongestLanguage && args.strongestLanguage === topic.language) {
    score += 3;
  }

  if (args.acceptanceRate < 55 && topic.tier === "foundation") {
    score += 3;
  } else if (args.acceptanceRate < 78 && topic.tier === "intermediate") {
    score += 3;
  } else if (args.acceptanceRate >= 78 && topic.tier === "advanced") {
    score += 3;
  }

  if (args.streak <= 1 && topic.tier === "foundation") {
    score += 1;
  }

  return score;
};

const recommendationReason = (
  topic: PracticeTopic,
  missionTopicIds: Set<string>,
  focusLanguage?: string,
): string => {
  if (missionTopicIds.has(topic.id)) return "Mission target";
  if (focusLanguage === topic.language) return "Focus language";
  if (topic.tier === "foundation") return "Consistency boost";
  return "Skill expansion";
};

const PracticePage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBranch, setSelectedBranch] = useState(user?.branch || "");
  const [showBranchFilter, setShowBranchFilter] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<PracticeTopic | null>(null);
  const [topicQuery, setTopicQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<PracticeTier | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [dna, setDna] = useState(() =>
    user ? getLearnerDnaSummary(user.id, user.branch) : null,
  );

  const missionTaskId = searchParams.get("missionTaskId");
  const selectedTopicId = searchParams.get("topic");

  useEffect(() => {
    if (!user) return;
    setDna(getLearnerDnaSummary(user.id, user.branch));
  }, [user]);

  useEffect(() => {
    if (!selectedTopicId) return;
    const topic = practiceTopics.find((candidate) => candidate.id === selectedTopicId);
    if (topic) {
      setSelectedProblem(topic);
    }
  }, [selectedTopicId]);

  const mission = useMemo(
    () => (user ? getTodayMission(user.id, user.branch) : null),
    [user],
  );

  const missionTopicIds = useMemo(
    () => new Set(mission?.tasks.map((task) => task.topicId) ?? []),
    [mission],
  );

  const scoreByTopic = useMemo(() => {
    const map = new Map<string, number>();
    for (const topic of practiceTopics) {
      map.set(
        topic.id,
        scoreTopic(topic, {
          focusLanguage: dna?.focusLanguage,
          strongestLanguage: dna?.strongestLanguage,
          acceptanceRate: dna?.acceptanceRate ?? 0,
          streak: dna?.streak ?? 0,
          missionTopicIds,
        }),
      );
    }
    return map;
  }, [dna?.acceptanceRate, dna?.focusLanguage, dna?.streak, dna?.strongestLanguage, missionTopicIds]);

  const filteredTopics = useMemo(() => {
    const normalizedQuery = topicQuery.trim().toLowerCase();

    const visible = practiceTopics.filter((topic) => {
      if (!matchesBranch(topic, selectedBranch)) return false;
      if (tierFilter !== "all" && topic.tier !== tierFilter) return false;

      if (!normalizedQuery) return true;
      const haystack = `${topic.title} ${topic.language} ${topic.difficulty} ${topic.tier}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return visible.sort((left, right) => {
      if (sortMode === "problems-desc") {
        return right.problems - left.problems;
      }
      if (sortMode === "problems-asc") {
        return left.problems - right.problems;
      }

      const leftScore = scoreByTopic.get(left.id) ?? 0;
      const rightScore = scoreByTopic.get(right.id) ?? 0;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      if (right.problems !== left.problems) {
        return right.problems - left.problems;
      }
      return left.title.localeCompare(right.title);
    });
  }, [scoreByTopic, selectedBranch, sortMode, tierFilter, topicQuery]);

  const recommendedTopics = useMemo(
    () =>
      practiceTopics
        .filter((topic) => matchesBranch(topic, selectedBranch))
        .slice()
        .sort((left, right) => {
          const leftScore = scoreByTopic.get(left.id) ?? 0;
          const rightScore = scoreByTopic.get(right.id) ?? 0;
          if (rightScore !== leftScore) return rightScore - leftScore;
          return right.problems - left.problems;
        })
        .slice(0, 3),
    [scoreByTopic, selectedBranch],
  );

  const activeProblem = useMemo(
    () =>
      selectedProblem
        ? {
            ...sampleProblem,
            id: `${sampleProblem.id}-${selectedProblem.id}`,
            language: selectedProblem.language,
            title: `${sampleProblem.title} (${selectedProblem.title})`,
          }
        : null,
    [selectedProblem],
  );

  const recentSession = user
    ? getLearnerProfile(user.id, user.branch).recentSessions[0] ?? null
    : null;

  const recentSessionTopic = useMemo(() => {
    if (!recentSession) return null;
    if (recentSession.topicId) {
      const matched = practiceTopics.find((topic) => topic.id === recentSession.topicId);
      if (matched) return matched;
    }

    const normalizedTitle = recentSession.problemTitle.toLowerCase();
    return (
      practiceTopics.find((topic) => normalizedTitle.includes(topic.title.toLowerCase().split(" ")[0])) ??
      null
    );
  }, [recentSession]);

  const currentBranch = branches.find((branch) => branch.id === selectedBranch);

  const handleSelectProblem = (topic: PracticeTopic) => {
    setSelectedProblem(topic);
    const params = new URLSearchParams(searchParams);
    params.set("topic", topic.id);
    setSearchParams(params, { replace: true });
  };

  const handleResume = () => {
    if (recentSessionTopic) {
      handleSelectProblem(recentSessionTopic);
      return;
    }

    if (recommendedTopics.length > 0) {
      handleSelectProblem(recommendedTopics[0]);
      toast.info("Opened your top recommended topic.");
      return;
    }

    toast.info("Pick any topic to start your next session.");
  };

  const handleResetFilters = () => {
    setTopicQuery("");
    setTierFilter("all");
    setSortMode("recommended");
    setSelectedBranch(user?.branch ?? "");
  };

  const handleBackToProblems = () => {
    setSelectedProblem(null);
    const params = new URLSearchParams(searchParams);
    params.delete("topic");
    params.delete("missionTaskId");
    setSearchParams(params, { replace: true });
  };

  const handleExecutionComplete = (payload: PracticeExecutionPayload) => {
    if (!user) return;

    recordPracticeExecution(user.id, {
      branch: user.branch,
      problemId: payload.problemId,
      problemTitle: payload.problemTitle,
      topicId: payload.topicId,
      topicTitle: payload.topicTitle,
      language: payload.runtimeName ?? payload.language,
      passedTests: payload.passedTests,
      totalTests: payload.totalTests,
      tookMs: payload.tookMs,
      results: payload.results,
    });

    setDna(getLearnerDnaSummary(user.id, user.branch));

    if (missionTaskId && payload.totalTests > 0 && payload.passedTests === payload.totalTests) {
      const currentMission = getTodayMission(user.id, user.branch);
      const currentTask = currentMission.tasks.find((task) => task.id === missionTaskId);
      if (currentTask?.status === "pending") {
        completeTodayMissionTask(user.id, user.branch, missionTaskId);
        toast.success("Mission progress updated. Task completed.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-foreground">Practice Problems</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Personalized coding workouts powered by your performance, branch goals, and mission progress.
          </p>
          {currentBranch && (
            <p className="mt-3 text-sm font-medium text-primary">
              Showing problems for {currentBranch.name}
            </p>
          )}
        </motion.div>

        {missionTaskId && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Target className="h-4 w-4" />
              Mission Mode Active
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pass all tests to complete this mission task and update your daily streak.
            </p>
          </motion.div>
        )}

        {selectedProblem && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 border-b border-border pb-12"
          >
            <Button variant="outline" onClick={handleBackToProblems} className="mb-4">
              ← Back to Problems
            </Button>
            {activeProblem && (
              <PracticeProblem
                {...activeProblem}
                topicId={selectedProblem.id}
                topicTitle={selectedProblem.title}
                onExecutionComplete={handleExecutionComplete}
              />
            )}
          </motion.div>
        )}

        {!selectedProblem && (
          <>
            {user && (
              <div className="mb-8 grid gap-4 lg:grid-cols-[1.1fr,1fr]">
                <Card className="border border-border/50 bg-gradient-card p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Resume</p>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">
                    {recentSession ? "Continue from your latest session" : "Start your next focused sprint"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {recentSession
                      ? `${recentSession.problemTitle} • ${recentSession.passedTests}/${recentSession.totalTests} tests passed`
                      : "We will keep adapting suggestions as you solve more problems."}
                  </p>
                  <Button className="mt-4" onClick={handleResume}>
                    {recentSession ? "Resume practice" : "Start recommended"}
                  </Button>
                </Card>

                <Card className="border border-border/50 bg-gradient-card p-5">
                  <div className="mb-2 inline-flex items-center gap-1 text-xs uppercase tracking-wide text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Recommended now
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recommendedTopics.map((topic) => (
                      <button
                        key={`recommended-${topic.id}`}
                        type="button"
                        onClick={() => handleSelectProblem(topic)}
                        className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/40"
                      >
                        {topic.title}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Suggestions use mission targets, streak, and current acceptance trends.
                  </p>
                </Card>
              </div>
            )}

            <div className="mb-6 grid gap-3 lg:grid-cols-[1.6fr,0.9fr,0.9fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={topicQuery}
                  onChange={(event) => setTopicQuery(event.target.value)}
                  placeholder="Search by topic, language, or tier"
                  className="pl-9"
                />
              </div>

              <Select value={tierFilter} onValueChange={(value) => setTierFilter(value as PracticeTier | "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  {tierLabels.map((tier) => (
                    <SelectItem key={tier.value} value={tier.value}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort topics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Sort: Recommended</SelectItem>
                  <SelectItem value="problems-desc">Sort: Most problems</SelectItem>
                  <SelectItem value="problems-asc">Sort: Quick wins</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {user && (
              <div className="mb-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={showBranchFilter ? "default" : "outline"}
                    onClick={() => setShowBranchFilter(!showBranchFilter)}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filter by Branch
                  </Button>
                  <Button variant="ghost" onClick={handleResetFilters} className="text-sm">
                    Reset filters
                  </Button>
                  <span className="text-xs text-muted-foreground">{filteredTopics.length} topics visible</span>
                </div>

                {showBranchFilter && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-lg border border-border bg-muted/30 p-4"
                  >
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                      {branches.map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => setSelectedBranch(selectedBranch === branch.id ? "" : branch.id)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            selectedBranch === branch.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {branch.code}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-10 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center"
            >
              <Terminal className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Live Multi-Language IDE</h2>
              <p className="mt-2 text-muted-foreground">
                Real execution with secure backend runtimes and per-test-case diagnostics. Built-in JavaScript fallback works by default; connect Judge0/RapidAPI for full multi-language coverage.
              </p>
            </motion.div>

            {filteredTopics.length === 0 ? (
              <Card className="border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No topics match your filters.</p>
                <Button variant="outline" className="mt-4" onClick={handleResetFilters}>
                  Clear filters
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTopics.map((topic, index) => {
                  const score = scoreByTopic.get(topic.id) ?? 0;
                  const showRecommended = score >= 6;

                  return (
                    <motion.button
                      key={topic.id}
                      onClick={() => handleSelectProblem(topic)}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group rounded-xl border border-border bg-gradient-card p-6 text-left shadow-card transition-all hover:border-primary/30 hover:shadow-lg"
                    >
                      <div
                        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${topic.color}20`, color: topic.color }}
                      >
                        <Code2 className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                        {topic.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{topic.problems} problems</span>
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{topic.difficulty}</span>
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{topic.language.toUpperCase()}</span>
                      </div>
                      {showRecommended && (
                        <p className="mt-3 inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {recommendationReason(topic, missionTopicIds, dna?.focusLanguage)}
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 grid gap-4 md:grid-cols-3"
            >
              <Card className="border border-border/50 bg-gradient-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Problems Solved</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{dna?.solvedProblems ?? 0}</p>
                  </div>
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
              </Card>

              <Card className="border border-border/50 bg-gradient-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{dna?.acceptanceRate ?? 0}%</p>
                  </div>
                  <div className="text-2xl">📊</div>
                </div>
              </Card>

              <Card className="border border-border/50 bg-gradient-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Streak</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{dna?.streak ?? 0} days</p>
                  </div>
                  <div className="text-2xl">🔥</div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default PracticePage;
