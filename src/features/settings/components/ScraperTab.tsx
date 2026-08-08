import React from "react";
import { Shield, Key, RefreshCw, Terminal, CheckCircle2, AlertCircle, Cpu, Globe } from "lucide-react";
import { triggerVibration } from "../../../lib/vibrate";

interface ScraperTabProps {
  scrapingUser: string;
  setScrapingUser: (val: string) => void;
  scrapingPass: string;
  setScrapingPass: (val: string) => void;
  scrapingSession: string;
  setScrapingSession: (val: string) => void;
  scrapingProxy: string;
  setScrapingProxy: (val: string) => void;
  loadingConfig: boolean;
  savingConfig: boolean;
  onSaveConfig: () => void;
  throttleStatus: { throttled: boolean; remaining: number };
  testingInstaloader: boolean;
  instaloaderResult: any;
  onTestInstaloader: () => void;
  testingMediaScraper: boolean;
  mediaScraperResult: any;
  onTestMediaScraper: () => void;
}

export const ScraperTab: React.FC<ScraperTabProps> = React.memo(({
  scrapingUser,
  setScrapingUser,
  scrapingPass,
  setScrapingPass,
  scrapingSession,
  setScrapingSession,
  scrapingProxy,
  setScrapingProxy,
  loadingConfig,
  savingConfig,
  onSaveConfig,
  throttleStatus,
  testingInstaloader,
  instaloaderResult,
  onTestInstaloader,
  testingMediaScraper,
  mediaScraperResult,
  onTestMediaScraper,
}) => {
  return (
    <div className="space-y-6">
      {/* Scraper Credentials & Proxy Config */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/20">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
              <Shield size={14} className="text-m3-primary" />
              <span>Instaloader & Media Scraper Credentials</span>
            </h3>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              Configure optional Instagram credentials or residential HTTP proxies to bypass rate limits.
            </p>
          </div>
          {throttleStatus.throttled && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse">
              Throttled: {throttleStatus.remaining}s cooldown
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Instagram Username
            </label>
            <input
              type="text"
              value={scrapingUser}
              onChange={(e) => setScrapingUser(e.target.value)}
              placeholder="e.g. curator_account"
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs font-mono text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Instagram Password
            </label>
            <input
              type="password"
              value={scrapingPass}
              onChange={(e) => setScrapingPass(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs font-mono text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Session Cookie (sessionid)
            </label>
            <input
              type="text"
              value={scrapingSession}
              onChange={(e) => setScrapingSession(e.target.value)}
              placeholder="e.g. 5241893%3AF9z..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs font-mono text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Residential Proxy (http/https)
            </label>
            <input
              type="text"
              value={scrapingProxy}
              onChange={(e) => setScrapingProxy(e.target.value)}
              placeholder="http://user:pass@proxy.example.com:8080"
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs font-mono text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={savingConfig || loadingConfig}
            onClick={() => {
              triggerVibration("light");
              onSaveConfig();
            }}
            className="px-5 py-2.5 bg-m3-primary text-m3-on-primary font-bold text-xs rounded-xl shadow-sm hover:bg-m3-primary/90 transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center gap-2"
          >
            {savingConfig ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving Credentials...</span>
              </>
            ) : (
              <span>Save Proxy &amp; Scraper Config</span>
            )}
          </button>
        </div>
      </div>

      {/* Engine Diagnostic Tests */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
          <Terminal size={14} className="text-m3-primary" />
          <span>Scraper Engine Diagnostics &amp; Bridge Probes</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Instaloader Test Box */}
          <div className="p-4 bg-m3-surface rounded-xl border border-m3-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-m3-on-surface">Instaloader CLI Bridge</h4>
                <p className="text-[10px] text-m3-on-surface-variant">Python-backed Instagram GQL shortcode extractor</p>
              </div>
              <button
                type="button"
                disabled={testingInstaloader}
                onClick={() => {
                  triggerVibration("light");
                  onTestInstaloader();
                }}
                className="px-3 py-1.5 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary text-m3-on-surface rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {testingInstaloader ? <RefreshCw size={12} className="animate-spin" /> : <Terminal size={12} />}
                <span>Probe Bridge</span>
              </button>
            </div>

            {instaloaderResult && (
              <pre className="p-3 bg-m3-surface-container rounded-lg text-[10px] font-mono text-m3-on-surface overflow-x-auto max-h-36">
                {JSON.stringify(instaloaderResult, null, 2)}
              </pre>
            )}
          </div>

          {/* Media Scraper Test Box */}
          <div className="p-4 bg-m3-surface rounded-xl border border-m3-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-m3-on-surface">Media Scraper Fallback Engine</h4>
                <p className="text-[10px] text-m3-on-surface-variant">Browser emulation DOM media extractor</p>
              </div>
              <button
                type="button"
                disabled={testingMediaScraper}
                onClick={() => {
                  triggerVibration("light");
                  onTestMediaScraper();
                }}
                className="px-3 py-1.5 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary text-m3-on-surface rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {testingMediaScraper ? <RefreshCw size={12} className="animate-spin" /> : <Globe size={12} />}
                <span>Probe Scraper</span>
              </button>
            </div>

            {mediaScraperResult && (
              <pre className="p-3 bg-m3-surface-container rounded-lg text-[10px] font-mono text-m3-on-surface overflow-x-auto max-h-36">
                {JSON.stringify(mediaScraperResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
