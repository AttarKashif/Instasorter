import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  History,
  Pin,
  Trash2,
  X,
  Search,
  Hash,
  User,
  Folder,
  SlidersHorizontal,
  Star,
  Video,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { CATEGORY_DICTIONARY } from "../../../lib/searchSynonyms";
import { usePostStore } from "../../../store/useStore";

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  useCount: number;
  isPinned?: boolean;
  category?: "filter" | "user" | "tag" | "folder" | "text";
}

export function detectCategory(
  query: string,
): "filter" | "user" | "tag" | "folder" | "text" {
  const lower = query.trim().toLowerCase();
  if (
    lower.startsWith("is:") ||
    lower.startsWith("media:") ||
    lower.startsWith("type:")
  )
    return "filter";
  if (lower.startsWith("from:") || lower.startsWith("user:")) return "user";
  if (lower.startsWith("tag:") || lower.startsWith("#")) return "tag";
  if (
    lower.startsWith("folder:") ||
    lower.startsWith("collection:") ||
    lower.startsWith("cat:")
  )
    return "folder";
  return "text";
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export function useSearchHistory() {
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>(() => {
    try {
      const v2 = localStorage.getItem("instasorter_recent_searches_v2");
      if (v2) {
        return JSON.parse(v2);
      }
      const v1 = localStorage.getItem("instasorter_recent_searches");
      if (v1) {
        const parsed: string[] = JSON.parse(v1);
        return parsed.map((query, idx) => ({
          id: `legacy_${idx}_${Date.now()}`,
          query,
          timestamp: Date.now() - idx * 60000,
          useCount: 1,
          isPinned: false,
          category: detectCategory(query),
        }));
      }
    } catch (e) {
      console.warn("Failed to parse search history", e);
    }
    return [];
  });

  const saveQuery = useCallback((queryStr: string) => {
    const trimmed = queryStr.trim();
    if (!trimmed) return;
    setHistoryItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.query.toLowerCase() === trimmed.toLowerCase(),
      );
      let updated: SearchHistoryItem[];
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const updatedItem: SearchHistoryItem = {
          ...existing,
          query: trimmed,
          timestamp: Date.now(),
          useCount: existing.useCount + 1,
        };
        updated = [
          updatedItem,
          ...prev.filter((_, idx) => idx !== existingIndex),
        ];
      } else {
        const newItem: SearchHistoryItem = {
          id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          query: trimmed,
          timestamp: Date.now(),
          useCount: 1,
          isPinned: false,
          category: detectCategory(trimmed),
        };
        updated = [newItem, ...prev].slice(0, 15);
      }
      try {
        localStorage.setItem(
          "instasorter_recent_searches_v2",
          JSON.stringify(updated),
        );
      } catch (err) {
        console.error("Failed to save search history:", err);
      }
      return updated;
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setHistoryItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, isPinned: !item.isPinned } : item,
      );
      try {
        localStorage.setItem(
          "instasorter_recent_searches_v2",
          JSON.stringify(updated),
        );
      } catch (e) {}
      return updated;
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setHistoryItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(
          "instasorter_recent_searches_v2",
          JSON.stringify(updated),
        );
      } catch (e) {}
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setHistoryItems([]);
    try {
      localStorage.removeItem("instasorter_recent_searches_v2");
      localStorage.removeItem("instasorter_recent_searches");
    } catch (e) {}
  }, []);

  return { historyItems, saveQuery, togglePin, deleteItem, clearAll };
}

