import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import SearchBar, { type SearchBarSuggestion } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  autocompleteUnifiedCatalog,
  searchUnifiedCatalog,
  trackSearchEngagement,
  type UnifiedSearchHit,
  type UnifiedSearchType,
} from "@/services/searchService";

const PAGE_SIZE = 10;

const typeFilters: Array<{ value: UnifiedSearchType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "problem", label: "Problems" },
  { value: "track", label: "Tracks" },
  { value: "course", label: "Courses" },
  { value: "roadmap", label: "Roadmaps" },
  { value: "help", label: "Help Docs" },
];

const difficultyFilters = ["all", "Easy", "Medium", "Hard"];

const parsePage = (value: string | null): number => {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

const sanitizeHighlight = (value: string): string => value.replace(/<(?!\/?em\b)[^>]*>/gi, "");

const SearchResultsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = (searchParams.get("q") ?? "").trim();
  const typeParam = (searchParams.get("type") ?? "all") as UnifiedSearchType | "all";
  const difficultyParam = searchParams.get("difficulty") ?? "all";
  const tagParam = searchParams.get("tag") ?? "";
  const pageParam = parsePage(searchParams.get("page"));

  const [queryInput, setQueryInput] = useState(urlQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UnifiedSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [sourceLabel, setSourceLabel] = useState("api");
  const [backendLabel, setBackendLabel] = useState<string | undefined>(undefined);
  const [autocomplete, setAutocomplete] = useState<UnifiedSearchHit[]>([]);

  useEffect(() => {
    setQueryInput(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (!urlQuery) {
      setResults([]);
      setTotal(0);
      setTookMs(0);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void searchUnifiedCatalog({
      q: urlQuery,
      page: pageParam,
      limit: PAGE_SIZE,
      type: typeParam,
      difficulty: difficultyParam === "all" ? undefined : difficultyParam,
      tags: tagParam ? [tagParam] : undefined,
      userId: user?.id,
      signal: controller.signal,
    })
      .then((response) => {
        setResults(response.results);
        setTotal(response.total);
        setTookMs(response.tookMs);
        setSourceLabel(response.source);
        setBackendLabel(response.backend);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setResults([]);
        setTotal(0);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [difficultyParam, pageParam, tagParam, typeParam, urlQuery, user?.id]);

  useEffect(() => {
    if (!queryInput.trim()) {
      setAutocomplete([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await autocompleteUnifiedCatalog({
          q: queryInput,
          userId: user?.id,
          limit: 8,
          signal: controller.signal,
        });
        setAutocomplete(response.results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAutocomplete([]);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [queryInput, user?.id]);

  const updateParams = (next: {
    q?: string;
    type?: UnifiedSearchType | "all";
    difficulty?: string;
    tag?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams(searchParams);
    if (next.q !== undefined) {
      const normalized = next.q.trim();
      if (normalized) params.set("q", normalized);
      else params.delete("q");
    }
    if (next.type !== undefined) {
      if (next.type === "all") params.delete("type");
      else params.set("type", next.type);
    }
    if (next.difficulty !== undefined) {
      if (next.difficulty === "all") params.delete("difficulty");
      else params.set("difficulty", next.difficulty);
    }
    if (next.tag !== undefined) {
      if (!next.tag) params.delete("tag");
      else params.set("tag", next.tag);
    }
    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page");
      else params.set("page", String(next.page));
    }
    setSearchParams(params, { replace: false });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const availableTags = useMemo(
    () =>
      [...new Set(results.flatMap((result) => result.tags))]
        .filter((tag) => tag.length > 1)
        .slice(0, 10),
    [results],
  );

  const autocompleteSuggestions: SearchBarSuggestion[] = useMemo(
    () =>
      autocomplete.map((item) => ({
        id: item.id,
        label: item.title,
        hint: item.section,
        section: item.section,
        highlightLabel: item.highlights.title?.[0],
        highlightHint: item.highlights.description?.[0],
      })),
    [autocomplete],
  );

  const handleSelectResult = async (result: UnifiedSearchHit) => {
    if (user) {
      await trackSearchEngagement({
        userId: user.id,
        type: result.type,
        tags: result.tags,
        query: urlQuery,
        resultId: result.id,
      });
    }
    navigate(result.url);
  };

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-foreground">Search Results</h1>
          <p className="text-sm text-muted-foreground">
            Search across problems, tracks, courses, roadmaps, and help docs.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <SearchBar
            value={queryInput}
            placeholder="Search Melete..."
            suggestions={autocompleteSuggestions}
            isLoading={isLoading}
            onValueChange={setQueryInput}
            onSubmit={(value) => {
              updateParams({
                q: value,
                page: 1,
              });
            }}
            onSelectSuggestion={(suggestion) => {
              updateParams({
                q: suggestion.label,
                page: 1,
              });
            }}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {typeFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() =>
                  updateParams({
                    type: filter.value,
                    page: 1,
                  })
                }
                className={`motion-interactive motion-button rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  typeParam === filter.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {difficultyFilters.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                onClick={() =>
                  updateParams({
                    difficulty,
                    page: 1,
                  })
                }
                className={`motion-interactive motion-button rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  difficultyParam === difficulty
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {difficulty}
              </button>
            ))}
          </div>

          {availableTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Tags:</span>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    updateParams({
                      tag: tagParam === tag ? "" : tag,
                      page: 1,
                    })
                  }
                  className={`motion-interactive motion-button rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    tagParam === tag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </span>
          ) : (
            <span>
              {total} matches in {tookMs}ms | source: {sourceLabel}
              {backendLabel ? `/${backendLabel}` : ""}
            </span>
          )}
        </section>

        <section className="space-y-3">
          {!isLoading && results.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
              No results found. Try a broader query.
            </div>
          )}

          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => {
                void handleSelectResult(result);
              }}
              className="w-full rounded-2xl border border-border bg-card p-5 text-left transition-shadow hover:shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    {result.section}
                  </span>
                  {result.difficulty && (
                    <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                      {result.difficulty}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">score: {result.score.toFixed(3)}</span>
              </div>

              <h2
                className="mt-3 text-lg font-semibold text-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHighlight(result.highlights.title?.[0] ?? result.title),
                }}
              />
              <p
                className="mt-2 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHighlight(result.highlights.description?.[0] ?? result.snippet),
                }}
              />
              {result.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.tags.slice(0, 5).map((tag) => (
                    <span key={`${result.id}-${tag}`} className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </section>

        {total > 0 && (
          <footer className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageParam <= 1}
              onClick={() => updateParams({ page: Math.max(1, pageParam - 1) })}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="inline-flex min-w-[120px] items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              Page {pageParam} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageParam >= totalPages}
              onClick={() => updateParams({ page: Math.min(totalPages, pageParam + 1) })}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default SearchResultsPage;
