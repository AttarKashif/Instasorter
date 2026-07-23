import { ReactNode, useState, useEffect } from "react";
import {
  LayoutGrid,
  Upload,
  Heart,
  BarChart3,
  Layers,
  User,
  Sun,
  Moon,
  RefreshCw,
  FolderTree,
  Keyboard,
  X,
  Wifi,
  WifiOff,
  Search,
  Image,
  Download,
  Smartphone,
  CheckCircle2,
  CloudDownload,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePostStore } from "../../store/useStore";
import { VOCABULARY } from "../../constants/vocabulary";
import { TelegramQuickPeek } from "../ui/TelegramQuickPeek";
import {
  isWorkerActive,
  registerProgressCallback,
  unregisterProgressCallback,
  offloadPendingToBackgroundServer,
} from "../../lib/thumbnailWorker";

type ViewType = "home" | "analytics" | "settings" | "grouped";

interface ShellProps {
  children: ReactNode;
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
}

export const Shell = ({
  children,
  currentView,
  onNavigate,
  theme,
  onThemeToggle,
}: ShellProps) => {
  const tShell = VOCABULARY.shell;
  const tShortcuts = VOCABULARY.shortcuts;
  const isImporting = usePostStore((state) => state.isImporting);
  const importMessage = usePostStore((state) => state.importMessage);
  const smartCollections = usePostStore((state) => state.smartCollections);
  const activePreviewPost = usePostStore((state) => state.activePreviewPost);
  const setActivePreviewPost = usePostStore((state) => state.setActivePreviewPost);
  const setIsImportModalOpen = usePostStore((state) => state.setIsImportModalOpen);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isInstallable, setIsInstallable] = useState(() => typeof window !== "undefined" && Boolean(window.deferredPrompt));
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handleInstallable = () => setIsInstallable(true);
    const handleInstalled = () => {
      setIsInstallable(false);
      setIsStandalone(true);
    };

    window.addEventListener("app-installable", handleInstallable);
    window.addEventListener("app-installed", handleInstalled);

    if (window.deferredPrompt) {
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener("app-installable", handleInstallable);
      window.removeEventListener("app-installed", handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      const choice = await window.deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstallable(false);
        setIsStandalone(true);
      }
      window.deferredPrompt = null;
    }
  };

  const [workerActive, setWorkerActive] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [initialPending, setInitialPending] = useState(0);
  const posts = usePostStore((state) => state.posts);

  // Update pending counts and active status whenever posts change or on mount/intervals
  useEffect(() => {
    const pending = posts.filter(
      (p) => p.thumbnailStatus === "pending" || !p.thumbnailStatus,
    ).length;
    setPendingCount(pending);

    // If no more pending, reset initialPending
    if (pending === 0) {
      setInitialPending(0);
    } else if (initialPending === 0 || pending > initialPending) {
      // Set or expand initial pending count when a batch starts or grows
      setInitialPending(pending);
    }

    setWorkerActive(isWorkerActive());
  }, [posts, initialPending]);

  // Subscribe to progress notifications from the background worker loop
  useEffect(() => {
    const handleProgress = () => {
      setWorkerActive(isWorkerActive());
    };
    registerProgressCallback(handleProgress);
    handleProgress();
    return () => {
      unregisterProgressCallback();
    };
  }, []);

  const progressPercent = initialPending > 0 
    ? Math.min(100, Math.max(5, ((initialPending - pendingCount) / initialPending) * 100))
    : 0;



  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input, textarea, or contenteditable
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        const contentEditable = activeEl.getAttribute("contenteditable");
        if (
          tag === "input" ||
          tag === "textarea" ||
          contentEditable === "true" ||
          contentEditable === ""
        ) {
          return;
        }
      }

      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      switch (e.key) {
        case "1":
          e.preventDefault();
          onNavigate("home");
          break;
        case "2":
          e.preventDefault();
          onNavigate("analytics");
          break;
        case "3":
          e.preventDefault();
          onNavigate("grouped");
          break;
        case "4":
          e.preventDefault();
          setIsImportModalOpen(true);
          break;
        case "5":
          e.preventDefault();
          onNavigate("settings");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [onNavigate, setIsImportModalOpen]);

  const navItems = [
    {
      id: "home" as const,
      label: tShell.navDashboard,
      icon: LayoutGrid,
      description: "Browse and filter posts",
    },
    {
      id: "grouped" as const,
      label: tShell.smartCollections,
      icon: FolderTree,
      description: "Collections & Creators",
    },
    {
      id: "analytics" as const,
      label: tShell.navAnalytics,
      icon: BarChart3,
      description: "Visual statistics & insights",
    },
    {
      id: "settings" as const,
      label: tShell.navSettings,
      icon: User,
      description: "View profile and settings",
    },
  ];

  const getScreenName = (view: ViewType) => {
    switch (view) {
      case "home":
        return tShell.navDashboard;
      case "grouped":
        return tShell.smartCollections;
      case "analytics":
        return tShell.navAnalytics;
      case "settings":
        return tShell.navSettings;
      default:
        return tShell.navDashboard;
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden text-m3-on-surface flex flex-col md:flex-row font-sans selection:bg-m3-primary-container selection:text-m3-on-primary-container">
      {/* Persistent Global Progress Bar */}
      {workerActive && pendingCount > 0 && (
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-m3-primary/10 z-50 pointer-events-none">
          <motion.div
            className="h-full bg-m3-primary"
            style={{ width: `${progressPercent}%` }}
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
          />
        </div>
      )}

      {/* Mobile Sticky Top Header removed as requested */}

      {/* Material 3 Desktop Navigation Drawer / Rail */}
      <nav className="hidden md:flex md:w-20 lg:w-72 bg-m3-surface border-r border-m3-outline-variant/40 shadow-sm z-10 px-2 lg:px-4 py-8 flex-col justify-between sticky top-0 h-screen shrink-0 transition-all duration-300">
        <div className="flex flex-col gap-8">
          {/* Navigation Items */}
          <div className="flex flex-col gap-1">
            {isImporting && (
              <div className="mx-1 lg:mx-4 my-2 p-3 bg-m3-primary-container/30 rounded-2xl flex items-center justify-center lg:justify-start gap-3 text-xs text-m3-on-primary-container" title={importMessage || "Importing..."}>
                <RefreshCw className="animate-spin shrink-0" size={16} />
                <span className="truncate hidden lg:inline">
                  {importMessage || "Importing..."}
                </span>
              </div>
            )}
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="group relative flex items-center justify-center lg:justify-start gap-4 p-3.5 lg:px-4 lg:py-3.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer text-center lg:text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-m3-primary"
                  title={item.label}
                >
                  {/* M3 Active Indicator Pill */}
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 bg-m3-primary-container rounded-full -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}

                  <Icon
                    size={20}
                    className={`shrink-0 transition-colors duration-200 ${
                      isActive
                        ? "text-m3-on-primary-container stroke-[2.5]"
                        : "text-m3-on-surface-variant group-hover:text-m3-on-surface"
                    }`}
                  />

                  <div className="flex flex-col hidden lg:flex">
                    <span
                      className={`transition-colors duration-200 ${
                        isActive
                          ? "text-m3-on-primary-container font-bold"
                          : "text-m3-on-surface-variant group-hover:text-m3-on-surface"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
            {smartCollections.length > 0 && (
              <div className="mt-4 px-4 hidden lg:block">
                <p className="text-xs font-semibold text-m3-outline mb-2">
                  {tShell.smartCollections}
                </p>
                <div className="flex flex-col gap-1">
                  {smartCollections.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="text-xs text-m3-on-surface-variant px-2 py-1 rounded hover:bg-m3-surface-variant/30 cursor-pointer"
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info & PWA status matching M3's modest branding style */}
        <div className="px-1 lg:px-4 py-3 border-t border-m3-outline-variant/20 flex flex-col gap-2 mt-auto">
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="w-full py-2 px-2 lg:px-3 rounded-2xl bg-m3-primary-container text-m3-on-primary-container hover:bg-m3-primary hover:text-m3-on-primary text-xs font-semibold flex items-center justify-center lg:justify-between transition-all duration-200 cursor-pointer shadow-xs group"
              title="Install Desktop App"
            >
              <div className="flex items-center gap-2">
                <Download size={14} className="group-hover:translate-y-0.5 transition-transform shrink-0" />
                <span className="hidden lg:inline">Install Desktop App</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider opacity-70 font-mono hidden lg:inline">PWA</span>
            </button>
          )}

          {isStandalone && (
            <div className="px-2 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium flex items-center justify-center lg:justify-start gap-2" title="Standalone App Active">
              <CheckCircle2 size={13} className="shrink-0" />
              <span className="hidden lg:inline">Standalone Active</span>
            </div>
          )}

          <p className="text-[11px] font-mono text-m3-outline text-center lg:text-left hidden lg:block">
            {tShell.footerText}
          </p>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative">
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500/10 dark:bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between gap-2 font-medium shrink-0 overflow-hidden select-none z-30"
            >
              <div className="flex items-center gap-2">
                <WifiOff size={14} className="shrink-0 text-amber-500" />
                <span className="leading-tight">
                  You are offline • Working in 100% Local IndexedDB Mode
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-80 uppercase px-2 py-0.5 rounded bg-amber-500/15">
                Offline Ready
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </main>

      {/* Material 3 Bottom Navigation Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-5 left-4 right-4 mx-auto max-w-[420px] h-16 bg-m3-surface-container/85 backdrop-blur-xl border border-m3-outline-variant/30 px-2 flex justify-around items-center z-50 rounded-full shadow-2xl">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center justify-center w-[72px] h-[52px] relative cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-m3-primary z-0"
            >
              {isActive && (
                <motion.div
                  layoutId="active-mobile-nav"
                  className="absolute inset-0 bg-m3-primary-container rounded-[16px] z-0"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {/* Icon Container */}
              <div className="relative z-10 w-14 h-6 flex items-center justify-center mb-0.5">
                <Icon
                  size={20}
                  className={`relative z-10 transition-colors duration-200 ${
                    isActive
                      ? "text-m3-on-primary-container stroke-[2.5]"
                      : "text-m3-on-surface-variant"
                  }`}
                />
              </div>

              {/* Nav Label */}
              <span
                className={`relative z-10 text-[10px] font-medium tracking-tight transition-all duration-200 ${
                  isActive
                    ? "text-m3-on-primary-container font-bold translate-y-0 opacity-100"
                    : "text-m3-on-surface-variant opacity-70"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Keyboard Shortcuts Dialog */}
      <AnimatePresence>
        {isShortcutsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Scrim Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShortcutsOpen(false)}
              className="absolute inset-0 bg-black/55 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="relative w-full max-w-lg bg-m3-surface-low/95 backdrop-blur-3xl text-m3-on-surface rounded-[28px] shadow-glass-lg overflow-hidden border border-m3-outline-variant/30 z-10 flex flex-col max-h-[90vh] md:max-h-[80vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-m3-surface-low border-b border-m3-outline-variant/15 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-m3-primary/10 text-m3-primary flex items-center justify-center">
                    <Keyboard size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display tracking-tight text-m3-on-surface">
                      {tShortcuts.title}
                    </h2>
                    <p className="text-[10px] text-m3-outline font-medium">
                      {tShortcuts.subtitle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShortcutsOpen(false)}
                  className="p-3 sm:p-2 -mr-1.5 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface-variant transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content (scrollable) */}
              <div className="p-6 overflow-y-auto flex flex-col gap-6 select-none">
                {/* Section 1: Navigation */}
                <div>
                  <h3 className="text-xs font-bold text-m3-primary uppercase tracking-wider mb-2.5 font-display">
                    {tShortcuts.globalNav}
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navHome}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        1
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navAnalytics}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        2
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navGrouped}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        3
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navImport}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        4
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navSettings}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        5
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleGuide}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        ?
                      </kbd>
                    </div>
                  </div>
                </div>

                {/* Section 2: Home Grid Actions */}
                <div>
                  <h3 className="text-xs font-bold text-m3-primary uppercase tracking-wider mb-2.5 font-display">
                    {tShortcuts.mainView}
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navFocus}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        Arrows / J / K
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.openDetails}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        Enter / Space
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleStar}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        F
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleArchive}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        A
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleReadLater}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        R
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.copyLink}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        C
                      </kbd>
                    </div>
                  </div>
                </div>

                {/* Section 3: Detail Modal Actions */}
                <div>
                  <h3 className="text-xs font-bold text-m3-primary uppercase tracking-wider mb-2.5 font-display">
                    {tShortcuts.detailSheet}
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.nextPrev}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        Right / Left Arrows
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.closeDetail}
                      </span>
                      <kbd className="px-2 py-0.5 rounded bg-m3-surface-variant text-m3-on-surface font-mono text-[11px] font-bold border border-m3-outline-variant/30 shadow-xs">
                        Escape
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-m3-surface-low border-t border-m3-outline-variant/15 flex justify-end">
                <button
                  onClick={() => setIsShortcutsOpen(false)}
                  className="px-4 py-2 rounded-full bg-m3-primary hover:bg-opacity-90 text-m3-on-primary text-xs font-bold shadow-xs cursor-pointer"
                >
                  {tShortcuts.gotIt}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Peek Modal Overlay */}
      <AnimatePresence>
        {activePreviewPost && (
          <TelegramQuickPeek
            post={activePreviewPost}
            onClose={() => setActivePreviewPost(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
