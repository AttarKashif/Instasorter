import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Bookmark,
  Share2,
  ExternalLink,
  Calendar,
  User,
  Tag,
  Film,
  Layers,
  MessageCircle,
  Sparkles,
  Copy,
  Check
} from "lucide-react";
import { Post } from "../../types/post";
import { InstagramImage } from "./InstagramImage";
import { usePostStore } from "../../store/useStore";

interface FullScreenMediaViewerProps {
  posts: Post[];
  initialIndex: number;
  onClose: () => void;
  onSelectIndex?: (index: number) => void;
  onTagClick?: (tag: string) => void;
  onCreatorClick?: (creator: string) => void;
}

export const FullScreenMediaViewer: React.FC<FullScreenMediaViewerProps> = ({
  posts,
  initialIndex,
  onClose,
  onSelectIndex,
  onTagClick,
  onCreatorClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentPost = posts[currentIndex] || posts[0];
  const updatePost = usePostStore((state) => state.updatePost);
  const toggleFavorite = usePostStore((state) => state.toggleFavorite);

  const [copied, setCopied] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const newIdx = currentIndex - 1;
      setCurrentIndex(newIdx);
      onSelectIndex?.(newIdx);
    }
  }, [currentIndex, onSelectIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < posts.length - 1) {
      const newIdx = currentIndex + 1;
      setCurrentIndex(newIdx);
      onSelectIndex?.(newIdx);
    }
  }, [currentIndex, posts.length, onSelectIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === "j") {
        handleNext();
      } else if (e.key === "f") {
        if (currentPost) {
          toggleFavorite(currentPost.id);
        }
      } else if (e.key === "c" && currentPost?.postUrl) {
        navigator.clipboard.writeText(currentPost.postUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handlePrev, handleNext, currentPost, toggleFavorite]);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (!currentPost) return null;

  const isVideo =
    currentPost.mediaType === "video" ||
    (currentPost.postUrl && currentPost.postUrl.includes("/reel/"));
  const formattedDate = currentPost.savedAt
    ? new Date(currentPost.savedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col md:flex-row overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Floating Header for Mobile / Tablet */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-4 z-30 md:hidden">
        <div className="flex items-center gap-2 text-white/90 text-xs font-mono">
          <span>{currentIndex + 1}</span>
          <span className="opacity-40">/</span>
          <span>{posts.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleFavorite(currentPost.id)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              currentPost.isFavorite ? "bg-red-500 text-white" : "bg-white/10 text-white"
            }`}
          >
            <Heart size={16} className={currentPost.isFavorite ? "fill-current" : ""} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/25 transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Media Stage */}
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-hidden">
        {/* Previous Post Button */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 md:left-8 z-30 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/10 flex items-center justify-center transition-all shadow-xl cursor-pointer"
            title="Previous Post (Left Arrow)"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Next Post Button */}
        {currentIndex < posts.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 md:right-8 z-30 w-12 h-12 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white border border-white/10 flex items-center justify-center transition-all shadow-xl cursor-pointer"
            title="Next Post (Right Arrow)"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Media content with AnimatePresence slide */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPost.id}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative max-w-full max-h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl bg-black/50 border border-white/10 group"
            style={{ width: "min(100%, 850px)", height: "min(100%, 850px)" }}
          >
            <InstagramImage
              post={currentPost}
              src={currentPost.thumbnailUrl || ""}
              alt={currentPost.caption || "Fullscreen Media"}
              className="w-full h-full object-contain max-h-[80vh]"
            />

            {/* Video or Carousel Badge */}
            {isVideo && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider bg-black/70 backdrop-blur-md text-white flex items-center gap-1.5 border border-white/15 z-20">
                <Film size={14} className="text-m3-primary" />
                <span>Reel / Video</span>
              </div>
            )}
            {currentPost.mediaType === "carousel" && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider bg-black/70 backdrop-blur-md text-white flex items-center gap-1.5 border border-white/15 z-20">
                <Layers size={14} className="text-m3-primary" />
                <span>Carousel ({currentPost.mediaCount || 2} slides)</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right Sidebar Details Panel (Desktop) */}
      <div className="w-full md:w-[420px] bg-m3-surface text-m3-on-surface border-t md:border-t-0 md:border-l border-m3-outline-variant/20 flex flex-col h-auto md:h-full z-20 shadow-2xl">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between p-5 border-b border-m3-outline-variant/15">
          <div className="flex items-center gap-2 text-xs font-mono text-m3-outline">
            <span>Post {currentIndex + 1} of {posts.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(currentPost.id)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                currentPost.isFavorite
                  ? "bg-red-500/15 text-red-500"
                  : "bg-m3-surface-variant/40 hover:bg-m3-surface-variant text-m3-on-surface-variant"
              }`}
              title="Toggle Favorite (Press F)"
            >
              <Heart size={18} className={currentPost.isFavorite ? "fill-current" : ""} />
            </button>
            <button
              onClick={() => {
                if (currentPost.postUrl) {
                  navigator.clipboard.writeText(currentPost.postUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="p-2 rounded-xl bg-m3-surface-variant/40 hover:bg-m3-surface-variant text-m3-on-surface-variant transition-all cursor-pointer"
              title="Copy Instagram Link (Press C)"
            >
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-m3-surface-variant/40 hover:bg-m3-surface-variant text-m3-on-surface-variant transition-all cursor-pointer"
              title="Close (Press Escape)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Post Metadata Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {/* Creator Profile */}
          <div className="flex items-center justify-between">
            <div
              onClick={() => {
                if (currentPost.creatorUsername && onCreatorClick) {
                  onCreatorClick(currentPost.creatorUsername);
                  onClose();
                }
              }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-11 h-11 rounded-full bg-m3-primary/10 border border-m3-primary/20 flex items-center justify-center text-m3-primary font-bold text-sm">
                <User size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                  @{currentPost.creatorUsername || "instagram_creator"}
                </h4>
                {formattedDate && (
                  <p className="text-[11px] text-m3-outline flex items-center gap-1 mt-0.5">
                    <Calendar size={11} />
                    Saved {formattedDate}
                  </p>
                )}
              </div>
            </div>

            {currentPost.postUrl && (
              <a
                href={currentPost.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-m3-surface-variant/50 hover:bg-m3-primary hover:text-m3-on-primary transition-all flex items-center gap-1.5"
              >
                <span>Instagram</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-m3-outline">Caption</h5>
            <p className="text-sm text-m3-on-surface leading-relaxed whitespace-pre-wrap font-sans">
              {currentPost.caption || <span className="italic text-m3-outline">No caption text available.</span>}
            </p>
          </div>

          {/* Tags */}
          {currentPost.tags && currentPost.tags.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-m3-outline">Tags</h5>
              <div className="flex flex-wrap gap-1.5">
                {currentPost.tags.map((tag) => (
                  <span
                    key={tag}
                    onClick={() => {
                      onTagClick?.(tag);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-m3-surface-container text-m3-on-surface-variant hover:bg-m3-primary/15 hover:text-m3-primary transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Tag size={11} />
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collections */}
          {currentPost.collections && currentPost.collections.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-m3-outline">Collections</h5>
              <div className="flex flex-wrap gap-1.5">
                {currentPost.collections.map((col) => (
                  <span
                    key={col}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-m3-primary-container/30 text-m3-primary border border-m3-primary/20"
                  >
                    📁 {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {currentPost.notes && (
            <div className="space-y-2 bg-m3-surface-container/50 p-3.5 rounded-2xl border border-m3-outline-variant/15">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-m3-primary flex items-center gap-1">
                <Sparkles size={12} />
                Curator Notes
              </h5>
              <p className="text-xs text-m3-on-surface-variant leading-relaxed">
                {currentPost.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer Keyboard Shortcut Hints */}
        <div className="p-4 bg-m3-surface-container/30 border-t border-m3-outline-variant/15 flex items-center justify-between text-[11px] text-m3-outline">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-m3-surface-variant font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-m3-surface-variant font-mono">→</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-m3-surface-variant font-mono">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </motion.div>
  );
};
