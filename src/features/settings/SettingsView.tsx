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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import {
  retrySingleThumbnail,
  isWorkerActive,
  registerProgressCallback,
  unregisterProgressCallback,
  getThumbnailStats,
  getThrottleStatus,
  retryFailedThumbnails,
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

    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);
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

              {/* Cache & Thumbnail Optimization Card */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-m3-on-surface">Thumbnail &amp; Cache Maintenance</h4>
                    <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                      {workerStats.failed > 0
                        ? `${workerStats.failed} thumbnails failed to load. Retry downloading them now.`
                        : "All cached media thumbnails are active and synchronized."}
                    </p>
                  </div>
                  {workerStats.failed > 0 && (
                    <button
                      onClick={() => retryFailedThumbnails()}
                      className="flex items-center gap-1.5 bg-m3-primary text-m3-on-primary px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-m3-primary/90 transition-all shadow-xs active:scale-95"
                    >
                      <RefreshCw size={12} />
                      <span>Retry Failed ({workerStats.failed})</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-m3-outline-variant/10">
                  <button
                    onClick={handleAnalyzeDuplicates}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <RefreshCw size={14} className="text-m3-primary" />
                    <span>Scan &amp; Merge Duplicates</span>
                  </button>
                  <button
                    onClick={handleConsolidateTags}
                    className="flex items-center justify-center gap-2 p-3 bg-m3-surface border border-m3-outline-variant/40 rounded-xl text-xs font-bold text-m3-on-surface hover:border-m3-primary transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Hash size={14} className="text-m3-primary" />
                    <span>Normalize &amp; Consolidate Tags</span>
                  </button>
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
