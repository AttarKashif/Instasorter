import React, { useState, useEffect } from "react";
import {
  Hash,
  RefreshCw,
  Layers,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Check,
  CloudDownload,
  HardDrive,
  ShieldCheck,
  Upload,
  Smartphone,
  Sun,
  Wrench,
  Filter,
  Database,
  Download,
} from "lucide-react";
import { offloadPendingToBackgroundServer } from "../../../lib/thumbnailWorker";
import { requestWakeLock, releaseWakeLock, isIOSDevice } from "../../../lib/wakeLock";
import { db } from "../../../lib/db";
import { usePostStore } from "../../../store/useStore";
import { StorageIndicator } from "./StorageIndicator";

interface MaintenanceTabProps {
  handleConsolidateTags: () => void;
  retryFailedThumbnails: () => void;
  setToast: (val: { type: "success" | "error"; message: string } | null) => void;
  handleAnalyzeDuplicates: () => void;
  setShowConfirmClear: (val: boolean) => void;
  setShowConfirmClearAll: (val: boolean) => void;
  exportCSVData: () => void;
  workerStats: { total: number; success: number; pending: number; failed: number };
  isDownloading: boolean;
  throttleStatus: { throttled: boolean; remaining: number };
}

type CategoryFilter = "all" | "media" | "optimization" | "backup" | "danger";

