import { db } from "./db";
import { executeAutoBatchCategorization } from "./autoOrganizer";
import { usePostStore } from "../store/useStore";

let workerInterval: number | null = null;
let isRunning = false;

export type ProgressCallback = (
  status: "idle" | "running" | "completed" | "error",
  progress: number
) => void;

let activeCallback: ProgressCallback | null = null;

/**
 * Register a progress callback to observe background organizing activity.
 */
export function setBackgroundOrganizerProgressCallback(callback: ProgressCallback | null) {
  activeCallback = callback;
}

function updateStatus(status: "idle" | "running" | "completed" | "error", progress: number) {
  // Update Zustand store
  usePostStore.getState().setBackgroundOrganizerStatus(status);
  usePostStore.getState().setBackgroundOrganizerProgress(progress);
  
  // Call registered progress callback if any
  if (activeCallback) {
    activeCallback(status, progress);
  }
}

export function startBackgroundAutoOrganizer() {
  if (workerInterval !== null) return;

  // Run every 10 seconds in the background to watch for newly imported uncategorized posts
  workerInterval = window.setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    
    try {
      updateStatus("running", 10);
      
      const currentPosts = await db.posts.toArray();
      updateStatus("running", 30);
      
      const uncategorizedCount = currentPosts.filter(
        (p) => !p.collections || p.collections.length === 0
      ).length;

      if (uncategorizedCount > 0) {
        updateStatus("running", 60);
        const { categorizedCount, collectionsCreatedCount } =
          await executeAutoBatchCategorization(currentPosts);
          
        updateStatus("running", 80);
        if (categorizedCount > 0 || collectionsCreatedCount > 0) {
          const freshPosts = await db.posts.toArray();
          usePostStore.getState().setPosts(freshPosts);
          console.debug(
            `[Background Worker] Auto-categorized ${categorizedCount} new posts and created ${collectionsCreatedCount} smart folders based on tags and keywords.`
          );
        }
      }
      
      updateStatus("completed", 100);
      
      // Auto-reset back to idle after a few seconds so the UI indicator fades out elegantly
      setTimeout(() => {
        if (usePostStore.getState().backgroundOrganizerStatus === "completed") {
          updateStatus("idle", 0);
        }
      }, 3500);

    } catch (err) {
      console.debug("[Background Worker] Error in auto-categorization worker:", err);
      updateStatus("error", 0);
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
  updateStatus("idle", 0);
}
