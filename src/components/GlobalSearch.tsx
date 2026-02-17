import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, History, LayoutDashboard, Loader2, Newspaper, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { searchCatalog } from "@/services/searchService";
import {
  getSearchSuggestions,
  rememberSearchQuery,
  type SearchHistoryEntry,
} from "@/services/searchHistoryService";
import type { SearchHit } from "@/shared/catalogSearch";
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

const pathForResult = (result: SearchHit): string => {
  if (result.type === "track") {
    return `/tracks/${result.trackId}`;
  }
  return `/tracks/${result.trackId}/courses/${result.courseId}`;
};

const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultSource, setResultSource] = useState<"api" | "fallback">("api");
  const [searchTookMs, setSearchTookMs] = useState(0);
  const [results, setResults] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setSearchTookMs(0);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchCatalog({
          q: normalizedQuery,
          type: "all",
          branch: user?.branch || undefined,
          limit: 10,
          signal: controller.signal,
        });

        setResults(response.results);
        setResultSource(response.source);
        setSearchTookMs(response.tookMs);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, query, user?.branch]);

  const suggestions = useMemo(
    () => getSearchSuggestions(query, query.trim().length < MIN_SEARCH_LENGTH ? 6 : 4),
    [query],
  );

  const groupedResults = useMemo(() => {
    const tracks = results.filter((result) => result.type === "track");
    const courses = results.filter((result) => result.type === "course");
    return { tracks, courses };
  }, [results]);

  const navigateToPath = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  };

  const handleSelectSuggestion = (entry: SearchHistoryEntry) => {
    setQuery(entry.query);
  };

  const handleSelectResult = (result: SearchHit) => {
    const destination = pathForResult(result);
    const historyQuery = query.trim() || result.title;
    rememberSearchQuery(historyQuery, {
      path: destination,
      title: result.title,
    });
    navigateToPath(destination);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search tracks, courses, and topics..."
      />
      <CommandList>
        {query.trim().length < MIN_SEARCH_LENGTH && suggestions.length > 0 && (
          <CommandGroup heading="Recent searches">
            {suggestions.map((entry) => (
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
          </CommandGroup>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </div>
        )}

        {!isLoading && query.trim().length >= MIN_SEARCH_LENGTH && results.length === 0 && (
          <>
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found. Try a broader query.
            </div>
            {suggestions.length > 0 && (
              <CommandGroup heading="Try from your history">
                {suggestions.map((entry) => (
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

        {!isLoading && query.trim().length >= MIN_SEARCH_LENGTH && results.length > 0 && (
          <>
            <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
              <span>
                Ranked search in {searchTookMs}ms
              </span>
              <span>
                Source: {resultSource}
              </span>
            </div>
            <CommandSeparator />
          </>
        )}

        {!isLoading && groupedResults.tracks.length > 0 && (
          <CommandGroup heading="Tracks">
            {groupedResults.tracks.map((result) => (
              <CommandItem
                key={`track-${result.trackId}`}
                value={`${result.title} ${result.description}`}
                onSelect={() => handleSelectResult(result)}
                className="flex-col items-start"
              >
                <div className="flex w-full items-center">
                  <LayoutDashboard className="mr-2 h-4 w-4 shrink-0" />
                  <span>{result.title}</span>
                </div>
                <span className="line-clamp-1 pl-6 text-xs text-muted-foreground">
                  {result.snippet}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!isLoading && groupedResults.courses.length > 0 && (
          <CommandGroup heading="Courses">
            {groupedResults.courses.map((result) => (
              <CommandItem
                key={`course-${result.trackId}-${result.courseId}`}
                value={`${result.title} ${result.description} ${result.trackTitle}`}
                onSelect={() => handleSelectResult(result)}
                className="flex-col items-start"
              >
                <div className="flex w-full items-center">
                  <BookOpen className="mr-2 h-4 w-4 shrink-0" />
                  <span>{result.title}</span>
                  <CommandShortcut className="ml-2">{result.trackTitle}</CommandShortcut>
                </div>
                <span className="line-clamp-1 pl-6 text-xs text-muted-foreground">
                  {result.snippet}
                </span>
                <span className="mt-1 flex items-center gap-1 pl-6 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {result.duration}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
