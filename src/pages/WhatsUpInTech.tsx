import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Newspaper, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getLearnerDnaSummary, getLearnerProfile } from "@/services/learnerProfileService";
import { listTechViseThreads } from "@/services/techviseService";
import { fetchTechNews, type TechNewsArticle, type TechNewsResponse } from "@/services/techNewsService";
import { searchTechNewsArticles } from "@/shared/articleSearch";

const formatPublishedAt = (value: string): string => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Recent";
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const WhatsUpInTechPage = () => {
  const { user } = useAuth();
  const [feed, setFeed] = useState<TechNewsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const requestPayload = useMemo(() => {
    if (!user) {
      return {
        maxPersonalized: 8,
        maxGeneral: 8,
      };
    }

    const dna = getLearnerDnaSummary(user.id, user.branch);
    const profile = getLearnerProfile(user.id, user.branch);
    const threads = listTechViseThreads();

    const relatedThreads = threads.filter(
      (thread) => thread.author.id === user.id || thread.answers.some((answer) => answer.author.id === user.id),
    );

    const techViseTags = Array.from(
      new Set(
        relatedThreads
          .flatMap((thread) => thread.tags)
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 1),
      ),
    ).slice(0, 14);

    return {
      branch: user.branch,
      strongestLanguage: dna.strongestLanguage,
      focusLanguage: dna.focusLanguage,
      topMistakes: dna.topMistakes.map((mistake) => mistake.label),
      recentProblemTitles: profile.recentSessions.slice(0, 10).map((session) => session.problemTitle),
      techViseTags,
      maxPersonalized: 8,
      maxGeneral: 8,
    };
  }, [user]);

  const loadFeed = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchTechNews(requestPayload);
      setFeed(response);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load tech news right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed();
  }, [requestPayload]);

  const filteredArticles = useMemo(
    () => searchTechNewsArticles(feed?.articles ?? [], searchQuery, 80),
    [feed?.articles, searchQuery],
  );
  const personalizedArticles = filteredArticles.filter((article) => article.relevance === "personalized");
  const generalArticles = filteredArticles.filter((article) => article.relevance === "general");
  const hasSearchQuery = searchQuery.trim().length > 0;

  const renderArticle = (article: TechNewsArticle) => (
    <article key={article.id} className="rounded-xl border border-border bg-card p-4">
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-start gap-2 text-sm font-semibold text-foreground hover:text-primary"
      >
        <span className="line-clamp-2">{article.title}</span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80 group-hover:opacity-100" />
      </a>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{article.source}</span>
        <span>•</span>
        <span>{formatPublishedAt(article.publishedAt)}</span>
        <span>•</span>
        <span>Query: {article.query}</span>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-4xl font-semibold text-foreground">What&apos;s Up in Tech</h1>
              <p className="mt-2 text-muted-foreground">
                Personalized tech news first from your learning activity, then general tech updates.
              </p>
            </div>
            <Button variant="outline" onClick={() => void loadFeed()} className="gap-2" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </motion.div>

        {feed && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-secondary px-2 py-1">source: {feed.source}</span>
            <span className="rounded-md bg-secondary px-2 py-1">cache: {feed.cache}</span>
            <span className="rounded-md bg-secondary px-2 py-1">{feed.personalizedCount} personalized</span>
            <span className="rounded-md bg-secondary px-2 py-1">{feed.generalCount} general</span>
            {hasSearchQuery && (
              <span className="rounded-md bg-secondary px-2 py-1">
                {filteredArticles.length} matches for "{searchQuery.trim()}"
              </span>
            )}
          </div>
        )}

        {!isLoading && !error && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder='Search news by topic, source, or query... (supports "phrase", +must, -exclude)'
                className="h-11 pl-10 pr-10"
              />
              {hasSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="liquid-glass-button absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <Card className="mb-6 border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </Card>
        )}

        {isLoading && (
          <Card className="border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading tech updates...
            </div>
          </Card>
        )}

        {!isLoading && !error && (
          <div className="space-y-8">
            {hasSearchQuery && filteredArticles.length === 0 && (
              <Card className="border border-border bg-card p-4 text-sm text-muted-foreground">
                No matching updates found. Try broader keywords or remove required/excluded terms.
              </Card>
            )}

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">For Your Learning Path</h2>
              </div>
              {personalizedArticles.length === 0 ? (
                <Card className="border border-border bg-card p-4 text-sm text-muted-foreground">
                  No personalized items yet. Keep solving and discussing in TechVise to sharpen this feed.
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {personalizedArticles.map(renderArticle)}
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">General Tech News</h2>
              </div>
              {generalArticles.length === 0 ? (
                <Card className="border border-border bg-card p-4 text-sm text-muted-foreground">
                  No general tech updates available right now.
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {generalArticles.map(renderArticle)}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsUpInTechPage;
