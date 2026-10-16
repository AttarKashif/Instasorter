import React, { useState, useRef, useCallback } from "react";
import { Post } from "../../types/post";
import { InstagramImage } from "./InstagramImage";
import {
  Play,
  SquareStack,
  Image as ImageIcon,
  Heart,
  FileText,
  Check,
  Star,
  Folder,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import toast from "react-hot-toast";

interface InstagramSquareGridItemProps {
  post: Post;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onPeek?: (post: Post) => void;
  onCreatorClick?: (creator: string) => void;
}

export const InstagramSquareGridItem: React.FC<InstagramSquareGridItemProps> = React.memo(
  ({
    post,
    isSelected = false,
    onToggleSelect,
    onClick,
    onPeek,
    onCreatorClick,
  }) => {
    const toggleFavorite = usePostStore((state) => state.toggleFavorite);
    const [showHeartBurst, setShowHeartBurst] = useState(false);
    const lastTapRef = useRef<number>(0);
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isHoldTriggeredRef = useRef(false);

    const isVideo =
      post.mediaType === "video" ||
      !!post.isReel ||
      (post.postUrl && (post.postUrl.includes("/reel/") || post.postUrl.includes("/reels/")));
    const isCarousel =
      post.mediaType === "carousel" ||
      (post.additionalSlides && post.additionalSlides.length > 0) ||
      (post.mediaCount !== undefined && post.mediaCount > 1);
    const isSinglePhoto = !isVideo && !isCarousel;
    const slideCount =
      post.mediaCount && post.mediaCount > 1
        ? post.mediaCount
        : post.additionalSlides && post.additionalSlides.length > 0
          ? 1 + post.additionalSlides.length
          : undefined;

    // Double tap to like (native Instagram iOS gesture)
    const handleTouchStart = (e: React.TouchEvent) => {
      isHoldTriggeredRef.current = false;
      if (onPeek) {
        holdTimerRef.current = setTimeout(() => {
          onPeek(post);
          isHoldTriggeredRef.current = true;
          triggerVibration("medium");
        }, 420);
      }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      if (isHoldTriggeredRef.current) {
        e.preventDefault();
        isHoldTriggeredRef.current = false;
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastTapRef.current;
      if (timeDiff < 300 && timeDiff > 0) {
        // Double tap detected!
        e.preventDefault();
        triggerHeartBurst();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    };

    const triggerHeartBurst = async () => {
      setShowHeartBurst(true);
      triggerVibration("double");
      if (!post.isFavorite) {
        toggleFavorite(post.id);
        await db.posts.update(post.id, { isFavorite: true });
        toast.success("Starred!", { icon: "❤️", duration: 1200 });
      }
      setTimeout(() => setShowHeartBurst(false), 800);
    };

    const handleContainerClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest(".select-checkbox") ||
        target.closest("a")
      ) {
        return;
      }

      if (onClick) {
        onClick();
      }
    };

    return (
      <div
        onClick={handleContainerClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`group relative aspect-square w-full overflow-hidden bg-zinc-900 cursor-pointer select-none transition-transform duration-200 active:scale-[0.98] ${
          isSelected ? "ring-2 ring-m3-primary ring-offset-2 ring-offset-black z-10" : ""
        }`}
      >
        {/* Post Media Image */}
        <InstagramImage
          post={post}
          src={post.thumbnailUrl}
          alt={post.caption || "Instagram media"}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          loading="lazy"
        />

        {/* Top-Right Badges (Instagram iOS standard post type overlays) */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 pointer-events-none drop-shadow-md">
          {isCarousel && (
            <div
              className="h-6 px-2 min-w-6 rounded-full bg-black/75 backdrop-blur-md flex items-center justify-center gap-1.5 text-white text-[11px] font-mono font-bold border border-white/20 shadow-md transition-transform group-hover:scale-105"
              title={slideCount ? `Carousel • ${slideCount} slides` : "Carousel post"}
            >
              <SquareStack size={12} className="stroke-[2.2] text-white shrink-0" />
              {slideCount && slideCount > 1 && (
                <span className="leading-none text-[10px]">{slideCount}</span>
              )}
            </div>
          )}

          {isVideo && (
            <div
              className="w-6 h-6 rounded-full bg-black/75 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-md transition-transform group-hover:scale-105"
              title="Video / Reel"
            >
              <Play size={10} className="fill-white text-white ml-0.5 shrink-0" />
            </div>
          )}

          {isSinglePhoto && (
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 px-2 rounded-full bg-black/75 backdrop-blur-md hidden sm:flex items-center justify-center gap-1 text-white text-[10px] font-sans font-medium border border-white/20 shadow-md"
              title="Single Photo"
            >
              <ImageIcon size={11} className="stroke-[2] text-white/90 shrink-0" />
              <span>Photo</span>
            </div>
          )}
        </div>

        {/* Top-Left Favorite Star / Starred Indicator */}
        {post.isFavorite && !isSelected && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none drop-shadow-md">
            <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-amber-400 border border-amber-400/30">
              <Star size={11} className="fill-current" />
            </div>
          </div>
        )}

        {/* Selection Checkbox (Hover-revealed on desktop or active) */}
        {onToggleSelect && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(e);
            }}
            className={`select-checkbox absolute top-2 left-2 z-30 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${
              isSelected
                ? "bg-m3-primary text-white scale-100 opacity-100 shadow-md"
                : "bg-black/40 border border-white/40 text-white opacity-0 group-hover:opacity-100 hover:scale-110"
            }`}
          >
            {isSelected && <Check size={13} className="stroke-[3]" />}
          </div>
        )}

        {/* Instagram Hover / Tap Overlay (Likes & Personal Notes) */}
        <div className="absolute inset-0 z-10 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 text-white pointer-events-none">
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold text-white/90 truncate max-w-[80%]">
              @{post.creatorUsername || "creator"}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 font-semibold text-xs text-white">
            <div className="flex items-center gap-1">
              <Heart
                size={14}
                className={post.isFavorite ? "fill-red-500 text-red-500" : "fill-white text-white"}
              />
              <span className="font-sans text-[11px]">
                {post.instagramLikes ? post.instagramLikes.toLocaleString() : (post.isFavorite ? "1" : "0")}
              </span>
            </div>

            {post.notes && (
              <div className="flex items-center gap-1">
                <FileText size={13} className="text-white/90" />
                <span className="font-sans text-[11px]">1</span>
              </div>
            )}

            {post.collections && post.collections.length > 0 && (
              <div className="flex items-center gap-1">
                <Folder size={12} className="text-white/80" />
                <span className="font-sans text-[11px]">{post.collections.length}</span>
              </div>
            )}
          </div>

          <div className="text-[10px] text-white/70 truncate line-clamp-1">
            {post.caption || "No caption"}
          </div>
        </div>

        {/* Double Tap Heart Burst Animation */}
        <AnimatePresence>
          {showHeartBurst && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 450, damping: 18 }}
              className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
            >
              <Heart
                size={54}
                className="fill-red-500 text-white drop-shadow-[0_4px_16px_rgba(239,68,68,0.6)]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

InstagramSquareGridItem.displayName = "InstagramSquareGridItem";
