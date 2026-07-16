import React from "react";
import { motion } from "motion/react";

interface PostCardSkeletonProps {
  index: number;
}

export const PostCardSkeleton = ({ index }: PostCardSkeletonProps) => {
  // Deterministic aspect ratio class to match the rendered Masonry post card
  const getAspectClass = (idx: number) => {
    const mod = idx % 3;
    if (mod === 0) return "aspect-square";
    if (mod === 1) return "aspect-[4/5]";
    return "aspect-[3/2]";
  };

  const aspectClass = getAspectClass(index);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.03 < 0.3 ? index * 0.03 : 0.3,
      }}
      className="break-inside-avoid mb-6 inline-block w-full rounded-[24px] overflow-hidden border border-m3-outline-variant/20 bg-m3-surface-low shadow-xs"
    >
      {/* Thumbnail shimmer placeholder */}
      <div
        className={`relative ${aspectClass} bg-m3-surface-variant/40 animate-pulse overflow-hidden`}
      >
        {/* Shimmer gradient line */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-m3-surface-variant/15 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />

        {/* Floating small dot placeholder (simulating selection box) */}
        <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-m3-surface-variant/50" />

        {/* Floating status dot placeholder (simulating status badge) */}
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-m3-surface-variant/50" />

        {/* Media type overlay pill shimmer */}
        <div className="absolute bottom-3 right-3 w-16 h-5 rounded-full bg-m3-surface-variant/60" />
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {/* Creator & Date row */}
          <div className="flex items-center justify-between">
            <div className="h-4 bg-m3-surface-variant/60 rounded-md w-1/3 animate-pulse" />
            <div className="h-3 bg-m3-surface-variant/40 rounded-md w-1/4 animate-pulse" />
          </div>

          {/* Caption lines */}
          <div className="space-y-1.5 pt-1">
            <div className="h-3.5 bg-m3-surface-variant/50 rounded-md w-11/12 animate-pulse" />
            <div className="h-3.5 bg-m3-surface-variant/30 rounded-md w-4/5 animate-pulse" />
          </div>

          {/* Tag pills shimmer */}
          <div className="flex gap-1.5 pt-1.5">
            <div className="h-4.5 bg-m3-surface-variant/45 rounded-full w-14 animate-pulse" />
            <div className="h-4.5 bg-m3-surface-variant/45 rounded-full w-12 animate-pulse" />
          </div>
        </div>

        {/* Footer actions shimmer */}
        <div className="flex items-center justify-between border-t border-m3-outline-variant/10 pt-3 mt-1">
          <div className="w-9 h-9 rounded-full bg-m3-surface-variant/35 animate-pulse" />
          <div className="w-9 h-9 rounded-full bg-m3-surface-variant/35 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
};
