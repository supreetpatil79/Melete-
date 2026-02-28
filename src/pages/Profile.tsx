import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Code2, Download, Flame, MessageSquare, RefreshCw, Sparkles, ThumbsUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useAppearance } from "@/context/AppearanceContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getLearnerDnaSummary, getLearnerProfile } from "@/services/learnerProfileService";
import {
  getTechViseLeaderboard,
  getTechViseUserStats,
  listTechViseThreads,
  type TechViseLeaderboardEntry,
} from "@/services/techviseService";
import { downloadLearningWrapUpPdf } from "@/services/learningWrapUpPdfService";
import {
  fetchLearningKnowledgeGraph,
  type LearningKnowledgeGraphResponse,
} from "@/services/knowledgeGraphService";

const rankOf = (
  entries: TechViseLeaderboardEntry[],
  userId: string,
  comparator: (left: TechViseLeaderboardEntry, right: TechViseLeaderboardEntry) => number,
): number => {
  const sorted = entries.slice().sort(comparator);
  const index = sorted.findIndex((entry) => entry.id === userId);
  return index >= 0 ? index + 1 : sorted.length + 1;
};

const ProfilePage = () => {
  const { user, isLoading } = useAuth();
  const { liquidGlassEnabled, setLiquidGlassEnabled } = useAppearance();
  const navigate = useNavigate();
  const [refreshToken, setRefreshToken] = useState(0);
  const [knowledgeGraph, setKnowledgeGraph] = useState<LearningKnowledgeGraphResponse | null>(null);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [knowledgeGraphError, setKnowledgeGraphError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setRefreshToken((previous) => previous + 1);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const snapshot = useMemo(() => {
    // refreshToken intentionally invalidates the memo after manual/user focus refresh.
    void refreshToken;

    if (!user) return null;

    const dna = getLearnerDnaSummary(user.id, user.branch);
    const learnerProfile = getLearnerProfile(user.id, user.branch);
    const techViseStats = getTechViseUserStats(user.id);
    const leaderboard = getTechViseLeaderboard({
      id: user.id,
      name: user.name,
      branch: user.branch,
    });
    const myEntry = leaderboard.find((entry) => entry.id === user.id);

    const overallRank = rankOf(leaderboard, user.id, (left, right) => right.score - left.score);
    const problemRank = rankOf(leaderboard, user.id, (left, right) => {
      if (right.solvedProblems !== left.solvedProblems) return right.solvedProblems - left.solvedProblems;
      return right.acceptanceRate - left.acceptanceRate;
    });
    const questionRank = rankOf(leaderboard, user.id, (left, right) => {
      if (right.totalQuestions !== left.totalQuestions) return right.totalQuestions - left.totalQuestions;
      return right.totalAnswers - left.totalAnswers;
    });
    const answerRank = rankOf(leaderboard, user.id, (left, right) => {
      if (right.totalAnswers !== left.totalAnswers) return right.totalAnswers - left.totalAnswers;
      return right.helpfulVotes - left.helpfulVotes;
    });
    const voteRank = rankOf(leaderboard, user.id, (left, right) => {
      if (right.helpfulVotes !== left.helpfulVotes) return right.helpfulVotes - left.helpfulVotes;
      return right.totalAnswers - left.totalAnswers;
    });

    const scoreBreakdown = {
      questionPoints: techViseStats.questionsAsked * 8,
      answerPoints: techViseStats.answersGiven * 12,
      votePoints: Math.max(0, techViseStats.helpfulVotes) * 6,
      solvedPoints: Math.round(dna.solvedProblems * 1.2),
      streakPoints: dna.streak * 2,
      acceptancePoints: Math.round(dna.acceptanceRate * 0.8),
    };

    return {
      dna,
      learnerProfile,
      techViseStats,
      leaderboard,
      myEntry,
      overallRank,
      problemRank,
      questionRank,
      answerRank,
      voteRank,
      scoreBreakdown,
    };
  }, [refreshToken, user]);

  useEffect(() => {
    if (!user || !snapshot) {
      setKnowledgeGraph(null);
      setKnowledgeGraphError(null);
      return;
    }

    let cancelled = false;

    const loadKnowledgeGraph = async () => {
      setIsGraphLoading(true);
      setKnowledgeGraphError(null);

      try {
        const threads = listTechViseThreads();
        const techViseTags = Array.from(
          new Set(
            threads
              .flatMap((thread) => thread.tags)
              .map((tag) => tag.trim().toLowerCase())
              .filter((tag) => tag.length > 1),
          ),
        ).slice(0, 24);

        const targetCompanies = Array.from(
          new Set(
            snapshot.leaderboard
              .filter((entry) => entry.isCompanyEngineer && Boolean(entry.company))
              .map((entry) => entry.company?.trim() ?? "")
              .filter((company) => company.length > 0),
          ),
        ).slice(0, 10);

        const response = await fetchLearningKnowledgeGraph({
          userId: user.id,
          name: user.name,
          branch: user.branch,
          strongestLanguage: snapshot.dna.strongestLanguage,
          focusLanguage: snapshot.dna.focusLanguage,
          topMistakes: snapshot.dna.topMistakes.map((mistake) => ({
            label: mistake.label,
            count: mistake.count,
          })),
          recentSessions: snapshot.learnerProfile.recentSessions.slice(0, 25).map((session) => ({
            problemId: session.problemId,
            problemTitle: session.problemTitle,
            topicId: session.topicId,
            topicTitle: session.topicTitle,
            language: session.language,
            passedTests: session.passedTests,
            totalTests: session.totalTests,
            tookMs: session.tookMs,
          })),
          techViseTags,
          targetCompanies,
          solvedProblems: snapshot.dna.solvedProblems,
          totalRuns: snapshot.dna.totalRuns,
          acceptanceRate: snapshot.dna.acceptanceRate,
        });

        if (cancelled) return;
        setKnowledgeGraph(response);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Knowledge graph is unavailable right now.";
        setKnowledgeGraphError(message);
      } finally {
        if (!cancelled) {
          setIsGraphLoading(false);
        }
      }
    };

    void loadKnowledgeGraph();

    return () => {
      cancelled = true;
    };
  }, [snapshot, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-24">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || !snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background pt-24">
        <Card className="border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Please log in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your profile ranking is available after login.</p>
          <Button onClick={() => navigate("/login")} className="mt-4">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  const {
    dna,
    learnerProfile,
    techViseStats,
    leaderboard,
    myEntry,
    overallRank,
    problemRank,
    questionRank,
    answerRank,
    voteRank,
    scoreBreakdown,
  } = snapshot;

  const totalContributors = Math.max(leaderboard.length, 1);
  const handleExportWrapUp = () => {
    try {
      downloadLearningWrapUpPdf({
        learner: {
          id: user.id,
          name: user.name,
          branch: user.branch,
        },
        generatedAt: new Date().toISOString(),
        metrics: {
          solvedProblems: dna.solvedProblems,
          totalRuns: dna.totalRuns,
          streak: dna.streak,
          acceptanceRate: dna.acceptanceRate,
          strongestLanguage: dna.strongestLanguage,
          focusLanguage: dna.focusLanguage,
          techViseQueries: techViseStats.questionsAsked,
          techViseAnswers: techViseStats.answersGiven,
          helpfulVotes: techViseStats.helpfulVotes,
          communityScore: myEntry?.score ?? 0,
        },
        rankings: {
          overallRank,
          problemRank,
          queryRank,
          answerRank,
          voteRank,
          totalContributors,
        },
        topMistakes: dna.topMistakes,
        scoreBreakdown,
        profile: learnerProfile,
      });

      toast.success("Learning wrap-up PDF downloaded.");
    } catch (error) {
      toast.error("Could not export wrap-up PDF right now.");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl font-semibold text-foreground">My Profile</h1>
              <p className="mt-2 text-muted-foreground">
                Problems solved, TechVise impact, and ranking are synced here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleExportWrapUp} className="gap-2">
                <Download className="h-4 w-4" />
                Export Wrap-Up PDF
              </Button>
              <Button variant="outline" onClick={() => setRefreshToken((previous) => previous + 1)} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh stats
              </Button>
            </div>
          </div>
        </motion.div>

        <section className="mb-8">
          <Card className="liquid-glass border border-border/70 bg-card/85 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Experience Settings
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tune premium visuals for a cleaner Apple-style interface in both light and dark mode.
                </p>
              </div>
              <div className="flex min-w-[280px] items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Liquid Glass</p>
                  <p className="text-xs text-muted-foreground">{liquidGlassEnabled ? "Enabled" : "Disabled"}</p>
                </div>
                <Switch
                  checked={liquidGlassEnabled}
                  onCheckedChange={setLiquidGlassEnabled}
                  aria-label="Toggle liquid glass visual effects"
                />
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Problems Solved</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{dna.solvedProblems}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">TechVise Queries</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{techViseStats.questionsAsked}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Answers Posted</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{techViseStats.answersGiven}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Helpful Votes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{techViseStats.helpfulVotes}</p>
          </Card>
          <Card className="border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs text-primary">Community Score</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{myEntry?.score ?? 0}</p>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Overall Rank</p>
            <p className="mt-1 text-xl font-semibold text-foreground">#{overallRank}</p>
            <p className="mt-1 text-xs text-muted-foreground">of {totalContributors}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Problem Rank</p>
            <p className="mt-1 text-xl font-semibold text-foreground">#{problemRank}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Query Rank</p>
            <p className="mt-1 text-xl font-semibold text-foreground">#{questionRank}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Answer Rank</p>
            <p className="mt-1 text-xl font-semibold text-foreground">#{answerRank}</p>
          </Card>
          <Card className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Votes Rank</p>
            <p className="mt-1 text-xl font-semibold text-foreground">#{voteRank}</p>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr,1fr]">
          <Card className="border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              Ranking Score Breakdown
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Rank uses solved problems, queries raised, answers, and received votes.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  Query points
                </span>
                <span className="font-semibold text-foreground">{scoreBreakdown.questionPoints}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Code2 className="h-4 w-4" />
                  Answer points
                </span>
                <span className="font-semibold text-foreground">{scoreBreakdown.answerPoints}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <ThumbsUp className="h-4 w-4" />
                  Vote points
                </span>
                <span className="font-semibold text-foreground">{scoreBreakdown.votePoints}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  Solved problem points
                </span>
                <span className="font-semibold text-foreground">{scoreBreakdown.solvedPoints}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Flame className="h-4 w-4" />
                  Streak points
                </span>
                <span className="font-semibold text-foreground">{scoreBreakdown.streakPoints}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  Acceptance points
                </span>
                <span className="font-semibold text-foreground">{scoreBreakdown.acceptancePoints}</span>
              </div>
            </div>
          </Card>

          <Card className="border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              Community Top 10
            </div>
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, index) => {
                const isCurrentUser = entry.id === user.id;
                return (
                  <div
                    key={entry.id}
                    className={`rounded-md border px-3 py-2 ${
                      isCurrentUser ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {index + 1}. {entry.name}
                      </p>
                      <span className="text-sm font-semibold text-primary">{entry.score}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.totalQuestions} queries • {entry.totalAnswers} answers • {entry.helpfulVotes} helpful votes •{" "}
                      {entry.solvedProblems} solved
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card className="mt-6 border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Code2 className="h-4 w-4 text-primary" />
            Learning Knowledge Graph
          </div>

          {isGraphLoading && (
            <p className="text-sm text-muted-foreground">Building your knowledge graph from recent activity...</p>
          )}

          {!isGraphLoading && knowledgeGraphError && (
            <p className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700">
              {knowledgeGraphError}
            </p>
          )}

          {!isGraphLoading && !knowledgeGraphError && knowledgeGraph && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {knowledgeGraph.summary.nodeCount} nodes • {knowledgeGraph.summary.edgeCount} links •{" "}
                {knowledgeGraph.summary.sessionCount} recent sessions analyzed
              </p>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Central Topics</p>
                <div className="flex flex-wrap gap-2">
                  {knowledgeGraph.insights.centralTopics.length > 0 ? (
                    knowledgeGraph.insights.centralTopics.map((topic) => (
                      <span key={topic} className="rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground">
                        {topic}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Not enough topic signals yet.</span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Strengths</p>
                  <div className="space-y-1">
                    {knowledgeGraph.insights.strengths.length > 0 ? (
                      knowledgeGraph.insights.strengths.map((item) => (
                        <p key={item} className="text-sm text-foreground">
                          {item}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No strong cluster yet. Keep practicing.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weaknesses</p>
                  <div className="space-y-1">
                    {knowledgeGraph.insights.weaknesses.length > 0 ? (
                      knowledgeGraph.insights.weaknesses.map((item) => (
                        <p key={item} className="text-sm text-foreground">
                          {item}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No high-risk weakness detected yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended Next Steps</p>
                <div className="space-y-1">
                  {knowledgeGraph.insights.recommendations.map((item) => (
                    <p key={item} className="text-sm text-foreground">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="mt-6 border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Recent Practice Activity</h2>
          {learnerProfile.recentSessions.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No practice sessions yet. Solve a problem to build your profile.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {learnerProfile.recentSessions.slice(0, 5).map((session) => (
                <div key={`${session.problemId}-${session.createdAt}`} className="rounded-md border border-border bg-background px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{session.problemTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.passedTests}/{session.totalTests} tests • {session.language.toUpperCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