export const MaintenanceTab: React.FC<MaintenanceTabProps> = React.memo(({
  handleConsolidateTags,
  retryFailedThumbnails,
  setToast,
  handleAnalyzeDuplicates,
  setShowConfirmClear,
  setShowConfirmClearAll,
  exportCSVData,
  workerStats,
  isDownloading,
  throttleStatus,
}) => {
  const setPosts = usePostStore((state) => state.setPosts);
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((persisted) => {
        setIsPersistent(persisted);
      });
    }
  }, []);

  const handleRequestPersistence = async () => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      setIsPersistent(granted);
      if (granted) {
        setToast({ type: "success", message: "Persistent Storage Granted! Safe from eviction." });
      } else {
        setToast({ type: "error", message: "Storage Persistence denied by browser settings." });
      }
    } else {
      setToast({ type: "error", message: "Storage Persistence API not supported on this browser." });
    }
  };

  const handleToggleWakeLock = async () => {
    if (wakeLockActive) {
      await releaseWakeLock();
      setWakeLockActive(false);
      setToast({ type: "success", message: "Screen Wake Lock released." });
    } else {
      const success = await requestWakeLock();
      if (success) {
        setWakeLockActive(true);
        setToast({ type: "success", message: "Screen Stay-Awake active! Screen will stay on during batch crawls." });
      } else {
        setToast({ type: "error", message: "Could not acquire Wake Lock on this device." });
      }
    }
  };

  const handleRestoreDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const postsToImport = Array.isArray(parsed) ? parsed : parsed.posts || [];
      const collectionsToImport = parsed.collections || [];

      if (!Array.isArray(postsToImport) || postsToImport.length === 0) {
        setToast({ type: "error", message: "Invalid backup file: No post objects found." });
        return;
      }

      await db.posts.bulkPut(postsToImport);
      if (collectionsToImport.length > 0) {
        await db.collections.bulkPut(collectionsToImport);
      }

      const freshPosts = await db.posts.toArray();
      setPosts(freshPosts);
      setToast({
        type: "success",
        message: `Successfully restored ${postsToImport.length} posts into local database!`,
      });
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: "Failed to parse backup file: " + (err.message || "Invalid JSON format") });
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="space-y-5">
      {/* Category Pills Header */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-m3-outline-variant/15 text-xs select-none">
        <span className="text-[10px] font-bold text-m3-outline uppercase tracking-wider mr-1 flex items-center gap-1">
          <Filter size={11} />
          Filter:
        </span>
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            activeCategory === "all"
              ? "bg-m3-primary text-m3-on-primary shadow-2xs"
              : "bg-m3-surface-variant/40 text-m3-on-surface-variant hover:bg-m3-surface-variant/70"
          }`}
        >
          All Tools
        </button>
        <button
          onClick={() => setActiveCategory("media")}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            activeCategory === "media"
              ? "bg-m3-primary text-m3-on-primary shadow-2xs"
              : "bg-m3-surface-variant/40 text-m3-on-surface-variant hover:bg-m3-surface-variant/70"
          }`}
        >
          Media & Scraper
        </button>
        <button
          onClick={() => setActiveCategory("backup")}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            activeCategory === "backup"
              ? "bg-m3-primary text-m3-on-primary shadow-2xs"
              : "bg-m3-surface-variant/40 text-m3-on-surface-variant hover:bg-m3-surface-variant/70"
          }`}
        >
          Backup & Export
        </button>
        <button
          onClick={() => setActiveCategory("danger")}
          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            activeCategory === "danger"
              ? "bg-red-600 text-white shadow-2xs"
              : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
          }`}
        >
          Danger Zone
        </button>
      </div>

      {/* Visual Storage Usage & Quota Monitor */}
      <StorageIndicator />

      {/* Downloader Compact Status Banner (Shown on All or Media) */}
      {(activeCategory === "all" || activeCategory === "media") && (
        <div className="bg-m3-surface-low border border-m3-outline-variant/30 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                {throttleStatus.throttled ? (
                  <AlertCircle size={18} className="text-amber-500 animate-pulse" />
                ) : isDownloading ? (
                  <RefreshCw size={18} className="text-m3-primary animate-spin" />
                ) : workerStats.failed > 0 ? (
                  <AlertCircle size={18} className="text-red-500" />
                ) : (
                  <Check size={18} className="text-emerald-500" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-m3-on-surface">Background Media Crawler</h4>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    throttleStatus.throttled
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : isDownloading
                      ? "bg-m3-primary/10 text-m3-primary"
                      : workerStats.failed > 0
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/15"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15"
                  }`}>
                    {throttleStatus.throttled
                      ? "COOLDOWN"
                      : isDownloading
                      ? "CRAWLING"
                      : workerStats.failed > 0
                      ? "ISSUES"
                      : "READY"}
                  </span>
                </div>
                <p className="text-[11px] text-m3-on-surface-variant font-medium">
                  {workerStats.success} downloaded • {workerStats.pending} pending • {workerStats.failed} failed
                </p>
              </div>
            </div>

            {/* Downloader Quick Action Buttons */}
            <div className="flex items-center gap-2">
              {throttleStatus.throttled && (
                <button
                  onClick={() => {
                    retryFailedThumbnails();
                    setToast({ type: "success", message: "Bypassing cooldown..." });
                  }}
                  className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-500/20 transition-all cursor-pointer"
                >
                  Bypass Cooldown ({throttleStatus.remaining}s)
                </button>
              )}
              {workerStats.failed > 0 && (
                <button
                  onClick={() => {
                    retryFailedThumbnails();
                    setToast({ type: "success", message: "Retrying failed downloads..." });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-m3-primary bg-m3-primary/10 hover:bg-m3-primary/20 rounded-lg border border-m3-primary/15 transition-all cursor-pointer"
                >
                  <RefreshCw size={12} className="animate-pulse" />
                  <span>Retry ({workerStats.failed})</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {workerStats.total > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-m3-outline font-bold">
                <span>Media Download Sync</span>
                <span>{Math.round((workerStats.success / workerStats.total) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-m3-surface-container rounded-full overflow-hidden border border-m3-outline-variant/10">
                <div
                  className="h-full bg-m3-primary transition-all duration-500 rounded-full"
                  style={{ width: `${(workerStats.success / workerStats.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOOL CATEGORIES (COMPACT ROWS) */}
      <div className="space-y-5">
        {/* Category 1: Media & Scraper Tools */}
        {(activeCategory === "all" || activeCategory === "media") && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider px-1">
              Media &amp; Scraper Tools
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* Offload Server Scraper */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-m3-outline-variant/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <CloudDownload size={16} />
                  </div>
                  <div className="min-w-0">
                    <h6 className="text-xs font-bold text-m3-on-surface truncate">Server Background Scraper</h6>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">
                      Offload pending extractions to server background queue
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const count = await offloadPendingToBackgroundServer();
                    if (count > 0) {
                      setToast({ type: "success", message: `Offloaded ${count} pending posts to server background!` });
                    } else {
                      setToast({ type: "success", message: "No pending posts to offload." });
                    }
                  }}
                  className="px-3 py-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer active:scale-95"
                >
                  Offload Queue
                </button>
              </div>

              {/* Redownload Missing Thumbnails */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-m3-outline-variant/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                    <RefreshCw size={16} />
                  </div>
                  <div className="min-w-0">
                    <h6 className="text-xs font-bold text-m3-on-surface truncate">Retry Image Crawls</h6>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">
                      Re-fetch image previews for empty or broken items
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    retryFailedThumbnails();
                    setToast({ type: "success", message: "Retrying failed image crawls..." });
                  }}
                  className="px-3 py-1.5 bg-m3-surface-variant text-m3-on-surface-variant hover:bg-m3-primary hover:text-m3-on-primary text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer active:scale-95"
                >
                  Retry Crawls
                </button>
              </div>

              {/* iOS Stay Awake Lock */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-m3-outline-variant/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Sun size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h6 className="text-xs font-bold text-m3-on-surface truncate">Screen Stay-Awake</h6>
                      {isIOSDevice() && (
                        <span className="text-[8px] font-bold px-1 rounded bg-amber-500/15 text-amber-600 font-mono">
                          iOS
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">
                      Keep mobile display active during batch media scraping
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleWakeLock}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer active:scale-95 border ${
                    wakeLockActive
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-m3-surface-variant text-m3-on-surface-variant border-transparent"
                  }`}
                >
                  {wakeLockActive ? "Active" : "Enable"}
                </button>
              </div>

              {/* PWA Cache Revalidate */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-m3-outline-variant/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={16} />
                  </div>
                  <div className="min-w-0">
                    <h6 className="text-xs font-bold text-m3-on-surface truncate">Offline PWA Cache</h6>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">
                      Revalidate ServiceWorker cache for offline access
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
                    }
                    setToast({ type: "success", message: "Offline cache revalidated!" });
                  }}
                  className="px-3 py-1.5 bg-m3-surface-variant text-m3-on-surface-variant hover:bg-m3-primary hover:text-m3-on-primary text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer active:scale-95"
                >
                  Revalidate
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Category 3: Backup & Export */}
        {(activeCategory === "all" || activeCategory === "backup") && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider px-1">
              Backup, Import &amp; Export
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* Restore Backup */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-m3-outline-variant/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Upload size={16} />
                  </div>
                  <div className="min-w-0">
                    <h6 className="text-xs font-bold text-m3-on-surface truncate">Restore Database Backup</h6>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">
                      Import previously saved JSON database backup
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleRestoreDatabase}
                  accept=".json"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer active:scale-95"
                >
                  Restore JSON
                </button>
              </div>

              {/* Export CSV */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-m3-outline-variant/40 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className="min-w-0">
                    <h6 className="text-xs font-bold text-m3-on-surface truncate">Export Library to CSV</h6>
                    <p className="text-[10px] text-m3-on-surface-variant truncate">
                      Download spreadsheet compatible CSV file
                    </p>
                  </div>
                </div>
                <button
                  onClick={exportCSVData}
                  className="px-3 py-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 text-xs font-bold rounded-lg shrink-0 transition-all cursor-pointer active:scale-95"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category 4: Danger Zone */}
        {(activeCategory === "all" || activeCategory === "danger") && (
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold text-red-500 uppercase tracking-wider px-1">
              Data Reset &amp; Danger Zone
            </h5>
            <div className="bg-m3-surface-low border border-red-500/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 size={16} />
                </div>
                <div className="min-w-0">
                  <h6 className="text-xs font-bold text-m3-on-surface truncate">Purge Saved Library Data</h6>
                  <p className="text-[10px] text-red-600 dark:text-red-400 truncate">
                    Irreversibly wipe local database or reset all settings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-all cursor-pointer border border-red-500/20 active:scale-95"
                >
                  Clear Database
                </button>
                <button
                  onClick={() => setShowConfirmClearAll(true)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  Reset App
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
