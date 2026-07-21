import { db } from "./db";
import { usePostStore } from "../store/useStore";
import { Post } from "../types/post";

let isWorkerRunning = false;
let stopRequested = false;
let globalThrottleUntil: number | null = null;

// Track posts currently visible in the viewport
const visiblePostIdsSet = new Set<string>();

export function getVisiblePostCount() {
  return visiblePostIdsSet.size;
}

export function registerPostVisibility(postId: string, isVisible: boolean) {
  if (isVisible) {
    visiblePostIdsSet.add(postId);
    // If a pending post becomes visible, run worker immediately to prioritize it!
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

// Global callbacks for UI updates
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
        if (post.visibility !== "hidden") {
          const updatedVisibility = { visibility: "hidden" as const };
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
      console.log(
        `[Storage Pruner] Triggering server-side vacuum of orphan thumbnail files...`,
      );
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
      console.warn(
        `[Storage Pruner] Failed to run server-side vacuum:`,
        vacuumErr,
      );
    }

    notifyUI();
  } catch (err) {
    console.warn(
      `[Storage Pruner] Error running IndexedDB storage pruner:`,
      err,
    );
  }
}

async function autoResetTransientFailures() {
  try {
    const allPosts = await db.posts.toArray();
    const BASE_BACKOFF_MS = 15 * 1000; // 15 seconds base delay
    const MAX_BACKOFF_MS = 15 * 60 * 1000; // 15 minutes maximum delay
    const MAX_RETRIES = 5; // Allow up to 5 self-healing retry attempts
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

        // Exponential backoff: BASE_BACKOFF_MS * 2^(attempts - 1)
        const exp = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
        const backoffDelay = exp < MAX_BACKOFF_MS ? exp : MAX_BACKOFF_MS;
        const elapsed = now - lastAttemptTime;
        const isReady = elapsed > backoffDelay;

        if (isReady) {
          console.log(
            `[Thumbnail Worker Backoff] Post ${p.id} (Attempt ${attempts}/${MAX_RETRIES}) is ready for auto-retry. Backoff delay: ${backoffDelay / 1000}s, elapsed: ${Math.round(elapsed / 1000)}s.`,
          );
        }
        return isReady;
      }
      return false;
    });

    if (postsToReset.length > 0) {
      console.log(
        `[Thumbnail Worker] Auto-resetting ${postsToReset.length} transient failed thumbnails back to pending for retry under exponential backoff policy.`,
      );
      for (const post of postsToReset) {
        const updatedFields = { thumbnailStatus: "pending" as const };
        await db.posts.update(post.id, updatedFields);
        usePostStore.getState().updatePost(post.id, updatedFields);
      }
      notifyUI();
    }
  } catch (err) {
    console.warn(
      `[Thumbnail Worker] Error auto-resetting failed thumbnails:`,
      err,
    );
  }
}

