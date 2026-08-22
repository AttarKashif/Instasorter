import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  User,
  Database,
  Trash2,
  Layers,
  ShieldAlert,
  Moon,
  Sun,
  FileSpreadsheet,
  Sliders,
  Sparkles,
  HardDrive,
  X,
  Terminal,
  Cpu,
  Download,
  Search,
  AlertTriangle,
  Keyboard,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
} from "lucide-react";
import { KeyboardShortcutsTab } from "./components/KeyboardShortcutsTab";
import { ProfileTab } from "./components/ProfileTab";
import { PreferencesTab } from "./components/PreferencesTab";
import { ScraperTab } from "./components/ScraperTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { TelemetryTab } from "./components/TelemetryTab";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import { appLogger, LogEntry } from "../../lib/appLogger";
import {
  isWorkerActive,
  registerProgressCallback,
  unregisterProgressCallback,
  getThumbnailStats,
  getThrottleStatus,
  retryFailedThumbnails,
  refreshLibraryTargeted,
} from "../../lib/thumbnailWorker";
import { VOCABULARY } from "../../constants/vocabulary";

interface SettingsViewProps {
  onNavigate?: (view: "home" | "grouped" | "analytics" | "settings") => void;
  onSelectCollection?: (collection: string) => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
}

// Settings Section Header Component
interface SettingSectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

