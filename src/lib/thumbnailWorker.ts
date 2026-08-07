import { db } from "./db";
import { usePostStore } from "../store/useStore";
import { Post } from "../types/post";

// Core Worker Execution State Flags
let isWorkerRunning = false;
let stopRequested = false;
let isPaused = false;
let globalThrottleUntil: number | null = null;
let speedMode: "eco" | "normal" | "fast" = "normal";

// Track viewport visibility
const visiblePostIdsSet = new Set<string>();

// Real-Time Telemetry & Diagnostics Counters
let totalProcessed = 0;
let totalSuccesses = 0;
let totalFailures = 0;
let recentLatenciesMs: number[] = [];
let workerStartTime: number | null = null;
let currentActiveConcurrency = 1;

// In-Flight Request Deduplication Map
const inFlightRequestsMap = new Map<string, Promise<void>>();

export function getVisiblePostCount() {
  return visiblePostIdsSet.size;
}

export function registerPostVisibility(postId: string, isVisible: boolean) {
  if (isVisible) {
    visiblePostIdsSet.add(postId);
    const posts = usePostStore.getState().posts;
    const post = posts.find((p) => p.id === postId);
    if (post && (post.thumbnailStatus === "pending" || !post.thumbnailStatus)) {
      runThumbnailWorker();
    }
  } else {
    visiblePostIdsSet.delete(postId);
  }
}

export const getThumbnailStats = (posts: Post[]) => {
  const total = posts.length;
  const pending = posts.filter(
    (p) => p.thumbnailStatus === "pending" || !p.thumbnailStatus,
  ).length;
  const success = posts.filter((p) => p.thumbnailStatus === "success").length;
  const failed = posts.filter((p) => p.thumbnailStatus === "failed").length;

  return { total, pending, success, failed };
};

export function getThrottleStatus() {
  if (globalThrottleUntil && Date.now() < globalThrottleUntil) {
    return {
      throttled: true,
      remaining: Math.max(
        0,
        Math.ceil((globalThrottleUntil - Date.now()) / 1000),
      ),
    };
  }
  return { throttled: false, remaining: 0 };
}

// User Controls: Pause, Resume & Speed Modes
export function pauseWorker() {
  isPaused = true;
  notifyUI();
}

export function resumeWorker() {
  isPaused = false;
  notifyUI();
  runThumbnailWorker();
}

export function setWorkerSpeedMode(mode: "eco" | "normal" | "fast") {
  speedMode = mode;
  notifyUI();
}

export function getWorkerSpeedMode() {
  return speedMode;
}

export function isWorkerPaused() {
  return isPaused;
}

// Global Diagnostics API for UI Progress Components
export function getWorkerDiagnostics() {
  const elapsedSec = workerStartTime ? Math.max(1, (Date.now() - workerStartTime) / 1000) : 1;
  const itemsPerSecond = Number((totalProcessed / elapsedSec).toFixed(2));
  
  const avgLatencyMs = recentLatenciesMs.length > 0
    ? Math.round(recentLatenciesMs.reduce((a, b) => a + b, 0) / recentLatenciesMs.length)
    : 0;

  const totalAttempts = totalSuccesses + totalFailures;
  const successRatePercent = totalAttempts > 0 ? Math.round((totalSuccesses / totalAttempts) * 100) : 100;

  const posts = usePostStore.getState().posts;
  const pendingCount = posts.filter((p) => p.thumbnailStatus === "pending" || !p.thumbnailStatus).length;
  const deadLetterCount = posts.filter((p) => p.thumbnailStatus === "failed" && (p.thumbnailAttempts || 0) >= 5).length;

  const estimatedTimeRemainingSec = itemsPerSecond > 0 ? Math.ceil(pendingCount / itemsPerSecond) : 0;

  return {
    isRunning: isWorkerRunning,
    isPaused,
    speedMode,
    currentConcurrency: currentActiveConcurrency,
    itemsPerSecond,
    avgLatencyMs,
    successRatePercent,
    estimatedTimeRemainingSec,
    pendingCount,
    deadLetterCount,
    totalProcessed,
    totalSuccesses,
    totalFailures,
  };
}

