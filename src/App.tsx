/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

console.log("Math:", Math);
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shell } from "./components/layout/Shell";
import { ImportView } from "./features/import/ImportView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { SettingsView } from "./features/settings/SettingsView";
import { AnalyticsView } from "./features/analytics/AnalyticsView";
import { GroupedView } from "./features/grouped/GroupedView";
import { db } from "./lib/db";
import { usePostStore } from "./store/useStore";
import { Post } from "./types/post";
import { cleanInstagramUrl } from "./lib/parser";
import { validateThumbnailUrl } from "./lib/validation";
import { decodeInstagramText } from "./lib/parser";
import { Toaster } from "react-hot-toast";
import { SkeletonLoader } from "./components/ui/SkeletonLoader";
import { OnboardingView } from "./components/ui/OnboardingView";

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("instasorter_onboarding_completed") !== "true";
  });
  const [view, setView] = useState<
    "home" | "analytics" | "settings" | "grouped"
  >(() => {
    const saved = localStorage.getItem("currentView");
    return saved === "home" ||
      saved === "analytics" ||
      saved === "settings" ||
      saved === "grouped"
      ? saved
      : "home";
  });
  const [gridDensity, setGridDensity] = useState<"single" | "double" | "list">(
    () => {
      const saved = localStorage.getItem("gridDensity");
      return saved === "single" || saved === "double" || saved === "list"
        ? saved
        : "double";
    },
  );

  useEffect(() => {
    localStorage.setItem("currentView", view);
  }, [view]);

  useEffect(() => {
    const hasNavigatedOnce = sessionStorage.getItem("instasorter_navigated_settings");
    if (!hasNavigatedOnce) {
      setView("settings");
      sessionStorage.setItem("instasorter_navigated_settings", "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("gridDensity", gridDensity);
  }, [gridDensity]);
  const [creatorFilter, setCreatorFilter] = useState("");
  const [initialSelectedCollections, setInitialSelectedCollections] = useState<
    string[]
  >([]);
  const [initialSelectedTags, setInitialSelectedTags] = useState<string[]>([]);
  const [initialFilterMediaType, setInitialFilterMediaType] =
    useState<string>("all");
  const [initialFilterFavoriteOnly, setInitialFilterFavoriteOnly] =
    useState<boolean>(false);
  const [initialFilterArchived, setInitialFilterArchived] = useState<
    "all" | "active" | "archived"
  >("active");
  const [initialStartDate, setInitialStartDate] = useState<string>("");
  const [initialEndDate, setInitialEndDate] = useState<string>("");
  const [initialSortBy, setInitialSortBy] = useState<string>("savedAt");

  const posts = usePostStore((state) => state.posts);
  const setPosts = usePostStore((state) => state.setPosts);
  const setSmartCollections = usePostStore((state) => state.setSmartCollections);
  const isLoading = usePostStore((state) => state.isLoading);
  const isImportModalOpen = usePostStore((state) => state.isImportModalOpen);
  const setIsImportModalOpen = usePostStore((state) => state.setIsImportModalOpen);

  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("forceReset") === "true") {
      setIsResetting(true);
      const performForceReset = async () => {
        try {
          await db.posts.clear();
          localStorage.clear();
          setPosts([]);
          // Strip query parameters and reload to origin
          window.location.href = window.location.origin + window.location.pathname;
        } catch (err) {
          console.error("Force reset failed:", err);
          setIsResetting(false);
        }
      };
      performForceReset();
    }
  }, [setPosts]);

  useEffect(() => {
    if (posts.length > 0) {
      import("./lib/smartCollections").then(({ generateSmartCollections }) => {
        generateSmartCollections().then(setSmartCollections);
      });
    } else {
      setSmartCollections([]);
    }
  }, [posts.length, setSmartCollections]);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Robust System Preference Listener fallback
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      // Only react to system changes if the user hasn't explicitly saved a preference
      const saved = localStorage.getItem("theme");
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const handleNavigate = (
    newView: "home" | "analytics" | "settings" | "grouped",
  ) => {
    if (newView !== "home") {
      setInitialSelectedCollections([]);
      setInitialSelectedTags([]);
      setInitialFilterMediaType("all");
      setInitialFilterFavoriteOnly(false);
      setInitialFilterArchived("active");
      setInitialStartDate("");
      setInitialEndDate("");
      setInitialSortBy("savedAt");
      setCreatorFilter("");
    }
    setView(newView);
  };

  useEffect(() => {
    const runStartupTasks = async () => {
      const allPosts = await db.posts.toArray();
      if (allPosts.length === 0) {
        setPosts([]);
        return;
      }

      const lastSyncTimestamp = localStorage.getItem("last_sync_timestamp");
      const lastImportTimestamp = localStorage.getItem("last_import_timestamp");

      // Incremental sync check: If we've already synced since the last import, skip deduplication
      if (
        lastSyncTimestamp &&
        lastImportTimestamp &&
        parseInt(lastSyncTimestamp) >= parseInt(lastImportTimestamp)
      ) {
        setPosts(
          allPosts.map((p) => ({
            ...p,
            caption: decodeInstagramText(p.caption || ""),
            creatorUsername: decodeInstagramText(p.creatorUsername || ""),
            creatorName: p.creatorName
              ? decodeInstagramText(p.creatorName)
              : undefined,
            tags: (p.tags || []).map(decodeInstagramText),
            hashtags: (p.hashtags || []).map(decodeInstagramText),
            collections: (p.collections || []).map(decodeInstagramText),
          })),
        );
        const { runThumbnailWorker } = await import("./lib/thumbnailWorker");
        runThumbnailWorker();
        return;
      }

      const seenPosts = new Map<string, Post>();
      const duplicateIdsToDelete: string[] = [];
      const postsToPut: Post[] = [];

      for (const p of allPosts) {
        const cleanUrl = cleanInstagramUrl(p.postUrl || "");
        let canonicalId = String(p.id);

        // Standardize IDs: if there is a cleanUrl, that must be the canonical ID
        if (cleanUrl) {
          canonicalId = cleanUrl;
        } else if (
          canonicalId.startsWith("http://") ||
          canonicalId.startsWith("https://")
        ) {
          canonicalId = cleanInstagramUrl(canonicalId);
        } else if (
          !canonicalId.startsWith("uri_") &&
          !canonicalId.startsWith("hash_")
        ) {
          // If ID is random or from older schemas, let's generate a stable hash
          const contentStr = `${p.creatorUsername || ""}_${p.savedAt || ""}_${(p.caption || "").substring(0, 50)}`;
          let hash = 0;
          for (let i = 0; i < contentStr.length; i++) {
            hash = contentStr.charCodeAt(i) + ((hash << 5) - hash);
          }
          canonicalId = `hash_${Math.abs(hash)}`;
        }

        const finalUrl = cleanUrl || p.postUrl || "";
        const isHttp =
          finalUrl.startsWith("http://") || finalUrl.startsWith("https://");

        const cleanThumbnailUrl = validateThumbnailUrl(p.thumbnailUrl || "");
        const cleanThumbnailStatus =
          p.thumbnailStatus ||
          (cleanThumbnailUrl ? "success" : isHttp ? "pending" : "success");

        const normalizedPost: Post = {
          ...p,
          id: canonicalId,
          postUrl: finalUrl,
          thumbnailUrl: cleanThumbnailUrl,
          thumbnailStatus: cleanThumbnailStatus,
          caption: decodeInstagramText(p.caption || ""),
          creatorUsername: decodeInstagramText(p.creatorUsername || ""),
          creatorName: p.creatorName
            ? decodeInstagramText(p.creatorName)
            : undefined,
          tags: (p.tags || []).map(decodeInstagramText),
          hashtags: (p.hashtags || []).map(decodeInstagramText),
          collections: (p.collections || []).map(decodeInstagramText),
        };

        const existing = seenPosts.get(canonicalId);
        if (existing) {
          // Merge metadata
          existing.collections = Array.from(
            new Set([
              ...(existing.collections || []),
              ...(normalizedPost.collections || []),
            ]),
          );
          existing.tags = Array.from(
            new Set([...(existing.tags || []), ...(normalizedPost.tags || [])]),
          );
          existing.isFavorite =
            existing.isFavorite || normalizedPost.isFavorite;
          existing.isArchived =
            existing.isArchived || normalizedPost.isArchived;
          existing.notes = existing.notes || normalizedPost.notes;

          // Mark the duplicate ID to be purged
          duplicateIdsToDelete.push(p.id);
          // Make sure we update the existing one in the store/database
          postsToPut.push(existing);
        } else {
          seenPosts.set(canonicalId, normalizedPost);
          if (p.id !== canonicalId) {
            duplicateIdsToDelete.push(p.id);
            postsToPut.push(normalizedPost);
          } else if (
            cleanUrl !== p.postUrl ||
            p.thumbnailUrl !== normalizedPost.thumbnailUrl ||
            p.thumbnailStatus !== normalizedPost.thumbnailStatus
          ) {
            postsToPut.push(normalizedPost);
          }
        }
      }

      try {
        if (duplicateIdsToDelete.length > 0) {
          await db.posts.bulkDelete(duplicateIdsToDelete);
        }
        if (postsToPut.length > 0) {
          await db.posts.bulkPut(postsToPut);
        }
      } catch (err) {
        console.error(
          "Failed to run active database deduplication on startup:",
          err,
        );
      }

      // Re-fetch clean consolidated records
      const freshPosts = await db.posts.toArray();
      setPosts(freshPosts);

      // Start background thumbnail worker
      const { runThumbnailWorker } = await import("./lib/thumbnailWorker");
      runThumbnailWorker();

      localStorage.setItem("last_sync_timestamp", Date.now().toString());
    };

    runStartupTasks();
  }, [setPosts]);

  useEffect(() => {
    const handleVisibilityAndFocus = async () => {
      const { runThumbnailWorker } = await import("./lib/thumbnailWorker");
      runThumbnailWorker();
    };

    // Keep downloads active when coming back, focusing, or even when hidden/in recents if browser allows
    document.addEventListener("visibilitychange", handleVisibilityAndFocus);
    window.addEventListener("focus", handleVisibilityAndFocus);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityAndFocus,
      );
      window.removeEventListener("focus", handleVisibilityAndFocus);
    };
  }, []);

  const handleOnboardingComplete = async (data: {
    displayName: string;
    username: string;
    email: string;
    loadSamples: boolean;
  }) => {
    localStorage.setItem("instasorter_displayName", data.displayName);
    localStorage.setItem("instasorter_username", data.username);
    localStorage.setItem("instasorter_email", data.email);
    localStorage.setItem("instasorter_onboarding_completed", "true");
    
    if (data.loadSamples) {
      try {
        const { SAMPLE_POSTS } = await import("./data/samplePosts");
        const { normalizeInstagramPost } = await import("./lib/parser");
        await db.posts.clear();
        await db.posts.bulkPut(SAMPLE_POSTS.map(normalizeInstagramPost));
        const fresh = await db.posts.toArray();
        setPosts(fresh);
      } catch (err) {
        console.error("Failed to seed sample posts on onboarding:", err);
      }
    }
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return (
      <>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--m3-surface-low)",
              color: "var(--m3-on-surface)",
              border: "1px solid var(--m3-outline-variant)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-glass-md)",
            },
          }}
        />
        <OnboardingView onComplete={handleOnboardingComplete} />
      </>
    );
  }

  return (
    <Shell
      currentView={view}
      onNavigate={handleNavigate}
      theme={theme}
      onThemeToggle={() =>
        setTheme((prev) => {
          const next = prev === "light" ? "dark" : "light";
          localStorage.setItem("theme", next);
          return next;
        })
      }
    >
      <Toaster position="bottom-right" toastOptions={{ style: { background: "var(--m3-surface-low)", color: "var(--m3-on-surface)", border: "1px solid var(--m3-outline-variant)", borderRadius: "16px", boxShadow: "var(--shadow-glass-md)" } }} />
      <AnimatePresence mode="wait">
        {isResetting ? (
          <motion.div
            key="resetting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col items-center justify-center p-6 space-y-4 font-sans text-m3-on-surface"
          >
            <div className="w-12 h-12 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
            <h3 className="font-display font-bold text-lg text-center">Wiping Local Caches &amp; Database...</h3>
            <p className="text-xs text-m3-on-surface-variant font-medium text-center">Please wait while the library is fully hard-reset.</p>
          </motion.div>
        ) : (
          <motion.div
            key={isLoading ? "loading" : view}
            initial={localStorage.getItem("instasorter_animations") !== "false" ? { opacity: 0, y: 15 } : {}}
            animate={localStorage.getItem("instasorter_animations") !== "false" ? { opacity: 1, y: 0 } : {}}
            exit={localStorage.getItem("instasorter_animations") !== "false" ? { opacity: 0, y: -10 } : {}}
            transition={
              localStorage.getItem("instasorter_animations") !== "false"
                ? {
                    type: "tween",
                    ease: [0.16, 1, 0.3, 1], // easeOutExpo
                    duration: 0.48,
                  }
                : { duration: 0 }
            }
            className="h-full flex flex-col min-h-0"
          >
            {isLoading ? (
              <SkeletonLoader gridDensity={gridDensity} />
            ) : (
              <>
                {view === "home" && (
                  <DashboardView
                    key="home"
                    posts={posts}
                    gridDensity={gridDensity}
                    setGridDensity={setGridDensity}
                    creatorFilter={creatorFilter}
                    setCreatorFilter={setCreatorFilter}
                    initialFilterFavoriteOnly={initialFilterFavoriteOnly}
                    initialFilterArchived={initialFilterArchived}
                    initialSelectedCollections={initialSelectedCollections}
                    initialSelectedTags={initialSelectedTags}
                    initialFilterMediaType={initialFilterMediaType}
                    initialStartDate={initialStartDate}
                    initialEndDate={initialEndDate}
                    initialSortBy={initialSortBy}
                    onNavigate={handleNavigate}
                  />
                )}
                {view === "grouped" && (
                  <GroupedView posts={posts} onNavigate={handleNavigate} />
                )}
                {view === "analytics" && (
                  <AnalyticsView
                    posts={posts}
                    onNavigate={handleNavigate}
                    setCreatorFilter={setCreatorFilter}
                    setInitialSelectedCollections={setInitialSelectedCollections}
                    setInitialSelectedTags={setInitialSelectedTags}
                    setInitialFilterMediaType={setInitialFilterMediaType}
                    setInitialFilterFavoriteOnly={setInitialFilterFavoriteOnly}
                    setInitialFilterArchived={setInitialFilterArchived}
                    setInitialStartDate={setInitialStartDate}
                    setInitialEndDate={setInitialEndDate}
                    setInitialSortBy={setInitialSortBy}
                  />
                )}
                {view === "settings" && (
                  <SettingsView
                    onNavigate={handleNavigate}
                    onSelectCollection={(colName) => {
                      setInitialSelectedCollections([colName]);
                      setInitialSelectedTags([]);
                      setView("home");
                    }}
                    theme={theme}
                    onThemeToggle={() =>
                      setTheme((prev) => {
                        const next = prev === "light" ? "dark" : "light";
                        localStorage.setItem("theme", next);
                        return next;
                      })
                    }
                  />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImportModalOpen && (
          <ImportView onClose={() => setIsImportModalOpen(false)} />
        )}
      </AnimatePresence>
    </Shell>
  );
}
