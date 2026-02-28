import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Medal,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  addTechViseAnswer,
  createTechViseThread,
  getTechViseLeaderboard,
  listTechViseThreads,
  voteTechViseAnswer,
  type TechViseThread,
  type TechViseUser,
} from "@/services/techviseService";

const TechVisePage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialCompany = searchParams.get("company") ?? "";

  const [threads, setThreads] = useState<TechViseThread[]>(() => listTechViseThreads());
  const [selectedThreadId, setSelectedThreadId] = useState<string>(threads[0]?.id ?? "");
  const [companyFilter, setCompanyFilter] = useState(initialCompany);
  const [query, setQuery] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newCompanyFocus, setNewCompanyFocus] = useState(initialCompany);

  const [answerBody, setAnswerBody] = useState("");
  const [answerAsEngineer, setAnswerAsEngineer] = useState(false);
  const [answerCompany, setAnswerCompany] = useState(initialCompany);
  const [answerRole, setAnswerRole] = useState("");

  const viewer: TechViseUser | undefined = user
    ? { id: user.id, name: user.name, branch: user.branch }
    : undefined;

  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedCompany = companyFilter.trim().toLowerCase();

    return threads.filter((thread) => {
      if (normalizedCompany) {
        const fromThread = thread.companyFocus?.toLowerCase() ?? "";
        const fromAnswers = thread.answers.some(
          (answer) => answer.author.company?.toLowerCase() === normalizedCompany,
        );
        if (fromThread !== normalizedCompany && !fromAnswers) return false;
      }

      if (!normalizedQuery) return true;

      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        thread.body.toLowerCase().includes(normalizedQuery) ||
        thread.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [companyFilter, query, threads]);

  const activeThread =
    filteredThreads.find((thread) => thread.id === selectedThreadId) ?? filteredThreads[0] ?? null;

  const leaderboard = useMemo(() => getTechViseLeaderboard(viewer), [viewer, threads]);

  useEffect(() => {
    if (!filteredThreads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(filteredThreads[0]?.id ?? "");
    }
  }, [filteredThreads, selectedThreadId]);

  const refreshThreads = () => setThreads(listTechViseThreads());

  const handleCreateThread = () => {
    if (!viewer) return;
    const title = newTitle.trim();
    const body = newBody.trim();
    if (title.length < 8 || body.length < 20) return;

    const created = createTechViseThread({
      title,
      body,
      tags: newTags.split(","),
      companyFocus: newCompanyFocus.trim() || undefined,
      user: viewer,
    });

    setNewTitle("");
    setNewBody("");
    setNewTags("");
    setSelectedThreadId(created.id);
    refreshThreads();
  };

  const handleAddAnswer = () => {
    if (!viewer || !activeThread) return;
    if (answerBody.trim().length < 12) return;

    const updated = addTechViseAnswer({
      threadId: activeThread.id,
      body: answerBody,
      user: viewer,
      isCompanyEngineer: answerAsEngineer,
      company: answerCompany,
      role: answerRole,
    });

    if (!updated) return;
    setAnswerBody("");
    setAnswerRole("");
    refreshThreads();
  };

  const handleVote = (answerId: string, value: 1 | -1) => {
    if (!viewer || !activeThread) return;
    const updated = voteTechViseAnswer({
      threadId: activeThread.id,
      answerId,
      userId: viewer.id,
      value,
    });
    if (!updated) return;
    refreshThreads();
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-border/50 bg-gradient-card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">TechVise</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Career and engineering advice from company engineers, ranked by helpfulness and
                coding profile strength.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Expert mentorship + leaderboard
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by topic, tag, or question"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              placeholder="Filter by company (Google, Amazon, NVIDIA...)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr,1.8fr,1fr]">
          <div className="space-y-4">
            <Card className="border border-border/50 bg-gradient-card p-4">
              <h2 className="text-sm font-semibold text-foreground">Start New Discussion</h2>
              {!viewer && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sign in to ask questions and post answers.
                </p>
              )}
              <div className="mt-3 space-y-2">
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Question title"
                  disabled={!viewer}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <textarea
                  value={newBody}
                  onChange={(event) => setNewBody(event.target.value)}
                  placeholder="Describe your challenge clearly so mentors can help."
                  disabled={!viewer}
                  className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <input
                  value={newTags}
                  onChange={(event) => setNewTags(event.target.value)}
                  placeholder="Tags (comma separated): dsa, system design, internship"
                  disabled={!viewer}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <input
                  value={newCompanyFocus}
                  onChange={(event) => setNewCompanyFocus(event.target.value)}
                  placeholder="Optional company focus"
                  disabled={!viewer}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                />
                <Button
                  onClick={handleCreateThread}
                  className="w-full"
                  disabled={!viewer || newTitle.trim().length < 8 || newBody.trim().length < 20}
                >
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Post Question
                </Button>
              </div>
            </Card>

            <Card className="border border-border/50 bg-gradient-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Discussions ({filteredThreads.length})
              </h2>
              <div className="space-y-2">
                {filteredThreads.map((thread) => {
                  const active = activeThread?.id === thread.id;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`liquid-glass-button w-full rounded-md border p-3 text-left transition-colors ${
                        active
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background/60 hover:border-primary/30"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">{thread.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {thread.answers.length} answers • {thread.tags.slice(0, 2).join(", ")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {!activeThread && (
              <Card className="border border-border/50 bg-gradient-card p-6">
                <p className="text-sm text-muted-foreground">
                  No discussions match the current filters. Clear filters or start a new question.
                </p>
              </Card>
            )}

            {activeThread && (
              <>
                <Card className="border border-border/50 bg-gradient-card p-5">
                  <h2 className="text-xl font-semibold text-foreground">{activeThread.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{activeThread.body}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeThread.tags.map((tag) => (
                      <span
                        key={`${activeThread.id}-${tag}`}
                        className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                    {activeThread.companyFocus && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary">
                        <Building2 className="h-3.5 w-3.5" />
                        {activeThread.companyFocus}
                      </span>
                    )}
                  </div>
                </Card>

                <Card className="border border-border/50 bg-gradient-card p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">
                    Answers ({activeThread.answers.length})
                  </h3>
                  <div className="space-y-3">
                    {activeThread.answers.map((answer) => (
                      <Card key={answer.id} className="border border-border/60 bg-background/70 p-4">
                        <p className="text-sm text-muted-foreground">{answer.body}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>
                            {answer.author.name}
                            {answer.author.role ? ` • ${answer.author.role}` : ""}
                            {answer.author.company ? ` • ${answer.author.company}` : ""}
                            {answer.author.isCompanyEngineer ? " • Verified engineer" : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleVote(answer.id, 1)}
                              disabled={!viewer}
                              className="liquid-glass-button rounded border border-border px-2 py-1 text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-14 text-center font-medium text-foreground">
                              {answer.upvotes - answer.downvotes}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleVote(answer.id, -1)}
                              disabled={!viewer}
                              className="liquid-glass-button rounded border border-border px-2 py-1 text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>

                <Card className="border border-border/50 bg-gradient-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">Post Answer</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Give targeted advice. Avoid sharing full solutions when mentoring coding tasks.
                  </p>
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={answerBody}
                      onChange={(event) => setAnswerBody(event.target.value)}
                      disabled={!viewer}
                      placeholder="Write your practical advice..."
                      className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    />

                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={answerAsEngineer}
                        onChange={(event) => setAnswerAsEngineer(event.target.checked)}
                        disabled={!viewer}
                      />
                      I am currently working in a company and sharing industry advice
                    </label>

                    {answerAsEngineer && (
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          value={answerCompany}
                          onChange={(event) => setAnswerCompany(event.target.value)}
                          placeholder="Company"
                          disabled={!viewer}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        />
                        <input
                          value={answerRole}
                          onChange={(event) => setAnswerRole(event.target.value)}
                          placeholder="Role title"
                          disabled={!viewer}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                        />
                      </div>
                    )}

                    <Button
                      onClick={handleAddAnswer}
                      disabled={!viewer || answerBody.trim().length < 12}
                    >
                      <Send className="mr-1.5 h-4 w-4" />
                      Publish Answer
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-4">
            <Card className="border border-border/50 bg-gradient-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Medal className="h-4 w-4 text-primary" />
                TechVise Ranking
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Score = questions asked + answers + helpful votes + solved problems + streak + acceptance rate.
              </p>
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, index) => (
                  <div
                    key={entry.id}
                    className="rounded-md border border-border bg-background/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {index + 1}. {entry.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.company ? `${entry.company} • ` : ""}
                          {entry.badge}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary">{entry.score}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {entry.totalQuestions} queries • {entry.totalAnswers} answers • {entry.helpfulVotes} helpful votes •{" "}
                      {entry.solvedProblems} solved
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechVisePage;
