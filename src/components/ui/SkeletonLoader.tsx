import React from "react";
import { motion } from "motion/react";

interface SkeletonLoaderProps {
  gridDensity?: "single" | "double" | "list";
}

const pulseTransition = {
  duration: 2.0,
  repeat: Infinity,
  ease: "easeInOut",
} as const;

export const SkeletonLoader = ({
  gridDensity = "list",
}: SkeletonLoaderProps) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="w-full h-full p-4 sm:p-6 lg:p-8 space-y-6 select-none"
      id="skeleton-loader"
    >
      {/* Search & Action Bar Skeleton */}
      <motion.div
        variants={{
          initial: { opacity: 0.35, y: 5 },
          animate: { opacity: [0.35, 0.75, 0.35], y: 0 }
        }}
        transition={{
          y: { duration: 0.4, ease: "easeOut" },
          opacity: pulseTransition
        }}
        className="flex flex-col md:flex-row gap-4 items-center justify-between"
      >
        <div className="w-full md:w-96 h-11 bg-m3-surface-variant/40 rounded-2xl border border-m3-outline-variant/15" />
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="w-24 h-11 bg-m3-surface-variant/40 rounded-2xl" />
          <div className="w-11 h-11 bg-m3-surface-variant/40 rounded-full" />
          <div className="w-11 h-11 bg-m3-surface-variant/40 rounded-full" />
        </div>
      </motion.div>

      {/* Grid or List skeleton */}
      <div
        className={
          gridDensity === "single"
            ? "grid grid-cols-1 gap-8 max-w-xl mx-auto w-full"
            : gridDensity === "double"
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full"
              : "flex flex-col gap-4 max-w-4xl mx-auto w-full"
        }
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            variants={{
              initial: { opacity: 0, y: 12 },
              animate: { 
                opacity: 1, 
                y: 0,
                transition: {
                  y: { duration: 0.45, delay: i * 0.04, ease: "easeOut" },
                  opacity: { duration: 0.45, delay: i * 0.04 }
                }
              }
            }}
            className="w-full"
          >
            <motion.div
              animate={{
                opacity: [0.4, 0.75, 0.4]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.12
              }}
              className={
                gridDensity === "list"
                  ? "flex items-center gap-4 p-4 bg-m3-surface border border-m3-outline-variant/15 rounded-[20px] shadow-xs"
                  : "bg-m3-surface border border-m3-outline-variant/20 rounded-[20px] overflow-hidden flex flex-col h-[340px] shadow-xs"
              }
            >
              {gridDensity === "list" ? (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-m3-surface-variant/50 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-3 bg-m3-surface-variant/60 rounded-md w-1/4" />
                    <div className="h-4 bg-m3-surface-variant/40 rounded-md w-3/4" />
                    <div className="h-3 bg-m3-surface-variant/50 rounded-md w-1/2" />
                  </div>
                </>
              ) : (
                <>
                  {/* Media Block with shimmer overlay */}
                  <div className="aspect-[4/5] bg-m3-surface-variant/40 w-full flex-1 shrink-0 relative overflow-hidden">
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-m3-surface-variant/12 to-transparent"
                      animate={{
                        x: ["-100%", "100%"]
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.08
                      }}
                    />
                  </div>

                  {/* Text Block */}
                  <div className="p-4 space-y-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-m3-surface-variant/50" />
                      <div className="h-3 bg-m3-surface-variant/60 rounded-md w-24" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-m3-surface-variant/40 rounded-md w-full" />
                      <div className="h-3 bg-m3-surface-variant/30 rounded-md w-5/6" />
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <div className="h-4 bg-m3-surface-variant/40 rounded-md w-12" />
                      <div className="h-4 bg-m3-surface-variant/40 rounded-md w-16" />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
