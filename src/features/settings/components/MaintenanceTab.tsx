import React from "react";
import { Hash, RefreshCw, Layers, Trash2, FileSpreadsheet, AlertCircle, Check } from "lucide-react";

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
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Background Downloader Health & Progress Dashboard */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/30 rounded-[20px] p-5 shadow-sm space-y-4 col-span-1 md:col-span-2 select-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-m3-outline-variant/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                {throttleStatus.throttled ? (
                  <AlertCircle size={20} className="text-m3-primary animate-pulse" />
                ) : isDownloading ? (
                  <RefreshCw size={20} className="text-m3-primary animate-spin" />
                ) : workerStats.failed > 0 ? (
                  <AlertCircle size={20} className="text-m3-primary" />
                ) : (
                  <Check size={20} className="text-m3-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-m3-on-surface">Background Downloader</h4>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
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
                      ? "ACTIVE"
                      : workerStats.failed > 0
                      ? "ISSUES DETECTED"
                      : "FULLY SYNCED"}
                  </span>
                </div>
                <p className="text-[11px] text-m3-on-surface-variant font-medium mt-0.5">
                  {throttleStatus.throttled
                    ? "Rate limit protection active. Pausing requests temporarily to avoid blocks."
                    : isDownloading
                    ? "Crawling, cache-validating, and downloading media assets to secure offline-ready local storage."
                    : workerStats.failed > 0
                    ? "Synchronizer complete but some media assets failed to download. You can retry them below."
                    : "All media files and preview assets are fully downloaded and available for offline viewing."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-m3-surface-lowest/40 rounded-xl p-3 border border-m3-outline-variant/10">
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-[10px] text-m3-outline font-semibold uppercase tracking-wider">Downloaded</span>
              <span className="text-sm font-bold text-m3-on-surface">{workerStats.success}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-[10px] text-m3-outline font-semibold uppercase tracking-wider">Pending Tasks</span>
              <span className="text-sm font-bold text-m3-on-surface">{workerStats.pending}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-left">
              <span className="text-[10px] text-m3-outline font-semibold uppercase tracking-wider">Failed Attempts</span>
              <span className="text-sm font-bold text-m3-on-surface text-red-500">{workerStats.failed}</span>
            </div>
          </div>

          {/* Progress Section */}
          {workerStats.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-m3-outline font-semibold">
                <span>Synchronization Progress</span>
                <span>{Math.round((workerStats.success / workerStats.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-m3-surface-container rounded-full overflow-hidden border border-m3-outline-variant/10">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    workerStats.failed > 0 && workerStats.pending === 0
                      ? "bg-m3-primary/50"
                      : "bg-m3-primary"
                  }`}
                  style={{ width: `${(workerStats.success / workerStats.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions & Alerts inside the card */}
          {(throttleStatus.throttled || workerStats.failed > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-m3-outline-variant/5">
              {throttleStatus.throttled ? (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <span>Rate limited. Cooldown timer: <strong>{throttleStatus.remaining}s</strong></span>
                  <button
                    onClick={() => {
                      retryFailedThumbnails();
                      setToast({ type: "success", message: "Bypassing cooldown..." });
                    }}
                    className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded text-[10px] font-bold uppercase transition-all cursor-pointer"
                  >
                    Bypass Cooldown
                  </button>
                </div>
              ) : <div />}

              {workerStats.failed > 0 && (
                <button
                  onClick={() => {
                    retryFailedThumbnails();
                    setToast({ type: "success", message: "Retrying failed downloads..." });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-m3-primary bg-m3-primary/10 hover:bg-m3-primary/15 rounded-lg border border-m3-primary/10 transition-all cursor-pointer"
                >
                  <RefreshCw size={11} className="animate-pulse" />
                  <span>Retry {workerStats.failed} Failed Downloads</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Offline PWA & Service Worker Status Card */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-105">
              <Check size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-m3-on-surface">PWA &amp; Offline Cache Health</h4>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase font-mono">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1">
                Instasorter is fully PWA-configured with ServiceWorker caching and IndexedDB offline persistence. You can launch and browse your collection without an internet connection.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
              }
              setToast({ type: "success", message: "PWA cache revalidated. Offline storage is up to date." });
            }}
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-surface-variant text-m3-on-surface-variant hover:bg-m3-primary hover:text-m3-on-primary rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-m3-outline-variant/20"
          >
            <RefreshCw size={12} />
            <span>Revalidate Offline Cache</span>
          </button>
        </div>

        {/* Consolidate Tags */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <Hash size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface">Consolidate Tag Taxonomy</h4>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1">
                Scans and cleans up casing inconsistencies or spelling variations across bookmark tags (e.g., merging "aesthetic" and "Aesthetic" into a single canonical tag).
              </p>
            </div>
          </div>
          <button
            onClick={handleConsolidateTags}
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
          >
            <Hash size={12} />
            <span>Run Tag Optimizer</span>
          </button>
        </div>

        {/* Retry Failed Previews */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <RefreshCw size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface">Redownload Missing Thumbnails</h4>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1">
                Initiates the local crawler in the background to automatically retry fetching image previews for bookmarks with broken, empty, or failed assets.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              retryFailedThumbnails();
              setToast({ type: "success", message: "Retrying failed previews in background..." });
            }}
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
          >
            <RefreshCw size={12} />
            <span>Retry Image Crawls</span>
          </button>
        </div>

        {/* Resolve Duplicates */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <Layers size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface">Merge Duplicate Entries</h4>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1">
                Analyzes database for duplicate bookmarks with matching shortcodes or URLs, merging their custom tags, collection labels, and notes into single records.
              </p>
            </div>
          </div>
          <button
            onClick={handleAnalyzeDuplicates}
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
          >
            <Layers size={12} />
            <span>Merge Duplicates</span>
          </button>
        </div>


        {/* Export to CSV */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <FileSpreadsheet size={18} className="text-emerald-500" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface">Export Library to CSV</h4>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1 font-sans">
                Converts your saved posts, tag indices, collection labels, and curation notes into a structured CSV file for spreadsheet-compatible personal backup or external data analytics.
              </p>
            </div>
          </div>
          <button
            onClick={exportCSVData}
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent font-sans"
          >
            <FileSpreadsheet size={12} />
            <span>Download CSV Spreadsheet</span>
          </button>
        </div>

        {/* Clear database */}
        <div className="bg-m3-surface-low border border-red-500/20 hover:border-red-500/40 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center transition-transform group-hover:scale-105">
              <Trash2 size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface">Purge Saved Library Data</h4>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1 text-red-600 dark:text-red-400 font-sans">
                Performs a complete hard-wipe of your local IndexedDB storage or resets all cached localStorage settings.
              </p>
            </div>
          </div>
          <div className="space-y-2 mt-5">
            <button
              onClick={() => setShowConfirmClear(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-red-500/5 hover:bg-red-600 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-600 dark:hover:text-white rounded-xl py-2 text-xs font-bold cursor-pointer border border-red-500/20 hover:border-red-600 transition-all active:scale-95 shadow-3xs"
            >
              <Trash2 size={12} />
              <span>Clear Database</span>
            </button>
            <button
              onClick={() => setShowConfirmClearAll(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
            >
              <Trash2 size={12} />
              <span>Clear All Data &amp; Reset App</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
});

