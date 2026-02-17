import { safeStorage } from "@/lib/safeStorage";

const SEARCH_HISTORY_STORAGE_KEY = "learnpath_search_history_v1";
const MAX_HISTORY_ENTRIES = 14;

export interface SearchHistoryEntry {
  query: string;
  selectedPath?: string;
  selectedTitle?: string;
  usedAt: string;
  count: number;
}

const normalizeQuery = (value: string): string => value.trim().toLowerCase();

const readEntries = (): SearchHistoryEntry[] => {
  const raw = safeStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SearchHistoryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => typeof entry.query === "string" && entry.query.trim().length > 0)
      .map((entry) => ({
        query: entry.query.trim(),
        selectedPath: entry.selectedPath,
        selectedTitle: entry.selectedTitle,
        usedAt: entry.usedAt,
        count: Math.max(1, Number(entry.count) || 1),
      }));
  } catch {
    return [];
  }
};

const writeEntries = (entries: SearchHistoryEntry[]): void => {
  safeStorage.setItem(
    SEARCH_HISTORY_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)),
  );
};

export const getRecentSearches = (limit = 6): SearchHistoryEntry[] =>
  readEntries()
    .slice()
    .sort((left, right) => right.usedAt.localeCompare(left.usedAt))
    .slice(0, Math.max(1, limit));

export const rememberSearchQuery = (
  query: string,
  selection?: { path?: string; title?: string },
): void => {
  const trimmed = query.trim();
  if (!trimmed) return;

  const normalized = normalizeQuery(trimmed);
  const now = new Date().toISOString();
  const entries = readEntries();
  const existingIndex = entries.findIndex((entry) => normalizeQuery(entry.query) === normalized);

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    entries.splice(existingIndex, 1);
    entries.unshift({
      ...existing,
      query: trimmed,
      selectedPath: selection?.path ?? existing.selectedPath,
      selectedTitle: selection?.title ?? existing.selectedTitle,
      usedAt: now,
      count: existing.count + 1,
    });
    writeEntries(entries);
    return;
  }

  entries.unshift({
    query: trimmed,
    selectedPath: selection?.path,
    selectedTitle: selection?.title,
    usedAt: now,
    count: 1,
  });
  writeEntries(entries);
};

export const getSearchSuggestions = (queryPrefix: string, limit = 5): SearchHistoryEntry[] => {
  const trimmed = queryPrefix.trim();
  if (!trimmed) {
    return getRecentSearches(limit);
  }

  const normalizedPrefix = normalizeQuery(trimmed);

  return readEntries()
    .filter((entry) => normalizeQuery(entry.query).includes(normalizedPrefix))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return right.usedAt.localeCompare(left.usedAt);
    })
    .slice(0, Math.max(1, limit));
};
