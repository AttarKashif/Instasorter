import { db } from "./db";
import { Post } from "../types/post";

export interface DuplicateGroup {
  id: string;
  posts: Post[];
}

/**
 * Groups posts by ID to find duplicate entries.
 */
export function analyzeDuplicates(posts: Post[]): { groups: DuplicateGroup[] } {
  const groupsMap = new Map<string, Post[]>();
  for (const post of posts) {
    if (!post.id) continue;
    const existing = groupsMap.get(post.id) || [];
    existing.push(post);
    groupsMap.set(post.id, existing);
  }
  const groups: DuplicateGroup[] = [];
  for (const [id, list] of groupsMap.entries()) {
    if (list.length > 1) {
      groups.push({ id, posts: list });
    }
  }
  return { groups };
}

/**
 * Resolves duplicates by keeping the post with the richest metadata and deleting others.
 */
export async function executeDeduplication(groups: DuplicateGroup[]): Promise<{ deletedPostsCount: number }> {
  let deletedPostsCount = 0;
  for (const group of groups) {
    const sorted = [...group.posts].sort((a, b) => {
      const aLen = (a.caption || "").length + (a.notes || "").length + (a.isFavorite ? 100 : 0);
      const bLen = (b.caption || "").length + (b.notes || "").length + (b.isFavorite ? 100 : 0);
      return bLen - aLen;
    });
    const bestPost = sorted[0];
    const toDelete = sorted.slice(1);
    for (const postToDelete of toDelete) {
      if (postToDelete.id) {
        await db.posts.delete(postToDelete.id);
        deletedPostsCount++;
      }
    }
  }
  return { deletedPostsCount };
}

/**
 * Automatically groups unorganized posts into collections based on caption & tag keywords.
 */
export async function executeAutoBatchCategorization(
  posts: Post[]
): Promise<{ categorizedCount: number; collectionsCreatedCount: number }> {
  let categorizedCount = 0;
  const categoriesMap = [
    { name: "Fashion & Style", keywords: ["fashion", "style", "outfit", "ootd", "apparel", "wardrobe", "lookbook", "chic"] },
    { name: "Food & Dining", keywords: ["food", "recipe", "dining", "cook", "chef", "yummy", "delicious", "restaurant", "cafe", "dinner", "brunch"] },
    { name: "Travel & Adventure", keywords: ["travel", "adventure", "nature", "wanderlust", "trip", "vacation", "explore", "hiking", "scenic"] },
    { name: "Tech & Design", keywords: ["tech", "coding", "design", "developer", "software", "gadget", "ux", "ui", "minimalist", "setup"] },
    { name: "Health & Fitness", keywords: ["fitness", "health", "workout", "gym", "wellness", "active", "run", "yoga", "nutrition"] }
  ];

  for (const post of posts) {
    const existingCollections = post.collections || [];
    if (existingCollections.length > 0) continue;

    const matchedCategories: string[] = [];
    const textToAnalyze = `${post.caption || ""} ${post.notes || ""} ${(post.hashtags || []).join(" ")} ${(post.tags || []).join(" ")}`.toLowerCase();

    for (const cat of categoriesMap) {
      if (cat.keywords.some(kw => textToAnalyze.includes(kw))) {
        matchedCategories.push(cat.name);
      }
    }

    if (matchedCategories.length > 0) {
      await db.posts.update(post.id, {
        collections: matchedCategories
      });
      categorizedCount++;
    }
  }

  return { categorizedCount, collectionsCreatedCount: 0 };
}

/**
 * Runs automatic deduplication and batch categorization on the entire IndexedDB post store.
 */
export async function runAutoDeduplicationAndBatching(): Promise<{
  mergedDuplicatesCount: number;
  autoCategorizedCount: number;
  freshPosts: Post[];
}> {
  try {
    let currentPosts = await db.posts.toArray();

    // 1. Run Automatic Deduplication
    const dupAnalysis = analyzeDuplicates(currentPosts);
    let mergedDuplicatesCount = 0;

    if (dupAnalysis.groups.length > 0) {
      const { deletedPostsCount } = await executeDeduplication(dupAnalysis.groups);
      mergedDuplicatesCount = deletedPostsCount;
    }

    // 2. Get updated posts after deduplication
    currentPosts = await db.posts.toArray();

    // 3. Run Automatic Batch Categorization
    const { categorizedCount } = await executeAutoBatchCategorization(currentPosts);

    // 4. Fetch final posts
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
