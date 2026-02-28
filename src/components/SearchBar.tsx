import { type KeyboardEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search } from "lucide-react";

export interface SearchBarSuggestion {
  id: string;
  label: string;
  hint?: string;
  section?: string;
  highlightLabel?: string;
  highlightHint?: string;
}

interface SearchBarProps {
  value: string;
  placeholder: string;
  suggestions?: SearchBarSuggestion[];
  isLoading?: boolean;
  emptyText?: string;
  onValueChange: (value: string) => void;
  onSelectSuggestion?: (suggestion: SearchBarSuggestion) => void;
  onSubmit?: (query: string) => void;
}

const sanitizeHighlight = (value: string): string => value.replace(/<(?!\/?em\b)[^>]*>/gi, "");

const SearchBar = ({
  value,
  placeholder,
  suggestions = [],
  isLoading = false,
  emptyText = "No suggestions found",
  onValueChange,
  onSelectSuggestion,
  onSubmit,
}: SearchBarProps) => {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedValue = value.trim();
  const visibleSuggestions = useMemo(() => {
    if (!trimmedValue) return [];
    return suggestions;
  }, [suggestions, trimmedValue]);

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, SearchBarSuggestion[]>();
    for (const suggestion of visibleSuggestions) {
      const section = suggestion.section ?? "Suggestions";
      if (!groups.has(section)) {
        groups.set(section, []);
      }
      groups.get(section)!.push(suggestion);
    }
    return [...groups.entries()];
  }, [visibleSuggestions]);

  const showDropdown = focused && (trimmedValue.length > 0 || isLoading);

  const handleSelect = (suggestion: SearchBarSuggestion) => {
    onSelectSuggestion?.(suggestion);
    setActiveIndex(-1);
    setFocused(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((previous) => {
        const next = previous + 1;
        return next >= visibleSuggestions.length ? 0 : next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((previous) => {
        if (previous <= 0) return visibleSuggestions.length - 1;
        return previous - 1;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < visibleSuggestions.length) {
        handleSelect(visibleSuggestions[activeIndex]);
        return;
      }
      onSubmit?.(trimmedValue);
      setFocused(false);
      return;
    }

    if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
    }
  };

  let suggestionCursor = -1;

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setFocused(false);
            setActiveIndex(-1);
          }, 120);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="motion-interactive h-10 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none"
        style={{
          boxShadow: focused ? "0 0 0 2px var(--accent)" : "none",
          margin: 0,
        }}
      />
      {isLoading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="motion-dropdown absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-card"
          >
            {groupedSuggestions.length === 0 && !isLoading ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              <div className="space-y-2">
                {groupedSuggestions.map(([section, entries]) => (
                  <div key={section}>
                    <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section}
                    </p>
                    <div className="space-y-1">
                      {entries.map((suggestion) => {
                        suggestionCursor += 1;
                        const currentIndex = suggestionCursor;
                        const isActive = currentIndex === activeIndex;

                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseEnter={() => setActiveIndex(currentIndex)}
                            onClick={() => handleSelect(suggestion)}
                            className={`motion-interactive motion-button w-full rounded-xl border px-3 py-2 text-left ${
                              isActive
                                ? "border-primary bg-secondary"
                                : "border-transparent hover:border-border hover:bg-secondary hover:shadow-sm"
                            }`}
                          >
                            <p
                              className="text-sm font-medium text-foreground"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHighlight(suggestion.highlightLabel ?? suggestion.label),
                              }}
                            />
                            {(suggestion.highlightHint ?? suggestion.hint) && (
                              <p
                                className="mt-0.5 text-xs text-muted-foreground"
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHighlight(suggestion.highlightHint ?? suggestion.hint ?? ""),
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;
