import React from "react";
import { Terminal, Download, FileText, Trash2, Search, ChevronUp, ChevronDown, Activity, AlertTriangle } from "lucide-react";
import { triggerVibration } from "../../../lib/vibrate";
import { LogEntry } from "../../../lib/appLogger";

interface TelemetryTabProps {
  isLoggingActive: boolean;
  onToggleLogging: (val: boolean) => void;
  logs: LogEntry[];
  logStats: { total: number; crashes: number; freezes: number; slowPerf: number; errors: number; warnings: number; info: number };
  filteredLogs: LogEntry[];
  logFilterCategory: string;
  setLogFilterCategory: (val: string) => void;
  logSearchText: string;
  setLogSearchText: (val: string) => void;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  onClearLogs: () => void;
  onExportLogs: () => void;
}

const UnifiedSwitch: React.FC<{ checked: boolean; onChange: (val: boolean) => void; ariaLabel?: string }> = ({
  checked,
  onChange,
  ariaLabel,
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? "bg-m3-primary" : "bg-m3-outline-variant"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-m3-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

export const TelemetryTab: React.FC<TelemetryTabProps> = React.memo(({
  isLoggingActive,
  onToggleLogging,
  logs,
  logStats,
  filteredLogs,
  logFilterCategory,
  setLogFilterCategory,
  logSearchText,
  setLogSearchText,
  expandedLogId,
  setExpandedLogId,
  onClearLogs,
  onExportLogs,
}) => {
  return (
    <div className="space-y-6">
      {/* Telemetry Control Bar */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
              <Terminal size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
                <span>Developer Diagnostics &amp; Telemetry Stream</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {logStats.total} Records
                </span>
              </h3>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                Real-time tracking of main thread freezes, network failures, worker thread metrics, and storage errors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-m3-on-surface hidden sm:inline">Logging Active</span>
            <UnifiedSwitch
              checked={isLoggingActive}
              onChange={onToggleLogging}
              ariaLabel="Toggle Developer Logging"
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2">
          <div className="bg-m3-surface p-2.5 rounded-xl border border-m3-outline-variant/20 text-center">
            <span className="text-[9px] font-mono uppercase tracking-wider text-m3-on-surface-variant font-bold">Total</span>
            <p className="text-sm font-bold font-mono text-m3-on-surface mt-0.5">{logStats.total}</p>
          </div>
          <div className="bg-red-500/5 p-2.5 rounded-xl border border-red-500/20 text-center">
            <span className="text-[9px] font-mono uppercase tracking-wider text-red-600 font-bold">Crashes</span>
            <p className="text-sm font-bold font-mono text-red-600 mt-0.5">{logStats.crashes}</p>
          </div>
          <div className="bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/20 text-center">
            <span className="text-[9px] font-mono uppercase tracking-wider text-amber-600 font-bold">Freezes</span>
            <p className="text-sm font-bold font-mono text-amber-600 mt-0.5">{logStats.freezes}</p>
          </div>
          <div className="bg-blue-500/5 p-2.5 rounded-xl border border-blue-500/20 text-center">
            <span className="text-[9px] font-mono uppercase tracking-wider text-blue-600 font-bold">Slow</span>
            <p className="text-sm font-bold font-mono text-blue-600 mt-0.5">{logStats.slowPerf}</p>
          </div>
          <div className="bg-purple-500/5 p-2.5 rounded-xl border border-purple-500/20 text-center">
            <span className="text-[9px] font-mono uppercase tracking-wider text-purple-600 font-bold">Errors</span>
            <p className="text-sm font-bold font-mono text-purple-600 mt-0.5">{logStats.errors}</p>
          </div>
          <div className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/20 text-center">
            <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-600 font-bold">Warnings</span>
            <p className="text-sm font-bold font-mono text-emerald-600 mt-0.5">{logStats.warnings}</p>
          </div>
        </div>

        {/* Action Bar & Search */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" />
            <input
              type="text"
              placeholder="Search logs by keyword or title..."
              value={logSearchText}
              onChange={(e) => setLogSearchText(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-m3-surface rounded-xl border border-m3-outline-variant/30 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerVibration("light");
                onExportLogs();
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary text-m3-on-surface transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5"
            >
              <Download size={13} />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerVibration("light");
                onClearLogs();
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Log Stream List */}
        <div className="bg-m3-surface rounded-xl border border-m3-outline-variant/25 max-h-[360px] overflow-y-auto divide-y divide-m3-outline-variant/10 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-m3-on-surface-variant font-sans text-xs">
              <Terminal size={24} className="mx-auto mb-2 opacity-40" />
              <p>No log entries found matching criteria. System running clean.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const dateStr = new Date(log.timestamp).toLocaleTimeString();
              let badgeColor = "bg-slate-500/10 text-slate-600 border-slate-500/20";
              if (log.category === "crash") badgeColor = "bg-red-500/10 text-red-600 border-red-500/20";
              else if (log.category === "freeze") badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
              else if (log.category === "slow_perf") badgeColor = "bg-blue-500/10 text-blue-600 border-blue-500/20";
              else if (log.category === "error") badgeColor = "bg-purple-500/10 text-purple-600 border-purple-500/20";
              else if (log.category === "warning") badgeColor = "bg-orange-500/10 text-orange-600 border-orange-500/20";

              return (
                <div
                  key={log.id}
                  onClick={() => {
                    triggerVibration("light");
                    setExpandedLogId(isExpanded ? null : log.id);
                  }}
                  className="p-3 hover:bg-m3-surface-container/50 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${badgeColor}`}>
                        {log.category.replace("_", " ")}
                      </span>
                      <span className="font-bold text-m3-on-surface font-sans truncate">{log.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-m3-on-surface-variant text-[10px] shrink-0">
                      {log.durationMs && (
                        <span className="text-blue-600 font-bold">{log.durationMs}ms</span>
                      )}
                      <span>{dateStr}</span>
                    </div>
                  </div>
                  <p className="text-m3-on-surface-variant text-[10px] font-sans line-clamp-1">{log.message}</p>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-m3-outline-variant/20 space-y-2 text-[10px]">
                      {log.url && (
                        <div>
                          <span className="text-m3-outline">Path:</span> <span className="text-m3-on-surface">{log.url}</span>
                        </div>
                      )}
                      {log.details && (
                        <div>
                          <span className="text-m3-outline">Details:</span>
                          <pre className="mt-1 p-2 bg-m3-surface-container rounded-lg overflow-x-auto text-[9px] text-m3-on-surface">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.stack && (
                        <div>
                          <span className="text-m3-outline">Stack Trace:</span>
                          <pre className="mt-1 p-2 bg-red-500/5 rounded-lg overflow-x-auto text-[9px] text-red-600">
                            {log.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
