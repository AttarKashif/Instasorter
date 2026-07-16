import { useState, useEffect } from "react";
import { Post } from "../types/post";
import { db } from "../lib/db";

export function useFullPost(post: Post) {
  const [fullPost, setFullPost] = useState<Post>(post);

  useEffect(() => {
    let isSubscribed = true;
    
    // Only load from DB if it has a placeholder thumbnail
    if (post.thumbnailUrl === "base64-placeholder" || !post.thumbnailUrl) {
      db.posts.get(post.id).then((p) => {
        if (isSubscribed && p) {
          setFullPost(p);
        }
      });
    } else {
      setFullPost(post);
    }
    
    return () => {
      isSubscribed = false;
    };
  }, [post.id, post.thumbnailUrl, post]);

  return fullPost;
}
