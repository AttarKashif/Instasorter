import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Layers,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  RefreshCw,
  ExternalLink,
  Info,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { Post } from "../../../types/post";
import { db } from "../../../lib/db";
import { usePostStore } from "../../../store/useStore";
import {
  analyzeDuplicates,
  executeDeduplication,
  DuplicateGroup,
} from "../../../lib/duplicateDetector";

interface DeduplicationAlertProps {
  posts: Post[];
}

export const DeduplicationAlert: React.FC<DeduplicationAlertProps> = ({
  posts,
}) => {
  const setPosts = usePostStore((state) => state.setPosts);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Calculate duplicate groups
  const duplicateAnalysis = useMemo(() => {
    return analyzeDuplicates(posts);
  }, [posts]);

  const { groups, totalRedundantCount, groupCount } = duplicateAnalysis;

  // If dismissed or no duplicates found, render nothing
  if (isDismissed || totalRedundantCount === 0) {
    return null;
  }

  const handleMergeAll = async () => {
    setIsMerging(true);
    try {
      const { mergedGroupsCount, deletedPostsCount } =
        await executeDeduplication(groups);

      // Refresh posts in store from Dexie DB
      const freshPosts = await db.posts.toArray();
      setPosts(freshPosts);

      toast.success(
        `Deduplicated ${deletedPostsCount} redundant post${deletedPostsCount !== 1 ? "s" : ""} across ${mergedGroupsCount} group${mergedGroupsCount !== 1 ? "s" : ""}. Tags & notes merged safely!`,
      );
    } catch (err: any) {
      console.error("Failed to execute deduplication:", err);
      toast.error("Failed to auto-merge duplicates: " + (err.message || ""));
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-4 mx-4 md:mx-6 p-3.5 bg-m3-surface border border-amber-500/30 rounded-2xl shadow-sm text-m3-on-surface font-sans"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Layers size={18} className="animate-pulse" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                Library Improvement
              </span>
              <span className="text-xs font-bold font-display text-m3-on-surface">
                {totalRedundantCount} Redundant Post
                {totalRedundantCount !== 1 ? "s" : ""} Detected
              </span>
            </div>

            <p className="text-[11px] text-m3-outline mt-0.5 line-clamp-1">
              Found {groupCount} duplicate group
              {groupCount !== 1 ? "s" : ""} sharing Instagram URLs, media, or
              identical content.
            </p>
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-m3-outline-variant/30 text-xs font-bold text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
          >
            <span>{isExpanded ? "Hide Details" : "Review Groups"}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            onClick={handleMergeAll}
            disabled={isMerging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isMerging ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>Auto-Merge Duplicates</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-xl text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
            title="Dismiss alert for this session"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expanded Breakdown Drawer */}
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
                Duplicate Groups Breakdown
              </span>
              <span>
                Tags & notes will be safely consolidated into primary posts
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {groups.map((group, idx) => (
                <div
                  key={group.groupId || idx}
                  className="p-2.5 rounded-xl bg-m3-surface-low border border-m3-outline-variant/20 space-y-2"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                      {group.reasonLabel}
                    </span>
                    <span className="text-m3-outline">
                      {group.allPosts.length} posts in group
                    </span>
                  </div>

                  {/* Thumbnail cards in cluster */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {group.allPosts.map((post, pIdx) => {
                      const isPrimary = pIdx === 0;
                      return (
                        <div
                          key={post.id}
                          className={`relative p-2 rounded-lg border text-left flex items-start gap-2 ${
                            isPrimary
                              ? "bg-indigo-500/5 border-indigo-500/30"
                              : "bg-m3-surface border-m3-outline-variant/15"
                          }`}
                        >
                          {/* Thumbnail */}
                          {post.thumbnailUrl ? (
                            <img
                              src={post.thumbnailUrl}
                              alt=""
                              className="w-10 h-10 object-cover rounded-md shrink-0 bg-slate-800"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-m3-surface-variant/30 flex items-center justify-center shrink-0 text-m3-outline text-[9px]">
                              No img
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-m3-on-surface truncate">
                                @{post.creatorUsername || "unknown"}
                              </span>
                              {isPrimary && (
                                <span className="text-[8px] font-mono font-bold px-1 rounded bg-indigo-500 text-white shrink-0">
                                  Keep
                                </span>
                              )}
                            </div>

                            <p className="text-[9px] text-m3-outline truncate mt-0.5">
                              {post.caption || "No caption"}
                            </p>

                            <span className="text-[8px] font-mono text-m3-outline/70 block mt-0.5">
                              {post.savedAt
                                ? new Date(post.savedAt).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
