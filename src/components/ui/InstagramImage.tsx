import React, { useState, useEffect, useRef, useCallback } from "react";
import { Post } from "../../types/post";
import { RefreshCw } from "lucide-react";
import { db } from "../../lib/db";
import { usePostStore } from "../../store/useStore";
import { getCachedThumbnailUrl, storeThumbnailInCache } from "../../lib/thumbnailCache";
import { registerPostVisibility, retrySingleThumbnail } from "../../lib/thumbnailWorker";

interface InstagramImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  post: Post;
  onDimensionsLoaded?: (dimensions: {
    width: number;
    height: number;
    ratio: number;
  }) => void;
}

const getInitialImgSrc = (post: Post): string => {
  if (post.thumbnailStatus === "failed") {
    return "";
  }

  if (post.thumbnailUrl) {
    const tUrl = post.thumbnailUrl.trim();
    // Do not use deprecated SVG card fallbacks
    if (tUrl.endsWith(".svg")) {
      return "";
    }

    if (
      tUrl.startsWith("/") ||
      tUrl.startsWith("data:") ||
      (!tUrl.includes("instagram.com") &&
        !tUrl.includes("instagr.am") &&
        !tUrl.includes("unsplash.com") &&
        !tUrl.includes("picsum.photos") &&
        tUrl.startsWith("http"))
    ) {
      return tUrl;
    }

    if (
      tUrl.includes("cdninstagram.com") ||
      tUrl.includes("scontent") ||
      tUrl.includes("fbcdn")
    ) {
      return tUrl;
    }
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
  const [hasFailed, setHasFailed] = useState<boolean>(() => {
    return post.thumbnailStatus === "failed";
  });
  const [isInView, setIsInView] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state whenever post properties change
  useEffect(() => {
    const nextSrc = src ? (typeof src === "string" ? src : "") : getInitialImgSrc(post);
    setImgSrc(nextSrc);
    setHasFailed(post.thumbnailStatus === "failed");
    setIsLoaded(false);
  }, [post.thumbnailUrl, post.thumbnailStatus, src]);

  // Viewport intersection observer: registers visibility with the background thumbnail worker queue
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.isIntersecting;
        setIsInView(inView);
        registerPostVisibility(post.id, inView);
      },
      {
        rootMargin: "300px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      registerPostVisibility(post.id, false);
    };
  }, [post.id]);

  // IndexedDB Cache lookup when in view
  useEffect(() => {
    if (!isInView || !imgSrc) return;
    let active = true;
    getCachedThumbnailUrl(imgSrc).then((cachedUrl) => {
      if (active && cachedUrl && cachedUrl !== imgSrc) {
        setImgSrc(cachedUrl);
      }
    });
    return () => {
      active = false;
    };
  }, [isInView, imgSrc]);

  const handleManualRetry = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRetrying) return;
    setIsRetrying(true);
    setHasFailed(false);
    try {
      await retrySingleThumbnail(post.id);
    } catch (err) {
      console.warn("Manual thumbnail retry error:", err);
    } finally {
      setTimeout(() => setIsRetrying(false), 2000);
    }
  }, [post.id, isRetrying]);

  const handleError = useCallback(() => {
    setHasFailed(true);
    setImgSrc("");
    const attempts = post.thumbnailAttempts || 0;
    if (attempts >= 4) {
      db.posts.update(post.id, { thumbnailStatus: "failed" }).catch(() => {});
      usePostStore.getState().updatePost(post.id, { thumbnailStatus: "failed" });
    }
  }, [post.id, post.thumbnailAttempts]);

  // 1. When actively pending in queue without an image yet, render a subtle, minimal Instagram-dark shimmer
  if (!imgSrc && post.thumbnailStatus === "pending") {
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative overflow-hidden bg-zinc-950 dark:bg-black flex items-center justify-center select-none"
        title="Loading Instagram media..."
      >
        <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/90 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-pulse pointer-events-none" />
      </div>
    );
  }

  // 2. When thumbnail fetching or loading fails, render the clean, minimal blank screen
  if (hasFailed || post.thumbnailStatus === "failed" || !imgSrc) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative overflow-hidden bg-zinc-950 dark:bg-black flex items-center justify-center select-none group/blank"
        title={post.caption ? `${post.caption.slice(0, 40)}...` : "Instagram Media"}
      >
        {/* Flat minimal dark canvas matching Instagram unloaded state */}
        <div className="absolute inset-0 bg-zinc-900/40 dark:bg-black/90 pointer-events-none" />

        {/* Subtle, non-intrusive retry button revealed on hover or touch */}
        {post.postUrl && (
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="relative z-10 opacity-0 group-hover/blank:opacity-85 hover:!opacity-100 active:scale-95 transition-all duration-200 px-2.5 py-1.5 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white text-[11px] font-medium flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer"
            title="Retry fetching preview image"
          >
            <RefreshCw size={12} className={isRetrying ? "animate-spin text-white" : "text-white/80"} />
            <span className="hidden sm:inline text-[10px] tracking-wide font-sans">Retry Fetch</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-zinc-950 dark:bg-black">

      {/* Actual image */}
      {isInView && (
        <img
          src={imgSrc || undefined}
          alt={alt || post.caption || "Instagram Media"}
          loading="lazy"
          decoding="async"
          className={`${className} relative z-20 transition-all duration-700 ease-in-out ${
            isLoaded ? "opacity-100 blur-0 scale-100" : "opacity-90 blur-0 scale-100"
          }`}
          onError={handleError}
          onLoad={(e) => {
            const nw = e.currentTarget.naturalWidth;
            const nh = e.currentTarget.naturalHeight;
            if (nw <= 10 || nh <= 10) {
               handleError();
               return;
            }
            setIsLoaded(true);
            if (post.thumbnailUrl && post.thumbnailUrl.startsWith("http") && !imgSrc.startsWith("blob:")) {
              fetch(post.thumbnailUrl, { mode: "cors", credentials: "omit" })
                .then(res => {
                  if (res.ok) storeThumbnailInCache(post.thumbnailUrl, res);
                })
                .catch(() => {});
            }
            if (onDimensionsLoaded) {
              onDimensionsLoaded({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
                ratio:
                  e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              });
            }

            // Extract dominant colors only if palette is missing/incomplete
            if (nw > 10 && nh > 10 && (!post.colorPalette || post.colorPalette.length < 2)) {
              const imgEl = e.currentTarget;
              setTimeout(() => {
                try {
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    canvas.width = 30;
                    canvas.height = 30;
                    ctx.drawImage(imgEl, 0, 0, 30, 30);
                    const imageData = ctx.getImageData(0, 0, 30, 30).data;
                    
                    const colorCounts: Record<string, number> = {};
                    for (let i = 0; i < imageData.length; i += 4) {
                      const r = imageData[i];
                      const g = imageData[i + 1];
                      const b = imageData[i + 2];
                      const a = imageData[i + 3];
                      if (a < 150) continue; // skip transparent
                      
                      const qr = Math.max(0, Math.min(255, Math.round(r / 20) * 20));
                      const qg = Math.max(0, Math.min(255, Math.round(g / 20) * 20));
                      const qb = Math.max(0, Math.min(255, Math.round(b / 20) * 20));
                      const hex = "#" + [qr, qg, qb].map(x => {
                        const h = x.toString(16);
                        return h.length === 1 ? "0" + h : h;
                      }).join("");
                      
                      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
                    }
                    
                    const sorted = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);
                    const palette: string[] = [];
                    for (const color of sorted) {
                      if (palette.length >= 4) break;
                      const isDistinct = palette.every(existingColor => {
                        const r1 = parseInt(existingColor.substring(1, 3), 16);
                        const g1 = parseInt(existingColor.substring(3, 5), 16);
                        const b1 = parseInt(existingColor.substring(5, 7), 16);
                        const r2 = parseInt(color.substring(1, 3), 16);
                        const g2 = parseInt(color.substring(3, 5), 16);
                        const b2 = parseInt(color.substring(5, 7), 16);
                        const diff = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
                        return diff > 45; // threshold
                      });
                      if (isDistinct || palette.length === 0) {
                        palette.push(color);
                      }
                    }
                    
                    if (palette.length > 0) {
                      const currentPaletteStr = JSON.stringify(post.colorPalette || []);
                      const newPaletteStr = JSON.stringify(palette);
                      if (currentPaletteStr !== newPaletteStr) {
                        db.posts.update(post.id, { colorPalette: palette }).catch(() => {});
                        usePostStore.getState().updatePost(post.id, { colorPalette: palette });
                      }
                    }
                  }
                } catch (canvasErr) {
                  // Gracefully ignore Canvas security/CORS block and retain fallback
                  console.debug("Canvas color extraction skipped due to CORS/security policy:", canvasErr);
                }
              }, 100);
            }
          }}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};
