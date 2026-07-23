import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Clock,
  Calendar,
  X,
  ChevronRight,
  Disc,
  FolderPlus,
  RefreshCw,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Post } from "../../../types/post";
import {
  analyzeForgottenGems,
  MemoryCapsuleGroup,
} from "../../../lib/memoryCapsule";
import { RetroMemoryCapsuleModal } from "./RetroMemoryCapsuleModal";

interface ForgottenGemsBannerProps {
  posts: Post[];
}

export const ForgottenGemsBanner: React.FC<ForgottenGemsBannerProps> = ({ posts }) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [activeGroup, setActiveGroup] = useState<MemoryCapsuleGroup | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const analysis = useMemo(() => {
    return analyzeForgottenGems(posts);
  }, [posts]);

  const { totalBuriedCount, capsuleGroups } = analysis;

  if (isDismissed || totalBuriedCount === 0 || capsuleGroups.length === 0) {
    return null;
  }

  const handleOpenCapsuleGroup = (group: MemoryCapsuleGroup) => {
    setActiveGroup(group);
    setIsModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mb-4 mx-4 md:mx-6 p-3.5 bg-stone-900 border border-amber-500/25 rounded-2xl shadow-md text-amber-50 font-sans"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Header */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Clock size={18} className="animate-pulse" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                  Forgotten Gems Engine
                </span>
                <span className="text-xs font-bold font-display text-stone-100">
                  {totalBuriedCount} Post{totalBuriedCount !== 1 ? "s" : ""} Waiting in Time Capsule
                </span>
              </div>

              <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
                Rediscover hidden posts saved long ago that haven't been reviewed or noted.
              </p>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              onClick={() => handleOpenCapsuleGroup(capsuleGroups[0])}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Disc size={14} />
              <span>Launch Memory Capsule</span>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-all cursor-pointer"
              title="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Capsule Groups Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3 mt-3 border-t border-amber-500/15">
          {capsuleGroups.map((group) => (
            <div
              key={group.id}
              onClick={() => handleOpenCapsuleGroup(group)}
              className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 hover:border-amber-500/40 transition-all cursor-pointer group flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {group.coverPost?.thumbnailUrl ? (
                  <img
                    src={group.coverPost.thumbnailUrl}
                    alt=""
                    className="w-10 h-10 object-cover rounded-lg shrink-0 border border-amber-500/20 group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center shrink-0 text-amber-400 font-mono text-[10px]">
                    N/A
                  </div>
                )}

                <div className="min-w-0">
                  <span className="text-xs font-bold text-stone-200 group-hover:text-amber-300 transition-colors truncate block">
                    {group.title}
                  </span>
                  <span className="text-[10px] font-mono text-amber-500 block truncate">
                    {group.badgeText} ({group.posts.length})
                  </span>
                </div>
              </div>

              <ChevronRight
                size={14}
                className="text-stone-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Modal */}
      <RetroMemoryCapsuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        group={activeGroup}
        allPosts={posts}
      />
    </>
  );
};
