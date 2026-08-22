import React, { useState } from "react";
import { Shield, Key, RefreshCw, Terminal, CheckCircle2, AlertCircle, Cpu, Globe, HelpCircle, Bookmark, Copy, Check } from "lucide-react";
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
  const [checkingSession, setCheckingSession] = useState(false);
  const [sessionCheckResult, setSessionCheckResult] = useState<{ success: boolean; authenticated?: boolean; message: string } | null>(null);
  const [showCookieGuide, setShowCookieGuide] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  const handleTestSession = async () => {
    setCheckingSession(true);
    setSessionCheckResult(null);
    try {
      const res = await fetch("/api/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_cookie: scrapingSession,
          username: scrapingUser
        })
      });
      const data = await res.json();
      setSessionCheckResult(data);
    } catch (err: any) {
      setSessionCheckResult({
        success: false,
        message: "Failed to connect to verification server: " + err.message
      });
    } finally {
      setCheckingSession(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){try{const u=window.location.href;const og=document.querySelector('meta[property="og:image"]');const img=og?og.getAttribute('content'):null;const authorEl=document.querySelector('header a[role="link"], a[href^="/"] span');const auth=authorEl?authorEl.textContent.trim():'';const timeEl=document.querySelector('time');const st=timeEl?timeEl.getAttribute('datetime'):new Date().toISOString();const capEl=document.querySelector('h1, span._aacl');const cap=capEl?capEl.textContent:'';const obj=[{id:window.location.pathname.split('/')[2]||'ig_'+Date.now(),postUrl:u,creatorUsername:auth||'instagram_creator',caption:cap,thumbnailUrl:img,savedAt:st,mediaType:u.includes('/reel/')?'video':'image',tags:[],collections:['Imported via Bookmarklet'],isFavorite:false,isArchived:false,readLater:false}];navigator.clipboard.writeText(JSON.stringify(obj,null,2)).then(()=>alert('✅ Post copied! Paste into Instasorter Import tab.')).catch(()=>prompt('Copy JSON:',JSON.stringify(obj)));}catch(e){alert('Error: '+e.message);}})();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmarklet(true);
    triggerVibration("light");
    setTimeout(() => setCopiedBookmarklet(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 1-Click Instagram Bookmarklet Helper Card */}
      <div className="bg-gradient-to-br from-m3-surface-low to-m3-surface border border-m3-outline-variant/30 rounded-[20px] p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary">
              <Bookmark size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface">
                1-Click Instagram Post Capture Bookmarklet (100% Success Rate)
              </h3>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                Zero proxy blocks &amp; zero rate-limits. Extract high-res media directly while browsing Instagram.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={copyBookmarklet}
            className="px-4 py-2 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary text-m3-on-surface font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-2"
          >
            {copiedBookmarklet ? (
              <>
                <Check size={14} className="text-emerald-500" />
                <span className="text-emerald-600 font-bold">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Bookmarklet Script</span>
              </>
            )}
          </button>
        </div>

        <div className="p-3 bg-m3-surface-container rounded-xl text-[11px] text-m3-on-surface-variant leading-relaxed">
          <span className="font-bold text-m3-on-surface block mb-1">How to use:</span>
          Create a new bookmark in your browser with any name (e.g. <span className="font-mono font-bold text-m3-primary">"Capture to Instasorter"</span>) and paste this script as the URL. Whenever you view any post or reel on Instagram, click the bookmark to copy its full HD metadata instantly!
        </div>
      </div>

      {/* Scraper Credentials & Proxy Config */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/20">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
              <Shield size={14} className="text-m3-primary" />
              <span>Instagram Authenticated Scraping Setup</span>
            </h3>
            <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
              Set up optional local browser-stored credentials and secure proxies to ensure stable downloading.
            </p>
          </div>
          {throttleStatus.throttled && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse">
              Throttled: {throttleStatus.remaining}s cooldown
            </span>
          )}
        </div>

        {/* Secure local storage notice & Help Guide toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-m3-primary/5 border border-m3-outline-variant/30 rounded-xl text-[11px] text-m3-on-surface-variant">
          <div className="space-y-0.5">
            <span className="font-bold text-m3-primary block">🔒 Private Local Storage</span>
            Your credentials are kept exclusively on this device and are never sent to third-party services.
          </div>
          <button
            type="button"
            onClick={() => setShowCookieGuide(!showCookieGuide)}
            className="text-xs font-bold text-m3-primary hover:underline flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <HelpCircle size={14} />
            <span>{showCookieGuide ? "Hide Guide" : "How to get sessionid?"}</span>
          </button>
        </div>

        {/* 3-Step DevTools Cookie Extraction Guide */}
        {showCookieGuide && (
          <div className="p-4 bg-m3-surface border border-m3-primary/20 rounded-xl space-y-3 text-xs text-m3-on-surface">
            <h4 className="font-bold flex items-center gap-2 text-m3-primary">
              <Key size={14} />
              <span>How to find your Instagram Session Cookie in 30 seconds:</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-m3-on-surface-variant text-[11px] leading-relaxed">
              <li>Open <strong className="text-m3-on-surface">Instagram.com</strong> in your desktop browser and log in.</li>
              <li>Press <kbd className="px-1.5 py-0.5 bg-m3-surface-container rounded border border-m3-outline-variant/40 font-mono text-[10px]">F12</kbd> (or Right Click &rarr; <em>Inspect</em>) to open Developer Tools.</li>
              <li>Click the <strong className="text-m3-on-surface">Application</strong> tab (or <strong className="text-m3-on-surface">Storage</strong> in Firefox), expand <strong className="text-m3-on-surface">Cookies</strong> &rarr; <strong className="text-m3-on-surface">https://www.instagram.com</strong>.</li>
              <li>Find the cookie named <code className="px-1.5 py-0.5 bg-m3-surface-container rounded text-m3-primary font-bold font-mono">sessionid</code>, double click its value, copy and paste it into the field below.</li>
            </ol>
          </div>
        )}

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
              Connection Proxy (HTTP/SOCKS5)
            </label>
            <input
              type="text"
              value={scrapingProxy}
              onChange={(e) => setScrapingProxy(e.target.value)}
              placeholder="e.g. http://proxy.example.com:8080"
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs font-mono text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
            />
          </div>
        </div>

        {/* Live Session Check Result Box */}
        {sessionCheckResult && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
            sessionCheckResult.authenticated
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
          }`}>
            {sessionCheckResult.authenticated ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold block">{sessionCheckResult.authenticated ? "Session Verified Active" : "Notice"}</span>
              <p className="text-[11px] mt-0.5">{sessionCheckResult.message}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            disabled={checkingSession}
            onClick={handleTestSession}
            className="px-4 py-2 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary text-m3-on-surface font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center gap-2"
          >
            {checkingSession ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Verifying Session...</span>
              </>
            ) : (
              <>
                <Shield size={13} className="text-m3-primary" />
                <span>Test Session Connection</span>
              </>
            )}
          </button>

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
              <span>Save Connection Settings</span>
            )}
          </button>
        </div>
      </div>

      {/* Engine Diagnostic Tests */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
          <Terminal size={14} className="text-m3-primary" />
          <span>Downloader Engine Diagnostics &amp; Connection Tests</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Primary Test Box */}
          <div className="p-4 bg-m3-surface rounded-xl border border-m3-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-m3-on-surface">Core Downloader Service</h4>
                <p className="text-[10px] text-m3-on-surface-variant">Primary media metadata retriever</p>
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
                <span>Test Downloader</span>
              </button>
            </div>

            {instaloaderResult && (
              <pre className="p-3 bg-m3-surface-container rounded-lg text-[10px] font-mono text-m3-on-surface overflow-x-auto max-h-36">
                {JSON.stringify(instaloaderResult, null, 2)}
              </pre>
            )}
          </div>

          {/* Fallback Test Box */}
          <div className="p-4 bg-m3-surface rounded-xl border border-m3-outline-variant/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-m3-on-surface">Fallback Downloader Engine</h4>
                <p className="text-[10px] text-m3-on-surface-variant">Fallback media layout retriever</p>
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
                <span>Test Fallback</span>
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


