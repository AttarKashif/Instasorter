import React, { useState, useMemo } from "react";
import {
  Wand2,
  FolderPlus,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  RefreshCw,
  Sparkles,
  Utensils,
  Shirt,
  Compass,
  Dumbbell,
  Cpu,
  Palette,
  Camera,
  Music,
  Home,
  PawPrint,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { Post } from "../../../types/post";
import { db } from "../../../lib/db";
import { usePostStore } from "../../../store/useStore";
import {
  analyzeUncategorizedPosts,
  CategoryGroupSuggestion,
} from "../../../lib/batchCategorizer";
import { triggerVibration } from "../../../lib/vibrate";

interface BatchCategorizationToolProps {
  posts: Post[];
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  food: Utensils,
  fashion: Shirt,
  travel: Compass,
  fitness: Dumbbell,
  tech: Cpu,
  art: Palette,
  photography: Camera,
  music: Music,
  home: Home,
  pets: PawPrint,
  business: Briefcase,
};

export const BatchCategorizationTool: React.FC<BatchCategorizationToolProps> = ({
  posts,
}) => {
  const setPosts = usePostStore((state) => state.setPosts);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedGroupIds, setAppliedGroupIds] = useState<Set<string>>(new Set());

  // Analyze uncategorized posts
  const batchResult = useMemo(() => {
    return analyzeUncategorizedPosts(posts);
  }, [posts]);

  const { uncategorizedCount, suggestedPostsCount, categoryGroups } = batchResult;

  // Filter out groups that have already been applied
  const activeGroups = useMemo(() => {
    return categoryGroups.filter((g) => !appliedGroupIds.has(g.category.id));
  }, [categoryGroups, appliedGroupIds]);

  if (isDismissed || uncategorizedCount === 0 || activeGroups.length === 0) {
    return null;
  }

  const applyCategoryGroup = async (group: CategoryGroupSuggestion) => {
    // 1. Ensure collection exists in Dexie DB
    const existingCollection = await db.collections
      .where("name")
      .equals(group.suggestedCollection)
      .first();

    if (!existingCollection) {
      await db.collections.add({
        id: `coll_${Date.now()}_${group.category.id}`,
        name: group.suggestedCollection,
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Update each post in group
    for (const item of group.posts) {
      const p = item.post;
      const currentCollections = p.collections || [];
      const currentTags = p.tags || [];

      const updatedCollections = Array.from(
        new Set([...currentCollections, group.suggestedCollection])
      );
      const updatedTags = Array.from(
        new Set([...currentTags, ...item.suggestedTags])
      );

      await db.posts.update(p.id, {
        collections: updatedCollections,
        tags: updatedTags,
      });
    }

    setAppliedGroupIds((prev) => new Set([...prev, group.category.id]));
  };

  const handleApplyAll = async () => {
    setIsApplying(true);
    triggerVibration("warning");
    try {
      let totalApplied = 0;
      for (const group of activeGroups) {
        await applyCategoryGroup(group);
        totalApplied += group.posts.length;
      }

      // Refresh posts in store
      const freshPosts = await db.posts.toArray();
      setPosts(freshPosts);

      toast.success(
        `Auto-categorized ${totalApplied} post${totalApplied !== 1 ? "s" : ""} across ${activeGroups.length} collection${activeGroups.length !== 1 ? "s" : ""}!`
      );
    } catch (err: any) {
      console.error("Batch categorization failed:", err);
      toast.error("Failed to batch categorize: " + (err.message || ""));
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplySingleGroup = async (group: CategoryGroupSuggestion) => {
    setIsApplying(true);
    triggerVibration("medium");
    try {
      await applyCategoryGroup(group);
      const freshPosts = await db.posts.toArray();
      setPosts(freshPosts);
      toast.success(
        `Assigned ${group.posts.length} post${group.posts.length !== 1 ? "s" : ""} to '${group.suggestedCollection}'!`
      );
    } catch (err: any) {
      console.error("Single group application failed:", err);
      toast.error("Failed to apply category: " + (err.message || ""));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-4 mx-4 md:mx-6 p-3.5 bg-m3-surface border border-indigo-500/30 rounded-2xl shadow-sm text-m3-on-surface font-sans"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side Header */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Wand2 size={18} className="animate-pulse" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                Batch Categorization Tool
              </span>
              <span className="text-xs font-bold font-display text-m3-on-surface">
                {suggestedPostsCount} Post{suggestedPostsCount !== 1 ? "s" : ""}{" "}
                Ready for Auto-Collection
              </span>
            </div>

            <p className="text-[11px] text-m3-outline mt-0.5 line-clamp-1">
              Keyword analysis identified {activeGroups.length} collection
              suggestion{activeGroups.length !== 1 ? "s" : ""} for{" "}
              {uncategorizedCount} uncategorized post
              {uncategorizedCount !== 1 ? "s" : ""}.
            </p>
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-m3-outline-variant/30 text-xs font-bold text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
          >
            <span>{isExpanded ? "Hide Suggestions" : "Review Groups"}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            onClick={handleApplyAll}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>Apply All ({suggestedPostsCount})</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
            title="Dismiss tool for this session"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expanded Suggestions Drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pt-3 mt-3 border-t border-m3-outline-variant/15 space-y-3"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-m3-outline">
              <span className="font-bold uppercase tracking-wider text-[10px] text-m3-on-surface">
                Suggested Category Collections & Tags
              </span>
              <span>Click 'Apply Group' to assign single category</span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {activeGroups.map((group) => {
                const CategoryIcon =
                  CATEGORY_ICON_MAP[group.category.id] || FolderPlus;

                return (
                  <div
                    key={group.category.id}
                    className="p-3 rounded-xl bg-m3-surface-low border border-m3-outline-variant/20 space-y-2"
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                          <CategoryIcon size={13} />
                        </div>
                        <span className="text-xs font-bold font-display text-m3-on-surface">
                          Collection: "{group.suggestedCollection}"
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                          {group.posts.length} post
                          {group.posts.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Tags Preview */}
                        <div className="hidden sm:flex items-center gap-1">
                          {group.suggestedTags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-m3-surface border border-m3-outline-variant/20 text-[9px] font-mono text-m3-outline"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => handleApplySingleGroup(group)}
                          disabled={isApplying}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20 transition-all cursor-pointer active:scale-95"
                        >
                          <span>Apply Group</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Posts Thumbnails Grid in this Group */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                      {group.posts.slice(0, 8).map(({ post, matchedKeywords }) => (
                        <div
                          key={post.id}
                          className="p-2 rounded-lg bg-m3-surface border border-m3-outline-variant/15 text-left flex items-start gap-2"
                        >
                          {post.thumbnailUrl ? (
                            <img
                              src={post.thumbnailUrl}
                              alt=""
                              className="w-9 h-9 object-cover rounded-md shrink-0 bg-slate-800"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-m3-surface-variant/30 flex items-center justify-center shrink-0 text-m3-outline text-[9px]">
                              No img
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-m3-on-surface truncate block">
                              @{post.creatorUsername || "unknown"}
                            </span>
                            <p className="text-[9px] text-m3-outline truncate">
                              {post.caption || "No caption"}
                            </p>
                            <span className="text-[8px] font-mono text-indigo-500 truncate block mt-0.5">
                              Matched: {matchedKeywords.slice(0, 2).join(", ")}
                            </span>
                          </div>
                        </div>
                      ))}
                      {group.posts.length > 8 && (
                        <div className="p-2 rounded-lg bg-m3-surface-variant/20 border border-m3-outline-variant/15 flex items-center justify-center text-[10px] font-mono text-m3-outline">
                          +{group.posts.length - 8} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
