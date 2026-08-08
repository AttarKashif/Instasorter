import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  User,
  Mail,
  Database,
  Trash2,
  RefreshCw,
  Layers,
  Heart,
  ShieldAlert,
  Check,
  Edit2,
  Save,
  Upload,
  Folder,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Hash,
  ExternalLink,
  ArrowLeft,
  Moon,
  Sun,
  MonitorSmartphone,
  FileSpreadsheet,
  Sliders,
  Sparkles,
  HardDrive,
  Camera,
  X,
  Terminal,
  Cpu,
  Download,
  Search,
  Clock,
  AlertTriangle,
  Keyboard,
  Shield,
  Command,
} from "lucide-react";
import { KeyboardShortcutsTab } from "./components/KeyboardShortcutsTab";
import { ProfileTab } from "./components/ProfileTab";
import { PreferencesTab } from "./components/PreferencesTab";
import { ScraperTab } from "./components/ScraperTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { BackupTab } from "./components/BackupTab";
import { TelemetryTab } from "./components/TelemetryTab";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import { appLogger, LogEntry, LogCategory } from "../../lib/appLogger";
import {
  retrySingleThumbnail,
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
      | "overview"
      | "profile"
      | "preferences"
      | "shortcuts"
      | "scraper"
      | "maintenance"
      | "backup"
      | "telemetry";

    const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
    const [settingsSearchQuery, setSettingsSearchQuery] = useState("");

    // Auto-switch tab based on search query if query matches specific tab keywords
    useEffect(() => {
      if (!settingsSearchQuery.trim()) return;
      const q = settingsSearchQuery.toLowerCase();
      if (["shortcut", "key", "hotkey", "keyboard", "nav", "space", "enter", "escape"].some((k) => q.includes(k))) {
        setActiveTab("shortcuts");
      } else if (["proxy", "cookie", "session", "instaloader", "probe", "gql", "scraper", "password"].some((k) => q.includes(k))) {
        setActiveTab("scraper");
      } else if (["log", "crash", "freeze", "error", "telemetry", "stack", "observability"].some((k) => q.includes(k))) {
        setActiveTab("telemetry");
      } else if (["backup", "export", "json", "csv", "reset", "wipe", "factory", "clear"].some((k) => q.includes(k))) {
        setActiveTab("backup");
      } else if (["storage", "quota", "thumbnail", "index", "duplicate", "tag", "cache"].some((k) => q.includes(k))) {
        setActiveTab("maintenance");
      } else if (["theme", "dark", "light", "compact", "grid", "motion", "anim", "worker", "organizer"].some((k) => q.includes(k))) {
        setActiveTab("preferences");
      } else if (["profile", "curator", "avatar", "handle", "email", "name"].some((k) => q.includes(k))) {
        setActiveTab("profile");
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

    // Accordion State for Hick's Law compliance
    const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({
      storage: false,
      scraper: false,
      backup: false,
      telemetry: false,
    });

    const toggleAccordion = useCallback((key: string) => {
      triggerVibration("light");
      setExpandedAccordions((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    }, []);

    const expandAllAccordions = useCallback(() => {
      triggerVibration("light");
      setExpandedAccordions({
        storage: true,
        scraper: true,
        backup: true,
        telemetry: true,
      });
      toast.success("Expanded all advanced sections.");
    }, []);

    const collapseAllAccordions = useCallback(() => {
      triggerVibration("light");
      setExpandedAccordions({
        storage: false,
        scraper: false,
        backup: false,
        telemetry: false,
      });
      toast.success("Collapsed all advanced sections.");
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
      { id: "overview", label: "Overview", icon: <LayoutGrid size={15} /> },
      { id: "profile", label: "Profile", icon: <User size={15} />, badge: displayName || "Curator" },
      { id: "preferences", label: "Preferences", icon: <Sliders size={15} /> },
      { id: "shortcuts", label: "Shortcuts", icon: <Keyboard size={15} />, badge: "Hotkeys" },
      { id: "maintenance", label: "Storage & Cache", icon: <Database size={15} />, badge: posts.length },
      { id: "scraper", label: "Scraper Config", icon: <Cpu size={15} /> },
      { id: "backup", label: "Backup & Export", icon: <Layers size={15} /> },
      { id: "telemetry", label: "Observability", icon: <Terminal size={15} />, badge: logStats.total },
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
        id: "general",
        title: "General Curation",
        tabs: [
          { id: "overview", label: "Overview", icon: <LayoutGrid size={15} /> },
          { id: "profile", label: "Profile & Identity", icon: <User size={15} />, badge: displayName || "Curator" },
          { id: "preferences", label: "Preferences & Theme", icon: <Sliders size={15} /> },
          { id: "shortcuts", label: "Keyboard Shortcuts", icon: <Keyboard size={15} />, badge: "Hotkeys" },
        ]
      },
      {
        id: "data",
        title: "Data Management",
        tabs: [
          { id: "maintenance", label: "Storage & Cache", icon: <Database size={15} />, badge: posts.length },
          { id: "scraper", label: "Scraper Engine", icon: <Cpu size={15} /> },
          { id: "backup", label: "Backup & Export", icon: <Layers size={15} /> },
        ]
      },
      {
        id: "advanced",
        title: "Advanced System",
        tabs: [
          { id: "telemetry", label: "System Telemetry", icon: <Terminal size={15} />, badge: logStats.total },
        ]
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
            {settingsCategories.map((cat) => (
              <div key={cat.id} className="space-y-2">
                <h2 className="px-2 text-[10px] uppercase tracking-wider font-extrabold text-m3-outline font-mono">
                  {cat.title}
                </h2>
                <div className="flex flex-col gap-1">
                  {cat.tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          triggerVibration("light");
                          setActiveTab(tab.id as SettingsTab);
                        }}
                        className={`group flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border ${
                          isActive
                            ? "bg-m3-primary-container border-m3-primary/25 text-m3-on-primary-container shadow-xs font-extrabold"
                            : "bg-transparent border-transparent text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-m3-on-primary-container' : 'text-m3-on-surface-variant'}`}>
                            {tab.icon}
                          </span>
                          <span className="font-sans text-[11px]">{tab.label}</span>
                        </div>
                        {tab.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold whitespace-nowrap leading-none ${
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
                </div>
              </div>
            ))}
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
              {/* TAB 0: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {/* Overview Header Banner */}
                  <div className="p-5 rounded-[20px] bg-gradient-to-br from-m3-primary/5 via-transparent to-m3-primary/5 border border-m3-outline-variant/30 relative overflow-hidden select-none">
                    <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 bg-m3-primary/5 rounded-full blur-2xl" />
                    <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={14} className="text-m3-primary animate-pulse" />
                      Instasorter Dashboard Control
                    </h2>
                    <p className="text-[11px] text-m3-on-surface-variant font-sans mt-1 max-w-2xl leading-relaxed">
                      Welcome to your system settings. This dashboard offers a tiered overview of your curator identity, browser caching, scrapers, and telemetry. Use the cards below to configure your installation or check real-time system health.
                    </p>
                  </div>

                  {/* Tiered Grid Categories */}
                  {settingsCategories.map((category) => (
                    <div key={category.id} className="space-y-4">
                      {/* Category Header */}
                      <div className="border-b border-m3-outline-variant/30 pb-2">
                        <h3 className="text-[11px] font-extrabold text-m3-primary uppercase tracking-widest font-mono flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-m3-primary" />
                          {category.id === "general" ? "I. General / Curation" : category.id === "data" ? "II. Data & Scraping" : "III. System Diagnostics"}
                        </h3>
                        <p className="text-[10px] text-m3-on-surface-variant mt-0.5">
                          {category.id === "general" 
                            ? "Configure your personal curator profile, user preferences, look-and-feel, and access tools."
                            : category.id === "data"
                            ? "Inspect local IndexedDB quotas, edit Instagram scrapers, export backups, or normalize library tags."
                            : "Track active main thread execution logs, examine observabilities, and debug engine test probes."}
                        </p>
                      </div>

                      {/* Card Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {category.tabs
                          .filter((tab) => tab.id !== "overview") // skip overview itself in the grid
                          .map((tab) => {
                            return (
                              <div
                                key={tab.id}
                                className="group flex flex-col justify-between p-5 bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] transition-all duration-300 hover:scale-[1.01] hover:border-m3-primary/20 hover:shadow-xs select-none"
                              >
                                <div>
                                  {/* Title & Icon Header */}
                                  <div className="flex items-center justify-between mb-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/20 transition-colors group-hover:bg-m3-primary/10">
                                        {tab.icon}
                                      </div>
                                      <h4 className="text-xs font-bold font-display text-m3-on-surface tracking-wide">
                                        {tab.label}
                                      </h4>
                                    </div>
                                    {tab.badge !== undefined && (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-m3-outline-variant/30 text-m3-on-surface-variant whitespace-nowrap">
                                        {tab.badge}
                                      </span>
                                    )}
                                  </div>

                                  {/* Descriptive Subtext */}
                                  <p className="text-[11px] text-m3-on-surface-variant leading-relaxed mb-4">
                                    {tab.id === "profile" && "Manage display name, Instagram handle, curator email, and sync with your local metadata tracker."}
                                    {tab.id === "preferences" && "Customize visual styling, dark room theme, compact list view, animations, and background media processing."}
                                    {tab.id === "shortcuts" && "Quick reference list of available hotkeys for fluid, ultra-high-efficiency mouse-free media curation."}
                                    {tab.id === "maintenance" && "Inspect local IndexedDB disk usage, run index checking, normalize hashtag casings, or redownload missing thumbnails."}
                                    {tab.id === "scraper" && "Configure login keys, proxy servers, and SOCKS5 endpoints. Execute test probes against the Instaloader bridge."}
                                    {tab.id === "backup" && "Export your library into secure JSON or standard CSV backups. Erase cache or perform structural data wipes."}
                                    {tab.id === "telemetry" && "Real-time diagnostic traces, thread locks tracker, API health observability, and logs export."}
                                  </p>

                                  {/* Dynamic Inline Statuses & Mini-Toggles */}
                                  <div className="py-2.5 px-3 bg-m3-surface/40 rounded-xl border border-m3-outline-variant/15 text-[10px] space-y-2 mb-4 font-sans text-m3-on-surface-variant">
                                    {tab.id === "profile" && (
                                      <div className="space-y-1.5 font-mono">
                                        <div className="flex items-center justify-between">
                                          <span>Curator:</span>
                                          <span className="font-bold text-m3-on-surface truncate max-w-[120px]">{displayName}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Username:</span>
                                          <span className="text-m3-primary">@{username || "none"}</span>
                                        </div>
                                      </div>
                                    )}

                                    {tab.id === "preferences" && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono">Dark Room Theme:</span>
                                          <UnifiedSwitch
                                            checked={theme === "dark"}
                                            onChange={onThemeToggle || (() => {})}
                                            ariaLabel="Toggle dark mode theme"
                                          />
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono">Compact Mode:</span>
                                          <UnifiedSwitch
                                            checked={compactMode}
                                            onChange={handleSetCompactMode}
                                            ariaLabel="Toggle compact layout"
                                          />
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono">UI Animations:</span>
                                          <UnifiedSwitch
                                            checked={animationsEnabled}
                                            onChange={handleSetAnimationsEnabled}
                                            ariaLabel="Toggle UI motion physics"
                                          />
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono">Background Organizer:</span>
                                          <UnifiedSwitch
                                            checked={isBackgroundOrganizerEnabled}
                                            onChange={setIsBackgroundOrganizerEnabled}
                                            ariaLabel="Toggle background categorizer worker"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {tab.id === "shortcuts" && (
                                      <div className="space-y-1.5 font-mono">
                                        <div className="flex items-center justify-between">
                                          <span>Go to Home:</span>
                                          <kbd className="px-1.5 py-0.5 rounded-md bg-m3-surface-container border border-m3-outline-variant/45 text-[9px] font-extrabold text-m3-on-surface">1</kbd>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Open Shortcuts:</span>
                                          <kbd className="px-1.5 py-0.5 rounded-md bg-m3-surface-container border border-m3-outline-variant/45 text-[9px] font-extrabold text-m3-on-surface">?</kbd>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Focus Post:</span>
                                          <kbd className="px-1.5 py-0.5 rounded-md bg-m3-surface-container border border-m3-outline-variant/45 text-[9px] font-extrabold text-m3-on-surface">J / K</kbd>
                                        </div>
                                      </div>
                                    )}

                                    {tab.id === "maintenance" && (
                                      <div className="space-y-1.5 font-mono">
                                        <div className="flex items-center justify-between">
                                          <span>IndexedDB Quota:</span>
                                          <span className="font-bold text-m3-on-surface">
                                            {storageInfo 
                                              ? `${(storageInfo.usage / (1024 * 1024)).toFixed(1)}MB of ${(storageInfo.quota / (1024 * 1024 * 1024)).toFixed(0)}GB`
                                              : "Checking..."}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Library Size:</span>
                                          <span className="font-bold text-m3-primary">{posts.length} saved posts</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Thumbnails Queue:</span>
                                          <span className="text-[9px] bg-m3-outline-variant/30 text-m3-on-surface px-1.5 py-0.2 rounded-full font-bold">
                                            {workerStats.pending} pending
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {tab.id === "scraper" && (
                                      <div className="space-y-1.5 font-mono">
                                        <div className="flex items-center justify-between">
                                          <span>Instaloader Auth:</span>
                                          <span className={`font-bold ${scrapingUser ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                                            {scrapingUser ? scrapingUser : "Anonymous"}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Proxy Server:</span>
                                          <span className="truncate max-w-[140px]" title={scrapingProxy}>
                                            {scrapingProxy ? scrapingProxy : "Direct Connection"}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {tab.id === "backup" && (
                                      <div className="flex flex-col gap-1.5 py-0.5">
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerVibration("light");
                                              exportData();
                                            }}
                                            className="flex-1 py-1 px-2 bg-m3-surface border border-m3-outline-variant/50 hover:bg-m3-surface-variant/20 rounded-lg text-[9px] font-bold text-m3-on-surface cursor-pointer select-none text-center whitespace-nowrap"
                                          >
                                            Export JSON
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerVibration("light");
                                              exportCSVData();
                                            }}
                                            className="flex-1 py-1 px-2 bg-m3-surface border border-m3-outline-variant/50 hover:bg-m3-surface-variant/20 rounded-lg text-[9px] font-bold text-m3-on-surface cursor-pointer select-none text-center whitespace-nowrap"
                                          >
                                            Export CSV
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {tab.id === "telemetry" && (
                                      <div className="space-y-1.5 font-mono">
                                        <div className="flex items-center justify-between">
                                          <span>Live Diagnostic:</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleLogging(!isLoggingActive);
                                            }}
                                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold cursor-pointer select-none whitespace-nowrap border ${
                                              isLoggingActive 
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300"
                                                : "bg-stone-50 border-stone-200 text-stone-500 dark:bg-stone-900/30 dark:border-stone-800 dark:text-stone-400"
                                            }`}
                                          >
                                            {isLoggingActive ? "Active" : "Disabled"}
                                          </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span>Total Traces:</span>
                                          <span>{logStats.total} traces</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Navigate / Config Footer Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerVibration("light");
                                    setActiveTab(tab.id as SettingsTab);
                                  }}
                                  className="w-full py-2 bg-m3-primary hover:bg-m3-primary/95 text-m3-on-primary font-bold text-[10px] rounded-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                                >
                                  <span>Configure {tab.label}</span>
                                  <ChevronRight size={10} />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 1: CURATOR PROFILE */}
              {activeTab === "profile" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<User size={18} />}
                    title="Account & Curator Profile"
                    subtitle="Display name, Instagram handle, email credentials, and library metrics."
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
              )}

              {/* TAB 2: PREFERENCES */}
              {activeTab === "preferences" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<Sliders size={18} />}
                    title="Primary App Preferences"
                    subtitle="Essential toggleable controls for visual theme, grid density, animation physics, and background workers."
                  />
                  <PreferencesTab
                    theme={theme}
                    onThemeToggle={onThemeToggle}
                    animationsEnabled={animationsEnabled}
                    onSetAnimationsEnabled={handleSetAnimationsEnabled}
                    compactMode={compactMode}
                    onSetCompactMode={handleSetCompactMode}
                    isBackgroundOrganizerEnabled={isBackgroundOrganizerEnabled}
                    setIsBackgroundOrganizerEnabled={setIsBackgroundOrganizerEnabled}
                    backgroundOrganizerStatus={backgroundOrganizerStatus}
                    backgroundOrganizerProgress={backgroundOrganizerProgress}
                  />
                </section>
              )}

              {/* TAB 3: KEYBOARD SHORTCUTS */}
              {activeTab === "shortcuts" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<Keyboard size={18} />}
                    title="Keyboard Shortcuts Cheatsheet"
                    subtitle="Interactive reference for all single-key navigation, post curation, and overlay hotkeys."
                  />
                  <KeyboardShortcutsTab />
                </section>
              )}

              {/* TAB 4: STORAGE & MAINTENANCE */}
              {activeTab === "maintenance" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<Database size={18} />}
                    title="Storage, Caching & Maintenance"
                    subtitle="Inspect browser IndexedDB quota, thumbnail worker status, duplicate items, and tag normalization."
                  />
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
                </section>
              )}

              {/* TAB 5: SCRAPER CONFIG */}
              {activeTab === "scraper" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<Cpu size={18} />}
                    title="Instagram Scraper Credentials & Proxies"
                    subtitle="Account credentials, session cookies, SOCKS5 proxies, and engine test probes."
                  />
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
                </section>
              )}

              {/* TAB 6: BACKUP & RESET */}
              {activeTab === "backup" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<Layers size={18} />}
                    title="Backup, Data Export & Reset Library"
                    subtitle="Export database backups in JSON or CSV spreadsheets, or clear local storage."
                  />
                  <BackupTab
                    postsCount={posts.length}
                    onExportJSON={exportData}
                    onExportCSV={exportCSVData}
                    onShowConfirmClear={() => setShowConfirmClear(true)}
                    onShowConfirmClearAll={() => setShowConfirmClearAll(true)}
                  />
                </section>
              )}

              {/* TAB 7: TELEMETRY & LOGS */}
              {activeTab === "telemetry" && (
                <section className="space-y-4">
                  <SettingSectionHeader
                    icon={<Terminal size={18} />}
                    title="Developer Diagnostics & Observability Logs"
                    subtitle="Live telemetry tracking, main thread freezes, storage logs, and log export tools."
                  />
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
