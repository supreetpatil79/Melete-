import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import TrackCard from "../components/TrackCard";
import CourseCard from "../components/CourseCard";
import { useAuth } from "../context/AuthContext";
import { getTracksByBranch } from "../services/trackService";
import { branches } from "../data/branches";
import { Button } from "@/components/ui/button";
import {
  autocompleteUnifiedCatalog,
  searchUnifiedCatalog,
  type UnifiedSearchHit,
} from "@/services/searchService";
import SearchBar from "@/components/SearchBar";

const parseTrackIdFromUrl = (url: string): string | null => {
  const match = url.match(/^\/tracks\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const parseCourseRoute = (url: string): { trackId: string; courseId: string } | null => {
  const match = url.match(/^\/tracks\/([^/?#]+)\/courses\/([^/?#]+)/);
  if (!match?.[1] || !match?.[2]) return null;
  return {
    trackId: decodeURIComponent(match[1]),
    courseId: decodeURIComponent(match[2]),
  };
};

const TracksPage = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showBranchFilter, setShowBranchFilter] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(user?.branch || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchTookMs, setSearchTookMs] = useState(0);
  const [searchSource, setSearchSource] = useState<"api" | "fallback">("api");
  const [searchBackend, setSearchBackend] = useState<
    "in-memory" | "elasticsearch" | "fallback-in-memory" | undefined
  >(undefined);
  const [searchResults, setSearchResults] = useState<UnifiedSearchHit[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<UnifiedSearchHit[]>([]);

  const allTracks = useMemo(() => getTracksByBranch(selectedBranch || undefined), [selectedBranch]);
  const trackById = useMemo(() => new Map(getTracksByBranch().map((track) => [track.id, track])), []);
  const normalizedQuery = searchQuery.trim();

  useEffect(() => {
    if (!normalizedQuery) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setSearchTotal(0);
      setSearchTookMs(0);
      setIsSearching(false);
      setSearchBackend(undefined);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await searchUnifiedCatalog({
          q: normalizedQuery,
          userId: user?.id,
          type: "all",
          limit: 10,
          signal: controller.signal,
        });

        const filteredResults =
          selectedBranch.length > 0
            ? response.results.filter((result) => {
                if (result.type === "track") {
                  const trackId = parseTrackIdFromUrl(result.url);
                  const track = trackId ? trackById.get(trackId) : null;
                  return track ? track.branches.includes(selectedBranch) : false;
                }
                if (result.type === "course") {
                  const route = parseCourseRoute(result.url);
                  const track = route ? trackById.get(route.trackId) : null;
                  return track ? track.branches.includes(selectedBranch) : false;
                }
                return true;
              })
            : response.results;

        setSearchResults(filteredResults);
        setSearchTotal(filteredResults.length);
        setSearchTookMs(response.tookMs);
        setSearchSource(response.source);
        setSearchBackend(response.backend);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSearchResults([]);
        setSearchTotal(0);
        setSearchBackend(undefined);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [normalizedQuery, selectedBranch, trackById, user?.id]);

  useEffect(() => {
    if (!normalizedQuery) {
      setSearchSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await autocompleteUnifiedCatalog({
          q: normalizedQuery,
          userId: user?.id,
          type: "all",
          limit: 8,
          signal: controller.signal,
        });
        setSearchSuggestions(response.results);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSearchSuggestions([]);
      }
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [normalizedQuery, user?.id]);

  const trackResults = useMemo(() => {
    if (!normalizedQuery) {
      return allTracks;
    }

    return searchResults
      .filter((result) => result.type === "track")
      .map((result) => {
        const trackId = parseTrackIdFromUrl(result.url);
        return trackId ? trackById.get(trackId) : null;
      })
      .filter((track): track is ReturnType<typeof getTracksByBranch>[number] => Boolean(track));
  }, [allTracks, normalizedQuery, searchResults, trackById]);

  const courseResults = useMemo(
    () =>
      searchResults
        .filter((result) => result.type === "course")
        .map((result) => {
          const route = parseCourseRoute(result.url);
          if (!route) return null;
          const track = trackById.get(route.trackId);
          const course = track?.courses.find((candidate) => candidate.id === route.courseId);
          return {
            result,
            trackId: route.trackId,
            courseId: route.courseId,
            duration: course?.duration ?? "Flexible",
            lessons: course?.lessons ?? 0,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [searchResults, trackById],
  );
  const suggestionItems = useMemo(
    () =>
      searchSuggestions.map((suggestion) => ({
        id: suggestion.id,
        section: suggestion.section,
        label: suggestion.title,
        hint: suggestion.snippet,
        highlightLabel: suggestion.highlights.title?.[0],
        highlightHint: suggestion.highlights.description?.[0],
      })),
    [searchSuggestions],
  );
  const currentBranch = branches.find((branch) => branch.id === selectedBranch);

  return (
    <div className="min-h-screen bg-background pb-16 pt-24">
      <div className="container">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-4xl font-semibold text-foreground">Tracks</h1>
          <p className="mt-2 text-muted-foreground">Find the right path quickly with focused search and filtering.</p>
          {currentBranch && <p className="mt-2 text-sm font-medium text-primary">Showing tracks for {currentBranch.name}</p>}
        </motion.section>

        <section className="liquid-glass mb-8 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                placeholder="Search tracks, courses, and skills"
                suggestions={suggestionItems}
                isLoading={isSearching}
                onValueChange={setSearchQuery}
                onSelectSuggestion={(suggestion) => setSearchQuery(suggestion.label)}
                onSubmit={setSearchQuery}
              />
            </div>

            {user && (
              <Button
                variant={showBranchFilter ? "default" : "outline"}
                onClick={() => setShowBranchFilter((value) => !value)}
                className="h-11 gap-2"
              >
                <Filter className="h-4 w-4" />
                Branch Filter
              </Button>
            )}
          </div>

          {showBranchFilter && user && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranch(selectedBranch === branch.id ? "" : branch.id)}
                    className={`liquid-glass-button motion-interactive motion-button rounded-md border px-3 py-2 text-sm font-medium ${
                      selectedBranch === branch.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/50"
                    }`}
                  >
                    {branch.code}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </section>

        {normalizedQuery && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {isSearching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </span>
            ) : (
              <>
                <span>{searchTotal} matches</span>
                <span>in {searchTookMs}ms</span>
                <span>source: {searchSource}{searchBackend ? `/${searchBackend}` : ""}</span>
              </>
            )}
          </div>
        )}

        {trackResults.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trackResults.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <TrackCard {...track} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              {normalizedQuery ? "No track results found. Try another query." : "No tracks available for this branch."}
            </p>
          </div>
        )}

        {normalizedQuery && courseResults.length > 0 && (
          <section className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">Course Matches</h2>
              <span className="text-sm text-muted-foreground">{courseResults.length} results</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courseResults.map((course, index) => (
                <motion.div
                  key={`${course.trackId}:${course.courseId}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <CourseCard
                    id={course.courseId ?? `${course.trackId}-${index}`}
                    title={course.result.title}
                    description={course.result.snippet || course.result.description}
                    duration={course.duration}
                    lessons={course.lessons ?? 0}
                    trackId={course.trackId}
                  />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default TracksPage;