// Dynamic Adaptive Concurrency Calculator
function calculateOptimalConcurrency(pendingCount: number): number {
  if (speedMode === "eco") return 1;

  // Network Information sensing
  if (typeof navigator !== "undefined" && (navigator as any).connection) {
    const conn = (navigator as any).connection;
    if (conn.saveData || conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
      return 1;
    }
  }

  // Calculate based on recent latencies & error rate
  const recentErrors = totalFailures > 0 ? totalFailures / Math.max(1, totalSuccesses + totalFailures) : 0;
  
  let target = 3; // normal default
  if (speedMode === "fast") target = 5;

  if (recentErrors > 0.2) {
    target = 1; // scale down on errors
  } else if (recentLatenciesMs.length >= 5) {
    const avgLat = recentLatenciesMs.reduce((a, b) => a + b, 0) / recentLatenciesMs.length;
    if (avgLat < 600) {
      target = Math.min(speedMode === "fast" ? 5 : 4, target + 1);
    }
  }

  return Math.max(1, Math.min(target, pendingCount));
}

// Global UI Progress Callbacks
const globalProgressCallbacks = new Set<() => void>();

export function registerProgressCallback(callback: () => void) {
  globalProgressCallbacks.add(callback);
}

export function unregisterProgressCallback(callback?: () => void) {
  if (callback) {
    globalProgressCallbacks.delete(callback);
  } else {
    globalProgressCallbacks.clear();
  }
}

function notifyUI() {
  globalProgressCallbacks.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn("Progress callback failed:", e);
    }
  });
}

export async function purgeOldOrFailedStorage() {
  try {
    const allPosts = await db.posts.toArray();
    const now = new Date();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    let clearedThumbnailCount = 0;

    for (const post of allPosts) {
      const savedDate = post.savedAt ? new Date(post.savedAt) : new Date();
      const ageMs = now.getTime() - savedDate.getTime();

      // 1. Purge completely broken posts (no ID, no URL)
      if (!post.id || !post.postUrl) {
        await db.posts.delete(post.id);
        const posts = usePostStore.getState().posts;
        usePostStore.getState().setPosts(posts.filter((p) => p.id !== post.id));
        deletedCount++;
        continue;
      }

      // 2. Prune old failed temporary posts
      const hasUserData =
        post.isFavorite ||
        post.isArchived ||
        (post.notes && post.notes.trim()) ||
        (post.tags && post.tags.length > 0) ||
        (post.collections && post.collections.length > 0);

      if (
        post.thumbnailStatus === "failed" &&
        ageMs > THIRTY_DAYS_MS &&
        !hasUserData
      ) {
        await db.posts.delete(post.id);
        const posts = usePostStore.getState().posts;
        usePostStore.getState().setPosts(posts.filter((p) => p.id !== post.id));
        deletedCount++;
      } else if (
        post.thumbnailStatus === "failed" &&
        (post.thumbnailAttempts || 0) >= 5
      ) {
        if (post.visibility !== "visible") {
          const updatedVisibility = { visibility: "visible" as const };
          await db.posts.update(post.id, updatedVisibility);
          usePostStore.getState().updatePost(post.id, updatedVisibility);
        }

        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const lastAttempt = post.lastThumbnailAttempt
          ? new Date(post.lastThumbnailAttempt).getTime()
          : 0;
        if (now.getTime() - lastAttempt > SEVEN_DAYS_MS) {
          const updatedFields = {
            thumbnailAttempts: 0,
            thumbnailStatus: "pending" as const,
          };
          await db.posts.update(post.id, updatedFields);
          usePostStore.getState().updatePost(post.id, updatedFields);
          clearedThumbnailCount++;
        }
      }
    }

    if (deletedCount > 0 || clearedThumbnailCount > 0) {
      console.log(
        `[Storage Pruner] Completed storage cleanup: Purged ${deletedCount} old/broken posts; Reset ${clearedThumbnailCount} stale failed post attempts.`,
      );
    }

    // Server-side Vacuum cleaner integration
    try {
      const activeIds = allPosts.map((p) => p.id);
      const vacuumResponse = await fetch("/api/vacuum-thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeIds }),
      });
      if (vacuumResponse.ok) {
        const vacuumData = await vacuumResponse.json();
        if (vacuumData.success && vacuumData.deletedCount > 0) {
          console.log(
            `[Storage Pruner] Server vacuumed ${vacuumData.deletedCount} orphan thumbnail files.`,
          );
        }
      }
    } catch (vacuumErr) {
      console.warn(`[Storage Pruner] Server vacuum skipped:`, vacuumErr);
    }

    notifyUI();
  } catch (err) {
    console.warn(`[Storage Pruner] Error running pruner:`, err);
  }
}

