import React from "react";
import { Hash, RefreshCw, Layers, Sparkles, Trash2 } from "lucide-react";

interface MaintenanceTabProps {
  handleConsolidateTags: () => void;
  retryFailedThumbnails: () => void;
  setToast: (val: { type: "success" | "error"; message: string } | null) => void;
  handleAnalyzeDuplicates: () => void;
  handleLoadSamples: () => void;
  setShowConfirmClear: (val: boolean) => void;
  setShowConfirmClearAll: (val: boolean) => void;
}

export const MaintenanceTab: React.FC<MaintenanceTabProps> = React.memo(({
  handleConsolidateTags,
  retryFailedThumbnails,
  setToast,
  handleAnalyzeDuplicates,
  handleLoadSamples,
  setShowConfirmClear,
  setShowConfirmClearAll,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-white hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
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
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-white hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
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
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-m3-primary text-white hover:bg-m3-primary/95 rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
          >
            <Layers size={12} />
            <span>Merge Duplicates</span>
          </button>
        </div>

        {/* Load Sample Curator Data */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01] group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-m3-primary/10 text-m3-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <Sparkles size={18} className="text-amber-500 fill-amber-500/20" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface">Seed Sample Curator Posts</h4>
              <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mt-1">
                Overwrites your current local workspace with standard, professionally cataloged sample Instagram posts to test visual feed grids.
              </p>
            </div>
          </div>
          <button
            onClick={handleLoadSamples}
            className="w-full mt-5 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs border border-transparent"
          >
            <Sparkles size={12} />
            <span>Seed Sample Bookmarks</span>
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

