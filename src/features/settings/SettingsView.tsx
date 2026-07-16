import React, { useState, useEffect, useMemo } from "react";
import {
  User,
  Mail,
  Database,
  Trash2,
  RefreshCw,
  BarChart3,
  Layers,
  Heart,
  Archive,
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
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { retryFailedThumbnails } from "../../lib/thumbnailWorker";
import { SAMPLE_POSTS } from "../../data/samplePosts";
import { normalizeInstagramPost } from "../../lib/parser";
import { AddBookmarkModal } from "../../components/ui/AddBookmarkModal";
import { VOCABULARY } from "../../constants/vocabulary";
import { classifyInstagramPost } from "../../lib/instagramClassifier";

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
    const { posts, setPosts } = usePostStore();
    const [showConfirmClear, setShowConfirmClear] = useState(false);
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
    const [compactMode, setCompactMode] = useState(
      () => localStorage.getItem("instasorter_compact") === "true",
    );

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
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    const [sandboxInput, setSandboxInput] = useState("");
    const [sandboxResult, setSandboxResult] = useState<any>(null);
    const [sandboxError, setSandboxError] = useState<string | null>(null);

    const CLASSIFIER_EXAMPLES = {
      reel: {
        title: "Reel",
        json: JSON.stringify({
          url: "https://www.instagram.com/reel/C7-xyz/",
          caption: "My standard Reel post!"
        }, null, 2)
      },
      carousel_sidecar: {
        title: "Carousel (GraphSidecar)",
        json: JSON.stringify({
          url: "https://www.instagram.com/p/C8-abc/",
          __typename: "GraphSidecar",
          caption: "A Multi-slide carousel showcase."
        }, null, 2)
      },
      carousel_album: {
        title: "Carousel (CAROUSEL_ALBUM)",
        json: JSON.stringify({
          url: "https://www.instagram.com/p/C9-def/",
          media_type: "CAROUSEL_ALBUM",
          carousel_media: [
            { media_url: "https://images.unsplash.com/photo-1" },
            { media_url: "https://images.unsplash.com/photo-2" }
          ],
          caption: "A carousel post with an array."
        }, null, 2)
      },
      single_image: {
        title: "Single Image",
        json: JSON.stringify({
          url: "https://www.instagram.com/p/C10-ghi/",
          __typename: "GraphImage",
          display_url: "https://images.unsplash.com/photo-1547082299-de196ea013d6",
          caption: "Exactly one image."
        }, null, 2)
      },
      video: {
        title: "Video",
        json: JSON.stringify({
          url: "https://www.instagram.com/p/C11-jkl/",
          media_type: "VIDEO",
          __typename: "GraphVideo",
          caption: "Watch this video"
        }, null, 2)
      },
      unknown: {
        title: "Unknown",
        json: JSON.stringify({
          url: "https://www.instagram.com/p/C12-mno/",
          caption: "Only a /p/ URL with no metadata."
        }, null, 2)
      }
    };

    const handleRunClassifier = (inputStr: string) => {
      if (!inputStr.trim()) {
        setSandboxResult(null);
        setSandboxError(null);
        return;
      }
      try {
        const parsed = JSON.parse(inputStr);
        setSandboxError(null);
        const result = classifyInstagramPost(parsed);
        setSandboxResult(result);
      } catch (err: any) {
        setSandboxError(`JSON Parse Error: ${err.message}`);
        setSandboxResult(null);
      }
    };

    const [collectionLayout, setCollectionLayout] = useState<"grid" | "list">(
      "grid",
    );

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

    const lastSyncTime = useMemo(() => {
      if (!posts || posts.length === 0) return "Never";
      const sorted = [...posts].sort(
        (a, b) =>
          new Date(b.savedAt || 0).getTime() -
          new Date(a.savedAt || 0).getTime(),
      );

      if (!sorted[0] || !sorted[0].savedAt) return "Never";

      const date = new Date(sorted[0].savedAt);
      if (isNaN(date.getTime())) return "Never";

      try {
        return new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        }).format(date);
      } catch (e) {
        return "Never";
      }
    }, [posts]);

    // Smart User Detail Inference: If the user hasn't explicitly edited their details and we have posts,
    // automatically suggest/fill their actual Instagram username from their data!
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

    // Aggregate collections with post counts and sample thumbnails
    const collectionsData = useMemo(() => {
      return allCollections
        .map((colName) => {
          const postsInCol = posts.filter((p) =>
            p.collections?.includes(colName),
          );
          const thumbnails = postsInCol
            .filter((p) => p.thumbnailUrl)
            .slice(0, 4)
            .map((p) => p.thumbnailUrl);
          return {
            name: colName,
            count: postsInCol.length,
            thumbnails,
          };
        })
        .sort((a, b) => b.count - a.count);
    }, [posts, allCollections]);

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

    const uniqueCollections = allCollections.length;
    const uniqueTags = allTags.length;

    const handleSaveProfile = () => {
      localStorage.setItem("instasorter_displayName", displayName);
      localStorage.setItem("instasorter_username", username);
      localStorage.setItem("instasorter_email", email);
      setIsEditing(false);
      setToast({
        type: "success",
        message: "Profile details updated successfully!",
      });
    };

    const handleClearAllPosts = async () => {
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
    };

    const handleLoadSamples = async () => {
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
    };

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
      normalizedMap.forEach((variations, norm) => {
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
        // Find duplicates by extracting the base shortcode/URL
        const getBaseUrl = (url?: string) => {
          if (!url) return "";
          try {
            const u = new URL(url);
            // Just domain + pathname, ignore query strings
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

        for (const [base, group] of Array.from(urlGroups.entries())) {
          if (group.length > 1) {
            // We have duplicates! Merge them.
            // Sort by newest savedAt to keep the latest as primary
            group.sort(
              (a, b) =>
                new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
            );

            const primary = group[0];
            const others = group.slice(1);

            // Merge metadata
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
              // Delete the duplicate
              await db.posts.delete(other.id);
              deletedCount++;
            }

            // Update primary
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

    return (
      <div className="flex-1 bg-m3-surface overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full select-none">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg border text-xs font-medium ${
                toast.type === "success"
                  ? "bg-m3-primary/5 text-m3-primary border-m3-primary/20 dark:bg-emerald-950 dark:text-m3-primary dark:border-m3-primary"
                  : "bg-red-50 text-red-800 border-red-100 dark:bg-red-950 dark:text-red-300 dark:border-red-900/50"
              }`}
            >
              {toast.type === "success" ? (
                <Check size={14} />
              ) : (
                <ShieldAlert size={14} />
              )}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-m3-primary hover:bg-m3-primary/5 rounded-full border border-m3-outline-variant transition-all cursor-pointer bg-m3-surface hover:border-m3-primary/30"
              >
                <Plus size={12} className="stroke-[2.5]" />
                <span>Add Bookmark</span>
              </button>

              {onNavigate && (
                <button
                  onClick={() =>
                    usePostStore.getState().setIsImportModalOpen(true)
                  }
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-m3-on-surface-variant hover:bg-m3-surface-variant/20 rounded-full border border-m3-outline-variant transition-all cursor-pointer bg-m3-surface"
                >
                  <Upload size={12} />
                  <span>Import More</span>
                </button>
              )}

              <button
                onClick={exportData}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-m3-primary text-m3-on-primary hover:shadow-md hover:bg-opacity-95 rounded-full transition-all cursor-pointer shadow-xs"
              >
                <Layers size={12} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="space-y-6 mt-4">
            {/* Profile Settings Section */}
            <div>
              <h3 className="text-sm font-bold font-display text-m3-on-surface flex items-center gap-1.5 pl-1 mb-2">
                <User size={16} className="text-m3-primary" />
                <span>{t.profileSectionTitle}</span>
              </h3>

              <div className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-3xl shadow-sm overflow-hidden relative flex flex-col">
                <div className="h-24 sm:h-32 bg-gradient-to-r from-m3-primary/20 via-m3-primary/10 to-m3-primary/20 w-full shrink-0" />

                <div className="px-5 sm:px-8 pb-6 pt-0 relative flex flex-col sm:flex-row gap-5 sm:items-end -mt-10 sm:-mt-12">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-m3-surface border-4 border-m3-surface text-m3-primary flex items-center justify-center font-display font-bold text-2xl sm:text-3xl shadow-sm shrink-0 relative overflow-hidden z-10">
                    <div className="absolute inset-0 bg-m3-primary-container/50" />
                    <span className="relative z-10">
                      {displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .substring(0, 2)}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 sm:mt-0">
                    {isEditing ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                            {t.displayNameLabel}
                          </label>
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-m3-surface-container rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans"
                            placeholder="Enter name"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                            {t.usernameLabel}
                          </label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-m3-surface-container rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans"
                            placeholder="Enter Instagram username"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                            {t.emailLabel}
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-m3-surface-container rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans"
                            placeholder="Enter email"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl sm:text-2xl font-bold font-display text-m3-on-surface flex items-center gap-2 truncate">
                          {displayName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-m3-on-surface-variant">
                          <span className="font-medium text-m3-primary">
                            @{username}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="opacity-70" /> {email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Database size={12} className="opacity-70" />{" "}
                            {t.roleLabel}: Archivist
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                      {isEditing ? (
                        <button
                          onClick={handleSaveProfile}
                          className="flex items-center gap-1.5 bg-m3-primary text-white rounded-xl px-4 py-2 text-xs font-bold cursor-pointer hover:bg-m3-primary/95 hover:shadow-md transition-all"
                        >
                          <Save size={14} />
                          <span>{t.saveProfileBtn}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-1.5 border border-m3-outline-variant/50 hover:border-m3-primary hover:text-m3-primary bg-m3-surface-container rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-all shadow-sm"
                        >
                          <Edit2 size={12} />
                          <span>{t.editProfileBtn}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Appearance & Interface Section */}
            <div className="mt-8">
              <h3 className="text-sm font-bold font-display text-m3-on-surface flex items-center gap-1.5 pl-1 mb-2">
                <MonitorSmartphone size={16} className="text-m3-primary" />
                <span>{t.appearanceSectionTitle}</span>
              </h3>

              <div className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-3xl shadow-sm overflow-hidden flex flex-col divide-y divide-m3-outline-variant/10">
                {/* Theme Toggle */}
                <div className="p-5 sm:px-6 flex items-center justify-between hover:bg-m3-surface-variant/5 transition-colors">
                  <div className="flex-1 pr-4">
                    <h4 className="text-sm font-bold text-m3-on-surface mb-0.5">
                      {t.themeLabel}
                    </h4>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed">
                      {t.themeDesc}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center bg-m3-surface-container rounded-xl p-1 border border-m3-outline-variant/20 shadow-xs">
                    <button
                      onClick={() =>
                        onThemeToggle && theme === "dark" && onThemeToggle()
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        theme === "light"
                          ? "bg-m3-surface text-m3-primary shadow-sm border border-m3-outline-variant/30"
                          : "text-m3-on-surface-variant hover:text-m3-on-surface"
                      }`}
                    >
                      <Sun
                        size={14}
                        className={theme === "light" ? "text-m3-primary" : ""}
                      />
                      <span className="hidden sm:inline">{t.lightMode}</span>
                    </button>
                    <button
                      onClick={() =>
                        onThemeToggle && theme === "light" && onThemeToggle()
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        theme === "dark"
                          ? "bg-m3-surface text-m3-primary shadow-sm border border-m3-outline-variant/30"
                          : "text-m3-on-surface-variant hover:text-m3-on-surface"
                      }`}
                    >
                      <Moon
                        size={14}
                        className={theme === "dark" ? "text-m3-primary" : ""}
                      />
                      <span className="hidden sm:inline">{t.darkMode}</span>
                    </button>
                  </div>
                </div>

                {/* Interface Animations */}
                <div className="p-5 sm:px-6 flex items-center justify-between hover:bg-m3-surface-variant/5 transition-colors">
                  <div className="flex-1 pr-4">
                    <h4 className="text-sm font-bold text-m3-on-surface mb-0.5">
                      {t.animationsLabel}
                    </h4>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed">
                      {t.animationsDesc}
                    </p>
                  </div>
                  <button
                    onClick={() => setAnimationsEnabled(!animationsEnabled)}
                    className={`shrink-0 transition-colors cursor-pointer ${animationsEnabled ? "text-m3-primary" : "text-m3-outline"}`}
                  >
                    {animationsEnabled ? (
                      <ToggleRight size={32} />
                    ) : (
                      <ToggleLeft size={32} />
                    )}
                  </button>
                </div>

                {/* Compact List View */}
                <div className="p-5 sm:px-6 flex items-center justify-between hover:bg-m3-surface-variant/5 transition-colors">
                  <div className="flex-1 pr-4">
                    <h4 className="text-sm font-bold text-m3-on-surface mb-0.5">
                      {t.compactModeLabel}
                    </h4>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed">
                      {t.compactModeDesc}
                    </p>
                  </div>
                  <button
                    onClick={() => setCompactMode(!compactMode)}
                    className={`shrink-0 transition-colors cursor-pointer ${compactMode ? "text-m3-primary" : "text-m3-outline"}`}
                  >
                    {compactMode ? (
                      <ToggleRight size={32} />
                    ) : (
                      <ToggleLeft size={32} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Library Statistics Bento Grid Layout */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold font-mono uppercase tracking-wider text-m3-outline flex items-center gap-1.5 pl-1">
              <BarChart3 size={12} className="text-m3-primary" />
              <span>Library Diagnostics</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1 */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-m3-outline-variant/35 transition-all">
                <div className="flex items-center justify-between text-m3-outline mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
                    Total Posts
                  </span>
                  <div className="w-6 h-6 rounded-md bg-m3-surface-container flex items-center justify-center">
                    <Layers size={12} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold font-display text-m3-on-surface leading-none mb-1">
                    {totalPosts}
                  </p>
                  <p className="text-[10px] text-m3-outline font-medium">
                    {activeCount} active • {archivedCount} arch.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-m3-outline-variant/35 transition-all">
                <div className="flex items-center justify-between text-m3-outline mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
                    Favorites
                  </span>
                  <div className="w-6 h-6 rounded-md bg-m3-primary/5 text-m3-primary dark:bg-m3-primary/50/10 flex items-center justify-center">
                    <Heart size={12} className="fill-twitter-pink/20" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold font-display text-m3-on-surface leading-none mb-1">
                    {favoritesCount}
                  </p>
                  <p className="text-[10px] text-m3-outline font-medium">
                    {totalPosts > 0
                      ? `${Math.round((favoritesCount / totalPosts) * 100)}%`
                      : "0%"}{" "}
                    starred
                  </p>
                </div>
              </div>

              {/* Card 5 (Now Card 3) */}
              <div className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-m3-outline-variant/35 transition-all">
                <div className="flex items-center justify-between text-m3-outline mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
                    Unique Tags
                  </span>
                  <div className="w-6 h-6 rounded-md bg-[#7D5260]/10 text-[#7D5260] flex items-center justify-center">
                    <Hash size={12} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold font-display text-m3-on-surface leading-none mb-1">
                    {uniqueTags}
                  </p>
                  <p className="text-[10px] text-m3-outline font-medium">
                    Active tags
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Saved Post Collections & Folders Section (High-fidelity Grid/List Toggle) */}
          <div className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold font-display text-m3-on-surface flex items-center gap-1.5">
                  <Folder size={16} className="text-m3-primary" />
                  <span>Saved Collections &amp; Folders</span>
                </h3>
                <p className="text-[11px] text-m3-on-surface-variant max-w-2xl">
                  Browse cataloged Instagram collections in high-fidelity grid
                  or compact list form.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-m3-surface-container/60 p-1 rounded-lg border border-m3-outline-variant/10 self-start sm:self-auto">
                <button
                  onClick={() => setCollectionLayout("grid")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    collectionLayout === "grid"
                      ? "bg-m3-surface text-m3-primary shadow-xs font-bold"
                      : "text-m3-outline hover:text-m3-on-surface"
                  }`}
                  title="Grid Layout"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setCollectionLayout("list")}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    collectionLayout === "list"
                      ? "bg-m3-surface text-m3-primary shadow-xs font-bold"
                      : "text-m3-outline hover:text-m3-on-surface"
                  }`}
                  title="List Layout"
                >
                  <List size={13} />
                </button>
              </div>
            </div>

            {collectionsData.length === 0 ? (
              <div className="border border-dashed border-m3-outline-variant/30 rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-1">
                <Folder size={24} className="text-m3-outline/40" />
                <p className="text-xs font-bold text-m3-on-surface-variant">
                  No collections created yet
                </p>
                <p className="text-[10px] text-m3-outline max-w-sm">
                  Add folders or categorize posts in the Dashboard view to
                  populate your visual collections grid.
                </p>
              </div>
            ) : (
              <motion.div
                layout
                className={
                  collectionLayout === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "flex flex-col gap-2"
                }
              >
                <AnimatePresence mode="popLayout">
                  {collectionsData.map((col) => (
                    <motion.div
                      layout
                      key={col.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={`bg-m3-surface border border-m3-outline-variant/15 hover:border-m3-primary/30 rounded-xl transition-all shadow-xs overflow-hidden group/col flex ${
                        collectionLayout === "grid"
                          ? "flex-col p-3 space-y-2.5"
                          : "flex-row p-2.5 items-center justify-between gap-3"
                      }`}
                    >
                      {/* Collages / Thumbnails preview block for Grid layout */}
                      {collectionLayout === "grid" ? (
                        <div className="aspect-[16/10] bg-m3-surface-container/50 rounded-lg overflow-hidden grid grid-cols-4 gap-1 p-1 shrink-0 relative">
                          {col.thumbnails.length === 0 ? (
                            <div className="col-span-4 h-full flex items-center justify-center text-m3-outline/20">
                              <Folder size={28} className="stroke-[1.5]" />
                            </div>
                          ) : (
                            col.thumbnails.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt="col-thumb"
                                referrerPolicy="no-referrer"
                                className={`h-full w-full object-cover rounded-md border border-black/5 ${
                                  col.thumbnails.length === 1
                                    ? "col-span-4"
                                    : col.thumbnails.length === 2
                                      ? "col-span-2"
                                      : col.thumbnails.length === 3 && i === 0
                                        ? "col-span-2 row-span-2"
                                        : col.thumbnails.length === 3
                                          ? "col-span-2"
                                          : "col-span-1"
                                }`}
                              />
                            ))
                          )}
                          <span className="absolute top-2 left-2 bg-m3-surface/90 backdrop-blur-xs text-[9px] font-mono font-bold text-m3-primary px-1.5 py-0.5 rounded-full border border-m3-outline-variant/10 shadow-xs">
                            {col.count} {col.count === 1 ? "post" : "posts"}
                          </span>
                        </div>
                      ) : (
                        // Thumbnails row for List layout
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-8 h-8 rounded-lg bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center shrink-0">
                            <Folder size={14} />
                          </div>
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {col.thumbnails.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt="col-thumb"
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 object-cover rounded-full border border-m3-surface shadow-xs shrink-0"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata details / Buttons */}
                      <div
                        className={
                          collectionLayout === "grid"
                            ? "space-y-2"
                            : "flex-1 flex items-center justify-between min-w-0"
                        }
                      >
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-m3-on-surface truncate pr-2 group-hover/col:text-m3-primary transition-colors">
                            {col.name}
                          </h4>
                          {collectionLayout === "list" && (
                            <p className="text-[9px] font-mono text-m3-outline mt-0.5">
                              {col.count} items
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (onSelectCollection) {
                              onSelectCollection(col.name);
                            } else if (onNavigate) {
                              onNavigate("home");
                            }
                          }}
                          className={`flex items-center gap-1 text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                            collectionLayout === "grid"
                              ? "w-full justify-center bg-m3-surface-container/40 group-hover/col:bg-m3-primary/10 text-m3-primary rounded-lg py-1.5 border border-m3-outline-variant/10"
                              : "bg-m3-surface border border-m3-outline-variant/15 hover:border-m3-primary/30 text-m3-primary hover:bg-m3-primary/5 px-2.5 py-1 rounded-lg"
                          }`}
                        >
                          <span>View Library</span>
                          <ChevronRight size={10} className="stroke-[2.5]" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Database Status Widget */}
          <div className="space-y-4 mt-6">
            <div>
              <h3 className="text-sm font-bold font-display text-m3-on-surface flex items-center gap-1.5 pl-1">
                <Database size={16} className="text-m3-primary" />
                <span>Database Status</span>
              </h3>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5 max-w-2xl leading-normal pl-1">
                Real-time metrics for your local IndexedDB storage instance.
              </p>
            </div>

            <div className="bg-m3-surface border border-m3-outline-variant/15 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-m3-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />

              {/* Storage Progress */}
              <div className="space-y-2 relative z-10">
                <div className="flex items-end justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-m3-on-surface font-mono uppercase tracking-wider mb-1">
                      Local Storage
                    </h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black font-display text-m3-primary leading-none">
                        {storageInfo
                          ? (storageInfo.usage / (1024 * 1024)).toFixed(1)
                          : "0.0"}
                      </span>
                      <span className="text-xs font-bold text-m3-on-surface-variant">
                        MB used
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-m3-outline uppercase tracking-wider">
                      {storageInfo
                        ? (storageInfo.quota / (1024 * 1024 * 1024)).toFixed(1)
                        : "10.0"}{" "}
                      GB Quota
                    </span>
                  </div>
                </div>

                <div className="h-3 w-full bg-m3-surface-container rounded-full overflow-hidden border border-m3-outline-variant/10">
                  <motion.div
                    className="h-full bg-m3-primary rounded-full relative"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${storageInfo ? storageInfo.percentage : 0}%`,
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  >
                    <div
                      className="absolute inset-0 bg-white/20"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)",
                        backgroundSize: "1rem 1rem",
                      }}
                    />
                  </motion.div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                <div className="bg-m3-surface-container/50 border border-m3-outline-variant/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-m3-secondary-container text-m3-on-secondary-container flex items-center justify-center shrink-0">
                    <Layers size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider mb-0.5">
                      Total Records
                    </p>
                    <p className="text-lg font-black font-display text-m3-on-surface leading-none">
                      {totalPosts}
                    </p>
                  </div>
                </div>

                <div className="bg-m3-surface-container/50 border border-m3-outline-variant/20 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-m3-primary/10 dark:bg-m3-primary/50/20 text-m3-primary dark:text-m3-primary flex items-center justify-center shrink-0">
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider mb-0.5">
                      Last Sync
                    </p>
                    <p className="text-sm font-bold font-display text-m3-on-surface leading-tight">
                      {lastSyncTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Library Optimization Utilities */}
          <div className="space-y-4 mt-8">
            <div>
              <h3 className="text-sm font-bold font-display text-m3-on-surface flex items-center gap-1.5 pl-1">
                <Layers size={16} className="text-m3-primary" />
                <span>Library Optimization</span>
              </h3>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5 max-w-2xl leading-normal pl-1">
                Utilities to organize and clean up your local library.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              
              {/* Retry Previews */}
              <div className="bg-m3-surface border border-m3-outline-variant/15 hover:border-m3-primary/100/30 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-sm group">
                <div className="mb-4">
                  <div className="w-8 h-8 rounded-full bg-m3-primary/50/10 text-m3-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon size={14} />
                  </div>
                  <h4 className="text-xs font-bold text-m3-on-surface mb-1">
                    Retry Failed Previews
                  </h4>
                  <p className="text-[10px] text-m3-on-surface-variant leading-relaxed">
                    Triggers a background process to re-download missing image previews for posts marked as failed.
                  </p>
                </div>
                <button
                  onClick={() => {
                    retryFailedThumbnails();
                    setToast({ type: "success", message: "Retrying failed previews in background..." });
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-m3-primary/5 hover:bg-m3-primary/10 dark:bg-m3-primary/50/10 dark:hover:bg-m3-primary/50/20 text-m3-primary dark:text-m3-primary rounded-xl py-2 text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-sm border border-m3-primary/30 dark:border-m3-primary/100/30"
                >
                  <RefreshCw size={12} />
                  <span>Retry Previews</span>
                </button>
              </div>

              {/* Consolidate Tags */}
              <div className="bg-m3-surface border border-m3-outline-variant/15 hover:border-m3-primary/100/30 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-sm group">
                <div className="mb-4">
                  <div className="w-8 h-8 rounded-full bg-m3-primary/50/10 text-m3-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Hash size={14} />
                  </div>
                  <h4 className="text-xs font-bold text-m3-on-surface mb-1">
                    Consolidate Tags
                  </h4>
                  <p className="text-[10px] text-m3-on-surface-variant leading-relaxed">
                    Scans all posts to merge similar and typo-ridden tags into
                    canonical versions, improving filter accuracy.
                  </p>
                </div>
                <button
                  onClick={handleConsolidateTags}
                  className="w-full flex items-center justify-center gap-1.5 bg-m3-primary/5 hover:bg-m3-primary/10 dark:bg-m3-primary/50/10 dark:hover:bg-m3-primary/50/20 text-m3-primary dark:text-m3-primary rounded-xl py-2 text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-sm border border-m3-primary/30 dark:border-m3-primary/100/30"
                >
                  <Hash size={12} />
                  <span>Optimize Tags</span>
                </button>
              </div>

              {/* Post Classifier Sandbox */}
              <div className="bg-m3-surface border border-m3-outline-variant/15 hover:border-m3-primary/100/30 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-sm group">
                <div className="mb-4">
                  <div className="w-8 h-8 rounded-full bg-m3-primary/50/10 text-m3-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Database size={14} />
                  </div>
                  <h4 className="text-xs font-bold text-m3-on-surface mb-1">
                    Post Classifier Sandbox
                  </h4>
                  <p className="text-[10px] text-m3-on-surface-variant leading-relaxed">
                    Test and debug classification of raw Instagram post JSON payloads against structural metadata rules.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsSandboxOpen(true);
                    const defaultEx = CLASSIFIER_EXAMPLES.reel.json;
                    setSandboxInput(defaultEx);
                    handleRunClassifier(defaultEx);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-m3-primary/5 hover:bg-m3-primary/10 dark:bg-m3-primary/50/10 dark:hover:bg-m3-primary/50/20 text-m3-primary dark:text-m3-primary rounded-xl py-2 text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-sm border border-m3-primary/30 dark:border-m3-primary/100/30"
                >
                  <Database size={12} />
                  <span>Launch Sandbox</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Clearing Database */}
        <AnimatePresence>
          {showConfirmClear && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmClear(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-md w-full p-6 shadow-2xl relative z-10 space-y-5"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold font-display text-m3-on-surface">
                      Confirm Library Purge?
                    </h3>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed">
                      This will delete all saved posts, tags, custom notes, and
                      collection data. This operation is local but **cannot be
                      undone**.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => setShowConfirmClear(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-full border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllPosts}
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-colors shadow-sm"
                  >
                    Yes, Clear All
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

        {/* Post Classifier Sandbox Modal */}
        <AnimatePresence>
          {isSandboxOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSandboxOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-4xl w-full p-6 shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden"
              >
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-m3-outline-variant/30">
                  <div>
                    <h3 className="text-lg font-bold font-display text-m3-on-surface">
                      Post Classifier Sandbox
                    </h3>
                    <p className="text-xs text-m3-on-surface-variant mt-0.5">
                      Verify classification output against Instagram post schemas.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSandboxOpen(false)}
                    className="text-m3-on-surface-variant hover:text-m3-on-surface p-1 rounded-full hover:bg-m3-outline-variant/20 transition-all cursor-pointer text-xl"
                  >
                    &times;
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Input Payload */}
                  <div className="space-y-4 flex flex-col h-[500px]">
                    <div>
                      <label className="text-xs font-bold text-m3-on-surface block mb-1">
                        Select an Example Payload:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(CLASSIFIER_EXAMPLES).map(([key, item]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setSandboxInput(item.json);
                              handleRunClassifier(item.json);
                            }}
                            className="px-2.5 py-1 text-[10px] font-semibold rounded-lg border border-m3-outline-variant text-m3-on-surface hover:bg-m3-primary/5 active:scale-95 transition-all cursor-pointer"
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="text-xs font-bold text-m3-on-surface block mb-1">
                        Raw Post JSON:
                      </label>
                      <textarea
                        value={sandboxInput}
                        onChange={(e) => {
                          setSandboxInput(e.target.value);
                          handleRunClassifier(e.target.value);
                        }}
                        placeholder="Paste raw Instagram post JSON here..."
                        className="flex-1 w-full bg-m3-surface border border-m3-outline-variant/60 rounded-2xl p-3 text-xs font-mono text-m3-on-surface focus:outline-none focus:border-m3-primary resize-none leading-relaxed shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Right Column: Result */}
                  <div className="space-y-4 flex flex-col h-[500px]">
                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="text-xs font-bold text-m3-on-surface block mb-1">
                        Classification Output:
                      </label>
                      <div className="flex-1 bg-black/95 dark:bg-black/85 rounded-2xl p-4 font-mono text-xs overflow-auto flex flex-col justify-between border border-white/10 shadow-lg">
                        {sandboxError ? (
                          <div className="text-red-400 whitespace-pre-wrap leading-relaxed">
                            {sandboxError}
                          </div>
                        ) : sandboxResult ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-white/10">
                              <span className="text-gray-400 font-bold">CLASSIFICATION SUCCESS</span>
                              <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md text-[10px] font-bold">100% VALID</span>
                            </div>
                            <pre className="text-green-400 leading-relaxed whitespace-pre-wrap">
                              {JSON.stringify(sandboxResult, null, 2)}
                            </pre>
                            <div className="space-y-1.5 pt-2 border-t border-white/10">
                              <span className="text-gray-400 font-bold text-[10px] block uppercase">Rule Explanation:</span>
                              <p className="text-[11px] text-gray-300 leading-normal font-sans">
                                {sandboxResult.type === "reel" && "Rules dictate that if the URL contains '/reel/', the post is classified as 'reel' with 100% confidence."}
                                {sandboxResult.type === "carousel" && "The structural metadata contains clear indicators of a carousel post (such as multiple items in children or album lists) taking priority over single media elements."}
                                {sandboxResult.type === "single_image" && "The metadata indicates a single image post (such as 'GraphImage' type or exactly one image URL/media object) without any secondary elements."}
                                {sandboxResult.type === "video" && "The post contains video indicators but lacks '/reel/' in the URL, hence it is classified as a standard feed video."}
                                {sandboxResult.type === "unknown" && "Insufficient metadata exists. A post URL ending with '/p/' without any other structural metadata cannot distinguish a single-image post from a carousel."}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500 flex items-center justify-center h-full">
                            Waiting for valid JSON input...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 justify-end pt-4 border-t border-m3-outline-variant/30">
                  <button
                    onClick={() => setIsSandboxOpen(false)}
                    className="px-5 py-2 text-xs font-semibold rounded-full bg-m3-primary text-white hover:bg-m3-primary/90 cursor-pointer transition-colors shadow-sm"
                  >
                    Done
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