// Exponential Backoff with Jitter for transient retries
async function autoResetTransientFailures() {
  try {
    const allPosts = await db.posts.toArray();
    const BASE_BACKOFF_MS = 15 * 1000; // 15s base delay
    const MAX_BACKOFF_MS = 15 * 60 * 1000; // 15m max delay
    const MAX_RETRIES = 5;
    const now = Date.now();

    const postsToReset = allPosts.filter((p) => {
      if (
        p.thumbnailStatus === "failed" &&
        (p.thumbnailAttempts || 0) < MAX_RETRIES
      ) {
        const attempts = p.thumbnailAttempts || 1;
        const lastAttemptTime = p.lastThumbnailAttempt
          ? new Date(p.lastThumbnailAttempt).getTime()
          : 0;

        // Exponential backoff with randomized jitter (0.8x to 1.2x)
        const exp = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
        const rawBackoff = exp < MAX_BACKOFF_MS ? exp : MAX_BACKOFF_MS;
        const jitteredBackoff = rawBackoff * (0.8 + Math.random() * 0.4);

        const elapsed = now - lastAttemptTime;
        return elapsed > jitteredBackoff;
      }
      return false;
    });

    if (postsToReset.length > 0) {
      console.log(
        `[Thumbnail Worker] Auto-resetting ${postsToReset.length} transient failed thumbnails back to pending under jittered backoff policy.`,
      );
      for (const post of postsToReset) {
        const updatedFields = { thumbnailStatus: "pending" as const };
        await db.posts.update(post.id, updatedFields);
        usePostStore.getState().updatePost(post.id, updatedFields);
      }
      notifyUI();
    }
  } catch (err) {
    console.warn(`[Thumbnail Worker] Error auto-resetting failed thumbnails:`, err);
  }
}

// Bulk reprocess Dead Letter Queue (DLQ)
export async function reprocessDeadLetterQueue() {
  const allPosts = await db.posts.toArray();
  const deadLetterPosts = allPosts.filter(
    (p) => p.thumbnailStatus === "failed" && (p.thumbnailAttempts || 0) >= 5
  );

  if (deadLetterPosts.length === 0) return 0;

  for (const post of deadLetterPosts) {
    const updated = {
      thumbnailStatus: "pending" as const,
      thumbnailAttempts: 0,
    };
    await db.posts.update(post.id, updated);
    usePostStore.getState().updatePost(post.id, updated);
  }

  globalThrottleUntil = null;
  isPaused = false;
  notifyUI();
  runThumbnailWorker();
  return deadLetterPosts.length;
}

