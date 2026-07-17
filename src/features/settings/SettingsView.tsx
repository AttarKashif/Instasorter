import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Plus,
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { retrySingleThumbnail } from "../../lib/thumbnailWorker";
import { SAMPLE_POSTS } from "../../data/samplePosts";
import { normalizeInstagramPost } from "../../lib/parser";
import { AddBookmarkModal } from "../../components/ui/AddBookmarkModal";
import { VOCABULARY } from "../../constants/vocabulary";
import { ProfileTab } from "./components/ProfileTab";
import { AppearanceTab } from "./components/AppearanceTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { DiagnosticsTab } from "./components/DiagnosticsTab";

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
    theme,
    onThemeToggle,
  }: SettingsViewProps) => {
    const t = VOCABULARY.settings;
    const posts = usePostStore((state) => state.posts);
    const setPosts = usePostStore((state) => state.setPosts);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);
    const [toast, setToast] = useState<{
      type: "success" | "error";
      message: string;
    } | null>(null);

    // Profile Editable Details
    const [displayName, setDisplayName] = useState(
      () => localStorage.getItem("instasorter_displayName") || "Kashif Attar",
    );
    const [username, setUsername] = useState(
      () => localStorage.getItem("instasorter_username") || "kashif_archivist",
    );
    const [email, setEmail] = useState(
      () =>
        localStorage.getItem("instasorter_email") ||
        "attarmohammadkashif@gmail.com",
    );
    const [isEditing, setIsEditing] = useState(false);
    const [animationsEnabled, setAnimationsEnabled] = useState(
      () => localStorage.getItem("instasorter_animations") !== "false",
    );
    const [activeTab, setActiveTab] = useState<
      "profile" | "appearance" | "maintenance" | "diagnostics"
    >("profile");
    const [optSearch, setOptSearch] = useState("");
    const [optFilter, setOptFilter] = useState<"all" | "broken_thumbnail" | "missing_metadata">("all");
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

    const [compactMode, setCompactMode] = useState(
      () => localStorage.getItem("instasorter_compact") === "true",
    );

    const handleSetAnimationsEnabled = useCallback((val: boolean) => {
      setAnimationsEnabled(val);
    }, []);

    const handleSetCompactMode = useCallback((val: boolean) => {
      setCompactMode(val);
    }, []);

    useEffect(() => {
      localStorage.setItem(
        "instasorter_animations",
        animationsEnabled.toString(),
      );
    }, [animationsEnabled]);

    useEffect(() => {
      localStorage.setItem("instasorter_compact", compactMode.toString());
    }, [compactMode]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

    // Auto-clear toast after 3 seconds
    useEffect(() => {
      if (toast) {
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
      }
    }, [toast]);

    // Calculate dynamic stats
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

    const filteredDeadPosts = useMemo(() => {
      return posts.map((post) => {
        const issues: { id: string; label: string; severity: "high" | "medium" }[] = [];
        if (post.thumbnailStatus === "failed") {
          issues.push({ id: "thumb_failed", label: "Extraction Failed", severity: "high" });
        } else if (!post.thumbnailUrl || post.thumbnailUrl.trim() === "" || post.thumbnailUrl === "base64-placeholder") {
          issues.push({ id: "thumb_missing", label: "Missing Thumbnail", severity: "high" });
        }
        
        if (!post.creatorUsername || post.creatorUsername.trim() === "" || post.creatorUsername === "instagram_creator" || post.creatorUsername === "instagram_user") {
          issues.push({ id: "meta_creator", label: "Missing Creator", severity: "medium" });
        }
        if (!post.caption || post.caption.trim() === "") {
          issues.push({ id: "meta_caption", label: "Missing Caption", severity: "medium" });
        }
        return { post, issues };
      }).filter((item) => {
        if (item.issues.length === 0) return false;
        
        // Apply category filter
        if (optFilter === "broken_thumbnail") {
          if (!item.issues.some((issue) => issue.id.startsWith("thumb_"))) return false;
        } else if (optFilter === "missing_metadata") {
          if (!item.issues.some((issue) => issue.id.startsWith("meta_"))) return false;
        }
        
        // Apply search query
        if (optSearch.trim()) {
          const query = optSearch.toLowerCase().trim();
          const matchId = item.post.id.toLowerCase().includes(query);
          const matchUser = item.post.creatorUsername.toLowerCase().includes(query);
          const matchCaption = item.post.caption.toLowerCase().includes(query);
          if (!matchId && !matchUser && !matchCaption) return false;
        }
        
        return true;
      });
    }, [posts, optSearch, optFilter]);

    // Handlers for optimization
    const handleRetrySingle = async (postId: string, username: string) => {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.add(postId);
        return next;
      });
      try {
        await retrySingleThumbnail(postId);
        setToast({ type: "success", message: `Re-triggered thumbnail extraction for @${username}` });
      } catch (err) {
        console.error("Retry failed", err);
        setToast({ type: "error", message: "Failed to re-trigger extraction." });
      } finally {
        setTimeout(() => {
          setRetryingIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
          });
        }, 1000);
      }
    };

    const handleDeleteSingleDead = async (postId: string) => {
      try {
        await db.posts.delete(postId);
        const fresh = await db.posts.toArray();
        setPosts(fresh);
        setToast({ type: "success", message: "Successfully deleted dead post entry." });
      } catch (err) {
        console.error("Delete failed", err);
        setToast({ type: "error", message: "Failed to delete post." });
      }
    };

    const handleBulkRetryDead = async () => {
      const postsToRetry = filteredDeadPosts.filter(
        (item) => item.issues.some((i) => i.id.startsWith("thumb_"))
      );
      if (postsToRetry.length === 0) {
        setToast({ type: "error", message: "No broken thumbnails found in filtered list to retry." });
        return;
      }
      
      try {
        for (const { post } of postsToRetry) {
          const updatedPost = {
            thumbnailStatus: "pending" as const,
            thumbnailAttempts: 0,
          };
          await db.posts.update(post.id, updatedPost);
          usePostStore.getState().updatePost(post.id, updatedPost);
        }
        setToast({ type: "success", message: `Re-triggering ${postsToRetry.length} thumbnail extractions in background...` });
        const { runThumbnailWorker } = await import("../../lib/thumbnailWorker");
        runThumbnailWorker();
      } catch (err) {
        console.error("Bulk retry failed", err);
        setToast({ type: "error", message: "Failed to run bulk thumbnail retry." });
      }
    };

    const handleBulkDeleteDead = async () => {
      if (filteredDeadPosts.length === 0) return;
      try {
        const idsToDelete = filteredDeadPosts.map(item => item.post.id);
        for (const id of idsToDelete) {
          await db.posts.delete(id);
        }
        const fresh = await db.posts.toArray();
        setPosts(fresh);
        setShowBulkDeleteConfirm(false);
        setToast({ type: "success", message: `Successfully deleted ${idsToDelete.length} unoptimized entries.` });
      } catch (err) {
        console.error("Bulk delete failed", err);
        setToast({ type: "error", message: "Failed to run bulk delete." });
      }
    };

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
        await db.posts.clear();
        setPosts([]);
        setShowConfirmClear(false);
        setToast({
          type: "success",
          message: "All post records and thumbnails cleared successfully.",
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
        await db.posts.clear();
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

    const handleLoadSamples = useCallback(async () => {
      try {
        await db.posts.clear();
        await db.posts.bulkPut(SAMPLE_POSTS.map(normalizeInstagramPost));
        const fresh = await db.posts.toArray();
        setPosts(fresh);
        setToast({
          type: "success",
          message: "Successfully loaded sample posts!",
        });
      } catch (err) {
        console.error(err);
        setToast({ type: "error", message: "Failed to load sample posts." });
      }
    }, [setPosts]);


    const handleConsolidateTags = async () => {
      if (!posts || posts.length === 0) {
        setToast({ type: "error", message: "No posts to consolidate." });
        return;
      }

      const normalizedMap = new Map<
        string,
        { original: string; count: number }[]
      >();

      posts.forEach((post) => {
        post.tags?.forEach((tag) => {
          const norm = tag
            .toLowerCase()
            .trim()
            .replace(/[-_]/g, " ")
            .replace(/\s+/g, " ");
          if (!norm) return;

          if (!normalizedMap.has(norm)) {
            normalizedMap.set(norm, []);
          }
          const variations = normalizedMap.get(norm)!;
          const existing = variations.find((v) => v.original === tag);
          if (existing) {
            existing.count++;
          } else {
            variations.push({ original: tag, count: 1 });
          }
        });
      });

      const canonicalMap = new Map<string, string>();
      normalizedMap.forEach((variations) => {
        const canonical = variations.reduce((prev, current) =>
          prev.count > current.count ? prev : current,
        ).original;
        variations.forEach((v) => {
          canonicalMap.set(v.original, canonical);
        });
      });

      let updatedCount = 0;
      const updatedPosts = posts.map((post) => {
        if (!post.tags || post.tags.length === 0) return post;

        const newTags = Array.from(
          new Set(post.tags.map((tag) => canonicalMap.get(tag) || tag)),
        );

        const tagsChanged =
          post.tags.length !== newTags.length ||
          !post.tags.every((tag, i) => tag === newTags[i]);

        if (tagsChanged) {
          updatedCount++;
          return { ...post, tags: newTags };
        }
        return post;
      });

      if (updatedCount > 0) {
        usePostStore.getState().setPosts(updatedPosts);

        try {
          const changedPosts = updatedPosts.filter((p, i) => p !== posts[i]);
          await db.posts.bulkPut(changedPosts);
          setToast({
            type: "success",
            message: `Consolidated tags across ${updatedCount} posts.`,
          });
        } catch (err) {
          console.error("Failed to update database", err);
          setToast({ type: "error", message: "Failed to update database." });
        }
      } else {
        setToast({
          type: "success",
          message: "All tags are already optimized!",
        });
      }
    };

    const handleAnalyzeDuplicates = async () => {
      try {
        const getBaseUrl = (url?: string) => {
          if (!url) return "";
          try {
            const u = new URL(url);
            let clean = u.hostname + u.pathname;
            if (clean.endsWith("/")) clean = clean.slice(0, -1);
            return clean;
          } catch {
            return url.split("?")[0];
          }
        };

        const urlGroups = new Map<string, typeof posts>();
        posts.forEach((p) => {
          const base = getBaseUrl(p.postUrl);
          if (base) {
            const group = urlGroups.get(base) || [];
            group.push(p);
            urlGroups.set(base, group);
          }
        });

        let mergedCount = 0;
        let deletedCount = 0;

        for (const [group] of Array.from(urlGroups.entries())) {
          const list = urlGroups.get(group)!;
          if (list.length > 1) {
            list.sort(
              (a, b) =>
                new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime(),
            );

            const primary = list[0];
            const others = list.slice(1);

            const mergedTags = new Set(primary.tags || []);
            const mergedCollections = new Set(primary.collections || []);
            let mergedIsFavorite = primary.isFavorite;
            let mergedIsArchived = primary.isArchived;
            let mergedReadLater = primary.readLater;
            let mergedNotes = primary.notes || "";

            for (const other of others) {
              other.tags?.forEach((t) => mergedTags.add(t));
              other.collections?.forEach((c) => mergedCollections.add(c));
              if (other.isFavorite) mergedIsFavorite = true;
              if (other.isArchived) mergedIsArchived = true;
              if (other.readLater) mergedReadLater = true;
              if (other.notes && !mergedNotes.includes(other.notes)) {
                mergedNotes += mergedNotes ? `\n${other.notes}` : other.notes;
              }
              await db.posts.delete(other.id);
              deletedCount++;
            }

            const updates = {
              tags: Array.from(mergedTags),
              collections: Array.from(mergedCollections),
              isFavorite: mergedIsFavorite,
              isArchived: mergedIsArchived,
              readLater: mergedReadLater,
              notes: mergedNotes,
            };

            await db.posts.update(primary.id, updates);
            mergedCount++;
          }
        }

        if (mergedCount > 0) {
          const fresh = await db.posts.toArray();
          setPosts(fresh);
          setToast({
            type: "success",
            message: `Found and merged ${mergedCount} duplicated groups (removed ${deletedCount} redundant posts).`,
          });
        } else {
          setToast({
            type: "success",
            message: "No duplicates found. Your library is clean!",
          });
        }
      } catch (err) {
        console.error(err);
        setToast({ type: "error", message: "Failed to analyze duplicates." });
      }
    };

    const TABS = [
      { id: "profile" as const, label: "Curator Profile", icon: User, desc: "Credentials & metrics" },
      { id: "appearance" as const, label: "Appearance & Style", icon: MonitorSmartphone, desc: "Theme & visual preferences" },
      { id: "maintenance" as const, label: "Maintenance & Tools", icon: RefreshCw, desc: "Database & optimization scripts" },
      { id: "diagnostics" as const, label: "Diagnostic Hub", icon: ShieldAlert, desc: "Find and repair bad links", badge: filteredDeadPosts.length },
    ];

    return (
      <div className="flex-1 bg-m3-surface overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full select-none">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-semibold ${
                toast.type === "success"
                  ? "bg-m3-surface border-m3-outline-variant/30 text-m3-primary dark:bg-zinc-900"
                  : "bg-red-50 text-red-800 border-red-100 dark:bg-red-950 dark:text-red-300 dark:border-red-900/50"
              }`}
            >
              {toast.type === "success" ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <ShieldAlert size={14} className="text-red-500" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          {/* Header Title Block - Clean & Spacious */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-m3-outline-variant/15">
            <div className="flex items-center gap-2.5">
              {onNavigate && (
                <button
                  onClick={() => onNavigate("home")}
                  className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer hover:scale-105 active:scale-95 shadow-2xs shrink-0"
                  title="Back to Home"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="space-y-0.5">
                <h2 className="text-base font-bold font-display tracking-tight text-m3-on-surface">
                  {t.title}
                </h2>
              </div>
            </div>
            
            <div className="flex overflow-x-auto md:flex-wrap items-center gap-2 max-w-full pb-2.5 md:pb-0 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-m3-primary hover:bg-m3-primary/5 rounded-full border border-m3-outline-variant transition-all cursor-pointer bg-m3-surface hover:border-m3-primary/30 shrink-0 shadow-2xs active:scale-95"
              >
                <Plus size={12} className="stroke-[2.5]" />
                <span>Add Bookmark</span>
              </button>

              {onNavigate && (
                <button
                  onClick={() =>
                    usePostStore.getState().setIsImportModalOpen(true)
                  }
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-m3-on-surface-variant hover:bg-m3-surface-variant/20 rounded-full border border-m3-outline-variant transition-all cursor-pointer bg-m3-surface shrink-0 active:scale-95"
                >
                  <Upload size={12} />
                  <span>Import More</span>
                </button>
              )}

              <button
                onClick={exportData}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-m3-primary text-m3-on-primary hover:shadow-md hover:bg-opacity-95 rounded-full transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
              >
                <Layers size={12} />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => setShowConfirmClear(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-600 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-600 dark:hover:text-white rounded-full border border-red-500/20 dark:border-red-500/30 hover:border-red-600 transition-all cursor-pointer active:scale-95 shadow-2xs shrink-0"
              >
                <Trash2 size={12} />
                <span>Clear All Posts</span>
              </button>
            </div>
          </div>

          {/* Subnavigation Segment Row (Mobile tabs scroll horizontally) */}
          <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none select-none">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 ${
                    isActive
                      ? "bg-m3-primary text-m3-on-primary border-m3-primary shadow-sm"
                      : "bg-m3-surface border-m3-outline-variant/60 text-m3-on-surface-variant hover:text-m3-on-surface"
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      isActive ? "bg-m3-on-primary text-m3-primary" : "bg-red-500 text-white animate-pulse"
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Grid Layout Container */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Sidebar Tab Navigation (Desktop Only) */}
            <div className="hidden md:flex md:col-span-3 flex-col gap-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left p-3.5 rounded-[16px] border transition-all duration-200 cursor-pointer flex items-start gap-3 select-none relative group ${
                      isActive
                        ? "bg-m3-surface-low border-m3-outline-variant text-m3-on-surface shadow-xs font-bold"
                        : "bg-transparent border-transparent text-m3-on-surface-variant hover:bg-m3-surface-variant/20 hover:text-m3-on-surface"
                    }`}
                  >
                    <div className={`p-2 rounded-xl transition-all ${
                      isActive ? "bg-m3-primary text-m3-on-primary" : "bg-m3-surface-container text-m3-outline group-hover:text-m3-on-surface"
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-xs font-bold font-display">{tab.label}</div>
                      <div className="text-[10px] text-m3-on-surface-variant font-semibold mt-0.5 truncate">{tab.desc}</div>
                    </div>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold leading-none animate-pulse">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Main Content Pane (Desktop and Mobile) */}
            <div className="md:col-span-9">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={animationsEnabled ? { opacity: 0, y: 12 } : {}}
                  animate={animationsEnabled ? { opacity: 1, y: 0 } : {}}
                  exit={animationsEnabled ? { opacity: 0, y: -8 } : {}}
                  transition={
                    animationsEnabled
                      ? {
                          type: "tween",
                          ease: [0.16, 1, 0.3, 1], // easeOutExpo
                          duration: 0.45,
                        }
                      : { duration: 0 }
                  }
                >
                  {activeTab === "profile" && (
                    <ProfileTab
                      displayName={displayName}
                      setDisplayName={setDisplayName}
                      username={username}
                      setUsername={setUsername}
                      email={email}
                      setEmail={setEmail}
                      isEditing={isEditing}
                      setIsEditing={setIsEditing}
                      handleSaveProfile={handleSaveProfile}
                      totalPosts={totalPosts}
                      activeCount={activeCount}
                      archivedCount={archivedCount}
                      favoritesCount={favoritesCount}
                      uniqueTags={uniqueTags}
                      storageInfo={storageInfo}
                    />
                  )}

                  {activeTab === "appearance" && (
                    <AppearanceTab
                      theme={theme}
                      onThemeToggle={onThemeToggle}
                      animationsEnabled={animationsEnabled}
                      setAnimationsEnabled={handleSetAnimationsEnabled}
                      compactMode={compactMode}
                      setCompactMode={handleSetCompactMode}
                    />
                  )}

                  {activeTab === "maintenance" && (
                    <MaintenanceTab
                      handleConsolidateTags={handleConsolidateTags}
                      retryFailedThumbnails={handleBulkRetryDead}
                      setToast={setToast}
                      handleAnalyzeDuplicates={handleAnalyzeDuplicates}
                      handleLoadSamples={handleLoadSamples}
                      setShowConfirmClear={setShowConfirmClear}
                      setShowConfirmClearAll={setShowConfirmClearAll}
                    />
                  )}

                  {activeTab === "diagnostics" && (
                    <DiagnosticsTab
                      filteredDeadPosts={filteredDeadPosts}
                      optSearch={optSearch}
                      setOptSearch={setOptSearch}
                      optFilter={optFilter}
                      setOptFilter={setOptFilter}
                      handleBulkRetryDead={handleBulkRetryDead}
                      showBulkDeleteConfirm={showBulkDeleteConfirm}
                      setShowBulkDeleteConfirm={setShowBulkDeleteConfirm}
                      handleBulkDeleteDead={handleBulkDeleteDead}
                      retryingIds={retryingIds}
                      handleRetrySingle={handleRetrySingle}
                      handleDeleteSingleDead={handleDeleteSingleDead}
                      theme={theme}
                      displayName={displayName}
                      username={username}
                      email={email}
                      animationsEnabled={animationsEnabled}
                      compactMode={compactMode}
                    />
                  )}

                </motion.div>
              </AnimatePresence>
            </div>
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
                      We strongly recommend creating a backup of your local database before clearing. Once cleared, all saved posts, collections, and custom curation notes will be permanently deleted and **cannot be undone**.
                    </p>
                  </div>
                </div>

                <div className="bg-m3-surface-container/50 border border-m3-outline-variant/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-m3-on-surface font-sans">
                      <Layers size={14} className="text-m3-primary" />
                      <span>Download Archive</span>
                    </div>
                    <span className="text-[10px] font-mono text-m3-outline font-semibold">
                      {posts.length} records
                    </span>
                  </div>
                  <p className="text-[11px] text-m3-on-surface-variant leading-normal font-sans">
                    Export your curated library into a JSON file so you can restore or migrate it at any time.
                  </p>
                  <button
                    onClick={() => {
                      exportData();
                      setToast({
                        type: "success",
                        message: "Backup export completed successfully!",
                      });
                    }}
                    className="w-full flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-xl py-2 text-xs font-bold hover:bg-m3-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Layers size={14} />
                    <span>Download JSON Backup</span>
                  </button>
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
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-colors shadow-sm text-center font-sans active:scale-95"
                  >
                    Skip Backup & Clear All Posts
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal for Clearing All Data & LocalStorage */}
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
                      This will permanently wipe **all** bookmark records from IndexedDB and clear **all** local storage settings (including your display name, email, customized layouts, and theme). The app will be restored to its raw initial default state. **This cannot be undone.**
                    </p>
                  </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-600 font-sans">
                    <ShieldAlert size={14} />
                    <span>Immediate Action Required</span>
                  </div>
                  <p className="text-[11px] text-m3-on-surface-variant leading-relaxed font-sans">
                    To preserve your curation work, you should export a backup JSON file before proceeding with this hard reset.
                  </p>
                  <button
                    onClick={() => {
                      exportData();
                      setToast({
                        type: "success",
                        message: "Backup export completed successfully!",
                      });
                    }}
                    className="w-full flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-xl py-2 text-xs font-bold hover:bg-m3-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Layers size={14} />
                    <span>Download JSON Backup First</span>
                  </button>
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
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-colors shadow-sm text-center font-sans active:scale-95"
                  >
                    Wipe Everything &amp; Reload
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>


        {/* Manual Bookmark Creator Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <AddBookmarkModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onAdd={async (newPost) => {
                await db.posts.put(newPost);
                const fresh = await db.posts.toArray();
                setPosts(fresh);
                setToast({
                  type: "success",
                  message: "Bookmark added successfully!",
                });
              }}
              allTags={allTags}
              allCollections={allCollections}
            />
          )}
        </AnimatePresence>


      </div>
    );
  },
);
