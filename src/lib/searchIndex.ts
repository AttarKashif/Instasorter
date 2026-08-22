import { Post } from "../types/post";

export interface FullTextSearchIndex {
  // Maps normalized token or prefix (min length 2) -> Set of post IDs
  tokenMap: Map<string, Set<string>>;
  // Maps post ID -> Set of original tokens for exact scoring
  postTokensMap: Map<string, Set<string>>;
}

/**
 * Normalizes text and extracts word tokens and prefix n-grams (min length 2)
 */
export function extractTokens(post: Post): { tokens: Set<string>; prefixes: Set<string> } {
  const tokens = new Set<string>();
  const prefixes = new Set<string>();

  const processText = (text?: string, isWeightyTag = false) => {
    if (!text) return;
    // Remove punctuation, split into words
    const clean = text.toLowerCase().replace(/[^\w\s#]/g, " ");
    const words = clean.split(/\s+/);

    for (let word of words) {
      if (word.startsWith("#")) word = word.slice(1);
      if (word.length < 2) continue;

      tokens.add(word);
      if (isWeightyTag) {
        tokens.add(`tag:${word}`);
      }

      // Generate prefix n-grams (e.g., "sunset" -> "su", "sun", "suns", "sunse", "sunset")
      const maxPrefix = Math.min(word.length, 12);
      for (let i = 2; i <= maxPrefix; i++) {
        prefixes.add(word.slice(0, i));
      }
    }
  };

  processText(post.caption);
  (post.tags || []).forEach((t) => processText(t, true));
  (post.hashtags || []).forEach((h) => processText(h, true));
  (post.collections || []).forEach((c) => processText(c));
  processText(post.creatorUsername);
  processText(post.creatorName);
  processText(post.notes);

  return { tokens, prefixes };
}

/**
 * Builds a fast inverted index with prefix indexing for all posts
 */
export function buildSearchIndex(posts: Post[]): FullTextSearchIndex {
  const tokenMap = new Map<string, Set<string>>();
  const postTokensMap = new Map<string, Set<string>>();

  for (const post of posts) {
    const { tokens, prefixes } = extractTokens(post);
    postTokensMap.set(post.id, tokens);

    // Index tokens and prefix n-grams
    const allKeys = new Set([...tokens, ...prefixes]);
    for (const key of allKeys) {
      let idSet = tokenMap.get(key);
      if (!idSet) {
        idSet = new Set<string>();
        tokenMap.set(key, idSet);
      }
      idSet.add(post.id);
    }
  }

  return { tokenMap, postTokensMap };
}

/**
 * Incrementally updates or removes a single post in the inverted index in O(tokens) time
 */
export function updatePostInIndex(
  index: FullTextSearchIndex,
  updatedPost: Post,
  isRemoval = false
): FullTextSearchIndex {
  const { tokenMap, postTokensMap } = index;

  // Clean old token mappings if already indexed
  const oldTokens = postTokensMap.get(updatedPost.id);
  if (oldTokens) {
    for (const token of oldTokens) {
      const set = tokenMap.get(token);
      if (set) {
        set.delete(updatedPost.id);
        if (set.size === 0) tokenMap.delete(token);
      }
      const maxPrefix = Math.min(token.length, 12);
      for (let i = 2; i <= maxPrefix; i++) {
        const prefix = token.slice(0, i);
        const pSet = tokenMap.get(prefix);
        if (pSet) {
          pSet.delete(updatedPost.id);
          if (pSet.size === 0) tokenMap.delete(prefix);
        }
      }
    }
    postTokensMap.delete(updatedPost.id);
  }

  if (!isRemoval) {
    const { tokens, prefixes } = extractTokens(updatedPost);
    postTokensMap.set(updatedPost.id, tokens);
    const allKeys = new Set([...tokens, ...prefixes]);
    for (const key of allKeys) {
      let idSet = tokenMap.get(key);
      if (!idSet) {
        idSet = new Set<string>();
        tokenMap.set(key, idSet);
      }
      idSet.add(updatedPost.id);
    }
  }

  return { tokenMap, postTokensMap };
}

/**
 * Fast lookup function returning post IDs matching the query using the inverted index
 */
export function querySearchIndex(
  index: FullTextSearchIndex,
  query: string,
  posts: Post[]
): Post[] | null {
  if (!query || !query.trim()) return null;

  const rawTokens = query.toLowerCase().trim().split(/\s+/);
  const searchTokens = rawTokens.map((t) => (t.startsWith("#") ? t.slice(1) : t)).filter((t) => t.length >= 1);

  if (searchTokens.length === 0) return null;

  let candidateIds: Set<string> | null = null;

  for (const token of searchTokens) {
    if (token.length < 2) {
      // Single character search fallback
      const singleMatches = new Set<string>();
      for (const post of posts) {
        const fullText = `${post.caption} ${(post.tags || []).join(" ")} ${(post.hashtags || []).join(" ")} ${post.creatorUsername} ${post.notes || ""}`.toLowerCase();
        if (fullText.includes(token)) {
          singleMatches.add(post.id);
        }
      }
      if (candidateIds === null) {
        candidateIds = singleMatches;
      } else {
        candidateIds = new Set([...candidateIds].filter((id) => singleMatches.has(id)));
      }
      continue;
    }

    const matches = index.tokenMap.get(token);
    if (!matches || matches.size === 0) {
      // Token not found in index, AND search results in 0 matches
      return [];
    }

    if (candidateIds === null) {
      candidateIds = new Set(matches);
    } else {
      // Intersect candidate set
      candidateIds = new Set([...candidateIds].filter((id) => matches.has(id)));
    }

    if (candidateIds.size === 0) break;
  }

  if (!candidateIds || candidateIds.size === 0) return [];

  // Map candidate IDs back to post objects in order
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const results: Post[] = [];

  for (const id of candidateIds) {
    const post = postMap.get(id);
    if (post) results.push(post);
  }

  return results;
}