async function executeWorkerLoop() {
  try {
    if (!workerStartTime) workerStartTime = Date.now();
    await purgeOldOrFailedStorage();
    await autoResetTransientFailures();

    while (!stopRequested) {
      if (isPaused) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (globalThrottleUntil && Date.now() < globalThrottleUntil) {
        await new Promise((r) => setTimeout(r, 5000));
        notifyUI();
        continue;
      }

      const hasPending = await processQueue();

      if (!hasPending || stopRequested) {
        break;
      }

      // Schedule next tick via requestIdleCallback if available for UI smoothness
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        await new Promise((resolve) => (window as any).requestIdleCallback(resolve, { timeout: 500 }));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  } finally {
    isWorkerRunning = false;
    notifyUI();
  }
}

export async function runThumbnailWorker() {
  if (isWorkerRunning || isPaused) return;
  isWorkerRunning = true;
  stopRequested = false;

  if (typeof navigator !== "undefined" && navigator.locks) {
    try {
      await navigator.locks.request(
        "thumbnail_worker_lock",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            isWorkerRunning = false;
            notifyUI();
            return;
          }
          await executeWorkerLoop();
        },
      );
    } catch (err) {
      await executeWorkerLoop();
    }
  } else {
    await executeWorkerLoop();
  }
}

export function stopThumbnailWorker() {
  stopRequested = true;
}

export function isWorkerActive() {
  return isWorkerRunning;
}

async function processQueue(): Promise<boolean> {
  const allPostsInDb = await db.posts.toArray();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Multi-tier pending queue calculation
  const pendingPosts = allPostsInDb.filter((p) => {
    if (p.thumbnailStatus === "pending" || !p.thumbnailStatus) {
      return true;
    }
    // Cache invalidation: re-scrape if saved and cached older than 30 days
    if (p.thumbnailStatus === "success" && p.lastThumbnailAttempt) {
      const lastAttemptTime = new Date(p.lastThumbnailAttempt).getTime();
      if (now - lastAttemptTime > THIRTY_DAYS_MS) {
        return true;
      }
    }
    return false;
  });

  if (pendingPosts.length === 0 || stopRequested) {
    return false;
  }

  // Multi-Tier Priority Sort:
  // Tier 1 (Highest): Viewport visible items
  // Tier 2 (Medium): Recently added posts (< 15 mins old)
  // Tier 3 (Low): Historical background items
  pendingPosts.sort((a, b) => {
    const aVisible = visiblePostIdsSet.has(a.id);
    const bVisible = visiblePostIdsSet.has(b.id);
    if (aVisible && !bVisible) return -1;
    if (!aVisible && bVisible) return 1;

    const aAge = a.savedAt ? now - new Date(a.savedAt).getTime() : 0;
    const bAge = b.savedAt ? now - new Date(b.savedAt).getTime() : 0;
    const FIFTEEN_MINS = 15 * 60 * 1000;

    const aRecent = aAge < FIFTEEN_MINS;
    const bRecent = bAge < FIFTEEN_MINS;
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;

    return 0;
  });

  // Calculate dynamic adaptive concurrency
  const concurrency = calculateOptimalConcurrency(pendingPosts.length);
  currentActiveConcurrency = concurrency;

  let index = 0;
  const workers = Array(concurrency)
    .fill(null)
    .map(async () => {
      while (index < pendingPosts.length && !stopRequested && !isPaused) {
        if (globalThrottleUntil && Date.now() < globalThrottleUntil) break;

        const post = pendingPosts[index++];
        if (post) {
          try {
            await fetchThumbnailForPostDeduplicated(post);
            
            // Stagger delay based on speedMode and visibility
            const isVisible = visiblePostIdsSet.has(post.id);
            let delay = isVisible ? 0 : 150;
            if (speedMode === "eco") delay = 400;
            if (speedMode === "fast" && isVisible) delay = 0;

            if (delay > 0 && !stopRequested) {
              await new Promise((r) => setTimeout(r, delay));
            }
          } catch (workerErr) {
            console.error(`[Thumbnail Worker Queue] Error processing ${post.id}:`, workerErr);
          }
        }
      }
    });

  await Promise.all(workers);

  if (globalThrottleUntil && Date.now() < globalThrottleUntil) {
    return true;
  }

  const remainingInDb = await db.posts.toArray();
  const stillPending = remainingInDb.filter((p) => p.thumbnailStatus === "pending" || !p.thumbnailStatus);
  return stillPending.length > 0;
}