async function executeWorkerLoop() {
  try {
    // Run storage pruning and self-healing transient resets once on worker startup
    // to avoid excessive IndexedDB scans, store updates, and server API vacuum requests on every tick.
    await purgeOldOrFailedStorage();
    await autoResetTransientFailures();

    while (!stopRequested) {
      // Check if throttled globally
      if (globalThrottleUntil && Date.now() < globalThrottleUntil) {
        console.log(
          `[Thumbnail Worker] Queue is currently rate limited. Sleeping for 10s.`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
        notifyUI();
        continue;
      }

      const hasPending = await processQueue();

      if (!hasPending || stopRequested) {
        break;
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } finally {
    isWorkerRunning = false;
    notifyUI();
  }
}

export async function runThumbnailWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  stopRequested = false;

  if (typeof navigator !== "undefined" && navigator.locks) {
    try {
      await navigator.locks.request(
        "thumbnail_worker_lock",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            console.log(
              "[Thumbnail Worker] Another browser tab is active. Offloading background tasks to the primary worker.",
            );
            isWorkerRunning = false;
            notifyUI();
            return;
          }
          console.log(
            "[Thumbnail Worker] Tab successfully elected as primary. Running worker loop.",
          );
          await executeWorkerLoop();
        },
      );
    } catch (err) {
      console.warn(
        "[Thumbnail Worker] Lock request failed, falling back to standard execution:",
        err,
      );
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

  // Find pending posts, including cached images older than 30 days
  const pendingPosts = allPostsInDb.filter((p) => {
    if (p.thumbnailStatus === "pending" || !p.thumbnailStatus) {
      return true;
    }
    // Cache invalidation: re-scrape if saved and cached older than 30 days
    if (p.thumbnailStatus === "success" && p.lastThumbnailAttempt) {
      const lastAttemptTime = new Date(p.lastThumbnailAttempt).getTime();
      if (now - lastAttemptTime > THIRTY_DAYS_MS) {
        console.log(
          `[Thumbnail Worker Cache Invalidation] Post ${p.id} thumbnail was cached > 30 days ago. Re-scraping.`,
        );
        return true;
      }
    }
    return false;
  });

  if (pendingPosts.length === 0 || stopRequested) {
    return false;
  }

  // Priority Queue: Sort pendingPosts so that those currently in the viewport (visible) are processed first
  pendingPosts.sort((a, b) => {
    const aVisible = visiblePostIdsSet.has(a.id);
    const bVisible = visiblePostIdsSet.has(b.id);
    if (aVisible && !bVisible) return -1;
    if (!aVisible && bVisible) return 1;
    return 0;
  });

  const visibleCount = pendingPosts.filter((p) => visiblePostIdsSet.has(p.id)).length;
  if (visibleCount > 0) {
    console.log(
      `[Thumbnail Worker Queue] Priority Queue active: prioritized ${visibleCount} visible pending posts at the front of the queue.`
    );
  }

  const CONCURRENCY = 1; // Concurrency control: reduced to 1 to prevent concurrent requests triggering Instagram 429 rate limiting
  let index = 0;

  const count =
    CONCURRENCY < pendingPosts.length ? CONCURRENCY : pendingPosts.length;
  const workers = Array(count)
    .fill(null)
    .map(async () => {
      while (index < pendingPosts.length && !stopRequested) {
        // If throttled during processing, stop processing more items in this chunk
        if (globalThrottleUntil && Date.now() < globalThrottleUntil) {
          break;
        }
        const post = pendingPosts[index++];
        if (post) {
          try {
            await fetchThumbnailForPost(post);
            // Stagger requests with a 1.5s - 2.5s delay to avoid triggering Instagram's public rate limits
            if (index < pendingPosts.length && !stopRequested) {
              await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));
            }
          } catch (workerErr) {
            console.error(
              `[Thumbnail Worker Queue] Failed to process post ${post.id}:`,
              workerErr,
            );
          }
        }
      }
    });

  await Promise.all(workers);

  if (globalThrottleUntil && Date.now() < globalThrottleUntil) {
    return true; // we still have pending items, just throttled
  }

  // Re-check pending posts
  const remainingPostsInDb = await db.posts.toArray();
  const stillPending = remainingPostsInDb.filter((p) => {
    if (p.thumbnailStatus === "pending" || !p.thumbnailStatus) return true;
    if (p.thumbnailStatus === "success" && p.lastThumbnailAttempt) {
      const lastAttemptTime = new Date(p.lastThumbnailAttempt).getTime();
      if (now - lastAttemptTime > THIRTY_DAYS_MS) return true;
    }
    return false;
  });

  return stillPending.length > 0;
}

