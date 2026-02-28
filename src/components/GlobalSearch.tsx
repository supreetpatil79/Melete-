import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Clock,
  History,
  LayoutDashboard,
  Loader2,
  Map as MapIcon,
  Newspaper,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  autocompleteUnifiedCatalog,
  searchUnifiedCatalog,
  trackSearchEngagement,
  type UnifiedSearchHit,
} from "@/services/searchService";
import {
  getSearchSuggestions,
  type SearchHistoryEntry,
  rememberSearchQuery,
} from "@/services/searchHistoryService";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_SEARCH_LENGTH = 2;

const iconByType = (type: UnifiedSearchHit["type"]) => {
  if (type === "track") return LayoutDashboard;
  if (type === "course") return BookOpen;
  if (type === "problem") return Sparkles;
  if (type === "roadmap") return MapIcon;
  return Wrench;
};

const queryToResultsPath = (query: string) => `/search-results?q=${encodeURIComponent(query.trim())}`;
const sanitizeHighlight = (value: string): string => value.replace(/<(?!\/?em\b)[^>]*>/gi, "");

const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultSource, setResultSource] = useState<"api" | "fallback">("api");
  const [searchBackend, setSearchBackend] = useState<
    "in-memory" | "elasticsearch" | "fallback-in-memory" | undefined
  >(undefined);
  const [searchTookMs, setSearchTookMs] = useState(0);
  const [results, setResults] = useState<UnifiedSearchHit[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<UnifiedSearchHit[]>([]);
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setAutocompleteResults([]);
      setIsLoading(false);
      setSearchBackend(undefined);
      setSearchTookMs(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (normalizedQuery.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setSearchTookMs(0);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchUnifiedCatalog({
          q: normalizedQuery,
          type: "all",
          limit: 10,
          page: 1,
          userId: user?.id,
          signal: controller.signal,
        });

        setResults(response.results);
        setResultSource(response.source);
        setSearchBackend(response.backend);
        setSearchTookMs(response.tookMs);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setResults([]);
        setSearchBackend(undefined);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, normalizedQuery, user?.id]);

  useEffect(() => {
    if (!open) return;
    if (normalizedQuery.length === 0) {
      setAutocompleteResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await autocompleteUnifiedCatalog({
          q: normalizedQuery,
          type: "all",
          limit: 8,
          userId: user?.id,
          signal: controller.signal,
        });
        setAutocompleteResults(response.results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setAutocompleteResults([]);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, normalizedQuery, user?.id]);

  const historySuggestions = useMemo(
    () => getSearchSuggestions(query, query.trim().length < MIN_SEARCH_LENGTH ? 6 : 4),
    [query],
  );

  const groupedResults = useMemo(() => {
    const groups = new Map<string, UnifiedSearchHit[]>();
    for (const result of results) {
      if (!groups.has(result.section)) {
        groups.set(result.section, []);
      }
      groups.get(result.section)!.push(result);
    }
    return [...groups.entries()];
  }, [results]);

  const groupedAutocomplete = useMemo(() => {
    const groups = new Map<string, UnifiedSearchHit[]>();
    for (const result of autocompleteResults) {
      if (!groups.has(result.section)) {
        groups.set(result.section, []);
      }
      groups.get(result.section)!.push(result);
    }
    return [...groups.entries()];
  }, [autocompleteResults]);

  const navigateToPath = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  };

  const handleSelectSuggestion = (entry: SearchHistoryEntry) => {
    setQuery(entry.query);
  };

  const handleSelectResult = async (result: UnifiedSearchHit) => {
    const historyQuery = normalizedQuery || result.title;
    rememberSearchQuery(historyQuery, {
      path: result.url,
      title: result.title,
    });
    if (user) {
      await trackSearchEngagement({
        userId: user.id,
        type: result.type,
        tags: result.tags,
        query: historyQuery,
        resultId: result.id,
      });
    }
    navigateToPath(result.url);
  };

  const handleOpenFullSearch = () => {
    if (!normalizedQuery) return;
    rememberSearchQuery(normalizedQuery, {
      path: queryToResultsPath(normalizedQuery),
      title: `Results for "${normalizedQuery}"`,
    });
    navigateToPath(queryToResultsPath(normalizedQuery));
  };

  const showAutocomplete =
    normalizedQuery.length > 0 &&
    groupedAutocomplete.length > 0 &&
    (normalizedQuery.length < MIN_SEARCH_LENGTH || isLoading || results.length === 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search problems, tracks, courses, roadmaps, and help docs..."
      />
      <CommandList>
        {query.trim().length < MIN_SEARCH_LENGTH && historySuggestions.length > 0 && (
          <CommandGroup heading="Recent searches">
            {historySuggestions.map((entry) => (
              <CommandItem
                key={`${entry.query}-${entry.usedAt}`}
                value={`history ${entry.query}`}
                onSelect={() => handleSelectSuggestion(entry)}
              >
                <History className="mr-2 h-4 w-4" />
                <span className="truncate">{entry.query}</span>
                <CommandShortcut>{entry.count}x</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showAutocomplete &&
          groupedAutocomplete.map(([section, entries]) => (
            <CommandGroup key={section} heading={section}>
              {entries.map((result) => {
                const Icon = iconByType(result.type);
                return (
                  <CommandItem
                    key={`autocomplete-${result.id}`}
                    value={`${result.title} ${result.section} ${result.tags.join(" ")}`}
                    onSelect={() => {
                      void handleSelectResult(result);
                    }}
                    className="flex-col items-start"
                  >
                    <div className="flex w-full items-center">
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      <span
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHighlight(result.highlights.title?.[0] ?? result.title),
                        }}
                      />
                    </div>
                    <span
                      className="line-clamp-1 pl-6 text-xs text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHighlight(result.highlights.description?.[0] ?? result.snippet),
                      }}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}

        {query.trim().length < MIN_SEARCH_LENGTH && (
          <CommandGroup heading="Quick links">
            <CommandItem
              value="whats up in tech page"
              onSelect={() => {
                navigateToPath("/whats-up-in-tech");
              }}
            >
              <Newspaper className="mr-2 h-4 w-4" />
              What&apos;s Up in Tech
              <CommandShortcut>Discover</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="tracks page"
              onSelect={() => {
                navigateToPath("/tracks");
              }}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Tracks
              <CommandShortcut>Browse</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="courses page"
              onSelect={() => {
                navigateToPath("/courses");
              }}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Courses
              <CommandShortcut>Browse</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="practice page"
              onSelect={() => {
                navigateToPath("/practice");
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Practice
              <CommandShortcut>Build</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="goals planner page"
              onSelect={() => {
                navigateToPath("/goals");
              }}
            >
              <Target className="mr-2 h-4 w-4" />
              Goals Planner
              <CommandShortcut>Plan</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {normalizedQuery.length >= MIN_SEARCH_LENGTH && (
          <CommandGroup heading="Search">
            <CommandItem value={`open full search ${normalizedQuery}`} onSelect={handleOpenFullSearch}>
              <Clock className="mr-2 h-4 w-4" />
              Search for &quot;{normalizedQuery}&quot;
              <CommandShortcut>Enter</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}

        {!isLoading && normalizedQuery.length >= MIN_SEARCH_LENGTH && results.length === 0 && (
          <>
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found. Try a broader query.
            </div>
            {historySuggestions.length > 0 && (
              <CommandGroup heading="Try from your history">
                {historySuggestions.map((entry) => (
                  <CommandItem
                    key={`suggestion-${entry.query}-${entry.usedAt}`}
                    value={`suggestion ${entry.query}`}
                    onSelect={() => handleSelectSuggestion(entry)}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {entry.query}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {!isLoading && normalizedQuery.length >= MIN_SEARCH_LENGTH && results.length > 0 && (
          <>
            <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
              <span>
                Ranked search in {searchTookMs}ms
              </span>
              <span>
                Source: {resultSource}{searchBackend ? `/${searchBackend}` : ""}
              </span>
            </div>
            <CommandSeparator />
            {groupedResults.map(([section, entries]) => (
              <CommandGroup key={`results-${section}`} heading={section}>
                {entries.map((result) => {
                  const Icon = iconByType(result.type);
                  return (
                    <CommandItem
                      key={`result-${result.id}`}
                      value={`${result.title} ${result.description} ${result.section}`}
                      onSelect={() => {
                        void handleSelectResult(result);
                      }}
                      className="flex-col items-start"
                    >
                      <div className="flex w-full items-center">
                        <Icon className="mr-2 h-4 w-4 shrink-0" />
                        <span
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHighlight(result.highlights.title?.[0] ?? result.title),
                          }}
                        />
                        <CommandShortcut className="ml-2">{result.section}</CommandShortcut>
                      </div>
                      <span
                        className="line-clamp-1 pl-6 text-xs text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHighlight(result.highlights.description?.[0] ?? result.snippet),
                        }}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
