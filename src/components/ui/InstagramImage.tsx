import React, { useState, useEffect, useRef } from "react";
import { Post } from "../../types/post";
import { Instagram, Image as ImageIcon, Film, Layers, ShieldAlert, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { db } from "../../lib/db";
import { usePostStore } from "../../store/useStore";
import { getDynamicCoverByKeywords } from "../../lib/parser";
import { getCachedThumbnailUrl, storeThumbnailInCache } from "../../lib/thumbnailCache";

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

const getDeterministicPalette = (id: string): string[] => {
  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    h1 = char + ((h1 << 5) - h1);
    h2 = char * 13 + ((h2 << 3) - h2);
    h3 = char * 23 + ((h3 << 7) - h3);
  }
  
  const getPastelColor = (hash: number, offset: number) => {
    const r = Math.abs((hash + offset) % 100) + 120; // 120-220 for bright, elegant pastels
    const g = Math.abs(((hash >> 8) + offset) % 100) + 120;
    const b = Math.abs(((hash >> 16) + offset) % 100) + 120;
    return `rgb(${r}, ${g}, ${b})`;
  };

  return [getPastelColor(h1, 10), getPastelColor(h2, 50), getPastelColor(h3, 90)];
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

  
  const triggerHeal = (force = true) => {
    fetch("/api/fetch-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: post.postUrl, id: post.id, force }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && (data.dataUrl || data.path)) {
          const finalUrl = data.dataUrl || data.path;
          const updatedFields: Partial<Post> = {
            thumbnailUrl: finalUrl,
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

  // If thumbnail scrape or image loading failed, fall back to clean gradient background instead of error SVG
  const palette = post.colorPalette && post.colorPalette.length >= 2
    ? post.colorPalette
    : getDeterministicPalette(post.id);

  const gradientStyle = {
    background: `radial-gradient(circle at 20% 20%, ${palette[0]} 0%, transparent 60%),
                 radial-gradient(circle at 80% 30%, ${palette[1]} 0%, transparent 60%),
                 radial-gradient(circle at 40% 80%, ${palette[2] || palette[0]} 0%, transparent 70%),
                 var(--m3-surface-low)`,
    filter: "blur(28px) saturate(1.3)",
    transform: "scale(1.2)",
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-m3-surface-container">
      {/* Dynamic Blur-up Gradient Placeholder */}
      <div 
        className={`absolute inset-0 z-0 transition-opacity duration-700 ease-in-out ${
          isLoaded && imgSrc ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={gradientStyle}
      />

      {/* Actual image */}
      {isInView && (
        <img
          src={imgSrc || undefined}
          alt={alt || post.caption || "Instagram Media"}
          loading="lazy"
          decoding="async"
          className={`${className} relative z-20 transition-all duration-700 ease-in-out ${
            isLoaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-md scale-95"
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
