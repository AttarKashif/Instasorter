export type LogCategory = "crash" | "freeze" | "slow_perf" | "error" | "warning" | "info";

export interface LogEntry {
  id: string;
  timestamp: number;
  category: LogCategory;
  title: string;
  message: string;
  details?: any;
  stack?: string;
  durationMs?: number;
  url?: string;
}

const STORAGE_KEY_ENABLED = "instasorter_dev_logs_enabled";
const STORAGE_KEY_LOGS = "instasorter_dev_logs_data";
const MAX_LOGS = 500;

type Listener = (logs: LogEntry[]) => void;

class AppLogger {
  private enabled: boolean = true;
  private logs: LogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private longTaskObserver: PerformanceObserver | null = null;
  private lastRafTime: number = 0;
  private rafId: number | null = null;
  private isMonitoringFreeze: boolean = false;

  constructor() {
    this.enabled = localStorage.getItem(STORAGE_KEY_ENABLED) !== "false";
    this.loadLogsFromStorage();
    if (this.enabled) {
      this.initAutoMonitoring();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    localStorage.setItem(STORAGE_KEY_ENABLED, val ? "true" : "false");
    if (val) {
      this.initAutoMonitoring();
      this.addLog({
        category: "info",
        title: "Developer Logging Enabled",
        message: "Real-time diagnostic and performance logging session activated.",
      });
    } else {
      this.stopAutoMonitoring();
    }
    this.notify();
  }

  private loadLogsFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      if (raw) {
        this.logs = JSON.parse(raw);
        this.cleanOldLogs(30, false);
      }
    } catch {
      this.logs = [];
    }
  }

  /**
   * Automatically cleans up performance and diagnostic logs older than specified days (default 30 days)
   * to keep local storage lightweight and performant.
   */
  public cleanOldLogs(maxAgeDays: number = 30, notifyListeners: boolean = true): number {
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const initialCount = this.logs.length;
    
    // Filter out logs older than cutoffTime
    this.logs = this.logs.filter((log) => log.timestamp >= cutoffTime);

    const removedCount = initialCount - this.logs.length;
    if (removedCount > 0) {
      this.saveLogsToStorage();
      if (notifyListeners) {
        this.notify();
      }
    }
    return removedCount;
  }

  private saveLogsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.logs.slice(-MAX_LOGS)));
    } catch (e) {
      // If quota exceeded, truncate to last 100 entries
      try {
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.logs.slice(-100)));
      } catch {
        // ignore
      }
    }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY_LOGS);
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn(this.getLogs()));
  }

  public addLog(entry: Omit<LogEntry, "id" | "timestamp">): void {
    if (!this.enabled) return;

    const newEntry: LogEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
      ...entry,
    };

    this.logs.unshift(newEntry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    this.saveLogsToStorage();
    this.notify();
  }

  // Auto monitoring setup for Crashes, Freezes & Performance
  private initAutoMonitoring(): void {
    if (typeof window === "undefined") return;

    // 1. Global Window Errors (Uncaught Exceptions -> Crash)
    const handleGlobalError = (event: ErrorEvent) => {
      this.addLog({
        category: "crash",
        title: "Uncaught Exception / Application Crash",
        message: event.message || "Unknown runtime error occurred",
        stack: event.error?.stack,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    // 2. Unhandled Promise Rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.addLog({
        category: "crash",
        title: "Unhandled Promise Rejection",
        message: typeof reason === "string" ? reason : reason?.message || "Promise rejected without explicit reason",
        stack: reason?.stack,
        details: { reason },
      });
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // 3. Performance Long Tasks API (Main Thread Freeze / Heavy Work)
    if ("PerformanceObserver" in window) {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 100) {
              const isSevere = entry.duration > 300;
              this.addLog({
                category: isSevere ? "freeze" : "slow_perf",
                title: isSevere ? "Main Thread Freeze Detected" : "Slow Execution / Heavy Task",
                message: `Main thread was blocked for ${Math.round(entry.duration)}ms.`,
                durationMs: Math.round(entry.duration),
                details: {
                  entryType: entry.entryType,
                  startTime: Math.round(entry.startTime),
                  attribution: (entry as any).attribution?.[0]?.name || "Script Execution",
                },
              });
            }
          }
        });
        this.longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        // Fallback to RAF freeze detection
        this.startRafFreezeMonitor();
      }
    } else {
      this.startRafFreezeMonitor();
    }

    // 4. Fallback/Complement RAF loop for frame lag / main thread freezes
    this.startRafFreezeMonitor();
  }

  private startRafFreezeMonitor(): void {
    if (this.isMonitoringFreeze) return;
    this.isMonitoringFreeze = true;
    this.lastRafTime = performance.now();

    const checkFrame = () => {
      if (!this.enabled || !this.isMonitoringFreeze) return;
      const now = performance.now();
      const delta = now - this.lastRafTime;

      // If frame gap > 250ms (and user wasn't tab switched/hidden), record main thread freeze
      if (delta > 250 && typeof document !== "undefined" && !document.hidden) {
        this.addLog({
          category: "freeze",
          title: "Screen / Frame Freeze Detected",
          message: `UI thread lagged by ${Math.round(delta)}ms without rendering.`,
          durationMs: Math.round(delta),
        });
      }

      this.lastRafTime = now;
      this.rafId = requestAnimationFrame(checkFrame);
    };

    this.rafId = requestAnimationFrame(checkFrame);
  }

  private stopAutoMonitoring(): void {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isMonitoringFreeze = false;
  }

  // Utility to measure async operations (e.g. database, parsing, image processing)
  public async measure<T>(title: string, fn: () => Promise<T>, thresholdMs = 150): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      if (duration >= thresholdMs) {
        this.addLog({
          category: "slow_perf",
          title: `Slow Operation: ${title}`,
          message: `${title} took ${duration}ms to complete (threshold: ${thresholdMs}ms).`,
          durationMs: duration,
        });
      }
      return result;
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      this.addLog({
        category: "error",
        title: `Failed Operation: ${title}`,
        message: err?.message || String(err),
        durationMs: duration,
        stack: err?.stack,
      });
      throw err;
    }
  }

  public getStats() {
    let crashes = 0;
    let freezes = 0;
    let slowPerf = 0;
    let errors = 0;
    let warnings = 0;

    for (const log of this.logs) {
      if (log.category === "crash") crashes++;
      else if (log.category === "freeze") freezes++;
      else if (log.category === "slow_perf") slowPerf++;
      else if (log.category === "error") errors++;
      else if (log.category === "warning") warnings++;
    }

    return {
      total: this.logs.length,
      crashes,
      freezes,
      slowPerf,
      errors,
      warnings,
    };
  }
}

export const appLogger = new AppLogger();