interface RecentSearchHistoryProps {
  currentQuery: string;
  onSelectQuery: (query: string, saveToHistory?: boolean) => void;
  onClose: () => void;
  historyItems: SearchHistoryItem[];
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

const QUICK_FILTER_PRESETS = [
  {
    label: "Starred",
    shortcut: "is:favorite",
    icon: Star,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    label: "Videos",
    shortcut: "media:video",
    icon: Video,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  {
    label: "Carousels",
    shortcut: "media:carousel",
    icon: Layers,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    label: "User Filter",
    shortcut: "from:",
    icon: User,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  {
    label: "Hashtag",
    shortcut: "tag:",
    icon: Hash,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    label: "Folder",
    shortcut: "folder:",
    icon: Folder,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
];

export const RecentSearchHistory: React.FC<RecentSearchHistoryProps> = ({
  currentQuery,
  onSelectQuery,
  onClose,
  historyItems,
  onTogglePin,
  onDeleteItem,
  onClearAll,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const posts = usePostStore((state) => state.posts);

  const suggestedSearches = React.useMemo(() => {
    if (!posts || posts.length === 0) return { tags: [], creators: [] };

    const cleanQuery = currentQuery.trim().toLowerCase().replace(/^(tag:|from:|#|@)/, "");

    const tagCounts: Record<string, number> = {};
    posts.forEach((p) => {
      const combined = new Set([
        ...(p.tags || []),
        ...(p.hashtags || []).map((h) => h.replace(/^#/, "")),
      ]);
      combined.forEach((t) => {
        const clean = t.trim().toLowerCase();
        if (clean) {
          tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        }
      });
    });

    const creatorCounts: Record<string, number> = {};
    posts.forEach((p) => {
      const c = (p.creatorUsername || "").trim().toLowerCase();
      if (c) {
        creatorCounts[c] = (creatorCounts[c] || 0) + 1;
      }
    });

    const topTags = Object.entries(tagCounts)
      .filter(([tag]) => !cleanQuery || tag.includes(cleanQuery))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));

    const topCreators = Object.entries(creatorCounts)
      .filter(([creator]) => !cleanQuery || creator.includes(cleanQuery))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([creator, count]) => ({ creator, count }));

    return { tags: topTags, creators: topCreators };
  }, [posts, currentQuery]);

  const pinnedItems = historyItems.filter((item) => item.isPinned);
  const unpinnedItems = historyItems.filter((item) => !item.isPinned);
  const allListItems = [...pinnedItems, ...unpinnedItems];

  // Handle keyboard navigation (ArrowUp, ArrowDown, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (allListItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < allListItems.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : allListItems.length - 1,
        );
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const selected = allListItems[selectedIndex];
        if (selected) {
          onSelectQuery(selected.query, true);
          onClose();
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allListItems, selectedIndex, onSelectQuery, onClose]);

  const renderCategoryIcon = (category?: string) => {
    switch (category) {
      case "filter":
        return <SlidersHorizontal size={11} className="text-indigo-500" />;
      case "user":
        return <User size={11} className="text-purple-500" />;
      case "tag":
        return <Hash size={11} className="text-emerald-500" />;
      case "folder":
        return <Folder size={11} className="text-amber-500" />;
      default:
        return <History size={11} className="text-m3-outline" />;
    }
  };

  const handleApplyPreset = (shortcut: string) => {
    let newQuery = shortcut;
    if (shortcut.endsWith(":")) {
      // If ends with colon, append to current input if something exists
      if (currentQuery.trim() && !currentQuery.includes(shortcut)) {
        newQuery = `${currentQuery.trim()} ${shortcut}`;
      }
    }
    onSelectQuery(newQuery, false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full right-0 mt-1.5 w-72 sm:w-80 bg-m3-surface border border-m3-outline-variant/40 rounded-2xl shadow-xl z-50 overflow-hidden font-sans backdrop-blur-xl text-m3-on-surface"
    >
      {/* Header Bar */}
      <div className="px-3 py-2 border-b border-m3-outline-variant/20 flex items-center justify-between bg-m3-surface-low/60 select-none">
        <div className="flex items-center gap-1.5 text-[11px] font-bold font-display text-m3-on-surface">
          <Clock size={12} className="text-m3-primary" />
          <span>Search History & Presets</span>
        </div>
        {historyItems.length > 0 && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onClearAll();
            }}
            className="text-[10px] font-semibold font-mono text-red-500 hover:text-red-600 cursor-pointer hover:underline transition-all"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Quick Filter Presets Bar */}
      <div className="p-2.5 border-b border-m3-outline-variant/15 bg-m3-surface-container-low/30">
        <div className="text-[9px] font-bold text-m3-outline uppercase tracking-wider mb-1.5 font-display flex items-center gap-1 select-none">
          <Sparkles size={10} className="text-amber-500" />
          <span>Quick Filter Presets</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_FILTER_PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleApplyPreset(preset.shortcut);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium font-mono hover:scale-[1.02] active:scale-95 transition-all cursor-pointer ${preset.color}`}
                title={`Apply ${preset.label} filter (${preset.shortcut})`}
              >
                <Icon size={11} className="shrink-0" />
                <span className="truncate">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Suggested Searches Section (Dynamic database recommendations) */}
      {(suggestedSearches.tags.length > 0 || suggestedSearches.creators.length > 0) && (
        <div className="p-2.5 border-b border-m3-outline-variant/15 bg-emerald-500/5">
          <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5 font-display flex items-center justify-between select-none">
            <span className="flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-500" />
              <span>Suggested Searches</span>
            </span>
            <span className="text-[8px] font-mono text-m3-outline">Database Picks</span>
          </div>

          <div className="space-y-1.5">
            {/* Trending Tags */}
            {suggestedSearches.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] font-bold text-m3-outline uppercase mr-1 flex items-center gap-0.5">
                  <Hash size={9} className="text-emerald-500" /> Tags:
                </span>
                {suggestedSearches.tags.map(({ tag, count }) => (
                  <button
                    key={`sug_tag_${tag}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectQuery(`tag:${tag}`, true);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-m3-surface border border-emerald-500/20 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-all cursor-pointer"
                    title={`Search tag '${tag}' (${count} saved posts)`}
                  >
                    <span>#{tag}</span>
                    <span className="text-[8px] opacity-60 font-sans">({count})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Top Creators */}
            {suggestedSearches.creators.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] font-bold text-m3-outline uppercase mr-1 flex items-center gap-0.5">
                  <User size={9} className="text-purple-500" /> Creators:
                </span>
                {suggestedSearches.creators.map(({ creator, count }) => (
                  <button
                    key={`sug_creator_${creator}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectQuery(`from:${creator}`, true);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-m3-surface border border-purple-500/20 text-[10px] font-mono text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 transition-all cursor-pointer"
                    title={`Search creator '${creator}' (${count} saved posts)`}
                  >
                    <span>@{creator}</span>
                    <span className="text-[8px] opacity-60 font-sans">({count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Category Discovery Bar */}
      <div className="px-2.5 py-2 border-b border-m3-outline-variant/15 bg-indigo-500/5">
        <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1.5 font-display flex items-center justify-between select-none">
          <span className="flex items-center gap-1">
            <Sparkles size={10} /> Smart Category Search
          </span>
          <span className="text-[8px] font-mono text-m3-outline">Auto-Synonyms</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_DICTIONARY.slice(0, 6).map((cat) => (
            <button
              key={cat.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectQuery(cat.keywords[0], true);
                onClose();
              }}
              className="px-2 py-0.5 rounded-full bg-m3-surface border border-indigo-500/20 text-[10px] font-medium font-mono text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all cursor-pointer shrink-0"
              title={`Search '${cat.keywords[0]}' (includes synonyms: ${cat.synonyms.slice(0, 3).join(", ")})`}
            >
              {cat.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Search History Lists */}
      <div className="max-h-60 overflow-y-auto divide-y divide-m3-outline-variant/10">
        {historyItems.length === 0 ? (
          <div className="py-6 px-4 text-center text-[11px] text-m3-on-surface-variant font-medium space-y-1 select-none">
            <Search size={18} className="mx-auto text-m3-outline opacity-60" />
            <p className="font-semibold text-m3-on-surface">
              No search history yet
            </p>
            <p className="text-[10px] opacity-75">
              Type keywords or filters above and press Enter to save frequent
              searches.
            </p>
          </div>
        ) : (
          <>
            {/* Pinned Searches Section */}
            {pinnedItems.length > 0 && (
              <div className="bg-amber-500/5">
                <div className="px-3 py-1 flex items-center justify-between text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider select-none font-display">
                  <span className="flex items-center gap-1">
                    <Pin size={9} className="fill-current" /> Pinned Queries
                  </span>
                  <span>{pinnedItems.length}</span>
                </div>
                {pinnedItems.map((item, idx) => {
                  const globalIdx = idx;
                  const isSelected = selectedIndex === globalIdx;
                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelectQuery(item.query, true);
                        onClose();
                      }}
                      className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors group/item ${
                        isSelected
                          ? "bg-m3-primary/10 text-m3-primary"
                          : "hover:bg-m3-surface-variant/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {renderCategoryIcon(item.category)}
                        <span className="text-[11px] font-medium font-mono truncate text-m3-on-surface">
                          {item.query}
                        </span>
                        {item.useCount > 1 && (
                          <span className="px-1 py-0.2 rounded bg-m3-surface-variant/40 text-[9px] font-mono text-m3-outline font-bold">
                            {item.useCount}x
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onTogglePin(item.id);
                          }}
                          className="p-1 rounded text-amber-500 hover:bg-amber-500/20 transition-all cursor-pointer"
                          title="Unpin search term"
                        >
                          <Pin size={11} className="fill-current" />
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                          className="p-1 rounded text-m3-outline hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer opacity-0 group-hover/item:opacity-100"
                          title="Remove item"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent Searches Section */}
            {unpinnedItems.length > 0 && (
              <div>
                <div className="px-3 py-1 flex items-center justify-between text-[9px] font-bold text-m3-outline uppercase tracking-wider select-none font-display bg-m3-surface-low/30">
                  <span>Recent Queries</span>
                  <span>{unpinnedItems.length}</span>
                </div>
                {unpinnedItems.map((item, idx) => {
                  const globalIdx = pinnedItems.length + idx;
                  const isSelected = selectedIndex === globalIdx;
                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelectQuery(item.query, true);
                        onClose();
                      }}
                      className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors group/item ${
                        isSelected
                          ? "bg-m3-primary/10 text-m3-primary"
                          : "hover:bg-m3-surface-variant/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {renderCategoryIcon(item.category)}
                        <span className="text-[11px] font-medium font-mono truncate text-m3-on-surface">
                          {item.query}
                        </span>
                        {item.useCount > 1 && (
                          <span className="px-1 py-0.2 rounded bg-m3-surface-variant/40 text-[9px] font-mono text-m3-outline font-bold">
                            {item.useCount}x
                          </span>
                        )}
                        <span className="text-[9px] text-m3-outline font-sans ml-auto pr-1 shrink-0">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onTogglePin(item.id);
                          }}
                          className="p-1 rounded text-m3-outline hover:text-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer opacity-0 group-hover/item:opacity-100"
                          title="Pin search term to top"
                        >
                          <Pin size={11} />
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                          className="p-1 rounded text-m3-outline hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer opacity-0 group-hover/item:opacity-100"
                          title="Remove item"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="px-3 py-1.5 bg-m3-surface-container-low/50 border-t border-m3-outline-variant/20 text-[9px] font-mono text-m3-outline flex items-center justify-between select-none">
        <span>Press ↵ to apply</span>
        <span>↑↓ to navigate</span>
      </div>
    </motion.div>
  );
};