async function fetchThumbnailForPost(post: Post) {
  const cleanUrl = (post.postUrl || "").trim();
  let isUrlValid = false;

  try {
    if (
      cleanUrl &&
      (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://"))
    ) {
      new URL(cleanUrl);
      isUrlValid = true;
    }
  } catch (err) {
    isUrlValid = false;
  }

  if (!isUrlValid) {
    console.warn(
      `[Thumbnail Worker] Skipping malformed/invalid URL for post ${post.id}: "${cleanUrl}"`,
    );
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
  const timeoutId = setTimeout(() => {
    console.warn(
      `[Thumbnail Worker] Timeout exceeded (12s threshold) fetching thumbnail for post ${post.id}`,
    );
    controller.abort();
  }, 12000); // 12 seconds request timeout

  const startTime = Date.now();
  try {
    console.log(
      `[Thumbnail Worker Client] [Attempt #${attempts}/${MAX_RETRIES}] Triggering server-side fetch-thumbnail for post ${post.id}. URL: ${post.postUrl}`,
    );
    const response = await fetch("/api/fetch-thumbnail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: post.postUrl,
        id: post.id,
        mediaType: post.mediaType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Detect 429 Rate limits globally
    if (response.status === 429) {
      const cooldown = 5 * 60 * 1000; // 5 mins cooldown
      globalThrottleUntil = Date.now() + cooldown;
      console.warn(
        `[Thumbnail Worker Client] Global 429 Rate Limiting detected for post ${post.id}. Throttling queue for 5 minutes.`,
      );

      // Leave post as pending so it can be retried once cooldown finishes
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
      throw new Error(
        `Server returned HTTP Error Status ${response.status}: ${response.statusText || "Unknown Error"}`,
      );
    }

    const data = await response.json();

    if (data.success && data.path) {
      console.log(
        `[Thumbnail Worker Client] [SUCCESS] Fetch thumbnail succeeded for post ${post.id} (Attempt ${attempts}/${MAX_RETRIES}).`,
      );

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
      console.warn(
        `[Thumbnail Worker Client] [UNRESOLVED] Server returned success=false for post ${post.id} (Attempt ${attempts}/${MAX_RETRIES}).`,
      );

      const updatedPost: Partial<Post> = {
        thumbnailStatus: "failed",
        thumbnailAttempts: attempts,
        lastThumbnailAttempt: new Date(),
        ...(attempts >= MAX_RETRIES ? { visibility: "hidden" as const } : {})
      };

      await db.posts.update(post.id, updatedPost);
      usePostStore.getState().updatePost(post.id, updatedPost);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const isAbort = error.name === "AbortError";
    const errMsg = isAbort
      ? "Request timed-out (12s threshold)"
      : error.message || "Unknown network error";

    console.warn(
      `[Thumbnail Worker Client] [DIAGNOSTICS] Fetch unresolved for post ${post.id}: ${errMsg}`,
    );

    const updatedPost: Partial<Post> = {
      thumbnailStatus: "failed",
      thumbnailAttempts: attempts,
      lastThumbnailAttempt: new Date(),
      ...(attempts >= MAX_RETRIES ? { visibility: "hidden" as const } : {})
    };

    await db.posts.update(post.id, updatedPost);
    usePostStore.getState().updatePost(post.id, updatedPost);
  } finally {
    notifyUI();
  }
}

// User-triggered: Retry failed posts
export async function retryFailedThumbnails() {
  const allPostsInDb = await db.posts.toArray();
  const failedPosts = allPostsInDb.filter(
    (p) => !p.id.startsWith("sample-") && p.thumbnailStatus === "failed",
  );

  console.log(
    `[Thumbnail Worker Client] Retrying all (${failedPosts.length}) failed thumbnails`,
  );

  for (const post of failedPosts) {
    const cleanUrl = (post.postUrl || "").trim();
    const isHttp =
      cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
    const updatedPost: Partial<Post> = {
      thumbnailStatus: isHttp ? "pending" : "success",
      thumbnailAttempts: 0, // Reset attempt counts so it starts fresh!
    };
    await db.posts.update(post.id, updatedPost);
    usePostStore.getState().updatePost(post.id, updatedPost);
  }

  // Lift global throttle on manual retry
  globalThrottleUntil = null;
  notifyUI();
  runThumbnailWorker();
}

// User-triggered: Retry single failed post
export async function retrySingleThumbnail(postId: string) {
  const post = await db.posts.get(postId);
  if (post) {
    console.log(
      `[Thumbnail Worker Client] Manually triggering single thumbnail retry for post: ${postId}`,
    );
    const updatedPost: Partial<Post> = {
      thumbnailStatus: "pending",
      thumbnailAttempts: 0, // Reset attempt counts
    };
    await db.posts.update(postId, updatedPost);
    usePostStore.getState().updatePost(postId, updatedPost);

    // Lift global throttle on manual retry
    globalThrottleUntil = null;
    notifyUI();
    runThumbnailWorker();
  }
}
