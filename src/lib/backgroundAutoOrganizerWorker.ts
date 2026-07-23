import { db } from "./db";
import { executeAutoBatchCategorization } from "./batchCategorizer";
import { usePostStore } from "../store/useStore";

let workerInterval: number | null = null;
let isRunning = false;

export function startBackgroundAutoOrganizer() {
  if (workerInterval !== null) return;

  // Run every 10 seconds in the background to watch for newly imported uncategorized posts
  workerInterval = window.setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const currentPosts = await db.posts.toArray();
      const uncategorizedCount = currentPosts.filter(
        (p) => !p.collections || p.collections.length === 0
      ).length;

      if (uncategorizedCount > 0) {
        const { categorizedCount, collectionsCreatedCount } =
          await executeAutoBatchCategorization(currentPosts);
        if (categorizedCount > 0 || collectionsCreatedCount > 0) {
          const freshPosts = await db.posts.toArray();
          usePostStore.getState().setPosts(freshPosts);
          console.debug(
            `[Background Worker] Auto-categorized ${categorizedCount} new posts and created ${collectionsCreatedCount} smart folders based on tags and keywords.`
          );
        }
      }
    } catch (err) {
      console.debug("[Background Worker] Error in auto-categorization worker:", err);
    } finally {
      isRunning = false;
    }
  }, 10000);
}

export function stopBackgroundAutoOrganizer() {
  if (workerInterval !== null) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