// In-Flight Request Merging & Deduplication Wrapper
async function fetchThumbnailForPostDeduplicated(post: Post): Promise<void> {
  if (inFlightRequestsMap.has(post.id)) {
    return inFlightRequestsMap.get(post.id)!;
  }

  const requestPromise = fetchThumbnailForPostInternal(post).finally(() => {
    inFlightRequestsMap.delete(post.id);
  });

  inFlightRequestsMap.set(post.id, requestPromise);
  return requestPromise;
}

async function fetchThumbnailForPostInternal(post: Post) {
  const cleanUrl = (post.postUrl || "").trim();
  let isUrlValid = false;

  try {
    if (cleanUrl && (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://"))) {
      new URL(cleanUrl);
      isUrlValid = true;
    }
  } catch (err) {
    isUrlValid = false;
  }

  if (!isUrlValid) {
    const updatedPost: Partial<Post> = {
      thumbnailStatus: "success",
      lastThumbnailAttempt: new Date(),
    };
    await db.posts.update(post.id, updatedPost);
    usePostStore.getState().updatePost(post.id, updatedPost);
    notifyUI();
    return;
  }

  const attempts = (post.thumbnailAttempts || 0) + 1;
  const MAX_RETRIES = 5;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const startTime = Date.now();
  try {
    const response = await fetch("/api/fetch-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: post.postUrl,
        id: post.id,
        mediaType: post.mediaType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Track latency telemetry
    recentLatenciesMs.push(duration);
    if (recentLatenciesMs.length > 20) recentLatenciesMs.shift();
    totalProcessed++;

    if (response.status === 429) {
      const cooldown = 5 * 60 * 1000;
      globalThrottleUntil = Date.now() + cooldown;

      const updatedPost: Partial<Post> = {
        thumbnailStatus: "pending",
        lastThumbnailAttempt: new Date(),
      };
      await db.posts.update(post.id, updatedPost);
      usePostStore.getState().updatePost(post.id, updatedPost);
      notifyUI();
      return;
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP Error Status ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.path) {
      totalSuccesses++;
      const updatedPost: Partial<Post> = {
        thumbnailUrl: data.path,
        thumbnailStatus: "success",
        thumbnailAttempts: attempts,
        lastThumbnailAttempt: new Date(),
        visibility: "visible",
      };

      if (data.additionalSlides && data.additionalSlides.length > 0) {
        updatedPost.additionalSlides = data.additionalSlides;
      }

      if (
        data.creatorUsername &&
        (!post.creatorUsername ||
          post.creatorUsername === "instagram_creator" ||
          post.creatorUsername === "instagram_user" ||
          post.creatorUsername.trim() === "")
      ) {
        updatedPost.creatorUsername = data.creatorUsername;
      }

      await db.posts.update(post.id, updatedPost);
      usePostStore.getState().updatePost(post.id, updatedPost);
    } else {
      totalFailures++;
      const updatedPost: Partial<Post> = {
        thumbnailStatus: "failed",
        thumbnailAttempts: attempts,
        lastThumbnailAttempt: new Date(),
        visibility: "visible",
      };

      await db.posts.update(post.id, updatedPost);
      usePostStore.getState().updatePost(post.id, updatedPost);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    totalFailures++;
    const updatedPost: Partial<Post> = {
      thumbnailStatus: "failed",
      thumbnailAttempts: attempts,
      lastThumbnailAttempt: new Date(),
      visibility: "visible",
    };

    await db.posts.update(post.id, updatedPost);
    usePostStore.getState().updatePost(post.id, updatedPost);
  } finally {
    notifyUI();
  }
}

// User-triggered: Retry all failed posts
export async function retryFailedThumbnails() {
  const allPostsInDb = await db.posts.toArray();
  const failedPosts = allPostsInDb.filter(
    (p) => !p.id.startsWith("sample-") && p.thumbnailStatus === "failed",
  );

  for (const post of failedPosts) {
    const cleanUrl = (post.postUrl || "").trim();
    const isHttp = cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
    const updatedPost: Partial<Post> = {
      thumbnailStatus: isHttp ? "pending" : "success",
      thumbnailAttempts: 0,
    };
    await db.posts.update(post.id, updatedPost);
    usePostStore.getState().updatePost(post.id, updatedPost);
  }

  globalThrottleUntil = null;
  isPaused = false;
  notifyUI();
  runThumbnailWorker();
}

// User-triggered: Targeted, low-intensity re-indexing of missing or failed posts only
export async function refreshLibraryTargeted() {
  const allPostsInDb = await db.posts.toArray();
  const targetedPosts = allPostsInDb.filter((p) => {
    if (p.id.startsWith("sample-")) return false;
    const lacksThumbnail = !p.thumbnailUrl || p.thumbnailUrl.trim() === "" || p.thumbnailUrl.includes("placeholder");
    const isFailed = p.thumbnailStatus === "failed";
    const isPending = p.thumbnailStatus === "pending" || !p.thumbnailStatus;
    return isFailed || isPending || lacksThumbnail;
  });

  if (targetedPosts.length === 0) {
    return { count: 0, message: "All posts in library already have active thumbnails!" };
  }

  for (const post of targetedPosts) {
    const cleanUrl = (post.postUrl || "").trim();
    const isHttp = cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
    const updatedPost: Partial<Post> = {
      thumbnailStatus: isHttp ? "pending" : "success",
      thumbnailAttempts: 0,
    };
    await db.posts.update(post.id, updatedPost);
    usePostStore.getState().updatePost(post.id, updatedPost);
  }

  speedMode = "eco";
  globalThrottleUntil = null;
  isPaused = false;
  notifyUI();
  runThumbnailWorker();

  return { count: targetedPosts.length, message: `Targeted re-indexing started for ${targetedPosts.length} posts.` };
}

// User-triggered: Retry single failed post
export async function retrySingleThumbnail(postId: string) {
  const post = await db.posts.get(postId);
  if (post) {
    const updatedPost: Partial<Post> = {
      thumbnailStatus: "pending",
      thumbnailAttempts: 0,
    };
    await db.posts.update(postId, updatedPost);
    usePostStore.getState().updatePost(postId, updatedPost);

    globalThrottleUntil = null;
    isPaused = false;
    notifyUI();
    runThumbnailWorker();
  }
}

// Background Offloader: Offload all pending extraction tasks to server
export async function offloadPendingToBackgroundServer(): Promise<number> {
  try {
    const allPosts = await db.posts.toArray();
    const pendingPosts = allPosts.filter(
      (p) => (p.thumbnailStatus === "pending" || !p.thumbnailStatus) && p.postUrl && p.id
    );

    if (pendingPosts.length === 0) return 0;

    const payload = pendingPosts.map((p) => ({
      url: p.postUrl,
      id: p.id,
      mediaType: p.mediaType,
    }));

    if (typeof fetch !== "undefined") {
      fetch("/api/queue-background-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: payload }),
        keepalive: true,
      }).catch((err) => console.warn("[Background Offloader] Fetch offload error:", err));
    }

    if (typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "OFFLOAD_BACKGROUND_QUEUE",
        posts: payload,
      });
    }

    return pendingPosts.length;
  } catch (err) {
    console.warn("[Background Offloader] Failed to offload pending queue:", err);
    return 0;
  }
}

// Auto-register lifecycle listeners
if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      offloadPendingToBackgroundServer();
    } else if (document.visibilityState === "visible") {
      isPaused = false;
      runThumbnailWorker();
    }
  });

  window.addEventListener("pagehide", () => {
    offloadPendingToBackgroundServer();
  });

  window.addEventListener("online", () => {
    console.log("[Thumbnail Worker] Network reconnected — lifting throttles and resuming queue processing.");
    globalThrottleUntil = null;
    isPaused = false;
    notifyUI();
    runThumbnailWorker();
  });
}
