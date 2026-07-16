import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Eye,
  HelpCircle,
} from "lucide-react";
import { Post } from "../../types/post";
import { VOCABULARY } from "../../constants/vocabulary";

interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: string;
}

interface InstagramMockupViewProps {
  post: Post;
  slides: string[];
  activeSlide: number;
  setActiveSlide: (index: number) => void;
  onTagClick?: (tag: string) => void;
  onClose: () => void;
  onToggleFavorite: () => Promise<void>;
  onToggleArchive: () => Promise<void>;
  onUpdateComments: (comments: Comment[]) => Promise<void>;
  onUpdateLocation: (location: string) => Promise<void>;
}

export const InstagramMockupView: React.FC<InstagramMockupViewProps> = ({
  post,
  slides,
  activeSlide,
  setActiveSlide,
  onTagClick,
  onClose,
  onToggleFavorite,
  onToggleArchive,
  onUpdateComments,
  onUpdateLocation,
}) => {
  const t = VOCABULARY.mockup;
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  // Simulated Location edit states
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState(post.location || "");

  // Comment section states
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize and select comments deterministically based on post id
  useEffect(() => {
    if (post.comments && post.comments.length > 0) {
      setComments(post.comments);
    } else {
      const sampleComments: Omit<Comment, "id">[] = [
        {
          username: "pixel_perfect",
          text: "This composition is so clean! Absolutely gorgeous curation.",
          timestamp: "1h",
        },
        {
          username: "curator_hub",
          text: "Incredible mood and color coordination in this save. Added to my inspo board.",
          timestamp: "3h",
        },
        {
          username: "code_and_design",
          text: "Exactly the reference I needed today! Perfect layout.",
          timestamp: "4h",
        },
        {
          username: "visual_memo",
          text: "Is this from your personal design stack? Top tier work.",
          timestamp: "1d",
        },
        {
          username: "aesthetic_dev",
          text: "Amazing visual structure, love the tones!",
          timestamp: "2d",
        },
      ];

      const idx1 = post.id.charCodeAt(0) % sampleComments.length;
      let idx2 =
        (post.id.charCodeAt(post.id.length - 1) || 0) % sampleComments.length;
      if (idx1 === idx2) idx2 = (idx1 + 1) % sampleComments.length;

      const generated = [
        { id: "gen-1", ...sampleComments[idx1] },
        { id: "gen-2", ...sampleComments[idx2] },
      ];
      setComments(generated);
      onUpdateComments(generated);
    }

    setLocationInput(post.location || "");
  }, [post.id]);

  // Double tap handler on media for large heart animation
  const lastTapRef = useRef<number>(0);
  const handleMediaTap = async () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      if (!post.isFavorite) {
        await onToggleFavorite();
      }
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
    lastTapRef.current = now;
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      username: "cataloger_pro",
      text: newCommentText.trim(),
      timestamp: "now",
    };

    const nextComments = [...comments, newComment];
    setComments(nextComments);
    await onUpdateComments(nextComments);
    setNewCommentText("");

    // Auto scroll comments view
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleDeleteComment = async (commentId: string) => {
    const nextComments = comments.filter((c) => c.id !== commentId);
    setComments(nextComments);
    await onUpdateComments(nextComments);
  };

  const handleSaveLocation = async () => {
    const clean = locationInput.trim();
    await onUpdateLocation(clean);
    setIsEditingLocation(false);
  };

  const handleShare = () => {
    if (post.postUrl) {
      navigator.clipboard.writeText(post.postUrl);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    }
  };

  // Helper to highlight tags in caption text
  const renderFormattedCaption = (text: string) => {
    if (!text)
      return <span className="italic text-m3-outline/60">{t.noCaption}</span>;
    const parts = text.split(/(\s+)/);
    return parts.map((part, idx) => {
      if (part.startsWith("#") && part.length > 1) {
        const cleanTag = part.replace(/[^\w]/g, "").toLowerCase();
        return (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(cleanTag);
              onClose();
            }}
            className="text-m3-primary font-bold hover:underline cursor-pointer inline-block mx-0.5"
          >
            {part}
          </button>
        );
      }
      if (part.startsWith("@") && part.length > 1) {
        const handle = part.replace(/[^\w]/g, "");
        return (
          <a
            key={idx}
            href={`https://instagram.com/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-m3-primary font-bold hover:underline inline-block mx-0.5"
          >
            {part}
          </a>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const isVideo =
    post.thumbnailUrl?.startsWith("data:video/") || post.mediaType === "video";

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden min-h-0 bg-m3-surface">
      {/* LEFT COLUMN: Smartphone Live Simulator */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-m3-surface-low border-b md:border-b-0 md:border-r border-m3-outline-variant/15 overflow-y-auto max-h-[60vh] md:max-h-none shrink-0">
        {/* Device Container Frame Mockup */}
        <div className="w-full max-w-[375px] bg-black rounded-[44px] p-2.5 shadow-2xl border-[5px] border-neutral-800 relative select-none">
          {/* Smartphone Camera Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-40 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-m3-surface-variant border border-neutral-800"></span>
          </div>

          <div className="w-full bg-white text-black rounded-[36px] overflow-hidden flex flex-col">
            {/* Feed Post Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 mt-2">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[1.5px] rounded-full">
                  <div className="bg-white p-[1px] rounded-full">
                    <div className="w-7 h-7 rounded-full bg-m3-surface-variant text-m3-on-surface font-bold text-[10px] flex items-center justify-center uppercase">
                      {post.creatorUsername.substring(0, 2)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-start">
                  <span className="text-[11px] font-bold tracking-tight text-m3-on-surface leading-none">
                    @{post.creatorUsername}
                  </span>

                  {isEditingLocation ? (
                    <div
                      className="flex items-center gap-1 mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        placeholder={t.addCityPlace}
                        className="px-1.5 py-0.5 text-[9px] border border-m3-outline-variant rounded focus:outline-none w-20"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleSaveLocation()
                        }
                        autoFocus
                      />
                      <button
                        onClick={handleSaveLocation}
                        className="text-[9px] font-bold text-m3-primary hover:underline"
                      >
                        {t.save}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingLocation(true)}
                      className="text-[9px] text-m3-on-surface-variant flex items-center gap-0.5 mt-0.5 text-left hover:text-m3-on-surface"
                    >
                      <MapPin size={8} />
                      <span className="truncate max-w-[120px]">
                        {post.location || t.addLocation}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <span className="text-[9px] font-bold text-m3-outline font-display">
                {post.mediaType === "carousel"
                  ? "Carousel"
                  : post.mediaType === "video"
                    ? "Video"
                    : "Photo"}
              </span>
            </div>

            {/* Simulated Live Media Viewport */}
            <div
              onClick={handleMediaTap}
              className="relative aspect-square w-full bg-gray-950 flex items-center justify-center overflow-hidden cursor-pointer"
            >
              {slides.length > 0 ? (
                isVideo ? (
                  <video
                    src={slides[activeSlide]}
                    className="w-full h-full object-contain"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={slides[activeSlide]}
                    alt="Mockup Image"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop";
                    }}
                  />
                )
              ) : (
                <div className="text-white/50 text-[11px] italic">
                  {t.noPreview}
                </div>
              )}

              {/* Slider Left Chevron Overlay */}
              {slides.length > 1 && activeSlide > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(activeSlide - 1);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 z-20 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
              )}

              {/* Slider Right Chevron Overlay */}
              {slides.length > 1 && activeSlide < slides.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(activeSlide + 1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 z-20 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              )}

              {/* Slide dots at the bottom */}
              {slides.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-20">
                  {slides.map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeSlide ? "bg-m3-primary/50 scale-125" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              )}

              {/* Floating Slide Counter */}
              {slides.length > 1 && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/60 text-white backdrop-blur-xs">
                  {activeSlide + 1}/{slides.length}
                </span>
              )}

              {/* Double tap heart animation pop */}
              <AnimatePresence>
                {showHeartAnim && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: [0, 1.25, 0.9, 1],
                      opacity: [0, 1, 1, 0],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                  >
                    <Heart
                      size={64}
                      fill="#ef4444"
                      className="text-red-500 drop-shadow-xl"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Bar */}
            <div className="px-3 py-2 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={onToggleFavorite}
                  className={`focus:outline-none transition-transform active:scale-90 cursor-pointer ${post.isFavorite ? "text-red-500" : "text-m3-on-surface"}`}
                >
                  <Heart
                    size={20}
                    fill={post.isFavorite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById("mockup-comment-input");
                    el?.focus();
                  }}
                  className="text-m3-on-surface cursor-pointer"
                >
                  <MessageCircle size={20} />
                </button>
                <button
                  onClick={handleShare}
                  className="text-m3-on-surface active:scale-95 cursor-pointer"
                >
                  <Send size={18} />
                </button>
              </div>

              <button
                onClick={onToggleArchive}
                className={`focus:outline-none transition-transform active:scale-90 cursor-pointer ${post.isArchived ? "text-m3-primary" : "text-m3-on-surface"}`}
              >
                <Bookmark
                  size={20}
                  fill={post.isArchived ? "currentColor" : "none"}
                />
              </button>
            </div>

            {/* Feed Engagement Metrics */}
            <div className="px-3 pb-3 bg-white text-left text-m3-on-surface">
              {/* Creator Caption line */}
              <div className="mt-1 leading-normal text-[11px] break-words whitespace-pre-wrap">
                <span className="font-extrabold mr-1.5">
                  @{post.creatorUsername}
                </span>
                {renderFormattedCaption(post.caption)}
              </div>
            </div>
          </div>
        </div>

        {/* Share alert toast */}
        <AnimatePresence>
          {showShareToast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 px-4 py-2 rounded-xl bg-m3-primary text-m3-on-primary font-bold text-xs shadow-lg flex items-center gap-2"
            >
              <Check size={12} className="stroke-[3]" />
              {t.linkCopied}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT COLUMN: Interactive Comments & Notes Thread */}
      <div className="flex-1 flex flex-col min-h-0 bg-m3-surface-container/20">
        {/* Comment list header */}
        <div className="px-6 py-4.5 border-b border-m3-outline-variant/15 flex justify-between items-center bg-m3-surface-low/30 shrink-0">
          <div>
            <h4 className="text-sm font-bold text-m3-on-surface">
              {t.simulatedComments}
            </h4>
            <p className="text-[10px] text-m3-outline">{t.commentHelp}</p>
          </div>
          <span className="text-xs font-mono font-bold bg-m3-surface-variant text-m3-on-surface-variant px-2 py-0.5 rounded-md">
            {comments.length}
          </span>
        </div>

        {/* Scrollable Comments Thread */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-h-0">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex justify-between items-start gap-3 p-3 bg-m3-surface rounded-2xl border border-m3-outline-variant/10 group shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex gap-2.5 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-m3-primary-container text-m3-on-primary-container font-extrabold text-[9px] flex items-center justify-center shrink-0 uppercase select-none">
                    {comment.username.substring(0, 2)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-m3-on-surface">
                        @{comment.username}
                      </span>
                      <span className="text-[9px] text-m3-outline">
                        {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-m3-on-surface-variant mt-1 leading-normal break-words">
                      {comment.text}
                    </p>
                  </div>
                </div>

                {/* Comment Actions (Delete) */}
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-m3-tertiary-container text-m3-outline hover:text-m3-tertiary transition-all cursor-pointer shrink-0"
                  title="Delete comment"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          ) : (
            <div className="my-auto flex flex-col items-center justify-center text-center p-6 text-m3-outline/65 gap-2.5">
              <MessageCircle size={32} className="stroke-1.5 animate-pulse" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold block text-m3-on-surface-variant">
                  {t.noComments}
                </span>
                <p className="text-[10px] leading-relaxed max-w-[200px]">
                  {t.noCommentsHelp}
                </p>
              </div>
            </div>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment input form */}
        <form
          onSubmit={handleAddComment}
          className="p-4 border-t border-m3-outline-variant/15 bg-m3-surface flex gap-2 shrink-0"
        >
          <input
            type="text"
            id="mockup-comment-input"
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder={t.commentPlaceholder}
            className="flex-1 px-4 py-2.5 text-xs border border-m3-outline-variant/40 rounded-xl bg-m3-surface text-m3-on-surface focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary shadow-xs"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim()}
            className="px-4 bg-m3-primary text-m3-on-primary text-xs font-bold rounded-xl hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
          >
            {t.postBtn}
          </button>
        </form>
      </div>
    </div>
  );
};
