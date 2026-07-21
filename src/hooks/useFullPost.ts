import { useState, useEffect } from "react";
import { Post } from "../types/post";
import { db } from "../lib/db";

export function useFullPost(post: Post) {
  const [dbPost, setDbPost] = useState<Post | null>(null);

  useEffect(() => {
    if (post.thumbnailUrl === "base64-placeholder" || !post.thumbnailUrl) {
      let isSubscribed = true;
      db.posts.get(post.id).then((p) => {
        if (isSubscribed && p) {
          setDbPost(p);
        }
      });
      return () => {
        isSubscribed = false;
      };
    } else {
      setDbPost(null);
    }
  }, [post.id, post.thumbnailUrl]);

  return (post.thumbnailUrl === "base64-placeholder" || !post.thumbnailUrl) && dbPost ? dbPost : post;
}
