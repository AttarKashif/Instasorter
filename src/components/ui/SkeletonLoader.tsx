import React from "react";

interface SkeletonLoaderProps {
  gridDensity?: "single" | "double" | "list";
}

export const SkeletonLoader = ({
  gridDensity = "double",
}: SkeletonLoaderProps) => {
  return (
    <div
      className="w-full h-full p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse select-none"
      id="skeleton-loader"
    >
      {/* Search & Action Bar Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-96 h-11 bg-m3-surface-variant/40 rounded-2xl border border-m3-outline-variant/15" />
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="w-24 h-11 bg-m3-surface-variant/40 rounded-2xl" />
          <div className="w-11 h-11 bg-m3-surface-variant/40 rounded-full" />
          <div className="w-11 h-11 bg-m3-surface-variant/40 rounded-full" />
        </div>
      </div>

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
        {Array.from({ length: 8 }).map((_, i) =>
          gridDensity === "list" ? (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-m3-surface border border-m3-outline-variant/15 rounded-[20px]"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-m3-surface-variant/50 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="h-3 bg-m3-surface-variant/60 rounded-md w-1/4" />
                <div className="h-4 bg-m3-surface-variant/40 rounded-md w-3/4" />
                <div className="h-3 bg-m3-surface-variant/50 rounded-md w-1/2" />
              </div>
            </div>
          ) : (
            <div
              key={i}
              className="bg-m3-surface border border-m3-outline-variant/20 rounded-[20px] overflow-hidden flex flex-col h-[340px]"
            >
              {/* Media Block */}
              <div className="aspect-[4/5] bg-m3-surface-variant/40 w-full flex-1 shrink-0" />

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
            </div>
          ),
        )}
      </div>
    </div>
  );
};
