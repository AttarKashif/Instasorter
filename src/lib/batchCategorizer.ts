import { Post } from "../types/post";
import { CATEGORY_DICTIONARY, CategoryDefinition } from "./searchSynonyms";
import { db } from "./db";

export interface PostSuggestion {
  post: Post;
  suggestedCollection: string;
  suggestedTags: string[];
  matchedKeywords: string[];
  category: CategoryDefinition;
}

export interface CategoryGroupSuggestion {
  category: CategoryDefinition;
  suggestedCollection: string;
  posts: PostSuggestion[];
  suggestedTags: string[];
}

export interface BatchCategorizationResult {
  uncategorizedCount: number;
  suggestedPostsCount: number;
  categoryGroups: CategoryGroupSuggestion[];
}

/**
 * Analyzes posts to find those without collections/tags and matches them against keyword dictionaries.
 */
export function analyzeUncategorizedPosts(posts: Post[]): BatchCategorizationResult {
  if (!posts || posts.length === 0) {
    return { uncategorizedCount: 0, suggestedPostsCount: 0, categoryGroups: [] };
  }

  // Identify uncategorized posts (no collections assigned)
  const uncategorizedPosts = posts.filter(
    (p) => !p.collections || p.collections.length === 0
  );

  const categoryGroupsMap = new Map<string, CategoryGroupSuggestion>();
  let totalSuggestedCount = 0;

  uncategorizedPosts.forEach((post) => {
    const searchableText = `${post.caption || ""} ${post.notes || ""} ${
      post.creatorUsername || ""
    } ${post.creatorName || ""} ${(post.hashtags || []).join(" ")} ${(
      post.tags || []
    ).join(" ")}`.toLowerCase();

    // Check each category definition
    let bestMatchCategory: CategoryDefinition | null = null;
    let maxMatchedCount = 0;
    let bestMatchedTerms: string[] = [];

    CATEGORY_DICTIONARY.forEach((cat) => {
      const matchedTerms: string[] = [];

      // Check keywords
      cat.keywords.forEach((kw) => {
        if (searchableText.includes(kw)) {
          matchedTerms.push(kw);
        }
      });

      // Check synonyms
      cat.synonyms.forEach((syn) => {
        if (searchableText.includes(syn)) {
          matchedTerms.push(syn);
        }
      });

      if (matchedTerms.length > maxMatchedCount) {
        maxMatchedCount = matchedTerms.length;
        bestMatchCategory = cat;
        bestMatchedTerms = Array.from(new Set(matchedTerms));
      }
    });

    if (bestMatchCategory && maxMatchedCount > 0) {
      const cat = bestMatchCategory as CategoryDefinition;
      const suggestedCollection = cat.label;
      const suggestedTags = Array.from(
        new Set([...bestMatchedTerms.slice(0, 3), cat.id])
      );

      const postSuggestion: PostSuggestion = {
        post,
        suggestedCollection,
        suggestedTags,
        matchedKeywords: bestMatchedTerms,
        category: cat,
      };

      if (!categoryGroupsMap.has(cat.id)) {
        categoryGroupsMap.set(cat.id, {
          category: cat,
          suggestedCollection,
          posts: [],
          suggestedTags: Array.from(new Set(cat.keywords.slice(0, 3))),
        });
      }

      categoryGroupsMap.get(cat.id)!.posts.push(postSuggestion);
      totalSuggestedCount++;
    }
  });

  return {
    uncategorizedCount: uncategorizedPosts.length,
    suggestedPostsCount: totalSuggestedCount,
    categoryGroups: Array.from(categoryGroupsMap.values()).sort(
      (a, b) => b.posts.length - a.posts.length
    ),
  };
}

/**
 * Automatically applies category suggestions to uncategorized posts, creating collections in Dexie.
 */
export async function executeAutoBatchCategorization(
  posts: Post[]
): Promise<{ categorizedCount: number; collectionsCreatedCount: number }> {
  const analysis = analyzeUncategorizedPosts(posts);
  if (!analysis || analysis.categoryGroups.length === 0) {
    return { categorizedCount: 0, collectionsCreatedCount: 0 };
  }

  let categorizedCount = 0;
  let collectionsCreatedCount = 0;

  for (const group of analysis.categoryGroups) {
    // 1. Ensure collection exists in Dexie DB
    const existingCollection = await db.collections
      .where("name")
      .equals(group.suggestedCollection)
      .first();

    if (!existingCollection) {
      await db.collections.add({
        id: `coll_${Date.now()}_${group.category.id}`,
        name: group.suggestedCollection,
        createdAt: new Date().toISOString(),
      });
      collectionsCreatedCount++;
    }

    // 2. Update each post in group
    for (const item of group.posts) {
      const p = item.post;
      const currentCollections = p.collections || [];
      const currentTags = p.tags || [];

      const updatedCollections = Array.from(
        new Set([...currentCollections, group.suggestedCollection])
      );
      const updatedTags = Array.from(
        new Set([...currentTags, ...item.suggestedTags])
      );

      await db.posts.update(p.id, {
        collections: updatedCollections,
        tags: updatedTags,
      });

      categorizedCount++;
    }
  }

  return { categorizedCount, collectionsCreatedCount };
}
