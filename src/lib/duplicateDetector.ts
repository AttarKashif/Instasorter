import { Post } from "../types/post";
import { db } from "./db";
import { cleanInstagramUrl } from "./parser";

export interface DuplicateGroup {
  groupId: string;
  reason: "shared_url" | "identical_image" | "matching_content";
  reasonLabel: string;
  primaryPost: Post;
  redundantPosts: Post[];
  allPosts: Post[];
}

export interface DuplicateAnalysisResult {
  groups: DuplicateGroup[];
  totalRedundantCount: number;
  groupCount: number;
}

/**
 * Normalizes string content for soft text comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects potential near-duplicate or exact duplicate posts in the collection.
 */
export function analyzeDuplicates(posts: Post[]): DuplicateAnalysisResult {
  if (!posts || posts.length < 2) {
    return { groups: [], totalRedundantCount: 0, groupCount: 0 };
  }

  // Track parent pointers (Disjoint-set / Union-Find) to group connected duplicates
  const parent = new Map<string, string>();
  posts.forEach((p) => parent.set(p.id, p.id));

  function find(id: string): string {
    if (parent.get(id) === id) return id;
    const root = find(parent.get(id)!);
    parent.set(id, root);
    return root;
  }

  function union(id1: string, id2: string) {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent.set(root2, root1);
    }
  }

  // Record reasons for grouping
  const groupReasons = new Map<
    string,
    "shared_url" | "identical_image" | "matching_content"
  >();

  // 1. Group by clean Instagram/post URL
  const urlMap = new Map<string, Post[]>();
  posts.forEach((p) => {
    const rawUrl = p.postUrl || p.instagramUrl || "";
    const cleanUrl = cleanInstagramUrl(rawUrl);
    if (cleanUrl) {
      const list = urlMap.get(cleanUrl) || [];
      list.push(p);
      urlMap.set(cleanUrl, list);
    }
  });

  urlMap.forEach((list) => {
    if (list.length > 1) {
      const first = list[0];
      for (let i = 1; i < list.length; i++) {
        union(first.id, list[i].id);
        groupReasons.set(first.id, "shared_url");
      }
    }
  });

  // 2. Group by exact non-empty thumbnail URL / image source
  const thumbMap = new Map<string, Post[]>();
  posts.forEach((p) => {
    const thumb = p.thumbnailUrl;
    if (
      thumb &&
      thumb.length > 20 &&
      !thumb.includes("placeholder") &&
      !thumb.startsWith("data:image/svg")
    ) {
      const list = thumbMap.get(thumb) || [];
      list.push(p);
      thumbMap.set(thumb, list);
    }
  });

  thumbMap.forEach((list) => {
    if (list.length > 1) {
      const first = list[0];
      for (let i = 1; i < list.length; i++) {
        const root1 = find(first.id);
        const root2 = find(list[i].id);
        if (root1 !== root2) {
          union(first.id, list[i].id);
          if (!groupReasons.has(first.id)) {
            groupReasons.set(first.id, "identical_image");
          }
        }
      }
    }
  });

  // 3. Group by Creator Username + normalized Caption (if caption length > 25 chars)
  const contentMap = new Map<string, Post[]>();
  posts.forEach((p) => {
    const creator = (p.creatorUsername || "").toLowerCase().trim();
    const normCap = normalizeText(p.caption || "");
    if (creator && normCap.length > 25) {
      const key = `${creator}___${normCap.substring(0, 80)}`;
      const list = contentMap.get(key) || [];
      list.push(p);
      contentMap.set(key, list);
    }
  });

  contentMap.forEach((list) => {
    if (list.length > 1) {
      const first = list[0];
      for (let i = 1; i < list.length; i++) {
        const root1 = find(first.id);
        const root2 = find(list[i].id);
        if (root1 !== root2) {
          union(first.id, list[i].id);
          if (!groupReasons.has(first.id)) {
            groupReasons.set(first.id, "matching_content");
          }
        }
      }
    }
  });

  // Collect clusters
  const clusters = new Map<string, Post[]>();
  posts.forEach((p) => {
    const rootId = find(p.id);
    const list = clusters.get(rootId) || [];
    list.push(p);
    clusters.set(rootId, list);
  });

  const groups: DuplicateGroup[] = [];
  let totalRedundantCount = 0;

  clusters.forEach((clusterPosts, rootId) => {
    if (clusterPosts.length > 1) {
      // Pick primary post: post with best thumbnail or most recent savedAt
      clusterPosts.sort((a, b) => {
        const aHasThumb = a.thumbnailUrl ? 1 : 0;
        const bHasThumb = b.thumbnailUrl ? 1 : 0;
        if (aHasThumb !== bHasThumb) return bHasThumb - aHasThumb;

        const aDate = new Date(a.savedAt || 0).getTime();
        const bDate = new Date(b.savedAt || 0).getTime();
        return bDate - aDate;
      });

      const primaryPost = clusterPosts[0];
      const redundantPosts = clusterPosts.slice(1);
      const rawReason = groupReasons.get(rootId) || "shared_url";

      let reasonLabel = "Shared Instagram URL";
      if (rawReason === "identical_image") {
        reasonLabel = "Identical Image Match";
      } else if (rawReason === "matching_content") {
        reasonLabel = "Matching Caption & Creator";
      }

      groups.push({
        groupId: rootId,
        reason: rawReason,
        reasonLabel,
        primaryPost,
        redundantPosts,
        allPosts: clusterPosts,
      });

      totalRedundantCount += redundantPosts.length;
    }
  });

  return {
    groups,
    totalRedundantCount,
    groupCount: groups.length,
  };
}

