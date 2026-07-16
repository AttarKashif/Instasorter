import React, { useState, useEffect, useRef } from "react";
import { Post } from "../../types/post";
import { Instagram, Image as ImageIcon, Film, Layers } from "lucide-react";
import { db } from "../../lib/db";
import { usePostStore } from "../../store/useStore";

interface InstagramImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  post: Post;
  onDimensionsLoaded?: (dimensions: {
    width: number;
    height: number;
    ratio: number;
  }) => void;
}

const getInitialImgSrc = (post: Post): string => {
  if (post.thumbnailUrl) {
    const tUrl = post.thumbnailUrl.trim();
    if (
      tUrl.startsWith("/") ||
      tUrl.startsWith("data:") ||
      tUrl.includes("unsplash.com") ||
      tUrl.includes("picsum.photos") ||
      (!tUrl.includes("instagram.com") &&
        !tUrl.includes("instagr.am") &&
        tUrl.startsWith("http"))
    ) {
      return tUrl;
    }
  }

  if (
    post.thumbnailUrl &&
    (post.thumbnailUrl.includes("cdninstagram.com") ||
      post.thumbnailUrl.includes("scontent"))
  ) {
    return post.thumbnailUrl;
  }

  return "";
};

export const InstagramImage = ({
  post,
  className,
  alt,
  onDimensionsLoaded,
  src,
  ...props
}: InstagramImageProps) => {
  const [imgSrc, setImgSrc] = useState<string>(() =>
    src ? (typeof src === "string" ? src : "") : getInitialImgSrc(post),
  );
  const [hasFailed, setHasFailed] = useState<boolean>(
    () => post.thumbnailStatus === "failed" || (!imgSrc && !src),
  );
  const [isInView, setIsInView] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

    
  useEffect(() => {
    let isSubscribed = true;
    const initialSrc = src ? (typeof src === "string" ? src : "") : getInitialImgSrc(post);
    const isPersistentlyFailed = post.thumbnailStatus === "failed";
    
    setIsLoaded(false);
    
    if (initialSrc === "base64-placeholder" || post.thumbnailUrl === "base64-placeholder") {
      db.posts.get(post.id).then(p => {
         if (!isSubscribed || !p) return;
         if (p.thumbnailUrl && p.thumbnailUrl !== "base64-placeholder") {
            setImgSrc(p.thumbnailUrl);
            setHasFailed(p.thumbnailStatus === "failed");
         } else {
            const fallbackSrc = getInitialImgSrc(p);
            if (!fallbackSrc && p.thumbnailStatus !== "failed" && p.postUrl) {
               setHasFailed(true);
               triggerHeal(true);
            } else {
               setImgSrc(fallbackSrc);
               setHasFailed(p.thumbnailStatus === "failed" || (!fallbackSrc && !src));
            }
         }
      }).catch(() => {});
    } else {
      if (!initialSrc && !isPersistentlyFailed && post.postUrl) {
         setHasFailed(true);
         triggerHeal(true);
      } else {
         setImgSrc(initialSrc);
         setHasFailed(isPersistentlyFailed || (!initialSrc && !src));
      }
    }
    
    return () => { isSubscribed = false; };
  }, [post.thumbnailUrl, post.thumbnailStatus, post.postUrl, post.id, src]);


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setIsInView(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "250px 0px", // start loading 250px before entering viewport
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [post.id]);

  
  const triggerHeal = (force = true) => {
    fetch("/api/fetch-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: post.postUrl, id: post.id, force }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.path) {
          const updatedFields: Partial<Post> = {
            thumbnailUrl: data.path,
            thumbnailStatus: "success",
          };
          if (
            data.creatorUsername &&
            (!post.creatorUsername ||
              post.creatorUsername === "instagram_creator" ||
              post.creatorUsername === "instagram_user" ||
              post.creatorUsername.trim() === "")
          ) {
            updatedFields.creatorUsername = data.creatorUsername;
          }
          db.posts.update(post.id, updatedFields).catch(() => {});
          usePostStore.getState().updatePost(post.id, updatedFields);
        } else {
          db.posts.update(post.id, { thumbnailStatus: "failed" }).catch(() => {});
          usePostStore.getState().updatePost(post.id, { thumbnailStatus: "failed" });
        }
      })
      .catch((err) => {
        console.warn("Failed self-healing thumbnail download:", err);
        db.posts.update(post.id, { thumbnailStatus: "failed" }).catch(() => {});
        usePostStore.getState().updatePost(post.id, { thumbnailStatus: "failed" });
      });
  };

  const handleError = () => {
    if (!hasFailed) {
      setHasFailed(true);
      db.posts.update(post.id, { thumbnailStatus: "failed" }).catch(() => {});
      usePostStore.getState().updatePost(post.id, { thumbnailStatus: "failed" });
      triggerHeal(true);
    }
  };

  const isDataUri = post.thumbnailUrl && post.thumbnailUrl.startsWith("data:");

  // If the live image failed to load, and not a local base64/data URI,
  // render our gorgeous metadata-driven custom placeholder card.
  if (hasFailed && !isDataUri) {
    return (
      <div className="w-full h-full flex flex-col justify-between p-5 text-center select-none bg-m3-surface-container border border-m3-outline-variant/20 rounded-[inherit] relative overflow-hidden group/placeholder">
        {/* Header/Badge */}
        <div className="flex items-center justify-between w-full opacity-80 text-[9px] font-mono tracking-wider text-m3-outline uppercase relative z-10">
          <span className="flex items-center gap-1 font-semibold text-m3-primary">
            <Instagram size={11} className="animate-pulse" />
            Instagram
          </span>
          <span className="bg-m3-surface-variant/50 px-2 py-0.5 rounded-full border border-m3-outline-variant/10 text-m3-on-surface-variant font-bold">
            {post.mediaType || "Post"}
          </span>
        </div>

        {/* Brand Icon & "No Preview Found" */}
        <div className="flex flex-col items-center gap-2 relative z-10 my-auto">
          <div className="w-12 h-12 rounded-full bg-m3-surface-variant/80 border border-m3-outline-variant/30 flex items-center justify-center text-m3-on-surface-variant/80 shadow-xs group-hover/placeholder:scale-105 transition-transform duration-300">
            <ImageIcon size={18} className="stroke-[1.75]" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-extrabold text-m3-on-surface tracking-tight">
              No preview found
            </span>
            <span className="text-[10px] text-m3-outline">
              @{post.creatorUsername || "creator"}
            </span>
          </div>
        </div>

        {/* Dynamic Caption Quote snippet (max 80 chars) */}
        <div className="w-full text-[10px] text-m3-on-surface-variant/75 font-medium leading-relaxed line-clamp-2 px-1 relative z-10 italic border-t border-m3-outline-variant/10 pt-3">
          "
          {post.caption
            ?.replace(/#[\w\d_]+/gu, "")
            .trim()
            .substring(0, 80) || "Saved item context"}
          "
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {/* Loading overlay/skeleton */}
      {(!isInView || !isLoaded) && (
        <div className="absolute inset-0 bg-m3-surface-container flex items-center justify-center animate-pulse z-10">
          <ImageIcon size={24} className="text-m3-outline/25 stroke-[1.5]" />
        </div>
      )}

      {/* Actual image */}
      {isInView && (
        <img
          src={imgSrc || undefined}
          alt={alt || post.caption || "Instagram Media"}
          className={`${className} transition-all duration-700 ${isLoaded ? "opacity-100 blur-0" : "opacity-0 blur-lg"}`}
          onError={handleError}
          onLoad={(e) => {
            const nw = e.currentTarget.naturalWidth;
            const nh = e.currentTarget.naturalHeight;
            if (nw <= 10 || nh <= 10) {
               handleError();
               return;
            }
            setIsLoaded(true);
            if (onDimensionsLoaded) {
              onDimensionsLoaded({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
                ratio:
                  e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              });
            }
          }}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};
