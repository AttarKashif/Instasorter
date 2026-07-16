import { Post, Collection } from "../types/post";
import { db } from "./db";

export async function generateSmartCollections(): Promise<
  Partial<Collection>[]
> {
  const allPosts = await db.posts.toArray();

  const hashtagCounts: Record<string, number> = {};
  const creatorCounts: Record<string, number> = {};

  allPosts.forEach((post) => {
    post.hashtags.forEach((tag) => {
      hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
    });
    creatorCounts[post.creatorUsername] =
      (creatorCounts[post.creatorUsername] || 0) + 1;
  });

  const smartCollections: Partial<Collection>[] = [];

  // Suggest collections for top hashtags used >= 3 times
  Object.entries(hashtagCounts).forEach(([tag, count]) => {
    if (count >= 3) {
      smartCollections.push({
        id: `smart_hashtag_${tag}`,
        name: `Hashtag: #${tag}`,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // Suggest collections for top creators used >= 3 times
  Object.entries(creatorCounts).forEach(([creator, count]) => {
    if (count >= 3) {
      smartCollections.push({
        id: `smart_creator_${creator}`,
        name: `Creator: ${creator}`,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return smartCollections as Collection[];
}
