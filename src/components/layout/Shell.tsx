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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Folder,
  Database,
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
import { triggerVibration } from "../../lib/vibrate";

type ViewType = "home" | "analytics" | "settings" | "grouped";

const renderKeycaps = (keysText: string) => {
  const parts = keysText.split(" / ");
  return (
    <div className="flex items-center gap-1 select-none shrink-0">
      {parts.map((p, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && <span className="text-[10px] text-m3-outline font-sans font-medium">or</span>}
          <kbd className="font-mono text-[9px] font-black text-m3-on-surface bg-m3-surface border-b-[2.5px] border-x border-t border-m3-outline-variant/80 px-2 py-0.5 rounded-md shadow-xs min-w-[20px] h-[22px] inline-flex items-center justify-center text-center leading-none">
            {p}
          </kbd>
        </span>
      ))}
    </div>
  );
};

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
  const isImportModalOpen = usePostStore((state) => state.isImportModalOpen);
  const setIsImportModalOpen = usePostStore((state) => state.setIsImportModalOpen);
  const searchQuery = usePostStore((state) => state.searchQuery);
  const setSearchQuery = usePostStore((state) => state.setSearchQuery);

  const [selectedGroupInShell, setSelectedGroupInShell] = useState<{
    type: "collection" | "creator" | "creators_folder" | "tag";
    name: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("grouped_selected_group");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const updateGroup = () => {
      try {
        const saved = localStorage.getItem("grouped_selected_group");
        setSelectedGroupInShell(saved ? JSON.parse(saved) : null);
      } catch {
        setSelectedGroupInShell(null);
      }
    };

    window.addEventListener("grouped_selected_group_changed", updateGroup);
    window.addEventListener("storage", updateGroup);
    return () => {
      window.removeEventListener("grouped_selected_group_changed", updateGroup);
      window.removeEventListener("storage", updateGroup);
    };
  }, []);

  const canGoBack = Boolean(
    activePreviewPost ||
      searchQuery ||
      isImportModalOpen ||
      (currentView === "grouped" && selectedGroupInShell) ||
      currentView !== "home"
  );

  const handleGoBack = () => {
    triggerVibration("light");
    if (activePreviewPost) {
      setActivePreviewPost(null);
      return;
    }
    if (searchQuery) {
      setSearchQuery("");
      return;
    }
    if (isImportModalOpen) {
      setIsImportModalOpen(false);
      return;
    }
    if (currentView === "grouped" && selectedGroupInShell) {
      window.dispatchEvent(new CustomEvent("clear_grouped_selected_group"));
      setSelectedGroupInShell(null);
      return;
    }
    if (currentView !== "home") {
      onNavigate("home");
      return;
    }
  };

  const handleNavClick = (view: ViewType) => {
    if (view === "home") {
      triggerVibration("tap");
    } else if (view === "grouped") {
      triggerVibration("medium");
    } else if (view === "analytics") {
      triggerVibration("thud");
    } else if (view === "settings") {
      triggerVibration("double");
    }
    onNavigate(view);
  };

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("isSidebarCollapsed") === "true";
    }
    return false;
  });
  const [hoveredNavId, setHoveredNavId] = useState<string | null>(null);
  const [hoveredMobileNavId, setHoveredMobileNavId] = useState<string | null>(null);
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
          handleNavClick("home");
          break;
        case "2":
          e.preventDefault();
          handleNavClick("analytics");
          break;
        case "3":
          e.preventDefault();
          handleNavClick("grouped");
          break;
        case "4":
          e.preventDefault();
          setIsImportModalOpen(true);
          triggerVibration("light");
          break;
        case "5":
          e.preventDefault();
          handleNavClick("settings");
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

      {/* Material 3 Desktop Navigation Drawer / Rail (Collapsible with smooth Motion Spring) */}
      <motion.nav
        animate={{ width: isSidebarCollapsed ? 84 : 288 }}
        transition={{ type: "spring", stiffness: 280, damping: 25 }}
        className="hidden md:flex bg-m3-surface border-r border-m3-outline-variant/40 shadow-sm z-10 p-4 py-8 flex-col justify-between sticky top-0 h-screen shrink-0 overflow-hidden select-none"
      >
        <div className="flex flex-col gap-6">
          {/* Brand & Collapse Header Toggle */}
          <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"} px-1 h-10`}>
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-xl bg-m3-primary text-m3-on-primary flex items-center justify-center font-display font-black text-xs shadow-xs">
                  IS
                </div>
                <span className="font-display font-bold text-base text-m3-on-surface tracking-tight">
                  Instasorter
                </span>
              </motion.div>
            )}
            
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface-variant cursor-pointer transition-colors active:scale-95"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-1.5">
            {isImporting && (
              <div className={`mx-1 my-2 p-3 bg-m3-primary-container/30 rounded-2xl flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-start"} gap-3 text-xs text-m3-on-primary-container`} title={importMessage || "Importing..."}>
                <RefreshCw className="animate-spin shrink-0 text-m3-primary" size={16} />
                {!isSidebarCollapsed && (
                  <span className="truncate font-sans font-medium">
                    {importMessage || "Importing..."}
                  </span>
                )}
              </div>
            )}
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  onMouseEnter={() => setHoveredNavId(item.id)}
                  onMouseLeave={() => setHoveredNavId(null)}
                  className={`group relative flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-start"} gap-4 p-4 min-h-[48px] rounded-full text-sm font-medium transition-all duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-m3-primary w-full`}
                  title={item.label}
                >
                  {/* Sliding hover pill (KokonutUI Style) */}
                  {hoveredNavId === item.id && !isActive && (
                    <motion.div
                      layoutId="hover-nav-pill"
                      className="absolute inset-0 bg-m3-surface-variant/20 rounded-full -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 26,
                      }}
                    />
                  )}

                  {/* Active Indicator Pill */}
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
                    className={`shrink-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6 ${
                      isActive
                        ? "text-m3-on-primary-container stroke-[2.5]"
                        : "text-m3-on-surface-variant group-hover:text-m3-on-surface"
                    }`}
                  />

                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      className="flex flex-col"
                    >
                      <span
                        className={`transition-colors duration-200 whitespace-nowrap ${
                          isActive
                            ? "text-m3-on-primary-container font-bold font-display"
                            : "text-m3-on-surface-variant group-hover:text-m3-on-surface font-sans"
                        }`}
                      >
                        {item.label}
                      </span>
                    </motion.div>
                  )}
                </button>
              );
            })}

            {!isSidebarCollapsed && smartCollections.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 px-4 hidden lg:block"
              >
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-m3-outline mb-2 font-mono">
                  {tShell.smartCollections}
                </p>
                <div className="flex flex-col gap-1.5">
                  {smartCollections.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className="text-xs font-sans text-m3-on-surface-variant px-2.5 py-1.5 rounded-lg hover:bg-m3-surface-variant/20 cursor-pointer transition-colors"
                    >
                      {c.name}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer info & PWA status matching M3's modest branding style */}
        <div className={`px-1 py-3 border-t border-m3-outline-variant/20 flex flex-col gap-2.5 mt-auto ${isSidebarCollapsed ? "items-center" : ""}`}>
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className={`py-2 px-3 rounded-2xl bg-m3-primary-container text-m3-on-primary-container hover:bg-m3-primary hover:text-m3-on-primary text-xs font-semibold flex items-center justify-center ${isSidebarCollapsed ? "" : "lg:justify-between"} transition-all duration-200 cursor-pointer shadow-xs group w-full`}
              title="Install Desktop App"
            >
              <div className="flex items-center gap-2">
                <Download size={14} className="group-hover:translate-y-0.5 transition-transform shrink-0" />
                {!isSidebarCollapsed && <span className="hidden lg:inline">Install App</span>}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-[9px] uppercase tracking-wider opacity-70 font-mono hidden lg:inline bg-m3-primary/10 px-1.5 py-0.5 rounded-sm">PWA</span>
              )}
            </button>
          )}

          {isStandalone && !isSidebarCollapsed && (
            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium flex items-center justify-center lg:justify-start gap-2" title="Standalone App Active">
              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
              <span className="hidden lg:inline">Standalone Active</span>
            </div>
          )}

          {!isSidebarCollapsed && (
            <p className="text-[10px] font-mono text-m3-outline text-center lg:text-left hidden lg:block leading-relaxed">
              {tShell.footerText}
            </p>
          )}
        </div>
      </motion.nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative pb-20 md:pb-0">
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

        {/* Responsive Breadcrumb Navigation Trail */}
        <header className="bg-m3-surface/90 backdrop-blur-md border-b border-m3-outline-variant/30 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs font-sans select-none z-20 shrink-0 sticky top-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {/* Fast Go Back Button */}
            <AnimatePresence mode="wait">
              {canGoBack && (
                <motion.button
                  key="go-back-btn"
                  initial={{ opacity: 0, scale: 0.9, x: -4 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -4 }}
                  whileHover={{ scale: 1.05, x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGoBack}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-m3-surface-container hover:bg-m3-surface-container-high text-m3-on-surface font-semibold text-xs border border-m3-outline-variant/40 transition-colors shadow-xs cursor-pointer shrink-0"
                  title="Go back to previous level (Back)"
                  aria-label="Go back to previous level"
                >
                  <ChevronLeft size={15} className="text-m3-primary shrink-0" />
                  <span className="hidden sm:inline">Back</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Breadcrumb Trail Nav */}
            <nav aria-label="Breadcrumb navigation" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* Root Level: Dashboard */}
              <button
                onClick={() => {
                  setActivePreviewPost(null);
                  setSearchQuery("");
                  if (currentView === "grouped" && selectedGroupInShell) {
                    window.dispatchEvent(new CustomEvent("clear_grouped_selected_group"));
                    setSelectedGroupInShell(null);
                  }
                  onNavigate("home");
                }}
                className={`flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  currentView === "home" && !activePreviewPost && !searchQuery
                    ? "font-bold font-display text-m3-on-surface"
                    : "text-m3-on-surface-variant hover:text-m3-primary font-medium"
                }`}
                title="Navigate to Dashboard Home"
              >
                <LayoutGrid size={13} className="text-m3-primary shrink-0" />
                <span>Dashboard</span>
              </button>

              {/* View Segment if not home */}
              {currentView !== "home" && (
                <>
                  <ChevronRight size={12} className="text-m3-outline/60 shrink-0" />
                  <button
                    onClick={() => {
                      setActivePreviewPost(null);
                      setSearchQuery("");
                      if (currentView === "grouped" && selectedGroupInShell) {
                        window.dispatchEvent(new CustomEvent("clear_grouped_selected_group"));
                        setSelectedGroupInShell(null);
                      }
                    }}
                    className={`transition-colors shrink-0 ${
                      (currentView === "grouped" && selectedGroupInShell) || activePreviewPost || searchQuery
                        ? "text-m3-on-surface-variant hover:text-m3-primary cursor-pointer font-medium"
                        : "font-bold font-display text-m3-on-surface cursor-default"
                    }`}
                  >
                    {getScreenName(currentView)}
                  </button>
                </>
              )}

              {/* Grouped Folder/Collection Context */}
              {currentView === "grouped" && selectedGroupInShell && (
                <>
                  <ChevronRight size={12} className="text-m3-outline/60 shrink-0" />
                  <span className="font-bold font-display text-m3-primary flex items-center gap-1 truncate max-w-[140px] sm:max-w-[220px]">
                    <Folder size={12} className="shrink-0 text-m3-primary" />
                    <span className="truncate">{selectedGroupInShell.name}</span>
                  </span>
                </>
              )}

              {/* Active Search Context */}
              {searchQuery && (
                <>
                  <ChevronRight size={12} className="text-m3-outline/60 shrink-0" />
                  <span className="inline-flex items-center gap-1 font-semibold text-m3-primary bg-m3-primary/10 px-2 py-0.5 rounded-full border border-m3-primary/20 max-w-[150px] sm:max-w-[220px]">
                    <Search size={11} className="shrink-0 text-m3-primary" />
                    <span className="truncate">"{searchQuery}"</span>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="hover:bg-m3-primary/20 rounded-full p-0.5 transition-colors cursor-pointer ml-0.5"
                      title="Clear search"
                    >
                      <X size={10} />
                    </button>
                  </span>
                </>
              )}

              {/* Active Preview Context */}
              {activePreviewPost && (
                <>
                  <ChevronRight size={12} className="text-m3-outline/60 shrink-0" />
                  <span className="font-bold font-display text-m3-primary flex items-center gap-1 truncate max-w-[140px] sm:max-w-[200px]">
                    <span className="truncate">
                      {activePreviewPost.caption
                        ? activePreviewPost.caption.slice(0, 22) + (activePreviewPost.caption.length > 22 ? "..." : "")
                        : "Post Preview"}
                    </span>
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right Area: Items Count & Keyboard Guide */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-m3-surface-low border border-m3-outline-variant/30 text-[11px] font-mono font-medium text-m3-on-surface-variant">
              <Database size={11} className="text-m3-primary" />
              <span>{posts.length} items</span>
            </span>

            {theme && onThemeToggle && (
              <button
                onClick={onThemeToggle}
                className="p-1.5 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface-variant cursor-pointer transition-colors"
                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            )}

            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="p-1.5 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface-variant cursor-pointer transition-colors"
              title="Keyboard Shortcuts Guide (?)"
            >
              <Keyboard size={15} />
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* Material 3 Bottom Navigation Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-4 right-4 mx-auto max-w-[420px] h-16 bg-m3-surface-container/85 backdrop-blur-xl border border-m3-outline-variant/30 px-2 flex justify-around items-center z-50 rounded-full shadow-2xl">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              onMouseEnter={() => setHoveredMobileNavId(item.id)}
              onMouseLeave={() => setHoveredMobileNavId(null)}
              className="flex flex-col items-center justify-center w-[72px] h-[56px] relative cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-m3-primary z-0"
            >
              {/* Sliding hover backdrop (KokonutUI Style) */}
              {hoveredMobileNavId === item.id && !isActive && (
                <motion.div
                  layoutId="hover-mobile-nav"
                  className="absolute inset-0 bg-m3-surface-variant/30 rounded-[16px] -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                />
              )}

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
                      {renderKeycaps("1")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navAnalytics}
                      </span>
                      {renderKeycaps("2")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navGrouped}
                      </span>
                      {renderKeycaps("3")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navImport}
                      </span>
                      {renderKeycaps("4")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.navSettings}
                      </span>
                      {renderKeycaps("5")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleGuide}
                      </span>
                      {renderKeycaps("?")}
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
                      {renderKeycaps("Arrows / J / K")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.openDetails}
                      </span>
                      {renderKeycaps("Enter / Space")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleStar}
                      </span>
                      {renderKeycaps("F")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleArchive}
                      </span>
                      {renderKeycaps("A")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.toggleReadLater}
                      </span>
                      {renderKeycaps("R")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.copyLink}
                      </span>
                      {renderKeycaps("C")}
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
                      {renderKeycaps("Right Arrow / Left Arrow")}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-m3-surface-variant/15 border border-m3-outline-variant/5">
                      <span className="text-xs font-medium text-m3-on-surface-variant">
                        {tShortcuts.closeDetail}
                      </span>
                      {renderKeycaps("Escape")}
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
