import { db } from "./db";
import { analyzeDuplicates, executeDeduplication } from "./duplicateDetector";
import { executeAutoBatchCategorization } from "./batchCategorizer";
import { Post } from "../types/post";

/**
 * Runs automatic deduplication and batch categorization on the entire IndexedDB post store.
 * Merges duplicate posts, creates category collections, and assigns tags/collections to uncategorized posts.
 * Operates silently without requiring manual approval.
 */
export async function runAutoDeduplicationAndBatching(): Promise<{
  mergedDuplicatesCount: number;
  autoCategorizedCount: number;
  freshPosts: Post[];
}> {
  try {
    // 1. Get current posts
    let currentPosts = await db.posts.toArray();

    // 2. Run Automatic Deduplication
    const dupAnalysis = analyzeDuplicates(currentPosts);
    let mergedDuplicatesCount = 0;

    if (dupAnalysis.groups.length > 0) {
      const { deletedPostsCount } = await executeDeduplication(dupAnalysis.groups);
      mergedDuplicatesCount = deletedPostsCount;
    }

    // 3. Get updated posts after deduplication
    currentPosts = await db.posts.toArray();

    // 4. Run Automatic Batch Categorization
    const { categorizedCount } = await executeAutoBatchCategorization(currentPosts);

    // 5. Fetch final posts
    const freshPosts = await db.posts.toArray();

    return {
      mergedDuplicatesCount,
      autoCategorizedCount: categorizedCount,
      freshPosts,
    };
  } catch (error) {
    console.error("[AutoOrganizer] Automatic organization failed:", error);
    const freshPosts = await db.posts.toArray();
    return {
      mergedDuplicatesCount: 0,
      autoCategorizedCount: 0,
      freshPosts,
    };
  }
}
