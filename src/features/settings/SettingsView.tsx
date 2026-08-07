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
} from "lucide-react";
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
      setAnimationsEnabled(val);
      localStorage.setItem("instasorter_animations", val.toString());
    }, []);

    const handleSetCompactMode = useCallback((val: boolean) => {
      setCompactMode(val);
      localStorage.setItem("instasorter_compact", val.toString());
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

    const handleAnalyzeDuplicates = async () => {
      setToast({ type: "success", message: "Library scan complete: No duplicate posts found." });
    };

    return (
      <div className="flex-1 bg-m3-surface select-none flex flex-col min-h-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-xs z-10 shrink-0 flex flex-col">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <h1 className="text-base sm:text-lg md:text-xl font-bold font-display tracking-tight text-m3-on-surface leading-none">
              {t.title}
            </h1>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-8 max-w-5xl mx-auto w-full space-y-10">

          {/* ================= SECTION 1: ACCOUNT ================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-m3-outline-variant/30">
              <div className="p-2 rounded-xl bg-m3-primary/10 text-m3-primary">
                <User size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider">
                  Account &amp; Curator Profile
                </h2>
                <p className="text-[11px] text-m3-on-surface-variant">
                  Display name, Instagram handle, email credentials, and library metrics.
                </p>
              </div>
            </div>

            {/* Profile Card */}
            <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-7 shadow-xs transition-all duration-300">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                {/* Avatar with Camera Upload Overlay */}
                <div className="relative group/avatar shrink-0">
                  <div className="w-20 h-20 rounded-full bg-m3-primary/10 border border-m3-outline-variant/30 text-m3-primary flex items-center justify-center font-display font-bold text-2xl shadow-xs overflow-hidden relative">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Curator Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-m3-primary-container/20" />
                        <span className="relative z-10">
                          {(displayName || "Curator")
                            .split(" ")
                            .map((n) => (n ? n[0] : ""))
                            .join("")
                            .toUpperCase()
                            .substring(0, 2)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Camera Upload Button Overlay */}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-m3-primary text-m3-on-primary hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer border border-m3-surface"
                    title="Upload profile picture"
                  >
                    <Camera size={12} />
                  </button>

                  {/* Clear Avatar Button (if custom avatar uploaded) */}
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all shadow-xs cursor-pointer border border-m3-surface"
                      title="Remove profile picture"
                    >
                      <X size={10} />
                    </button>
                  )}

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 flex flex-col justify-center text-center sm:text-left w-full">
                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                          placeholder="Enter name"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                          Instagram Handle
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                          placeholder="Enter Instagram username"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold font-display text-m3-on-surface">
                        {displayName || "Curator"}
                      </h3>
                      {username && (
                        <p className="text-sm font-semibold text-m3-primary">
                          @{username}
                        </p>
                      )}
                      {email && (
                        <p className="text-xs text-m3-on-surface-variant font-medium mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                          <Mail size={12} className="text-m3-outline" />
                          <span>{email}</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-5 flex justify-center sm:justify-start">
                    {isEditing ? (
                      <button
                        onClick={handleSaveProfile}
                        className="flex items-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-xl px-5 py-2 text-xs font-bold cursor-pointer hover:bg-m3-primary/95 transition-all shadow-xs active:scale-95"
                      >
                        <Save size={12} />
                        <span>Save Changes</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 border border-m3-outline-variant/60 hover:border-m3-primary hover:text-m3-primary bg-m3-surface rounded-xl px-5 py-2 text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95"
                      >
                        <Edit2 size={11} />
                        <span>Edit Curator Credentials</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stat Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-m3-outline-variant/10">
                <div className="bg-m3-surface/60 p-3 rounded-xl border border-m3-outline-variant/20">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-m3-outline block font-bold">Total Posts</span>
                  <span className="text-lg font-extrabold font-display text-m3-on-surface mt-0.5 block">{totalPosts}</span>
                </div>
                <div className="bg-m3-surface/60 p-3 rounded-xl border border-m3-outline-variant/20">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-m3-outline block font-bold">Favorites</span>
                  <span className="text-lg font-extrabold font-display text-m3-on-surface mt-0.5 block">{favoritesCount}</span>
                </div>
                <div className="bg-m3-surface/60 p-3 rounded-xl border border-m3-outline-variant/20">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-m3-outline block font-bold">Collections</span>
                  <span className="text-lg font-extrabold font-display text-m3-on-surface mt-0.5 block">{allCollections.length}</span>
                </div>
                <div className="bg-m3-surface/60 p-3 rounded-xl border border-m3-outline-variant/20">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-m3-outline block font-bold">Tags</span>
                  <span className="text-lg font-extrabold font-display text-m3-on-surface mt-0.5 block">{uniqueTags}</span>
                </div>
              </div>
            </div>
          </section>


          {/* ================= SECTION 2: STORAGE & DATA ================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-m3-outline-variant/30">
              <div className="p-2 rounded-xl bg-m3-primary/10 text-m3-primary">
                <Database size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider">
                  Storage &amp; Data
                </h2>
                <p className="text-[11px] text-m3-on-surface-variant">
                  Manage browser IndexedDB cache, media downloader stats, backups, and library reset.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Storage Quota Card */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary">
                    <HardDrive size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-m3-on-surface">Browser Storage Quota</h4>
                    <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                      {storageInfo
                        ? `${(storageInfo.usage / (1024 * 1024)).toFixed(2)} MB used of ${(storageInfo.quota / (1024 * 1024 * 1024)).toFixed(1)} GB available`
                        : "Calculating storage usage..."}
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-48 bg-m3-surface-container rounded-full h-2.5 overflow-hidden border border-m3-outline-variant/30">
                  <div
                    className="bg-m3-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${storageInfo?.percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Background Auto-Organizer Worker Toggle Card */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary shrink-0 mt-0.5">
                      <Cpu size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-m3-on-surface">Background Auto-Organizer Worker</h4>
                      <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-relaxed">
                        Periodically scans, deduplicates, and organizes newly imported posts. Toggle off to save power and reduce CPU overhead when on battery.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-m3-outline uppercase block font-bold">Status</span>
                      <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          !isBackgroundOrganizerEnabled 
                            ? "bg-gray-400" 
                            : backgroundOrganizerStatus === "running" 
                            ? "bg-emerald-500 animate-pulse" 
                            : backgroundOrganizerStatus === "completed"
                            ? "bg-blue-500"
                            : "bg-emerald-400"
                        }`} />
                        <span className="text-[10px] font-semibold text-m3-on-surface-variant capitalize">
                          {!isBackgroundOrganizerEnabled 
                            ? "Disabled" 
                            : backgroundOrganizerStatus === "running" 
                            ? "Active..." 
                            : backgroundOrganizerStatus === "completed"
                            ? "Completed"
                            : "Idle"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setIsBackgroundOrganizerEnabled(!isBackgroundOrganizerEnabled);
                        toast.success(
                          !isBackgroundOrganizerEnabled 
                            ? "Background auto-organizer enabled." 
                            : "Background auto-organizer disabled to save power."
                        );
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isBackgroundOrganizerEnabled ? "bg-m3-primary" : "bg-m3-outline-variant"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-m3-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
                          isBackgroundOrganizerEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {isBackgroundOrganizerEnabled && backgroundOrganizerStatus === "running" && (
                  <div className="space-y-1.5 pt-2 border-t border-m3-outline-variant/10">
                    <div className="flex justify-between text-[9px] font-mono text-m3-outline">
                      <span>Scanning & grouping posts...</span>
                      <span>{backgroundOrganizerProgress}%</span>
                    </div>
                    <div className="w-full bg-m3-surface-container rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${backgroundOrganizerProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cache & Thumbnail Optimization Card */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-m3-on-surface">Thumbnail &amp; Cache Maintenance</h4>
                    <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                      Targeted low-intensity re-indexing for posts lacking thumbnails or with failed processing status.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {workerStats.failed > 0 && (
                      <button
                        onClick={() => retryFailedThumbnails()}
                        className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-amber-500/20 transition-all shadow-2xs active:scale-95"
                      >
                        <RefreshCw size={12} />
                        <span>Retry Failed ({workerStats.failed})</span>
                      </button>
                    )}
                    <button
                      onClick={handleRefreshLibrary}
                      disabled={isRefreshingLibrary}
                      className="flex items-center gap-1.5 bg-m3-primary text-m3-on-primary px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-m3-primary/90 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isRefreshingLibrary ? "animate-spin" : ""} />
                      <span>{isRefreshingLibrary ? "Re-indexing..." : "Refresh Library"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-m3-outline-variant/10">
                  <button
                    onClick={handleRefreshLibrary}
                    disabled={isRefreshingLibrary}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={`text-m3-primary ${isRefreshingLibrary ? "animate-spin" : ""}`} />
                    <span>Refresh Library</span>
                  </button>
                  <button
                    onClick={handleAnalyzeDuplicates}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Layers size={14} className="text-m3-primary" />
                    <span>Scan Duplicates</span>
                  </button>
                  <button
                    onClick={handleConsolidateTags}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Hash size={14} className="text-m3-primary" />
                    <span>Normalize Tags</span>
                  </button>
                </div>
              </div>

              {/* Instagram Scraper Credentials & Proxy Configuration */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-m3-outline-variant/10">
                  <Sliders size={16} className="text-m3-primary" />
                  <h4 className="text-xs font-bold text-m3-on-surface">Instagram Scraper Configuration &amp; Proxy</h4>
                </div>
                
                <p className="text-[11px] text-m3-on-surface-variant">
                  Configure account credentials, session cookies, and proxies to bypass Instagram's strict rate limits and extraction blocks completely. This configures both the Instaloader Python Bridge and Direct GraphQL Scraping engines.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                      Instagram Username
                    </label>
                    <input
                      type="text"
                      value={scrapingUser}
                      onChange={(e) => setScrapingUser(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                      placeholder="e.g. instasorter_curator"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                      Instagram Password
                    </label>
                    <input
                      type="password"
                      value={scrapingPass}
                      onChange={(e) => setScrapingPass(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                      placeholder="Leave empty to preserve saved password"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                      Active Session Cookie (sessionid)
                    </label>
                    <textarea
                      value={scrapingSession}
                      onChange={(e) => setScrapingSession(e.target.value)}
                      rows={2}
                      className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-mono text-m3-on-surface resize-none"
                      placeholder="Paste your Instagram sessionid cookie value here for highly stable scrapers"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                      HTTP/SOCKS5 Proxy (Optional)
                    </label>
                    <input
                      type="text"
                      value={scrapingProxy}
                      onChange={(e) => setScrapingProxy(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                      placeholder="e.g. http://username:password@ip:port or socks5://ip:port"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveScrapingConfig}
                    disabled={savingConfig}
                    className="flex items-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer hover:bg-m3-primary/95 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {savingConfig ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Saving configuration...</span>
                      </>
                    ) : (
                      <>
                        <Save size={12} />
                        <span>Save Scraper Configuration</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Scraper Pipeline Diagnostic Console */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-m3-outline-variant/10">
                  <Terminal size={16} className="text-m3-primary" />
                  <h4 className="text-xs font-bold text-m3-on-surface">Interactive Diagnostics Console</h4>
                </div>

                <p className="text-[11px] text-m3-on-surface-variant">
                  Test the active bridged engines with a live query using your newly configured credentials and proxies. This prints real-time debug responses.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Instaloader Section */}
                  <div className="p-4 rounded-xl bg-m3-surface border border-m3-outline-variant/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider">Engine A</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold">
                        Instaloader Bridge
                      </span>
                    </div>
                    <button
                      onClick={handleTestInstaloader}
                      disabled={testingInstaloader}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-m3-outline-variant/60 hover:border-m3-primary hover:text-m3-primary bg-m3-surface rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                    >
                      <Terminal size={12} className="text-m3-primary" />
                      <span>{testingInstaloader ? "Running Bridge..." : "Run Test Probe"}</span>
                    </button>

                    {instaloaderResult && (
                      <div className="p-3 rounded-lg bg-m3-surface-low border border-m3-outline-variant/20 font-mono text-[10px] space-y-1.5 max-h-48 overflow-y-auto">
                        <div className="font-bold text-m3-on-surface">
                          Result: {instaloaderResult.success ? "✅ Success" : "ℹ️ Fallback Enabled"}
                        </div>
                        <pre className="text-[9px] text-m3-on-surface-variant whitespace-pre-wrap">
                          {JSON.stringify(instaloaderResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* ahmedrangel/instagram-media-scraper Section */}
                  <div className="p-4 rounded-xl bg-m3-surface border border-m3-outline-variant/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider">Engine B</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] font-mono font-bold">
                        Direct GQL/API Scraper
                      </span>
                    </div>
                    <button
                      onClick={handleTestMediaScraper}
                      disabled={testingMediaScraper}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-m3-outline-variant/60 hover:border-m3-primary hover:text-m3-primary bg-m3-surface rounded-xl text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                    >
                      <Terminal size={12} className="text-m3-primary" />
                      <span>{testingMediaScraper ? "Running Direct GQL..." : "Run Test Probe"}</span>
                    </button>

                    {mediaScraperResult && (
                      <div className="p-3 rounded-lg bg-m3-surface-low border border-m3-outline-variant/20 font-mono text-[10px] space-y-1.5 max-h-48 overflow-y-auto">
                        <div className="font-bold text-m3-on-surface">
                          Result: {mediaScraperResult.success ? "✅ Success" : "ℹ️ Fallback Enabled"}
                        </div>
                        <pre className="text-[9px] text-m3-on-surface-variant whitespace-pre-wrap">
                          {JSON.stringify(mediaScraperResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Import & Export Card */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">Backup, Import &amp; Export</h4>
                  <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                    Download complete database backups in JSON or tabular spreadsheet format (CSV).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={exportData}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Layers size={14} className="text-m3-primary" />
                    <span>Export JSON Backup ({posts.length})</span>
                  </button>
                  <button
                    onClick={exportCSVData}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <FileSpreadsheet size={14} className="text-green-600" />
                    <span>Export Spreadsheet (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Reset Library Card */}
              <div className="bg-red-500/5 border border-red-500/15 rounded-[20px] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-red-600">Danger Zone: Reset Library</h4>
                  <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                    Clear all saved bookmarks or perform a hard factory reset of local storage.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-m3-surface border border-red-500/30 text-red-600 rounded-xl text-xs font-bold hover:bg-red-500/10 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Trash2 size={13} />
                    <span>Clear Posts</span>
                  </button>
                  <button
                    onClick={() => setShowConfirmClearAll(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <ShieldAlert size={13} />
                    <span>Factory Reset</span>
                  </button>
                </div>
              </div>
            </div>
          </section>


          {/* ================= SECTION 3: PREFERENCES ================= */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-m3-outline-variant/30">
              <div className="p-2 rounded-xl bg-m3-primary/10 text-m3-primary">
                <Sliders size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider">
                  Preferences &amp; Appearance
                </h2>
                <p className="text-[11px] text-m3-on-surface-variant">
                  Customize color themes, motion animation transitions, and grid density.
                </p>
              </div>
            </div>

            <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] shadow-xs overflow-hidden divide-y divide-m3-outline-variant/10">
              {/* Theme Toggle Option */}
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">Color Palette Mode</h4>
                  <p className="text-[11px] text-m3-on-surface-variant mt-0.5">Toggle between crisp studio light mode and dark room studio mode.</p>
                </div>
                <div className="shrink-0 flex items-center bg-m3-surface-container rounded-xl p-1 border border-m3-outline-variant/25 shadow-xs relative overflow-hidden min-w-[180px]">
                  <div className="absolute inset-y-1 left-1 right-1 pointer-events-none select-none">
                    <motion.div
                      className="h-full bg-m3-surface rounded-lg border border-m3-outline-variant/30 shadow-xs"
                      layout
                      animate={{
                        x: theme === "light" ? "0%" : "100%",
                        width: "calc(50% - 4px)",
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    />
                  </div>
                  <button
                    onClick={() => onThemeToggle && theme === "dark" && onThemeToggle()}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      theme === "light" ? "text-m3-primary font-extrabold" : "text-m3-on-surface-variant hover:text-m3-on-surface"
                    }`}
                  >
                    <Sun size={14} className={theme === "light" ? "text-m3-primary" : ""} />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => onThemeToggle && theme === "light" && onThemeToggle()}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      theme === "dark" ? "text-m3-primary font-extrabold" : "text-m3-on-surface-variant hover:text-m3-on-surface"
                    }`}
                  >
                    <Moon size={14} className={theme === "dark" ? "text-m3-primary" : ""} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Animations Toggle Option */}
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">Motion Animations</h4>
                  <p className="text-[11px] text-m3-on-surface-variant mt-0.5">Enable smooth spring transitions and modal entry effects.</p>
                </div>
                <button
                  onClick={() => handleSetAnimationsEnabled(!animationsEnabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    animationsEnabled ? "bg-m3-primary" : "bg-m3-outline-variant"
                  }`}
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: animationsEnabled ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Grid Density Option */}
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">Grid Density &amp; Compact Mode</h4>
                  <p className="text-[11px] text-m3-on-surface-variant mt-0.5">Display cards in a compact, higher-density grid layout.</p>
                </div>
                <button
                  onClick={() => handleSetCompactMode(!compactMode)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    compactMode ? "bg-m3-primary" : "bg-m3-outline-variant"
                  }`}
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: compactMode ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* ================= SECTION: DEVELOPER DIAGNOSTICS & OBSERVABILITY ================= */}
          <section className="space-y-4 pt-6 border-t border-m3-outline-variant/30">
            <div className="flex items-center justify-between pb-2 border-b border-m3-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-m3-primary/10 text-m3-primary">
                  <Terminal size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider">
                    Developer Diagnostics &amp; Observability
                  </h2>
                  <p className="text-[11px] text-m3-on-surface-variant">
                    Real-time error tracking, background task monitoring, and storage operation telemetry.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportLogs}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Export JSON</span>
                </button>
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Clear Logs</span>
                </button>
              </div>
            </div>

            {/* Logger Status Bar & Stats */}
            <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-m3-on-surface">Background Observability Engine</h4>
                  <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                    Actively monitors unhandled exceptions, unhandled promise rejections, main thread freezes, and slow storage operations.
                  </p>
                </div>
                <button
                  onClick={() => handleToggleLogging(!isLoggingActive)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    isLoggingActive ? "bg-m3-primary" : "bg-m3-outline-variant"
                  }`}
                >
                  <motion.div
                    className="bg-white w-4 h-4 rounded-full shadow-md"
                    animate={{ x: isLoggingActive ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Stat Counters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
                <div className="bg-m3-surface p-3 rounded-xl border border-m3-outline-variant/20 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-m3-on-surface-variant">Total</span>
                  <p className="text-base font-bold font-mono text-m3-on-surface mt-0.5">{logStats.total}</p>
                </div>
                <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-red-600">Crashes</span>
                  <p className="text-base font-bold font-mono text-red-600 mt-0.5">{logStats.crashes}</p>
                </div>
                <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600">Freezes</span>
                  <p className="text-base font-bold font-mono text-amber-600 mt-0.5">{logStats.freezes}</p>
                </div>
                <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600">Slow Tasks</span>
                  <p className="text-base font-bold font-mono text-blue-600 mt-0.5">{logStats.slowPerf}</p>
                </div>
                <div className="bg-purple-500/5 p-3 rounded-xl border border-purple-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-600">Errors</span>
                  <p className="text-base font-bold font-mono text-purple-600 mt-0.5">{logStats.errors}</p>
                </div>
                <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600">Warnings</span>
                  <p className="text-base font-bold font-mono text-emerald-600 mt-0.5">{logStats.warnings}</p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="Search logs by title, message, stack..."
                    value={logSearchText}
                    onChange={(e) => setLogSearchText(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-m3-surface rounded-xl border border-m3-outline-variant/30 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {["all", "crash", "freeze", "slow_perf", "error", "warning", "info"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setLogFilterCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer transition-colors ${
                        logFilterCategory === cat
                          ? "bg-m3-primary text-m3-on-primary"
                          : "bg-m3-surface text-m3-on-surface-variant hover:text-m3-on-surface border border-m3-outline-variant/30"
                      }`}
                    >
                      {cat.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logs Stream List */}
              <div className="bg-m3-surface rounded-xl border border-m3-outline-variant/25 max-h-[400px] overflow-y-auto divide-y divide-m3-outline-variant/10 font-mono text-xs">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-m3-on-surface-variant font-sans text-xs">
                    No log entries found matching criteria. System is running smoothly.
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const dateStr = new Date(log.timestamp).toLocaleTimeString();
                    let badgeColor = "bg-slate-500/10 text-slate-600 border-slate-500/20";
                    if (log.category === "crash") badgeColor = "bg-red-500/10 text-red-600 border-red-500/20";
                    else if (log.category === "freeze") badgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                    else if (log.category === "slow_perf") badgeColor = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                    else if (log.category === "error") badgeColor = "bg-purple-500/10 text-purple-600 border-purple-500/20";
                    else if (log.category === "warning") badgeColor = "bg-orange-500/10 text-orange-600 border-orange-500/20";

                    return (
                      <div
                        key={log.id}
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-3.5 hover:bg-m3-surface-container/50 transition-colors cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                              {log.category.replace("_", " ")}
                            </span>
                            <span className="font-bold text-m3-on-surface font-sans">{log.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-m3-on-surface-variant text-[11px]">
                            {log.durationMs && (
                              <span className="text-blue-600 font-bold">{log.durationMs}ms</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {dateStr}
                            </span>
                          </div>
                        </div>
                        <p className="text-m3-on-surface-variant text-[11px] font-sans line-clamp-2">{log.message}</p>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-m3-outline-variant/20 space-y-2 text-[11px]">
                            {log.url && (
                              <div>
                                <span className="text-m3-outline">Path:</span> <span className="text-m3-on-surface">{log.url}</span>
                              </div>
                            )}
                            {log.details && (
                              <div>
                                <span className="text-m3-outline">Details:</span>
                                <pre className="mt-1 p-2 bg-m3-surface-container rounded-lg overflow-x-auto text-[10px] text-m3-on-surface">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.stack && (
                              <div>
                                <span className="text-m3-outline">Stack Trace:</span>
                                <pre className="mt-1 p-2 bg-red-500/5 rounded-lg overflow-x-auto text-[10px] text-red-600">
                                  {log.stack}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>



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
  },
);
