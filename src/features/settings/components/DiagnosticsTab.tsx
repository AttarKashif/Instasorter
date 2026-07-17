import React, { useMemo } from "react";
import { Wrench, Search, RefreshCw, Trash2, AlertTriangle, Image as ImageIcon, ExternalLink, Check, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { runSettingsDiagnostic } from "../SettingsDebugger";

interface DiagnosticIssue {
  id: string;
  label: string;
  severity: "high" | "medium";
}

interface DiagnosticItem {
  post: {
    id: string;
    creatorUsername: string;
    caption?: string;
    savedAt?: string;
    thumbnailUrl?: string;
    thumbnailStatus?: string;
    postUrl?: string;
  };
  issues: DiagnosticIssue[];
}

interface DiagnosticsTabProps {
  filteredDeadPosts: DiagnosticItem[];
  optSearch: string;
  setOptSearch: (val: string) => void;
  optFilter: "all" | "broken_thumbnail" | "missing_metadata";
  setOptFilter: (val: "all" | "broken_thumbnail" | "missing_metadata") => void;
  handleBulkRetryDead: () => void;
  showBulkDeleteConfirm: boolean;
  setShowBulkDeleteConfirm: (val: boolean) => void;
  handleBulkDeleteDead: () => void;
  retryingIds: Set<string>;
  handleRetrySingle: (id: string, user: string) => void;
  handleDeleteSingleDead: (id: string) => void;
  
  // Settings Verification state
  theme?: "light" | "dark";
  displayName: string;
  username: string;
  email: string;
  animationsEnabled: boolean;
  compactMode: boolean;
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = React.memo(({
  filteredDeadPosts,
  optSearch,
  setOptSearch,
  optFilter,
  setOptFilter,
  handleBulkRetryDead,
  showBulkDeleteConfirm,
  setShowBulkDeleteConfirm,
  handleBulkDeleteDead,
  retryingIds,
  handleRetrySingle,
  handleDeleteSingleDead,
  
  theme,
  displayName,
  username,
  email,
  animationsEnabled,
  compactMode,
}) => {
  // Compute diagnostic report on current settings state dynamically
  const debugReport = useMemo(() => {
    return runSettingsDiagnostic({
      displayName,
      username,
      email,
      animationsEnabled,
      compactMode,
      theme,
    });
  }, [displayName, username, email, animationsEnabled, compactMode, theme]);
  return (
    <div className="space-y-6">
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 space-y-6 shadow-xs">
        
        {/* Diagnostic Hub Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-m3-outline-variant/10">
          <div className="space-y-1">
            <h3 className="text-sm font-bold font-display text-m3-on-surface flex items-center gap-2">
              <Wrench className="text-emerald-500" size={16} />
              <span>Library Diagnostic &amp; Repair Hub</span>
            </h3>
            <p className="text-[11px] text-m3-on-surface-variant leading-relaxed">
              Deep-scans active local bookmarks to repair broken thumbnails, identify unclassified links, and fill missing captions.
            </p>
          </div>
        </div>

        {/* Metrics Subgrid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-m3-surface border border-m3-outline-variant/15 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-m3-outline block mb-1">Flagged Bookmarks</span>
              <p className="text-xl font-extrabold font-display text-m3-on-surface">
                {filteredDeadPosts.length}
              </p>
            </div>
            <p className="text-[10px] text-m3-on-surface-variant mt-2 font-sans">
              Items showing anomalies.
            </p>
          </div>
          
          <div className="bg-m3-surface border border-m3-outline-variant/15 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-m3-outline block mb-1">Broken Thumbnails</span>
              <p className="text-xl font-extrabold font-display text-red-500 dark:text-red-400">
                {filteredDeadPosts.filter(item => item.issues.some(i => i.id.startsWith("thumb_"))).length}
              </p>
            </div>
            <p className="text-[10px] text-m3-on-surface-variant mt-2 font-sans">
              Missing local preview files.
            </p>
          </div>

          <div className="bg-m3-surface border border-m3-outline-variant/15 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-m3-outline block mb-1">Incomplete Metadata</span>
              <p className="text-xl font-extrabold font-display text-amber-500 dark:text-amber-400">
                {filteredDeadPosts.filter(item => item.issues.some(i => i.id.startsWith("meta_"))).length}
              </p>
            </div>
            <p className="text-[10px] text-m3-on-surface-variant mt-2 font-sans">
              Missing usernames/captions.
            </p>
          </div>
        </div>

        {/* Action Search Row */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 bg-m3-surface-container/40 p-4 rounded-xl border border-m3-outline-variant/10">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-outline" size={14} />
              <input
                type="text"
                value={optSearch}
                onChange={(e) => setOptSearch(e.target.value)}
                placeholder="Search unoptimized posts by user or caption..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary text-m3-on-surface font-sans"
              />
            </div>
            
            <div className="flex bg-m3-surface border border-m3-outline-variant/15 rounded-xl p-0.5">
              <button
                onClick={() => setOptFilter("all")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  optFilter === "all"
                    ? "bg-m3-primary text-white shadow-3xs"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setOptFilter("broken_thumbnail")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  optFilter === "broken_thumbnail"
                    ? "bg-m3-primary text-white shadow-3xs"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                Thumbnails
              </button>
              <button
                onClick={() => setOptFilter("missing_metadata")}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  optFilter === "missing_metadata"
                    ? "bg-m3-primary text-white shadow-3xs"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                Metadata
              </button>
            </div>
          </div>

          <div className="flex gap-2 shrink-0 self-start lg:self-auto">
            <button
              onClick={handleBulkRetryDead}
              disabled={filteredDeadPosts.filter(item => item.issues.some(i => i.id.startsWith("thumb_"))).length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-m3-primary hover:bg-m3-primary/5 rounded-xl border border-m3-outline-variant disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer bg-m3-surface active:scale-95"
            >
              <RefreshCw size={12} />
              <span>Retry All Failed</span>
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={filteredDeadPosts.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-600 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-600 dark:hover:text-white rounded-xl border border-red-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer active:scale-95 shadow-3xs"
            >
              <Trash2 size={12} />
              <span>Purge Selected</span>
            </button>
          </div>
        </div>

        {/* Bulk Delete Confirm Alert */}
        <AnimatePresence>
          {showBulkDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/25 rounded-xl p-4 space-y-3 overflow-hidden"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-bold text-red-600 dark:text-red-400">Confirm database purge</h4>
                  <p className="text-[10px] text-m3-on-surface-variant leading-relaxed mt-0.5">
                    This will permanently delete <strong>{filteredDeadPosts.length}</strong> bookmarks matching current filters from local IndexedDB storage.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-m3-outline-variant hover:bg-m3-surface-container transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDeleteDead}
                  className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer shadow-3xs"
                >
                  Confirm and Purge {filteredDeadPosts.length} Posts
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diagnostic Lists */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
          {filteredDeadPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-m3-surface rounded-xl border border-m3-outline-variant/10">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                <Check size={24} />
              </div>
              <h4 className="text-xs font-bold text-m3-on-surface">No Issues Flagged</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 max-w-xs leading-normal">
                Your active curated database matches 100% of our extraction parameters with active media caches.
              </p>
            </div>
          ) : (
            filteredDeadPosts.map(({ post, issues }) => {
              const isPending = post.thumbnailStatus === "pending" || retryingIds.has(post.id);
              return (
                <div
                  key={post.id}
                  className="bg-m3-surface border border-m3-outline-variant/15 hover:border-m3-outline-variant/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 shadow-3xs hover:shadow-2xs group"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-m3-surface-container border border-m3-outline-variant/10 shrink-0 overflow-hidden relative flex items-center justify-center">
                      {post.thumbnailUrl && post.thumbnailUrl !== "base64-placeholder" ? (
                        <img
                          src={post.thumbnailUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-red-500 dark:text-red-400">
                          <ImageIcon size={16} />
                        </div>
                      )}
                      {isPending && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <RefreshCw size={14} className="text-white animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs font-bold text-m3-on-surface hover:underline truncate">
                          @{post.creatorUsername || "unknown"}
                        </span>
                        <span className="text-[10px] text-m3-outline font-medium">
                          • {post.savedAt ? new Date(post.savedAt).toLocaleDateString() : "Unknown Date"}
                        </span>
                      </div>
                      <p className="text-xs text-m3-on-surface-variant truncate font-sans pr-4">
                        {post.caption || <em className="text-m3-outline">No caption found</em>}
                      </p>
                      
                      <div className="flex flex-wrap gap-1">
                        {issues.map((issue) => (
                          <span
                            key={issue.id}
                            className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                              issue.severity === "high"
                                ? "bg-red-500/15 text-red-500 border border-red-500/10"
                                : "bg-amber-500/15 text-amber-500 border border-amber-500/10"
                            }`}
                          >
                            <span className={`w-1 h-1 rounded-full ${issue.severity === "high" ? "bg-red-500" : "bg-amber-500"}`} />
                            {issue.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-stretch sm:self-center justify-end">
                    <button
                      onClick={() => handleRetrySingle(post.id, post.creatorUsername)}
                      disabled={isPending}
                      title="Re-run crawl worker on this thumbnail"
                      className="h-9 w-9 flex items-center justify-center text-m3-primary hover:bg-m3-primary/5 active:scale-90 border border-m3-outline-variant rounded-xl transition-all cursor-pointer bg-m3-surface disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
                    </button>
                    <button
                      onClick={() => handleDeleteSingleDead(post.id)}
                      title="Purge this entry permanently"
                      className="h-9 w-9 flex items-center justify-center text-red-500 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 active:scale-90 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                    {post.postUrl && (
                      <a
                        href={post.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open original post on Instagram"
                        className="h-9 w-9 flex items-center justify-center text-m3-outline hover:text-m3-primary hover:bg-m3-primary/5 border border-m3-outline-variant rounded-xl transition-all cursor-pointer bg-m3-surface"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Configuration State Verification */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-m3-outline-variant/10">
          <div>
            <h4 className="text-xs font-bold font-display text-m3-on-surface flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={16} />
              <span>Active Settings State &amp; LocalStorage Verification</span>
            </h4>
            <p className="text-[10px] text-m3-on-surface-variant leading-relaxed font-sans">
              Automated audit of the runtime React state vs local storage cache to verify layout configurations.
            </p>
          </div>
          <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
            debugReport.overallStatus === "PASS"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}>
            {debugReport.overallStatus === "PASS" ? (
              <>
                <Check size={12} />
                <span>STATE MATCHED &amp; COMPLIANT</span>
              </>
            ) : (
              <>
                <ShieldAlert size={12} />
                <span>MISALIGNED CONFIGURATION</span>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-m3-outline-variant/10">
                <th className="py-2 text-[10px] font-bold text-m3-outline uppercase font-mono tracking-wider">Setting / Key</th>
                <th className="py-2 text-[10px] font-bold text-m3-outline uppercase font-mono tracking-wider">React State</th>
                <th className="py-2 text-[10px] font-bold text-m3-outline uppercase font-mono tracking-wider">LocalStorage Cache</th>
                <th className="py-2 text-[10px] font-bold text-m3-outline uppercase font-mono tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant/10 font-sans text-xs">
              {debugReport.items.map((item) => (
                <tr key={item.key} className="hover:bg-m3-surface-variant/5">
                  <td className="py-2.5 pr-2">
                    <span className="font-mono text-xs font-semibold text-m3-on-surface">{item.key}</span>
                    <p className="text-[10px] text-m3-on-surface-variant mt-0.5">{item.description}</p>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="font-mono bg-m3-surface border border-m3-outline-variant/20 px-1.5 py-0.5 rounded text-[11px] text-m3-on-surface-variant">
                      {item.stateValue !== undefined ? String(item.stateValue) : "undefined"}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="font-mono bg-m3-surface border border-m3-outline-variant/20 px-1.5 py-0.5 rounded text-[11px] text-m3-on-surface-variant">
                      {item.storageValue !== null ? String(item.storageValue) : "null"}
                    </span>
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    {item.status === "MATCHED" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        <Check size={12} /> MATCHED
                      </span>
                    )}
                    {item.status === "MISALIGNED" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 font-mono">
                        <X size={12} /> MISALIGNED
                      </span>
                    )}
                    {item.status === "MISSING" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 font-mono">
                        <AlertTriangle size={12} /> MISSING
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