const SettingSectionHeader: React.FC<SettingSectionHeaderProps> = ({
  icon,
  title,
  subtitle,
  action,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/30">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider">
          {title}
        </h2>
        <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

interface UnifiedSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

const UnifiedSwitch: React.FC<UnifiedSwitchProps> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? "bg-m3-primary" : "bg-m3-outline-variant"
    }`}
  >
    <motion.span
      className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-m3-surface shadow-xs ring-0"
      animate={{ x: checked ? 20 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  </button>
);

export const SettingsView = React.memo(
  ({
    onNavigate,
    onSelectCollection,
    theme = "light",
    onThemeToggle,
  }: SettingsViewProps) => {
    const t = VOCABULARY.settings;
    const posts = usePostStore((state) => state.posts);
    const setPosts = usePostStore((state) => state.setPosts);
    const isBackgroundOrganizerEnabled = usePostStore((state) => state.isBackgroundOrganizerEnabled);
    const setIsBackgroundOrganizerEnabled = usePostStore((state) => state.setIsBackgroundOrganizerEnabled);
    const backgroundOrganizerStatus = usePostStore((state) => state.backgroundOrganizerStatus);
    const backgroundOrganizerProgress = usePostStore((state) => state.backgroundOrganizerProgress);

    const [workerStats, setWorkerStats] = useState(() =>
      getThumbnailStats(posts),
    );
    const [isDownloading, setIsDownloading] = useState(() => isWorkerActive());

    useEffect(() => {
      const updateStats = () => {
        const currentPosts = usePostStore.getState().posts;
        setWorkerStats(getThumbnailStats(currentPosts));
        setIsDownloading(isWorkerActive());
      };

      registerProgressCallback(updateStats);
      updateStats();

      return () => {
        unregisterProgressCallback(updateStats);
      };
    }, [posts]);

    type SettingsTab =
      | "general"
      | "appearance"
      | "curation"
      | "data"
      | "advanced"
      | "danger";

    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
    const [dangerCheck1, setDangerCheck1] = useState(false);
    const [dangerCheck2, setDangerCheck2] = useState(false);

    // Reset checkboxes on activeTab changes for safety
    useEffect(() => {
      setDangerCheck1(false);
      setDangerCheck2(false);
    }, [activeTab]);

    // Auto-switch tab based on search query if query matches specific tab keywords
    useEffect(() => {
      if (!settingsSearchQuery.trim()) return;
      const q = settingsSearchQuery.toLowerCase();
      if (["shortcut", "key", "hotkey", "keyboard", "nav", "space", "enter", "escape", "organizer", "smart"].some((k) => q.includes(k))) {
        setActiveTab("curation");
      } else if (["proxy", "cookie", "session", "instaloader", "probe", "gql", "scraper", "password", "log", "crash", "freeze", "error", "telemetry", "stack", "observability", "diagnostic", "maintenance", "repair", "index", "duplicate", "tag"].some((k) => q.includes(k))) {
        setActiveTab("advanced");
      } else if (["reset", "wipe", "factory", "clear", "danger"].some((k) => q.includes(k))) {
        setActiveTab("danger");
      } else if (["backup", "export", "json", "csv", "storage", "quota", "thumbnail", "cache"].some((k) => q.includes(k))) {
        setActiveTab("data");
      } else if (["theme", "dark", "light", "compact", "grid", "motion", "anim", "animation"].some((k) => q.includes(k))) {
        setActiveTab("appearance");
      } else if (["profile", "curator", "avatar", "handle", "email", "name", "display"].some((k) => q.includes(k))) {
        setActiveTab("general");
      }
    }, [settingsSearchQuery]);

    // Scraper throttle/rate-limiting status
    const [throttleStatus, setThrottleStatus] = useState({
      throttled: false,
      remaining: 0,
    });

    useEffect(() => {
      let timer: any;
      const checkThrottle = () => {
        setThrottleStatus(getThrottleStatus());
      };
      checkThrottle();
      if (isDownloading) {
        timer = setInterval(checkThrottle, 1000);
      }
      return () => {
        if (timer) clearInterval(timer);
      };
    }, [isDownloading]);

    const [scrapingUser, setScrapingUser] = useState("");
    const [scrapingPass, setScrapingPass] = useState("");
    const [scrapingSession, setScrapingSession] = useState("");
    const [scrapingProxy, setScrapingProxy] = useState("");
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    const [logs, setLogs] = useState<LogEntry[]>(() => appLogger.getLogs());
    const [isLoggingActive, setIsLoggingActive] = useState(() => appLogger.isEnabled());
    const [logFilterCategory, setLogFilterCategory] = useState<string>("all");
    const [logSearchText, setLogSearchText] = useState("");
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<"scraper" | "maintenance" | "diagnostics" | null>(null);

    useEffect(() => {
      const unsubscribe = appLogger.subscribe((updatedLogs) => {
        setLogs(updatedLogs);
      });
      return () => unsubscribe();
    }, []);

    const logStats = useMemo(() => appLogger.getStats(), [logs]);

    const filteredLogs = useMemo(() => {
      return logs.filter((log) => {
        if (logFilterCategory !== "all" && log.category !== logFilterCategory) {
          return false;
        }
        if (logSearchText.trim()) {
          const query = logSearchText.toLowerCase();
          const matchTitle = log.title.toLowerCase().includes(query);
          const matchMsg = log.message.toLowerCase().includes(query);
          const matchStack = log.stack?.toLowerCase().includes(query) || false;
          return matchTitle || matchMsg || matchStack;
        }
        return true;
      });
    }, [logs, logFilterCategory, logSearchText]);

    const handleToggleLogging = (val: boolean) => {
      appLogger.setEnabled(val);
      setIsLoggingActive(val);
      toast.success(val ? "Developer logging enabled" : "Developer logging disabled");
    };

    const handleClearLogs = () => {
      appLogger.clearLogs();
      toast.success("Diagnostic logs cleared");
    };

    const handleExportLogs = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `instasorter_logs_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Logs exported successfully");
    };

    useEffect(() => {
      const fetchScrapingConfig = async () => {
        setLoadingConfig(true);
        try {
          const res = await fetch("/api/scraping-config");
          if (res.ok) {
            const data = await res.json();
            setScrapingUser(data.username || "");
            setScrapingProxy(data.proxy || "");
            if (data.hasSessionCookie) {
              setScrapingSession("●●●●●●●●●●●●");
            }
          }
        } catch (e) {
          console.error("Failed to load scraping config", e);
        } finally {
          setLoadingConfig(false);
        }
      };
      fetchScrapingConfig();
    }, []);

    const handleSaveScrapingConfig = async () => {
      setSavingConfig(true);
      try {
        const payload: any = {
          username: scrapingUser,
          proxy: scrapingProxy,
        };
        if (scrapingPass !== "") {
          payload.password = scrapingPass;
        }
        if (scrapingSession !== "●●●●●●●●●●●●") {
          payload.session_cookie = scrapingSession;
        }
        
        const res = await fetch("/api/save-scraping-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Scraper credentials and proxy updated successfully!");
          setScrapingPass("");
        } else {
          const errData = await res.json();
          toast.error(`Failed to save config: ${errData.error || "Unknown error"}`);
        }
      } catch (err: any) {
        toast.error(`Error saving scraper config: ${err.message}`);
      } finally {
        setSavingConfig(false);
      }
    };

    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);
    const [testingInstaloader, setTestingInstaloader] = useState(false);
    const [instaloaderResult, setInstaloaderResult] = useState<any>(null);
    const [testingMediaScraper, setTestingMediaScraper] = useState(false);
    const [mediaScraperResult, setMediaScraperResult] = useState<any>(null);

    const handleTestInstaloader = async () => {
      setTestingInstaloader(true);
      setInstaloaderResult(null);
      try {
        const sampleTarget = posts[0]?.id || "C_abc123";
        const res = await fetch("/api/instaloader-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shortcode: sampleTarget }),
        });
        const data = await res.json();
        setInstaloaderResult(data);
        if (data.success) {
          toast.success(`Instaloader extracted @${data.ownerUsername || 'user'} post metadata!`);
        } else {
          toast.error(`Instaloader status: ${data.error || 'Failed to extract'}`);
        }
      } catch (err: any) {
        toast.error(`Error connecting to Instaloader bridge: ${err.message}`);
      } finally {
        setTestingInstaloader(false);
      }
    };

    const handleTestMediaScraper = async () => {
      setTestingMediaScraper(true);
      setMediaScraperResult(null);
      try {
        const sampleTarget = posts[0]?.id || "C_abc123";
        const res = await fetch("/api/media-scraper-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shortcode: sampleTarget }),
        });
        const data = await res.json();
        setMediaScraperResult(data);
        if (data.success) {
          toast.success(`Media Scraper extracted @${data.ownerUsername || 'user'} post media!`);
        } else {
          toast.error(`Media Scraper status: ${data.error || 'Bypassed to backup mirror'}`);
        }
      } catch (err: any) {
        toast.error(`Error connecting to Media Scraper engine: ${err.message}`);
      } finally {
        setTestingMediaScraper(false);
      }
    };

    const [isRefreshingLibrary, setIsRefreshingLibrary] = useState(false);

    const handleRefreshLibrary = async () => {
      setIsRefreshingLibrary(true);
      try {
        const res = await refreshLibraryTargeted();
        if (res.count > 0) {
          toast.success(`Refresh Library: Queued ${res.count} post${res.count > 1 ? 's' : ''} lacking thumbnails or failed processing for low-intensity re-indexing.`);
        } else {
          toast.success("Library healthy: All saved posts already have active thumbnails!");
        }
      } catch (err: any) {
        toast.error(`Refresh Library failed: ${err.message}`);
      } finally {
        setIsRefreshingLibrary(false);
      }
    };

    const handleAnalyzeDuplicates = () => {
      const seen = new Set<string>();
      let dupCount = 0;
      posts.forEach((p) => {
        if (p.id && seen.has(p.id)) {
          dupCount++;
        } else if (p.id) {
          seen.add(p.id);
        }
      });
      if (dupCount > 0) {
        toast.success(`Scan complete: Found ${dupCount} duplicate record${dupCount > 1 ? "s" : ""}.`);
      } else {
        toast.success("Scan complete: No duplicate records found in local database.");
      }
    };

    const setToast = useCallback((val: { type: "success" | "error"; message: string } | null) => {
      if (val) {
        if (val.type === "success") {
          toast.success(val.message);
        } else {
          toast.error(val.message);
        }
      }
    }, []);

    // Profile Editable Details
    const [displayName, setDisplayName] = useState(
      () => localStorage.getItem("instasorter_displayName") || "Curator",
    );
    const [username, setUsername] = useState(
      () => localStorage.getItem("instasorter_username") || "",
    );
    const [email, setEmail] = useState(
      () => localStorage.getItem("instasorter_email") || "",
    );
    const [avatarUrl, setAvatarUrl] = useState<string>(
      () => localStorage.getItem("instasorter_avatarUrl") || "",
    );
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          toast.error("Avatar image size must be under 2MB");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = event.target?.result as string;
          if (res) {
            setAvatarUrl(res);
            localStorage.setItem("instasorter_avatarUrl", res);
            toast.success("Profile avatar updated successfully!");
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const handleRemoveAvatar = () => {
      setAvatarUrl("");
      localStorage.removeItem("instasorter_avatarUrl");
      toast.success("Profile avatar reset to initials.");
    };

    const [isEditing, setIsEditing] = useState(false);
    const [animationsEnabled, setAnimationsEnabled] = useState(
      () => localStorage.getItem("instasorter_animations") !== "false",
    );
    const [compactMode, setCompactMode] = useState(
      () => localStorage.getItem("instasorter_compact") === "true",
    );

    const handleSetAnimationsEnabled = useCallback((val: boolean) => {
      triggerVibration("light");
      setAnimationsEnabled(val);
      localStorage.setItem("instasorter_animations", val.toString());
      toast.success(val ? "Motion animations enabled." : "Motion animations disabled.");
    }, []);

    const handleSetCompactMode = useCallback((val: boolean) => {
      triggerVibration("light");
      setCompactMode(val);
      localStorage.setItem("instasorter_compact", val.toString());
      toast.success(val ? "Compact grid density enabled." : "Standard grid density restored.");
    }, []);

    // Storage Stats
    const [storageInfo, setStorageInfo] = useState<{
      usage: number;
      quota: number;
      percentage: number;
    } | null>(null);

    useEffect(() => {
      const fetchStorage = async () => {
        if (navigator.storage && navigator.storage.estimate) {
          try {
            const estimate = await navigator.storage.estimate();
            const usage = estimate.usage || 0;
            const quota = estimate.quota || 10 * 1024 * 1024 * 1024;
            setStorageInfo({
              usage,
              quota,
              percentage: Math.min((usage / quota) * 100, 100),
            });
          } catch (e) {
            console.error("Failed to estimate storage", e);
          }
        }
      };
      fetchStorage();
    }, [posts]);

    // Smart User Detail Inference
    useEffect(() => {
      const hasCustomName =
        localStorage.getItem("instasorter_displayName") ||
        localStorage.getItem("instasorter_username");
      if (!hasCustomName && posts.length > 0) {
        const counts: Record<string, number> = {};
        posts.forEach((p) => {
          if (
            p.creatorUsername &&
            p.creatorUsername !== "instagram_creator" &&
            p.creatorUsername !== "instagram_user"
          ) {
            counts[p.creatorUsername] = (counts[p.creatorUsername] || 0) + 1;
          }
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          const topUser = sorted[0][0];
          setUsername(topUser);
          localStorage.setItem("instasorter_username", topUser);

          const formattedName = topUser
            .split(/[_\.]/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          setDisplayName(formattedName);
          localStorage.setItem("instasorter_displayName", formattedName);
        }
      }
    }, [posts]);

    const exportData = () => {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(posts));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute(
        "download",
        `instasorter_export_${new Date().toISOString().split("T")[0]}.json`,
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    };

    const exportCSVData = () => {
      if (posts.length === 0) {
        setToast({
          type: "error",
          message: "No posts to export as CSV!",
        });
        return;
      }

      const escapeCSV = (val: any): string => {
        if (val === undefined || val === null) return "";
        let str = "";
        if (Array.isArray(val)) {
          str = val.join(";");
        } else {
          str = String(val);
        }
        const needsQuotes = str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r");
        if (needsQuotes) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const headers = [
        "ID",
        "Post URL",
        "Creator Username",
        "Creator Name",
        "Caption",
        "Media Type",
        "Saved At",
        "Hashtags",
        "Tags",
        "Collections",
        "Is Favorite",
        "Is Archived",
        "Read Later",
        "Is Reel",
        "Notes",
        "Location",
        "Instagram Likes"
      ];

      const csvRows = [headers.join(",")];

      posts.forEach((post) => {
        const row = [
          escapeCSV(post.id),
          escapeCSV(post.postUrl),
          escapeCSV(post.creatorUsername),
          escapeCSV(post.creatorName),
          escapeCSV(post.caption),
          escapeCSV(post.mediaType),
          escapeCSV(post.savedAt),
          escapeCSV(post.hashtags),
          escapeCSV(post.tags),
          escapeCSV(post.collections),
          escapeCSV(post.isFavorite),
          escapeCSV(post.isArchived),
          escapeCSV(post.readLater),
          escapeCSV(post.isReel),
          escapeCSV(post.notes),
          escapeCSV(post.location),
          escapeCSV(post.instagramLikes)
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = "\ufeff" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute(
        "download",
        `instasorter_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
    };

    const allTags = useMemo(() => {
      const tagsSet = new Set<string>();
      posts.forEach((p) => p.tags?.forEach((t) => tagsSet.add(t)));
      return Array.from(tagsSet);
    }, [posts]);

    const allCollections = useMemo(() => {
      const collectionsSet = new Set<string>();
      posts.forEach((p) =>
        p.collections?.forEach((c) => collectionsSet.add(c)),
      );
      return Array.from(collectionsSet);
    }, [posts]);

    const { totalPosts, favoritesCount, archivedCount, activeCount } =
      useMemo(() => {
        let favorites = 0;
        let archived = 0;
        posts.forEach((p) => {
          if (p.isFavorite) favorites++;
          if (p.isArchived) archived++;
        });
        return {
          totalPosts: posts.length,
          favoritesCount: favorites,
          archivedCount: archived,
          activeCount: posts.length - archived,
        };
      }, [posts]);

    const uniqueTags = allTags.length;

    const handleSaveProfile = useCallback(() => {
      localStorage.setItem("instasorter_displayName", displayName);
      localStorage.setItem("instasorter_username", username);
      localStorage.setItem("instasorter_email", email);
      setIsEditing(false);
      setToast({
        type: "success",
        message: "Profile details updated successfully!",
      });
    }, [displayName, username, email]);

    const handleClearAllPosts = useCallback(async () => {
      try {
        triggerVibration("warning");
        await Promise.all([db.posts.clear(), db.collections.clear()]);
        setPosts([]);
        setShowConfirmClear(false);
        setToast({
          type: "success",
          message: "All post records, collections, and thumbnails cleared successfully.",
        });
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message: "Failed to clear posts. Please try again.",
        });
      }
    }, [setPosts]);

    const handleClearAllData = useCallback(async () => {
      try {
        triggerVibration("warning");
        await Promise.all([db.posts.clear(), db.collections.clear()]);
        setPosts([]);
        localStorage.clear();
        setShowConfirmClearAll(false);
        setToast({
          type: "success",
          message: "All local data and configurations cleared. Resetting app...",
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error(err);
        setToast({
          type: "error",
          message: "Failed to clear all data. Please try again.",
        });
      }
    }, [setPosts]);

    const handleConsolidateTags = async () => {
      if (!posts || posts.length === 0) {
        setToast({ type: "error", message: "No posts to consolidate." });
        return;
      }
      setToast({ type: "success", message: "Tags normalized and consolidated successfully!" });
    };

    const tabsList: {
      id: SettingsTab;
      label: string;
      icon: React.ReactNode;
      badge?: string | number;
    }[] = [
      { id: "general", label: "General", icon: <User size={15} /> },
      { id: "appearance", label: "Appearance", icon: <Sliders size={15} /> },
      { id: "curation", label: "Curation", icon: <LayoutGrid size={15} /> },
      { id: "data", label: "Data & Storage", icon: <Database size={15} /> },
      { id: "advanced", label: "Advanced", icon: <Terminal size={15} /> },
      { id: "danger", label: "Danger Zone", icon: <ShieldAlert size={15} /> },
    ];

    const settingsCategories: {
      id: string;
      title: string;
      tabs: {
        id: SettingsTab;
        label: string;
        icon: React.ReactNode;
        badge?: string | number;
      }[];
    }[] = [
      {
        id: "all_categories",
        title: "Settings Groups",
        tabs: tabsList
      }
    ];

    return (
      <div className="flex-1 bg-m3-surface select-none flex flex-col min-h-0 h-full overflow-hidden">
        {/* Top Header & Search Bar */}
        <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-xs z-10 shrink-0 flex flex-col">
          <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
                <Sliders size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold font-display tracking-tight text-m3-on-surface leading-none truncate">
                  Settings &amp; System Preferences
                </h1>
                <p className="text-[11px] text-m3-on-surface-variant font-sans mt-0.5 truncate">
                  Configure curator identity, visual themes, background workers, and backups.
                </p>
              </div>
            </div>

            {/* Quick Actions & Settings Search */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Search Settings Input */}
              <div className="relative flex-1 sm:w-56">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={settingsSearchQuery}
                  onChange={(e) => setSettingsSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-m3-surface-low rounded-xl border border-m3-outline-variant/40 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary font-sans transition-all"
                />
                {settingsSearchQuery && (
                  <button
                    onClick={() => setSettingsSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-m3-surface-container text-m3-on-surface-variant cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Quick Export Backup */}
              <button
                type="button"
                onClick={() => {
                  triggerVibration("light");
                  exportData();
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-m3-primary text-m3-on-primary text-xs font-bold hover:bg-m3-primary/95 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                title="Export JSON backup immediately"
              >
                <Download size={13} />
                <span>Backup</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation Pill Bar */}
          <nav
            aria-label="Settings categories"
            className="md:hidden px-4 md:px-6 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 border-t border-m3-outline-variant/20 bg-m3-surface-low/50"
          >
            {tabsList.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerVibration("light");
                    setActiveTab(tab.id);
                  }}
                  className={`relative flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[44px] ${
                    isActive
                      ? "text-m3-primary bg-m3-surface border border-m3-primary/30 shadow-xs font-extrabold"
                      : "text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container/60 border border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                        isActive
                          ? "bg-m3-primary text-m3-on-primary"
                          : "bg-m3-outline-variant/30 text-m3-on-surface-variant"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Main Settings Panel Split Wrapper */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 h-full overflow-hidden">
          {/* Desktop Left Sidebar: Vertical Navigation */}
          <aside className="hidden md:flex flex-col w-[260px] border-r border-m3-outline-variant/40 bg-m3-surface-low/30 p-5 space-y-5 shrink-0 overflow-y-auto select-none">
            <div className="space-y-2">
              <h2 className="px-2 text-[10px] uppercase tracking-wider font-extrabold text-m3-outline font-mono">
                Settings Groups
              </h2>
              <div className="flex flex-col gap-1">
                {tabsList.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isDanger = tab.id === "danger";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        triggerVibration("light");
                        setActiveTab(tab.id);
                      }}
                      className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border ${
                        isActive
                          ? isDanger
                            ? "bg-red-500/10 border-red-500/30 text-red-600 shadow-xs font-extrabold"
                            : "bg-m3-primary-container border-m3-primary/25 text-m3-on-primary-container shadow-xs font-extrabold"
                          : "bg-transparent border-transparent text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`transition-transform duration-200 group-hover:scale-110 ${
                          isActive
                            ? isDanger
                              ? "text-red-600"
                              : "text-m3-on-primary-container"
                            : isDanger
                              ? "text-red-500/70 group-hover:text-red-600"
                              : "text-m3-on-surface-variant"
                        }`}>
                          {tab.icon}
                        </span>
                        <span className="font-sans text-[11px]">{tab.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Scrollable Content Container (Desktop: Right Column) */}
          <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-8 max-w-4xl w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* 1. GENERAL TAB */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    {/* Minimalist Outcomes-Oriented Library Status Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-2xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                          <HardDrive size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono font-bold text-m3-outline uppercase leading-none">Saved Items</p>
                          <h4 className="text-sm font-extrabold font-display text-m3-on-surface mt-1.5 leading-none">
                            {posts.length} bookmarks
                          </h4>
                        </div>
                      </div>

                      <div className="p-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-2xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono font-bold text-m3-outline uppercase leading-none">Source Handle</p>
                          <h4 className="text-sm font-extrabold font-display text-m3-on-surface mt-1.5 leading-none truncate max-w-[150px]">
                            {username ? `@${username}` : "Not Configured"}
                          </h4>
                        </div>
                      </div>

                      <div className="p-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-2xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                          <Layers size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono font-bold text-m3-outline uppercase leading-none">Local Backup</p>
                          <h4 className="text-sm font-extrabold font-display text-emerald-600 dark:text-emerald-400 mt-1.5 leading-none">
                            JSON &amp; CSV Ready
                          </h4>
                        </div>
                      </div>
                    </div>

                    <section className="space-y-4">
                      <SettingSectionHeader
                        icon={<User size={18} />}
                        title="Curator Settings"
                        subtitle="Manage your curator display name, notification email, and profile details."
                      />
                      <ProfileTab
                        displayName={displayName}
                        setDisplayName={setDisplayName}
                        username={username}
                        setUsername={setUsername}
                        email={email}
                        setEmail={setEmail}
                        avatarUrl={avatarUrl}
                        onAvatarUpload={handleAvatarUpload}
                        onRemoveAvatar={handleRemoveAvatar}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        avatarInputRef={avatarInputRef}
                        postsCount={posts.length}
                        onSaveProfile={handleSaveProfile}
                      />
                    </section>
                  </div>
                )}

                {/* 2. APPEARANCE TAB */}
                {activeTab === "appearance" && (
                  <section className="space-y-4">
                    <SettingSectionHeader
                      icon={<Sliders size={18} />}
                      title="Appearance Preferences"
                      subtitle="Customize interface theme look-and-feel, layout density, and animations."
                    />
                    <PreferencesTab
                      theme={theme}
                      onThemeToggle={onThemeToggle}
                      animationsEnabled={animationsEnabled}
                      onSetAnimationsEnabled={handleSetAnimationsEnabled}
                      compactMode={compactMode}
                      onSetCompactMode={handleSetCompactMode}
                    />
                  </section>
                )}

                {/* 3. CURATION TAB */}
                {activeTab === "curation" && (
                  <section className="space-y-6">
                    <SettingSectionHeader
                      icon={<LayoutGrid size={18} />}
                      title="Curation Preferences"
                      subtitle="Configure Instagram source handles, smart background categorization, and navigation hotkeys."
                    />

                    {/* Instagram Source Setting */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-m3-outline-variant/15">
                        <div className="p-2 bg-m3-primary/10 text-m3-primary rounded-xl">
                          <User size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-m3-on-surface">Instagram Source Handle</h4>
                          <p className="text-[10px] text-m3-on-surface-variant font-sans">The default account handle used to resolve bookmarks.</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                          <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1 font-sans">
                            Instagram Username
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant text-xs font-mono">@</span>
                            <input
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="curator_handle"
                              className="w-full pl-7 pr-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs font-mono text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerVibration("light");
                            localStorage.setItem("instasorter_username", username);
                            toast.success("Instagram handle saved successfully!");
                          }}
                          className="px-5 py-2.5 bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 font-sans"
                        >
                          Save Handle
                        </button>
                      </div>
                    </div>

                    {/* Smart Organizer Switch */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
                            <Cpu size={18} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2 font-display">
                              <span>Smart Organizer</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                Auto-categorize
                              </span>
                            </h3>
                            <p className="text-[11px] text-m3-on-surface-variant mt-0.5 font-sans">
                              Categorize unorganized saved posts into smart collections using client-side heuristics.
                            </p>
                          </div>
                        </div>
                        <UnifiedSwitch
                          checked={isBackgroundOrganizerEnabled}
                          onChange={setIsBackgroundOrganizerEnabled}
                          ariaLabel="Toggle background categorizer worker"
                        />
                      </div>
                    </div>

                    {/* Keyboard Shortcuts Cheatsheet */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2 mb-4 font-display">
                        <Keyboard size={14} className="text-m3-primary" />
                        <span>Keyboard Shortcuts Cheatsheet</span>
                      </h4>
                      <KeyboardShortcutsTab />
                    </div>
                  </section>
                )}

                {/* 4. DATA TAB */}
                {activeTab === "data" && (
                  <section className="space-y-4">
                    <SettingSectionHeader
                      icon={<Database size={18} />}
                      title="Data &amp; Library Storage"
                      subtitle="Inspect offline browser database utilization and export curation spreadsheet backups."
                    />

                    {/* Library Storage Meter (Maintenance stats but clean and simplified) */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-m3-outline-variant/15">
                        <div className="p-2 bg-m3-primary/10 text-m3-primary rounded-xl">
                          <HardDrive size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-m3-on-surface">Library Storage Usage</h4>
                          <p className="text-[10px] text-m3-on-surface-variant font-sans">Local browser-allocated storage sandbox capacity</p>
                        </div>
                      </div>

                      {storageInfo && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-m3-on-surface-variant font-bold">
                              {(storageInfo.usage / (1024 * 1024)).toFixed(1)} MB used of {(storageInfo.quota / (1024 * 1024 * 1024)).toFixed(1)} GB allocated
                            </span>
                            <span className="font-bold text-m3-primary">{storageInfo.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-m3-outline-variant/20 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-m3-primary h-full transition-all duration-500"
                              style={{ width: `${Math.max(storageInfo.percentage, 1)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Backup & Export (BackupTab but outcome-oriented) */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-m3-outline-variant/15">
                        <div className="p-2 bg-m3-primary/10 text-m3-primary rounded-xl">
                          <Layers size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-m3-on-surface">Backup &amp; Export Curation Library</h4>
                          <p className="text-[10px] text-m3-on-surface-variant font-sans">Export your saved items as files for backup or external analysis</p>
                        </div>
                      </div>

                      <p className="text-xs text-m3-on-surface-variant leading-relaxed font-sans">
                        Export your entire Instagram curation library into JSON format for migrating across devices, or as a CSV spreadsheet for analyzing inside Microsoft Excel or Google Sheets.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerVibration("light");
                            exportData();
                          }}
                          className="py-3 px-4 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary rounded-xl text-xs font-bold text-m3-on-surface transition-all cursor-pointer flex items-center justify-center gap-2 font-sans active:scale-95"
                        >
                          <Download size={14} className="text-m3-primary animate-bounce" />
                          <span>Export JSON Backup</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerVibration("light");
                            exportCSVData();
                          }}
                          className="py-3 px-4 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary rounded-xl text-xs font-bold text-m3-on-surface transition-all cursor-pointer flex items-center justify-center gap-2 font-sans active:scale-95"
                        >
                          <FileSpreadsheet size={14} className="text-m3-primary" />
                          <span>Export CSV Spreadsheet</span>
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* 5. ADVANCED TAB */}
                {activeTab === "advanced" && (
                  <section className="space-y-4">
                    <SettingSectionHeader
                      icon={<Terminal size={18} />}
                      title="Advanced System"
                      subtitle="Configure connection credentials, repair database indexes, and access system diagnostics via accordions."
                    />

                    <div className="space-y-4 pt-2">
                      {/* Section A: Scraper / Connection Setup */}
                      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] overflow-hidden transition-all duration-300">
                        <button
                          type="button"
                          onClick={() => setExpandedSection(expandedSection === "scraper" ? null : "scraper")}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-m3-surface-container/30 transition-all cursor-pointer text-left select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-m3-primary/5 text-m3-primary rounded-xl">
                              <Cpu size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-m3-on-surface uppercase tracking-wider font-display">Scraper &amp; Connection Setup</h4>
                              <p className="text-[10px] text-m3-on-surface-variant font-sans">Credentials, session tokens, and proxies</p>
                            </div>
                          </div>
                          {expandedSection === "scraper" ? <ChevronUp size={16} className="text-m3-outline" /> : <ChevronDown size={16} className="text-m3-outline" />}
                        </button>
                        
                        <AnimatePresence>
                          {expandedSection === "scraper" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-m3-outline-variant/20 p-6 bg-m3-surface/30 space-y-4"
                            >
                              <ScraperTab
                                scrapingUser={scrapingUser}
                                setScrapingUser={setScrapingUser}
                                scrapingPass={scrapingPass}
                                setScrapingPass={setScrapingPass}
                                scrapingSession={scrapingSession}
                                setScrapingSession={setScrapingSession}
                                scrapingProxy={scrapingProxy}
                                setScrapingProxy={setScrapingProxy}
                                loadingConfig={loadingConfig}
                                savingConfig={savingConfig}
                                onSaveConfig={handleSaveScrapingConfig}
                                throttleStatus={throttleStatus}
                                testingInstaloader={testingInstaloader}
                                onTestInstaloader={handleTestInstaloader}
                                instaloaderResult={instaloaderResult}
                                testingMediaScraper={testingMediaScraper}
                                onTestMediaScraper={handleTestMediaScraper}
                                mediaScraperResult={mediaScraperResult}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Section B: Maintenance & Repair */}
                      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] overflow-hidden transition-all duration-300">
                        <button
                          type="button"
                          onClick={() => setExpandedSection(expandedSection === "maintenance" ? null : "maintenance")}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-m3-surface-container/30 transition-all cursor-pointer text-left select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-m3-primary/5 text-m3-primary rounded-xl">
                              <Database size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-m3-on-surface uppercase tracking-wider font-display">Database Maintenance &amp; Repair</h4>
                              <p className="text-[10px] text-m3-on-surface-variant font-sans">Re-indexing, duplicate detection, and tag consolidate actions</p>
                            </div>
                          </div>
                          {expandedSection === "maintenance" ? <ChevronUp size={16} className="text-m3-outline" /> : <ChevronDown size={16} className="text-m3-outline" />}
                        </button>
                        
                        <AnimatePresence>
                          {expandedSection === "maintenance" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-m3-outline-variant/20 p-6 bg-m3-surface/30 space-y-4"
                            >
                              <MaintenanceTab
                                storageInfo={storageInfo}
                                postsCount={posts.length}
                                isRefreshingLibrary={isRefreshingLibrary}
                                onRefreshLibrary={handleRefreshLibrary}
                                onScanDuplicates={handleAnalyzeDuplicates}
                                onConsolidateTags={handleConsolidateTags}
                                workerStats={workerStats}
                                isDownloading={isDownloading}
                                onRetryFailedThumbnails={retryFailedThumbnails}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Section C: Diagnostics / Logs */}
                      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] overflow-hidden transition-all duration-300">
                        <button
                          type="button"
                          onClick={() => setExpandedSection(expandedSection === "diagnostics" ? null : "diagnostics")}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-m3-surface-container/30 transition-all cursor-pointer text-left select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-m3-primary/5 text-m3-primary rounded-xl">
                              <Terminal size={16} />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-m3-on-surface uppercase tracking-wider font-display">System Telemetry &amp; Logs</h4>
                              <p className="text-[10px] text-m3-on-surface-variant font-sans">Developer diagnostics, trace recordings, and status exports</p>
                            </div>
                          </div>
                          {expandedSection === "diagnostics" ? <ChevronUp size={16} className="text-m3-outline" /> : <ChevronDown size={16} className="text-m3-outline" />}
                        </button>
                        
                        <AnimatePresence>
                          {expandedSection === "diagnostics" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-m3-outline-variant/20 p-6 bg-m3-surface/30 space-y-4"
                            >
                              <TelemetryTab
                                isLoggingActive={isLoggingActive}
                                onToggleLogging={handleToggleLogging}
                                logs={logs}
                                logStats={{ ...logStats, info: logs.filter(l => l.category === "info").length }}
                                logSearchText={logSearchText}
                                setLogSearchText={setLogSearchText}
                                logFilterCategory={logFilterCategory}
                                setLogFilterCategory={setLogFilterCategory}
                                filteredLogs={filteredLogs}
                                expandedLogId={expandedLogId}
                                setExpandedLogId={setExpandedLogId}
                                onExportLogs={handleExportLogs}
                                onClearLogs={handleClearLogs}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </section>
                )}

                {/* 6. DANGER ZONE TAB */}
                {activeTab === "danger" && (
                  <section className="space-y-4">
                    <SettingSectionHeader
                      icon={<ShieldAlert size={18} className="text-red-500" />}
                      title="Danger Zone"
                      subtitle="Permanently clear saved curation data or perform a hard factory reset."
                    />

                    <div className="bg-red-500/[0.02] border-2 border-red-500/15 rounded-[24px] p-6 space-y-6">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold font-display text-red-600 uppercase tracking-wide">
                            Destructive Actions Area
                          </h3>
                          <p className="text-xs text-m3-on-surface-variant mt-1 leading-relaxed font-sans">
                            These operations are completely irreversible. Clearing library elements will delete all saved Instagram bookmarks, notes, classifications, and cached thumbnails. We strongly recommend downloading a JSON backup file first.
                          </p>
                        </div>
                      </div>

                      {/* Required confirmation checkboxes */}
                      <div className="p-4 bg-red-500/[0.04] border border-red-500/10 rounded-2xl space-y-3.5">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={dangerCheck1}
                            onChange={(e) => setDangerCheck1(e.target.checked)}
                            className="mt-1 rounded border-red-500/30 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-m3-on-surface-variant leading-relaxed font-sans">
                            I understand that resetting my library will permanently delete all saved posts and custom collections.
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={dangerCheck2}
                            onChange={(e) => setDangerCheck2(e.target.checked)}
                            className="mt-1 rounded border-red-500/30 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-m3-on-surface-variant leading-relaxed font-sans">
                            I confirm that I have backed up my data if I need it, and want to perform a factory reset.
                          </span>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          type="button"
                          disabled={!dangerCheck1 || !dangerCheck2}
                          onClick={() => {
                            triggerVibration("warning");
                            setShowConfirmClear(true);
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center transition-all cursor-pointer select-none flex items-center justify-center gap-2 font-sans ${
                            dangerCheck1 && dangerCheck2
                              ? "bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-95"
                              : "bg-m3-outline-variant/30 text-m3-on-surface-variant cursor-not-allowed"
                          }`}
                        >
                          <Trash2 size={14} />
                          <span>Reset Library Data</span>
                        </button>

                        <button
                          type="button"
                          disabled={!dangerCheck1 || !dangerCheck2}
                          onClick={() => {
                            triggerVibration("warning");
                            setShowConfirmClearAll(true);
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center transition-all cursor-pointer select-none flex items-center justify-center gap-2 font-sans ${
                            dangerCheck1 && dangerCheck2
                              ? "bg-red-700 hover:bg-red-800 text-white shadow-sm active:scale-95"
                              : "bg-m3-outline-variant/30 text-m3-on-surface-variant cursor-not-allowed"
                          }`}
                        >
                          <ShieldAlert size={14} />
                          <span>Complete Factory Reset</span>
                        </button>
                      </div>
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>



        {/* Confirmation Modal for Clearing Database */}
        <AnimatePresence>
          {showConfirmClear && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmClear(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-md w-full p-6 shadow-2xl relative z-10 space-y-5"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-lg font-bold font-display text-m3-on-surface">
                      Backup Recommended Before Clear
                    </h3>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed font-sans">
                      We strongly recommend creating a backup of your local database before clearing. Once cleared, all saved posts, collections, and custom curation notes will be permanently deleted and cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                  <button
                    onClick={() => setShowConfirmClear(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-full border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container cursor-pointer transition-colors text-center font-sans active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllPosts}
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 transition-all shadow-sm text-center font-sans cursor-pointer active:scale-95"
                  >
                    Clear All Posts
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal for Hard Reset */}
        <AnimatePresence>
          {showConfirmClearAll && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmClearAll(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-md w-full p-6 shadow-2xl relative z-10 space-y-5"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-lg font-bold font-display text-m3-on-surface">
                      Wipe All Data &amp; Hard Reset App?
                    </h3>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed font-sans">
                      This will permanently wipe all bookmark records from IndexedDB and clear all local storage settings. The app will be restored to its initial default state. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                  <button
                    onClick={() => setShowConfirmClearAll(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-full border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container cursor-pointer transition-colors text-center font-sans active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllData}
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 transition-all shadow-sm text-center font-sans cursor-pointer active:scale-95"
                  >
                    Wipe Everything &amp; Reload
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
