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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePostStore } from "../../store/useStore";
import { VOCABULARY } from "../../constants/vocabulary";
import { TelegramQuickPeek } from "../ui/TelegramQuickPeek";

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
      {/* Material 3 Desktop Navigation Drawer */}
      <nav className="hidden md:flex w-72 bg-m3-surface border-r border-m3-outline-variant/40 shadow-sm z-10 px-4 py-8 flex-col justify-between sticky top-0 h-screen shrink-0">
        <div className="flex flex-col gap-8">
          {/* App Header branding */}
          <div className="px-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-m3-primary flex items-center justify-center text-m3-on-primary shadow-sm">
                <Layers size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight text-m3-on-surface">
                  {tShell.title}
                </h1>
                <span className="text-[10px] text-m3-outline font-semibold tracking-wider uppercase">
                  {tShell.subtitle}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Online/Offline Connection Status Indicator */}
              <div
                className={`relative group p-2.5 rounded-xl flex items-center justify-center border border-m3-outline-variant/10 shadow-xs transition-all duration-300 ${
                  isOnline
                    ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : "text-amber-500 dark:text-amber-400 bg-amber-500/10 animate-pulse border-amber-500/30"
                }`}
                title={isOnline ? "Online" : "Offline Warning"}
              >
                {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                
                {/* Tooltip */}
                <div className="pointer-events-none absolute top-full right-0 mt-2 w-52 p-2.5 bg-m3-surface-low border border-m3-outline-variant text-[11px] text-m3-on-surface rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-glass-md leading-relaxed text-center font-sans font-medium">
                  {isOnline ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Online</span>
                  ) : (
                    <div>
                      <span className="text-amber-600 dark:text-amber-400 font-bold block mb-0.5">Offline Warning</span>
                      Disconnected. Edits will be saved locally, but might not sync immediately.
                    </div>
                  )}
                </div>
              </div>

              {onThemeToggle && (
                <button
                  onClick={onThemeToggle}
                  className="p-2.5 rounded-xl text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-variant/35 transition-all duration-200 cursor-pointer flex items-center justify-center border border-m3-outline-variant/10 shadow-xs"
                  title={`Switch to ${theme === "light" ? "Dark Room" : "Crisp Studio"}`}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={theme}
                      initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: 90, scale: 0.8, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    >
                      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                    </motion.div>
                  </AnimatePresence>
                </button>
              )}

              <button
                onClick={() => setIsShortcutsOpen(true)}
                className="p-2.5 rounded-xl text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-variant/35 transition-all duration-200 cursor-pointer flex items-center justify-center border border-m3-outline-variant/10 shadow-xs"
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard size={16} />
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-1">
            {isImporting && (
              <div className="mx-4 my-2 p-3 bg-m3-primary-container/30 rounded-2xl flex items-center gap-3 text-xs text-m3-on-primary-container">
                <RefreshCw className="animate-spin" size={16} />
                <span className="truncate">
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
                  className="group relative flex items-center gap-4 px-4 py-3.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-m3-primary"
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
                    className={`transition-colors duration-200 ${
                      isActive
                        ? "text-m3-on-primary-container stroke-[2.5]"
                        : "text-m3-on-surface-variant group-hover:text-m3-on-surface"
                    }`}
                  />

                  <div className="flex flex-col">
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
              <div className="mt-4 px-4">
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

        {/* Footer info matching M3's modest branding style */}
        <div className="px-4 py-2 border-t border-m3-outline-variant/20 flex flex-col gap-1 mt-auto">
          <p className="text-[11px] font-mono text-m3-outline">
            {tShell.footerText}
          </p>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-24 md:pb-0 flex flex-col relative">
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden bg-amber-500/10 dark:bg-amber-500/5 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 font-medium shrink-0 overflow-hidden select-none"
            >
              <WifiOff size={14} className="shrink-0 text-amber-500" />
              <span className="leading-tight">
                Offline. Edits saved locally, but won't sync immediately.
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

      {/* Telegram Quick Peek Modal Overlay */}
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