/**
 * Executes automatic deduplication merging metadata into primary posts and deleting redundant entries.
 */
export async function executeDeduplication(
  groups: DuplicateGroup[],
): Promise<{ mergedGroupsCount: number; deletedPostsCount: number }> {
  let mergedGroupsCount = 0;
  let deletedPostsCount = 0;

  for (const group of groups) {
    const { primaryPost, redundantPosts } = group;
    if (redundantPosts.length === 0) continue;

    const mergedTags = new Set(primaryPost.tags || []);
    const mergedCollections = new Set(primaryPost.collections || []);
    let mergedIsFavorite = primaryPost.isFavorite;
    let mergedIsArchived = primaryPost.isArchived;
    let mergedReadLater = primaryPost.readLater;
    let mergedNotes = primaryPost.notes || "";
    let bestThumbnail = primaryPost.thumbnailUrl;

    const redundantIds: string[] = [];

    for (const other of redundantPosts) {
      redundantIds.push(other.id);
      other.tags?.forEach((t) => mergedTags.add(t));
      other.collections?.forEach((c) => mergedCollections.add(c));
      if (other.isFavorite) mergedIsFavorite = true;
      if (other.isArchived) mergedIsArchived = true;
      if (other.readLater) mergedReadLater = true;
      if (other.notes && !mergedNotes.includes(other.notes)) {
        mergedNotes += mergedNotes ? `\n${other.notes}` : other.notes;
      }
      if (!bestThumbnail && other.thumbnailUrl) {
        bestThumbnail = other.thumbnailUrl;
      }
    }

    // Update primary post in Dexie
    await db.posts.update(primaryPost.id, {
      tags: Array.from(mergedTags),
      collections: Array.from(mergedCollections),
      isFavorite: mergedIsFavorite,
      isArchived: mergedIsArchived,
      readLater: mergedReadLater,
      notes: mergedNotes,
      thumbnailUrl: bestThumbnail,
    });

    // Delete redundant posts
    if (redundantIds.length > 0) {
      await db.posts.bulkDelete(redundantIds);
      deletedPostsCount += redundantIds.length;
    }

    mergedGroupsCount++;
  }

  return { mergedGroupsCount, deletedPostsCount };
}
