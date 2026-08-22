import React from "react";
import { Database, RefreshCw, Layers, Hash, Image, HardDrive, Cpu, AlertTriangle } from "lucide-react";
import { triggerVibration } from "../../../lib/vibrate";

interface MaintenanceTabProps {
  storageInfo: { usage: number; quota: number; percentage: number } | null;
  postsCount: number;
  isRefreshingLibrary: boolean;
  onRefreshLibrary: () => void;
  onScanDuplicates: () => void;
  onConsolidateTags: () => void;
  workerStats: any;
  isDownloading: boolean;
  onRetryFailedThumbnails: () => void;
}

export const MaintenanceTab: React.FC<MaintenanceTabProps> = React.memo(({
  storageInfo,
  postsCount,
  isRefreshingLibrary,
  onRefreshLibrary,
  onScanDuplicates,
  onConsolidateTags,
  workerStats,
  isDownloading,
  onRetryFailedThumbnails,
}) => {
  return (
    <div className="space-y-6">
      {/* Downloader & Thumbnail Health Stats */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-m3-outline-variant/15">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
                <span>Thumbnail Downloader Health</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {isDownloading ? "Active Worker" : "Worker Idle"}
                </span>
              </h3>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                Local background caching and image health metrics.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-m3-surface border border-m3-outline-variant/30 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-m3-outline uppercase block">Saved Items</span>
            <span className="text-base font-extrabold font-display text-m3-on-surface">{postsCount}</span>
          </div>
          <div className="p-3 bg-m3-surface border border-m3-outline-variant/30 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-m3-outline uppercase block">Background Worker</span>
            <span className="text-base font-extrabold font-display text-m3-primary">{isDownloading ? "Processing" : "Idle"}</span>
          </div>
          <div className="p-3 bg-m3-surface border border-m3-outline-variant/30 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-m3-outline uppercase block">Thumbnails Active</span>
            <span className="text-base font-extrabold font-display text-emerald-600">{workerStats?.completed || 0}</span>
          </div>
          <div className="p-3 bg-m3-surface border border-m3-outline-variant/30 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-m3-outline uppercase block">Missing / Failed</span>
            <span className="text-base font-extrabold font-display text-amber-600">{workerStats?.failed || 0}</span>
          </div>
        </div>
      </div>

      {/* Library Maintenance Action Buttons */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
          <Database size={14} className="text-m3-primary" />
          <span>Database Repair &amp; Consolidation Actions</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            disabled={isRefreshingLibrary}
            onClick={() => {
              triggerVibration("light");
              onRefreshLibrary();
            }}
            className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={`text-m3-primary ${isRefreshingLibrary ? "animate-spin" : ""}`} />
            <span>{isRefreshingLibrary ? "Re-indexing..." : "Repair Database Indexes"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerVibration("light");
              onScanDuplicates();
            }}
            className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Layers size={14} className="text-m3-primary" />
            <span>Identify Duplicate Posts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerVibration("light");
              onConsolidateTags();
            }}
            className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Hash size={14} className="text-m3-primary" />
            <span>Fix tag duplicates</span>
          </button>
        </div>

        {workerStats?.failed > 0 && (
          <div className="pt-2 flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              <span>{workerStats.failed} thumbnail download failures detected</span>
            </span>
            <button
              type="button"
              onClick={() => {
                triggerVibration("medium");
                onRetryFailedThumbnails();
              }}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Retry Failed
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

