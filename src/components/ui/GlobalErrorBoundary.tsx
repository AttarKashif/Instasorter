import React, { Component, ErrorInfo, ReactNode } from "react";
import { appLogger } from "../../lib/appLogger";
import { AlertOctagon, RefreshCw, Terminal, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log crash to appLogger real-time developer log store
    appLogger.addLog({
      category: "crash",
      title: "React Component Hierarchy Crash",
      message: error.message || "Uncaught React rendering error",
      stack: error.stack,
      details: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-m3-surface text-m3-on-surface flex items-center justify-center p-4 font-sans">
          <div className="max-w-xl w-full bg-m3-surface-low border border-red-500/30 rounded-[24px] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-3 bg-red-500/10 rounded-2xl">
                <AlertOctagon size={32} />
              </div>
              <div>
                <h1 className="text-lg font-bold font-display text-m3-on-surface">
                  Application Encountered an Unexpected Error
                </h1>
                <p className="text-xs text-m3-on-surface-variant">
                  Instasorter Developer Protection: Crash details have been recorded in real-time developer telemetry logs.
                </p>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 font-mono text-xs text-red-600 dark:text-red-400 break-words space-y-1">
              <p className="font-bold">Error Cause:</p>
              <p>{this.state.error?.message || "Unknown Application Crash"}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-m3-surface border border-m3-outline-variant/30 text-m3-on-surface hover:bg-m3-surface-high transition-all cursor-pointer active:scale-95"
              >
                Try Recovering Component
              </button>
              
              <button
                onClick={this.handleReload}
                className="px-5 py-2 text-xs font-semibold rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 font-sans"
              >
                <RefreshCw size={14} />
                <span>Reload Application</span>
              </button>
            </div>

            {/* Stack trace expander */}
            <div className="border-t border-m3-outline-variant/15 pt-4">
              <button
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-m3-outline flex items-center gap-1.5 hover:text-m3-on-surface transition-colors cursor-pointer"
              >
                <Terminal size={14} />
                <span>{this.state.showDetails ? "Hide Technical Details" : "View Stack Trace"}</span>
                {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-zinc-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60 leading-relaxed border border-zinc-800 space-y-2">
                  <div>
                    <p className="text-zinc-400 font-bold">// Component Stack Trace</p>
                    <pre className="whitespace-pre-wrap">{this.state.errorInfo?.componentStack || "N/A"}</pre>
                  </div>
                  {this.state.error?.stack && (
                    <div className="pt-2 border-t border-zinc-800">
                      <p className="text-zinc-400 font-bold">// JavaScript Stack Trace</p>
                      <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
