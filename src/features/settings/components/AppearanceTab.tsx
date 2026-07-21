import React, { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  ToggleLeft,
  ToggleRight,
  Download,
  Laptop,
  Smartphone,
  CheckCircle2,
  Share,
  PlusSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AppearanceTabProps {
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = React.memo(({
  theme = "light",
  onThemeToggle,
  animationsEnabled,
  setAnimationsEnabled,
  compactMode,
  setCompactMode,
}) => {
  const [isStandalone, setIsStandalone] = useState(() => {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  });
  const [isInstallable, setIsInstallable] = useState(() => !!window.deferredPrompt);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);

  useEffect(() => {
    const handleInstallable = () => {
      setIsInstallable(true);
    };
    const handleInstalled = () => {
      setIsInstallable(false);
      setIsStandalone(true);
    };

    window.addEventListener("app-installable", handleInstallable);
    window.addEventListener("app-installed", handleInstalled);

    // Periodically poll window.deferredPrompt as well in case it was set early
    const interval = setInterval(() => {
      if (window.deferredPrompt) {
        setIsInstallable(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener("app-installable", handleInstallable);
      window.removeEventListener("app-installed", handleInstalled);
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = window.deferredPrompt;
    if (!promptEvent) return;

    // Show the install prompt
    promptEvent.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again
    window.deferredPrompt = null;
    setIsInstallable(false);
  };

  return (
    <div className="space-y-6">
      {/* Theme and Preferences Block */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-m3-outline-variant/10">
          <h3 className="text-sm font-bold font-display text-m3-on-surface">Custom Appearance</h3>
          <p className="text-xs text-m3-on-surface-variant mt-0.5">Control the design theme and responsive features of your feed catalog.</p>
        </div>
        
        <div className="divide-y divide-m3-outline-variant/10">
          {/* Theme Toggle */}
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-m3-surface-variant/5 transition-colors">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-m3-on-surface">Color Palette &amp; Mode</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-normal max-w-md">Toggle between a crisp studio white gallery look or a dimmed dark room layout.</p>
            </div>
            <div className="shrink-0 flex items-center bg-m3-surface-container rounded-xl p-1 border border-m3-outline-variant/20 shadow-xs relative overflow-hidden min-w-[170px] sm:min-w-[190px]">
              {/* Sliding active pill indicator */}
              <div className="absolute inset-y-1 left-1 right-1 pointer-events-none select-none">
                <motion.div
                  className="h-full bg-m3-surface rounded-lg border border-m3-outline-variant/30 shadow-xs"
                  layout
                  animate={{
                    x: theme === "light" ? "0%" : "100%",
                    width: "calc(50% - 4px)",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 28,
                  }}
                />
              </div>

              <button
                onClick={() => onThemeToggle && theme === "dark" && onThemeToggle()}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 cursor-pointer ${
                  theme === "light"
                    ? "text-m3-primary font-extrabold"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                <motion.div
                  animate={{ rotate: theme === "light" ? 0 : -45 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Sun size={14} className={theme === "light" ? "text-m3-primary" : ""} />
                </motion.div>
                <span>Light</span>
              </button>
              
              <button
                onClick={() => onThemeToggle && theme === "light" && onThemeToggle()}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 cursor-pointer ${
                  theme === "dark"
                    ? "text-m3-primary font-extrabold"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                <motion.div
                  animate={{ rotate: theme === "dark" ? 0 : 45 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Moon size={14} className={theme === "dark" ? "text-m3-primary" : ""} />
                </motion.div>
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Interface Animations */}
          <div className="p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-m3-surface-variant/5 transition-colors">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-m3-on-surface">Fluid Interface Animations</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-normal max-w-md">Enable hardware-accelerated motion sweeps and fade-ins for cards and navigations.</p>
            </div>
            <button
              onClick={() => setAnimationsEnabled(!animationsEnabled)}
              className={`shrink-0 transition-colors cursor-pointer ${animationsEnabled ? "text-m3-primary" : "text-m3-outline"} active:scale-95`}
            >
              {animationsEnabled ? (
                <ToggleRight size={36} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>

          {/* Compact List View */}
          <div className="p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-m3-surface-variant/5 transition-colors">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-m3-on-surface">Compact Catalog Layout</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-normal max-w-md">Optimize space in search tables by packing row items and details into dense lists.</p>
            </div>
            <button
              onClick={() => setCompactMode(!compactMode)}
              className={`shrink-0 transition-colors cursor-pointer ${compactMode ? "text-m3-primary" : "text-m3-outline"} active:scale-95`}
            >
              {compactMode ? (
                <ToggleRight size={36} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* PWA Standalone Installation Card */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-m3-outline-variant/10">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold font-display text-m3-on-surface">Standalone Desktop &amp; Mobile App</h3>
            <span className="bg-m3-primary-container text-m3-on-primary-container text-[9px] font-bold px-2 py-0.5 rounded-full font-mono">
              PWA Support
            </span>
          </div>
          <p className="text-xs text-m3-on-surface-variant mt-0.5">
            Install Instasorter directly to your home screen or desktop dock for the ultimate offline focus.
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {isStandalone ? (
            /* STATE 1: ALREADY INSTALLED AND RUNNING STANDALONE */
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="animate-pulse" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-xs font-bold text-m3-on-surface">Instasorter Standalone Mode Active</h4>
                <p className="text-[11px] text-m3-on-surface-variant leading-relaxed">
                  You are currently running the application within its native window cage. Enjoy the faster indexing speed, dedicated browser isolation, and standard keyboard shortcuts.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>✓ OFFLINE DATABASE ACTIVE</span>
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span>✓ LAUNCHER CACHED</span>
                </div>
              </div>
            </div>
          ) : isInstallable ? (
            /* STATE 2: READY FOR ONE-CLICK BROWSER INSTALLATION */
            <div className="space-y-4">
              <div className="bg-m3-primary/5 border border-m3-primary/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-m3-primary/10 text-m3-primary flex items-center justify-center shrink-0">
                    <Laptop size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-m3-on-surface">Ready for Native Installation</h4>
                    <p className="text-[11px] text-m3-on-surface-variant leading-relaxed max-w-md">
                      Instasorter can be installed as a local app with its own dedicated launch icon, full-screen viewport, window menu bars, and clean task isolation.
                    </p>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInstallClick}
                  className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-m3-primary text-m3-on-primary rounded-xl text-xs font-bold hover:shadow-md cursor-pointer transition-all font-sans"
                >
                  <Download size={14} className="stroke-[2.5]" />
                  <span>Install Instasorter</span>
                </motion.button>
              </div>

              {/* Benefits list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1.5">
                <div className="p-3.5 rounded-xl border border-m3-outline-variant/20 bg-m3-surface-container/30 flex items-start gap-2.5">
                  <Sparkles size={14} className="text-m3-primary mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[10.5px] font-bold text-m3-on-surface">Window Freedom</h5>
                    <p className="text-[10px] text-m3-on-surface-variant mt-0.5 leading-normal">Launches in a clean distraction-free window without tabs.</p>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-m3-outline-variant/20 bg-m3-surface-container/30 flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-m3-primary mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[10.5px] font-bold text-m3-on-surface">Offline-First Engine</h5>
                    <p className="text-[10px] text-m3-on-surface-variant mt-0.5 leading-normal">Load and query your entire library instantenously without internet.</p>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-m3-outline-variant/20 bg-m3-surface-container/30 flex items-start gap-2.5">
                  <HelpCircle size={14} className="text-m3-primary mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[10.5px] font-bold text-m3-on-surface">Native Shortcuts</h5>
                    <p className="text-[10px] text-m3-on-surface-variant mt-0.5 leading-normal">Enjoy clean system-level shortcuts, multitasking and window focus.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STATE 3: MANIFEST DEPLOYED BUT BROWSERS LIMITS OR NOT DIRECTLY TRIGGERABLE */
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-m3-outline-variant/30 bg-m3-surface-container/20 text-xs text-m3-on-surface-variant font-sans leading-relaxed">
                If your browser does not trigger an install prompt automatically, you can always pin or install the app manually. Instasorter is fully PWA compliant and registered. Follow the guides below.
              </div>

              {/* Manual Installation Guides Accordions */}
              <div className="space-y-2.5">
                {/* iOS Guide */}
                <div className="border border-m3-outline-variant/20 rounded-xl overflow-hidden bg-m3-surface-container/20 font-sans">
                  <button
                    onClick={() => setShowIOSInstructions(!showIOSInstructions)}
                    className="w-full flex items-center justify-between p-3 text-xs font-bold text-m3-on-surface hover:bg-m3-surface-variant/10 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone size={14} className="text-m3-outline" />
                      <span>Apple iOS / iPadOS Curation (Safari)</span>
                    </div>
                    {showIOSInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <AnimatePresence>
                    {showIOSInstructions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-m3-outline-variant/10 bg-m3-surface-low p-4 text-[11px] text-m3-on-surface-variant space-y-2.5"
                      >
                        <p className="leading-relaxed">To add Instasorter to your iPhone or iPad home screen for immersive, native-like cataloging:</p>
                        <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed font-semibold">
                          <li>Open this page inside the native <span className="text-m3-on-surface font-bold">Safari browser</span> on your Apple device.</li>
                          <li>
                            Tap the <span className="text-m3-on-surface font-bold inline-flex items-center gap-1 bg-m3-surface-container/50 px-1.5 py-0.5 rounded"><Share size={10} /> Share</span> action button in Safari’s navigation rail.
                          </li>
                          <li>
                            Scroll down the options list and select <span className="text-m3-on-surface font-bold inline-flex items-center gap-1 bg-m3-surface-container/50 px-1.5 py-0.5 rounded"><PlusSquare size={10} /> Add to Home Screen</span>.
                          </li>
                          <li>Confirm by clicking "Add" at the top right. An elegant Instasorter icon will pin instantly next to your apps!</li>
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Android & Google Chrome Desktop Guide */}
                <div className="border border-m3-outline-variant/20 rounded-xl overflow-hidden bg-m3-surface-container/20 font-sans">
                  <button
                    onClick={() => setShowAndroidInstructions(!showAndroidInstructions)}
                    className="w-full flex items-center justify-between p-3 text-xs font-bold text-m3-on-surface hover:bg-m3-surface-variant/10 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      <Laptop size={14} className="text-m3-outline" />
                      <span>Android &amp; Desktop Browser Guide (Chrome/Edge/Firefox)</span>
                    </div>
                    {showAndroidInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <AnimatePresence>
                    {showAndroidInstructions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-m3-outline-variant/10 bg-m3-surface-low p-4 text-[11px] text-m3-on-surface-variant space-y-2.5"
                      >
                        <p className="leading-relaxed">If you missed the prompt or prefer manual configuration in Google Chrome, Brave, Edge, or Firefox:</p>
                        <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed font-semibold">
                          <li>Look closely at the browser's URL address bar at the top right.</li>
                          <li>
                            You should see a small <span className="text-m3-on-surface font-bold">Monitor/Download</span> icon, or click the <span className="text-m3-on-surface font-bold">"..." / "⋮"</span> menu button.
                          </li>
                          <li>
                            Select <span className="text-m3-on-surface font-bold">"Install Instasorter..."</span> or <span className="text-m3-on-surface font-bold">"Add to Phone" / "Install App"</span>.
                          </li>
                          <li>Confirm the installation prompt to add the program to your desktop dock, application drawer, or home screen.</li>
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
