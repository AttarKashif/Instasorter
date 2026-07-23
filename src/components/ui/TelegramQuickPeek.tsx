import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Heart,
  ExternalLink,
  Copy,
  Check,
  X,
  Film,
  Image as ImageIcon,
  Download,
  ShieldAlert,
} from "lucide-react";
import { Post } from "../../types/post";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { InstagramImage } from "./InstagramImage";
import { getSubtlePaletteColor } from "../../lib/highlight";
import { downloadPostMedia } from "../../lib/wakeLock";
import toast from "react-hot-toast";

interface TelegramQuickPeekProps {
  post: Post | null;
  onClose: () => void;
}

export const TelegramQuickPeek = ({
  post,
  onClose,
}: TelegramQuickPeekProps) => {
  if (!post) return null;

  const toggleFavorite = usePostStore((state) => state.toggleFavorite);
  const [copied, setCopied] = useState(false);

  const subtleBg = getSubtlePaletteColor(post.colorPalette, "var(--m3-surface)");

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(post.id);
    await db.posts.update(post.id, { isFavorite: !post.isFavorite });
  };

  const handleCopyCaption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.caption) {
      navigator.clipboard.writeText(post.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 15 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        style={subtleBg ? { backgroundColor: subtleBg } : undefined}
        className="relative bg-m3-surface rounded-[24px] overflow-hidden border border-m3-outline-variant/30 shadow-2xl w-full max-w-sm flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic header with user details */}
        <div className="px-5 py-4 border-b border-m3-outline-variant/15 flex items-center justify-between bg-m3-surface-low">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-m3-primary/10 text-m3-primary flex items-center justify-center font-bold text-sm">
              {post.creatorUsername
                ? post.creatorUsername[0].toUpperCase()
                : "I"}
            </div>
            <div>
              <h4 className="text-sm font-bold text-m3-on-surface">
                @{post.creatorUsername}
              </h4>
              <p className="text-[10px] text-m3-outline font-semibold">
                Quick Peek Preview
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-m3-surface-variant/40 flex items-center justify-center text-m3-on-surface-variant transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Media Preview Box */}
        <div className="relative aspect-square bg-m3-surface-variant overflow-hidden flex items-center justify-center">
          {post.thumbnailUrl ? (
            <InstagramImage
              post={post}
              alt={post.caption || "Quick Peek"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-m3-outline">
              <ImageIcon size={32} className="stroke-1 animate-pulse" />
              <span className="text-xs">Loading media...</span>
            </div>
          )}

          {/* Media Type Overlay */}
          <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-black/60 text-white flex items-center gap-1">
            {post.mediaType === "video" ? (
              <Film size={10} />
            ) : (
              <ImageIcon size={10} />
            )}
            <span>{post.mediaType || "image"}</span>
          </span>
        </div>

        {/* Caption snippet */}
        {post.caption && (
          <div className="p-4 bg-m3-surface-lowest text-xs text-m3-on-surface-variant line-clamp-3 leading-relaxed border-b border-m3-outline-variant/15 select-text">
            {post.caption}
          </div>
        )}

        {/* Interactive Quick Actions Row */}
        <div className="grid grid-cols-4 divide-x divide-m3-outline-variant/15 bg-m3-surface-low text-[11px] font-bold text-m3-on-surface-variant">
          <button
            onClick={handleToggleFavorite}
            className={`flex flex-col items-center gap-1.5 py-3 hover:bg-m3-surface-variant/20 transition-colors cursor-pointer ${
              post.isFavorite ? "text-m3-tertiary" : ""
            }`}
          >
            <Heart
              size={15}
              fill={post.isFavorite ? "currentColor" : "none"}
              className={post.isFavorite ? "scale-110" : ""}
            />
            <span>{post.isFavorite ? "Unstar" : "Star"}</span>
          </button>

          <button
            onClick={() => {
              toast.promise(downloadPostMedia(post), {
                loading: "Downloading HD Reel/Media...",
                success: "Saved to device downloads!",
                error: "Download failed, opened original link",
              });
            }}
            className="flex flex-col items-center gap-1.5 py-3 hover:bg-m3-surface-variant/20 transition-colors cursor-pointer text-indigo-600 dark:text-indigo-400"
          >
            <Download size={15} />
            <span>Save HD</span>
          </button>

          {post.postUrl ? (
            <a
              href={post.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 py-3 hover:bg-m3-surface-variant/20 transition-colors text-center cursor-pointer"
            >
              <ExternalLink size={15} />
              <span>Link</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-3 text-m3-outline cursor-not-allowed">
              <ExternalLink size={15} />
              <span>No Link</span>
            </div>
          )}

          <button
            onClick={handleCopyCaption}
            disabled={!post.caption}
            className={`flex flex-col items-center gap-1.5 py-3 hover:bg-m3-surface-variant/20 transition-colors cursor-pointer ${
              !post.caption ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            {copied ? (
              <Check size={15} className="text-m3-primary" />
            ) : (
              <Copy size={15} />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
