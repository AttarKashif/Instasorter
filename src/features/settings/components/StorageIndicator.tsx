import React, { useState, useEffect, useCallback } from "react";
import {
  HardDrive,
  Database,
  Trash2,
  RefreshCw,
  Sparkles,
  Check,
  AlertTriangle,
  PieChart,
  ImageIcon,
} from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { db } from "../../../lib/db";
import { usePostStore } from "../../../store/useStore";

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const StorageIndicator: React.FC = () => {
  const posts = usePostStore((state) => state.posts);
  const setPosts = usePostStore((state) => state.setPosts);

  const [storageData, setStorageData] = useState<{
    usageBytes: number;
    quotaBytes: number;
    dbSizeEstimate: number;
    thumbnailCount: number;
    cachedImageBytesEstimate: number;
    isCalculating: boolean;
  }>({
    usageBytes: 0,
    quotaBytes: 0,
    dbSizeEstimate: 0,
    thumbnailCount: 0,
    cachedImageBytesEstimate: 0,
    isCalculating: true,
  });

  const [isClearingThumbnails, setIsClearingThumbnails] = useState(false);

  const calculateStorage = useCallback(async () => {
    setStorageData((prev) => ({ ...prev, isCalculating: true }));

    let usageBytes = 0;
    let quotaBytes = 0;

    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      navigator.storage.estimate
    ) {
      try {
        const estimate = await navigator.storage.estimate();
        usageBytes = estimate.usage || 0;
        quotaBytes = estimate.quota || 0;
      } catch (err) {
        console.warn("Storage estimate error:", err);
      }
    }

    // Calculate approximate size of posts stored in IndexedDB
    let dbSizeEstimate = 0;
    let thumbnailCount = 0;
    let cachedImageBytesEstimate = 0;

    try {
      const allDbPosts = await db.posts.toArray();
      const serialized = JSON.stringify(allDbPosts);
      dbSizeEstimate = new Blob([serialized]).size;

      allDbPosts.forEach((p) => {
        if (p.thumbnailUrl && p.thumbnailUrl.length > 0) {
          thumbnailCount++;
          // Estimate base64 or URL string payload size
          if (p.thumbnailUrl.startsWith("data:")) {
            cachedImageBytesEstimate += p.thumbnailUrl.length;
          } else {
            cachedImageBytesEstimate += 200; // typical URL metadata overhead
          }
        }
      });
    } catch (e) {
      console.warn("Error estimating DB size:", e);
    }

    setStorageData({
      usageBytes,
      quotaBytes,
      dbSizeEstimate,
      thumbnailCount,
      cachedImageBytesEstimate,
      isCalculating: false,
    });
  }, []);

  useEffect(() => {
    calculateStorage();
  }, [calculateStorage, posts.length]);

  const handleClearCachedThumbnails = async () => {
    setIsClearingThumbnails(true);
    try {
      const allPosts = await db.posts.toArray();
      let clearedCount = 0;

      // Update in Dexie DB - clear thumbnailUrl & reset thumbnailStatus to pending,
      // strictly retaining all metadata (caption, notes, creator, tags, collections, etc.)
      await db.transaction("rw", db.posts, async () => {
        for (const p of allPosts) {
          if (p.thumbnailUrl) {
            clearedCount++;
            await db.posts.update(p.id, {
              thumbnailUrl: "",
              thumbnailStatus: "pending",
            });
          }
        }
      });

      // Clear any browser CacheStorage entries for thumbnails
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const keys = await caches.keys();
          for (const key of keys) {
            if (key.includes("thumbnail") || key.includes("instasorter")) {
              await caches.delete(key);
            }
          }
        } catch (e) {
          console.warn("CacheStorage clear error:", e);
        }
      }

      // Update state
      const updatedPosts = await db.posts.toArray();
      setPosts(updatedPosts);
      await calculateStorage();

      toast.success(
        `Cleared cached thumbnails for ${clearedCount} post${clearedCount !== 1 ? "s" : ""}. Post metadata preserved!`,
      );
    } catch (err: any) {
      console.error("Failed to clear cached thumbnails:", err);
      toast.error("Failed to clear thumbnail cache: " + (err.message || ""));
    } finally {
      setIsClearingThumbnails(false);
    }
  };

  const {
    usageBytes,
    quotaBytes,
    dbSizeEstimate,
    thumbnailCount,
    cachedImageBytesEstimate,
    isCalculating,
  } = storageData;

  const percentUsed =
    quotaBytes > 0 ? Math.min(100, (usageBytes / quotaBytes) * 100) : 0;

  // Determine progress bar color based on quota consumption
  const getProgressColor = () => {
    if (percentUsed > 80) return "bg-red-500 text-red-500";
    if (percentUsed > 50) return "bg-amber-500 text-amber-500";
    return "bg-indigo-500 text-indigo-500";
  };

  return (
    <div className="bg-m3-surface-low border border-m3-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-4 font-sans text-m3-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <HardDrive size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold font-display text-m3-on-surface">
              Storage Usage & Quota Monitor
            </h4>
            <p className="text-[11px] text-m3-outline font-medium">
              IndexedDB local database & browser storage health
            </p>
          </div>
        </div>

        <button
          onClick={calculateStorage}
          disabled={isCalculating}
          className="p-1.5 rounded-lg text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
          title="Refresh storage statistics"
        >
          <RefreshCw
            size={14}
            className={isCalculating ? "animate-spin text-indigo-500" : ""}
          />
        </button>
      </div>

      {/* Progress Bar & Quota Metrics */}
      <div className="space-y-2 bg-m3-surface border border-m3-outline-variant/20 rounded-xl p-3">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="flex items-center gap-1.5 font-mono text-m3-on-surface">
            <Database size={12} className="text-indigo-500" />
            <span>
              DB Size: <strong>{formatBytes(dbSizeEstimate)}</strong>
            </span>
            <span className="text-m3-outline text-[10px]">
              ({posts.length} posts)
            </span>
          </span>

          <span className="font-mono text-[11px] text-m3-on-surface font-bold">
            {percentUsed.toFixed(2)}% Quota Used
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-2.5 bg-m3-surface-container-low rounded-full overflow-hidden border border-m3-outline-variant/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(1, percentUsed)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full ${getProgressColor().split(" ")[0]}`}
          />
        </div>

        {/* Usage Details Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px] font-mono text-m3-outline">
          <div className="bg-m3-surface-low/60 p-2 rounded-lg border border-m3-outline-variant/15">
            <span className="block text-[9px] uppercase tracking-wider text-m3-outline">
              Total Storage Used
            </span>
            <span className="text-xs font-bold text-m3-on-surface">
              {formatBytes(usageBytes)}
            </span>
          </div>

          <div className="bg-m3-surface-low/60 p-2 rounded-lg border border-m3-outline-variant/15">
            <span className="block text-[9px] uppercase tracking-wider text-m3-outline">
              Browser Quota
            </span>
            <span className="text-xs font-bold text-m3-on-surface">
              {formatBytes(quotaBytes)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-m3-surface-low/60 p-2 rounded-lg border border-m3-outline-variant/15">
            <span className="block text-[9px] uppercase tracking-wider text-m3-outline">
              Cached Image Previews
            </span>
            <span className="text-xs font-bold text-m3-on-surface">
              {thumbnailCount} items (~
              {formatBytes(cachedImageBytesEstimate)})
            </span>
          </div>
        </div>
      </div>

      {/* Clear Cached Thumbnails Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-m3-outline-variant/15">
        <div className="flex items-center gap-2">
          <ImageIcon size={15} className="text-amber-500 shrink-0" />
          <p className="text-[11px] text-m3-on-surface-variant font-medium">
            Clear locally cached image thumbnails to free up space. All
            metadata (captions, notes, creator, tags) remains completely safe.
          </p>
        </div>

        <button
          onClick={handleClearCachedThumbnails}
          disabled={isClearingThumbnails || thumbnailCount === 0}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95 border ${
            thumbnailCount === 0
              ? "bg-m3-surface-variant/30 text-m3-outline border-transparent cursor-not-allowed opacity-60"
              : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/25"
          }`}
        >
          {isClearingThumbnails ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
          <span>Clear Cached Thumbnails</span>
        </button>
      </div>
    </div>
  );
};
