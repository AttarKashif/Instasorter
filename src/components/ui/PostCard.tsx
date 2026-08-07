import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Heart,
  ExternalLink,
  Calendar,
  Film,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Loader2,
  Copy,
  RefreshCw,
  Bookmark,
  FileText,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Trash2,
  Send,
  Plus,
  X,
  FolderOpen,
  Archive,
  MapPin,
  ArrowLeft,
  Globe,
  Sparkles,
  Compass,
  Search,
  EyeOff,
  Download,
} from "lucide-react";
import { Post } from "../../types/post";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { motion, AnimatePresence } from "motion/react";
import { InstagramImage } from "./InstagramImage";
import { retrySingleThumbnail, registerPostVisibility } from "../../lib/thumbnailWorker";
import { downloadPostMedia } from "../../lib/wakeLock";
import toast from "react-hot-toast";
import { VOCABULARY } from "../../constants/vocabulary";
import { highlightTextHelper, getSubtlePaletteColor } from "../../lib/highlight";
import { triggerVibration } from "../../lib/vibrate";

interface PostCardProps {
  post: Post;
  onClick?: () => void;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onTagClick?: (tag: string) => void;
  onCreatorClick?: (creator: string) => void;
  onPeek?: (post: Post) => void;
  isKeyboardFocused?: boolean;
  onMouseEnter?: () => void;
  isDetailMode?: boolean;
  creatorFilter?: string;
  onClose?: () => void;
  isImmersive?: boolean;
}

export const PostCard = React.memo(
  ({
    post,
    onClick,
    isSelected,
    onToggleSelect,
    onTagClick,
    onCreatorClick,
    onPeek,
    isKeyboardFocused,
    onMouseEnter,
    isDetailMode = false,
    creatorFilter,
    onClose,
    isImmersive = false,
  }: PostCardProps) => {
    const t = VOCABULARY.postcard;
    const updatePost = usePostStore((state) => state.updatePost);
    const posts = usePostStore((state) => state.posts);
    const toggleFavorite = usePostStore((state) => state.toggleFavorite);
    const searchQuery = usePostStore((state) => state.searchQuery);

    const highlightText = useCallback((text: string, fieldType: "caption" | "creator") => {
      return highlightTextHelper(text, fieldType, searchQuery, creatorFilter);
    }, [searchQuery, creatorFilter]);

    const subtleBg = useMemo(() => {
      if (isSelected || isKeyboardFocused) return undefined;
      return getSubtlePaletteColor(post.colorPalette, isDetailMode ? "var(--m3-surface)" : "var(--m3-surface-low)");
    }, [post.colorPalette, isSelected, isKeyboardFocused, isDetailMode]);

    // Core visual & editing states
    const [showNotesPanel, setShowNotesPanel] = useState(() => {
      return isDetailMode || !!post.notes;
    });
    const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

    // Tag editing states
    const [newTagInput, setNewTagInput] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    // Collection editing states
    const [newColInput, setNewColInput] = useState("");
    const [showColDropdown, setShowColDropdown] = useState(false);

    // Note editing states
    const [noteText, setNoteText] = useState(post.notes || "");
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
      "idle",
    );

    // Comment editing states
    const [commentInput, setCommentInput] = useState("");

    // Google Search Grounding & Verification States
    const [isResearching, setIsResearching] = useState(false);
    const [researchResult, setResearchResult] = useState<string | null>(null);
    const [researchSources, setResearchSources] = useState<Array<{ title: string; url: string }>>([]);
    const [customResearchQuery, setCustomResearchQuery] = useState("");
    const [researchError, setResearchError] = useState<string | null>(null);

    const handleResearch = useCallback(async (type: "creator" | "hashtags" | "custom") => {
      setIsResearching(true);
      setResearchError(null);
      setResearchResult(null);
      setResearchSources([]);

      try {
        const payload: any = {};
        if (type === "creator") {
          payload.creatorUsername = post.creatorUsername;
        } else if (type === "hashtags") {
          payload.hashtags = post.tags || [];
        } else {
          if (!customResearchQuery.trim()) return;
          payload.query = customResearchQuery;
        }

        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to fetch research from Google Search.");
        }

        setResearchResult(data.text);
        setResearchSources(data.sources || []);
        if (type === "custom") {
          setCustomResearchQuery("");
        }
      } catch (err: any) {
        console.error("[Research Error]:", err);
        setResearchError(err.message || "An unexpected error occurred during search.");
      } finally {
        setIsResearching(false);
      }
    }, [post.creatorUsername, post.tags, customResearchQuery]);

    // Simple robust markdown formatted lines rendering
    const renderFormattedResearch = useCallback((text: string) => {
      if (!text) return null;
      const lines = text.split("\n");
      return (
        <div className="flex flex-col gap-2 text-xs leading-relaxed text-m3-on-surface-variant font-sans">
          {lines.map((line, index) => {
            let cleanLine = line.trim();
            if (!cleanLine) return <div key={index} className="h-1.5" />;

            // Check if line is a heading
            if (cleanLine.startsWith("###")) {
              return (
                <h4 key={index} className="font-display font-bold text-m3-on-surface text-sm mt-3.5 mb-1 flex items-center gap-1.5 border-b border-m3-outline-variant/10 pb-0.5">
                  <Sparkles size={11} className="text-amber-500 shrink-0" />
                  {cleanLine.replace(/^###\s*/, "")}
                </h4>
              );
            }
            if (cleanLine.startsWith("##")) {
              return (
                <h3 key={index} className="font-display font-extrabold text-m3-on-surface text-sm mt-4 mb-1 border-b border-m3-outline-variant/20 pb-1 flex items-center gap-1.5">
                  <Compass size={12} className="text-amber-500 shrink-0" />
                  {cleanLine.replace(/^##\s*/, "")}
                </h3>
              );
            }
            if (cleanLine.startsWith("#")) {
              return (
                <h2 key={index} className="font-display font-black text-m3-on-surface text-base mt-4 mb-1.5 flex items-center gap-2">
                  <Globe size={13} className="text-amber-500 shrink-0" />
                  {cleanLine.replace(/^#\s*/, "")}
                </h2>
              );
            }

            // Check if list item
            const isBullet = cleanLine.startsWith("*") || cleanLine.startsWith("-") || cleanLine.startsWith("•");
            if (isBullet) {
              cleanLine = cleanLine.replace(/^[\*\-•]\s*/, "");
            }

            // Handle inline bold formatting (**text**)
            const parts = cleanLine.split(/\*\*([^*]+)\*\*/g);
            const formattedContent = parts.map((part, pIdx) => {
              if (pIdx % 2 === 1) {
                return <strong key={pIdx} className="font-extrabold text-m3-on-surface">{part}</strong>;
              }
              return part;
            });

            if (isBullet) {
              return (
                <div key={index} className="flex gap-2 pl-2">
                  <span className="text-m3-on-surface select-none">•</span>
                  <div className="flex-1 text-m3-on-surface-variant/90">{formattedContent}</div>
                </div>
              );
            }

            return <p key={index} className="text-m3-on-surface-variant/90">{formattedContent}</p>;
          })}
        </div>
      );
    }, []);

    // Sync state if post changes
    useEffect(() => {
      setActiveSlide(0);
      setNoteText(post.notes || "");
      setSaveStatus("idle");
      setResearchResult(null);
      setResearchSources([]);
      setCustomResearchQuery("");
      setResearchError(null);
    }, [post.id, post.notes]);

    // Viewport Intersection observer for prioritizing thumbnail loading
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = cardRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          registerPostVisibility(post.id, entry.isIntersecting);
        },
        {
          rootMargin: "50px 0px", // slight buffer to start fetching before it hits the viewport
          threshold: 0.01,
        }
      );

      observer.observe(el);
      return () => {
        observer.unobserve(el);
        registerPostVisibility(post.id, false);
      };
    }, [post.id]);

    // Hold peek timer refs
    const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isHeldTriggeredRef = useRef(false);

    const startHold = (e: React.MouseEvent | React.TouchEvent) => {
      if ("button" in e && e.button !== 0) return;
      isHeldTriggeredRef.current = false;

      holdTimerRef.current = setTimeout(() => {
        if (onPeek) {
          onPeek(post);
          isHeldTriggeredRef.current = true;
        }
      }, 450);
    };

    const endHold = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const handleCardClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest("a") ||
        target.closest(".interactive-badge")
      ) {
        return;
      }

      if (isHeldTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        isHeldTriggeredRef.current = false;
        return;
      }

      if (onClick) {
        onClick();
      } else {
        setShowNotesPanel((prev) => !prev);
      }
    };

    // Toggle favorite with micro-animation
    const handleToggleFavorite = async (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(post.id);
      const nextFavorite = !post.isFavorite;
      await db.posts.update(post.id, { isFavorite: nextFavorite });
      toast.success(nextFavorite ? t.likedAdded : t.likedRemoved, {
        icon: nextFavorite ? "❤️" : "🤍",
        duration: 1500,
      });
    };

    // Toggle Read Later (Bookmark)
    const handleToggleReadLater = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextReadLater = !post.readLater;
      updatePost(post.id, { readLater: nextReadLater });
      await db.posts.update(post.id, { readLater: nextReadLater });
      toast.success(nextReadLater ? t.bookmarkAdded : t.bookmarkRemoved, {
        icon: "🔖",
        duration: 1500,
      });
    };

    // Toggle Archive
    const handleToggleArchive = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextArchived = !post.isArchived;
      updatePost(post.id, { isArchived: nextArchived });
      await db.posts.update(post.id, { isArchived: nextArchived });
      toast.success(nextArchived ? t.archivedAdded : t.archivedRemoved, {
        icon: nextArchived ? "📥" : "📤",
        duration: 1500,
      });
    };

    // Handle Note Autosaving with micro-feedback
    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNoteText(val);
      setSaveStatus("saving");
    };

    const handleNoteBlur = async () => {
      if (post.notes === noteText) {
        setSaveStatus("idle");
        return;
      }
      updatePost(post.id, { notes: noteText });
      await db.posts.update(post.id, { notes: noteText });
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    };

    // Fetch unique existing collections from all posts to populate auto-suggestions
    const allCollections = useMemo(() => {
      return Array.from(
        new Set(posts.flatMap((p) => p.collections || [])),
      ).filter(Boolean);
    }, [posts]);

    // Add / Remove Tags
    const handleAddTagSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const clean = newTagInput.trim().replace(/^#/, "").toLowerCase();
      if (!clean) return;

      const currentTags = post.tags || [];
      if (currentTags.includes(clean)) {
        setNewTagInput("");
        setShowTagInput(false);
        return;
      }

      const nextTags = [...currentTags, clean];
      updatePost(post.id, { tags: nextTags });
      await db.posts.update(post.id, { tags: nextTags });
      setNewTagInput("");
      setShowTagInput(false);
      toast.success(t.tagAdded.replace("{tag}", clean), { duration: 1500 });
    };

    const handleRemoveTag = async (tagToRemove: string) => {
      const nextTags = (post.tags || []).filter((t) => t !== tagToRemove);
      updatePost(post.id, { tags: nextTags });
      await db.posts.update(post.id, { tags: nextTags });
      toast.success(t.tagRemoved.replace("{tag}", tagToRemove), {
        duration: 1500,
      });
    };

    // Add / Remove Collections
    const handleAddColSubmit = async (colName: string) => {
      const clean = colName.trim();
      if (!clean) return;

      const currentCols = post.collections || [];
      if (currentCols.includes(clean)) {
        setShowColDropdown(false);
        return;
      }

      const nextCols = [...currentCols, clean];
      updatePost(post.id, { collections: nextCols });
      await db.posts.update(post.id, { collections: nextCols });
      setNewColInput("");
      setShowColDropdown(false);
      toast.success(t.collectionAdded.replace("{collection}", clean), {
        icon: "📁",
        duration: 1500,
      });
    };

    const handleRemoveCollection = async (colToRemove: string) => {
      const nextCols = (post.collections || []).filter(
        (c) => c !== colToRemove,
      );
      updatePost(post.id, { collections: nextCols });
      await db.posts.update(post.id, { collections: nextCols });
      toast.success(t.collectionRemoved.replace("{collection}", colToRemove), {
        duration: 1500,
      });
    };

    // Add / Remove mock comments inline
    const handleAddCommentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const text = commentInput.trim();
      if (!text) return;

      const newComment = {
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 9),
        username: "you",
        text,
        timestamp: new Date().toISOString(),
      };

      const nextComments = [...(post.comments || []), newComment];
      updatePost(post.id, { comments: nextComments });
      await db.posts.update(post.id, { comments: nextComments });
      setCommentInput("");
      toast.success(t.commentPosted, { duration: 1500 });
    };

    const handleRemoveComment = async (commentId: string) => {
      const nextComments = (post.comments || []).filter(
        (c) => c.id !== commentId,
      );
      updatePost(post.id, { comments: nextComments });
      await db.posts.update(post.id, { comments: nextComments });
      toast.success(t.commentDeleted, { duration: 1500 });
    };

    // Media Aspect Ratios Setup
    const isVideo = post.mediaType === "video";
    const slides = useMemo(() => {
      return [post.thumbnailUrl || "", ...(post.additionalSlides || [])].filter(
        Boolean,
      );
    }, [post.thumbnailUrl, post.additionalSlides]);

    const [aspectClass, setAspectClass] = useState<string>(() => {
      if (post.mediaType === "video") return "aspect-[3/4]";
      let hash = 0;
      for (let i = 0; i < post.id.length; i++) {
        hash = post.id.charCodeAt(i) + ((hash << 5) - hash);
      }
      const mod = Math.abs(hash) % 3;
      if (mod === 0) return "aspect-square";
      if (mod === 1) return "aspect-[4/5]";
      return "aspect-[3/2]";
    });

    const handleDimensionsLoaded = useCallback(
      (dims: { width: number; height: number; ratio: number }) => {
        const { ratio } = dims;
        if (ratio < 0.85) {
          setAspectClass("aspect-[3/4]");
        } else if (ratio >= 0.85 && ratio < 1.15) {
          setAspectClass("aspect-square");
        } else if (ratio >= 1.15 && ratio < 1.35) {
          setAspectClass("aspect-[4/3]");
        } else {
          setAspectClass("aspect-[3/2]");
        }
      },
      [],
    );

    // Format caption text to highlight hashtags (#) and user mentions (@)
    const formattedCaption = useMemo(() => {
      if (!post.caption) return null;
      const parts = post.caption.split(/(\s+)/);
      return parts.map((part, index) => {
        if (part.startsWith("#") && part.length > 1) {
          const tag = part
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .substring(1);
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className="text-m3-primary hover:underline cursor-pointer font-semibold animate-none"
            >
              {highlightText(part, "caption")}
            </span>
          );
        }
        if (part.startsWith("@") && part.length > 1) {
          const username = part
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .substring(1);
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onCreatorClick?.(username);
              }}
              className="text-m3-primary hover:underline cursor-pointer font-semibold animate-none"
            >
              {highlightText(part, "caption")}
            </span>
          );
        }
        return highlightText(part, "caption");
      });
    }, [post.caption, onTagClick, onCreatorClick, highlightText]);

    // Is caption long?
    const captionIsLong = post.caption && post.caption.length > 120;
    const displayedCaption =
      isCaptionExpanded || !captionIsLong ? (
        formattedCaption
      ) : (
        <>
          {highlightText(post.caption.slice(0, 110), "caption")}...{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerVibration("light");
              setIsCaptionExpanded(true);
            }}
            className="text-m3-outline hover:text-m3-primary font-bold text-[11px]"
          >
            {t.more}
          </button>
        </>
      );

    if (!isDetailMode) {
      return (
        <motion.div
          ref={cardRef}
          layoutId={`post-card-${post.id}`}
          onClick={handleCardClick}
          onMouseEnter={onMouseEnter}
          onMouseDown={startHold}
          onMouseUp={endHold}
          onMouseLeave={endHold}
          onTouchStart={startHold}
          onTouchEnd={endHold}
          onTouchMove={endHold}
          whileTap={{ scale: 0.98 }}
          transition={{
            layout: { type: "spring", stiffness: 280, damping: 28 },
            default: { type: "spring", stiffness: 400, damping: 25 }
          }}
          style={subtleBg ? { backgroundColor: subtleBg } : undefined}
          className={`relative rounded-[20px] overflow-hidden cursor-pointer border transition-all duration-300 group/card flex flex-col hover:-translate-y-1 hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:z-10 ${
            post.visibility === "hidden"
              ? "opacity-50 saturate-[0.35] hover:opacity-85 hover:saturate-100"
              : ""
          } ${
            isSelected
              ? "bg-m3-primary-container/10 border-m3-primary shadow-glass-md ring-2 ring-m3-primary/20"
              : isKeyboardFocused
                ? "bg-m3-primary-container/15 border-m3-primary ring-2 ring-m3-primary/40 shadow-glass-lg scale-[1.01] -translate-y-0.5"
                : "bg-m3-surface-low border-m3-outline-variant/25 hover:border-m3-outline/40"
          }`}
        >
          {/* ================= THUMBNAIL / MEDIA AREA ================= */}
          <motion.div
            layoutId={`post-media-${post.id}`}
            className={`relative overflow-hidden w-full ${aspectClass} shrink-0 bg-black select-none flex flex-col justify-between group/carousel`}
          >
            {/* Background Image / Slider */}
            <div className="absolute inset-0 w-full h-full z-0">
              {post.thumbnailUrl || post.postUrl ? (
                <>
                  <InstagramImage
                    post={post}
                    src={slides[activeSlide]}
                    alt={post.caption || "Instagram Post"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                    loading="lazy"
                    onDimensionsLoaded={handleDimensionsLoaded}
                  />

                  {/* Slider Controls */}
                  {slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSlide((prev) =>
                            prev > 0 ? prev - 1 : slides.length - 1,
                          );
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover/carousel:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 z-30 shadow-md cursor-pointer"
                        title="Previous image"
                      >
                        <ChevronLeft size={16} className="stroke-[2.5]" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSlide((prev) =>
                            prev < slides.length - 1 ? prev + 1 : 0,
                          );
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover/carousel:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 z-30 shadow-md cursor-pointer"
                        title="Next image"
                      >
                        <ChevronRight size={16} className="stroke-[2.5]" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-1 bg-black select-none">
                  <ImageIcon size={28} className="stroke-1 animate-pulse" />
                  <span className="text-[10px] font-semibold">
                    {t.loadingThumbnail}
                  </span>
                </div>
              )}
            </div>

            {post.visibility === "hidden" && (
              <div className="absolute inset-0 bg-red-950/25 backdrop-blur-[1.5px] flex flex-col items-center justify-center text-white/95 gap-1.5 z-10 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg border border-red-500">
                  <EyeOff size={20} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-extrabold font-mono uppercase bg-red-600 px-2 py-0.5 rounded-full tracking-wider shadow-sm">
                  Hidden / Broken
                </span>
              </div>
            )}

            {/* Gradient Overlays for media area readability */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent pointer-events-none z-10" />

            {/* Overlaid details (Top Left check, Top Right badges) */}
            <div className="relative z-20 px-3 pt-3 flex items-start justify-between w-full pointer-events-none">
              {/* Select Checkbox (Hover-revealed or active) */}
              <div
                className="z-30 pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(e);
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  animate={isSelected ? { scale: [0.95, 1.15, 1.05, 1] } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 border shadow-md backdrop-blur-md cursor-pointer ${
                    isSelected
                      ? "bg-m3-primary border-m3-primary text-m3-on-primary opacity-100"
                      : "bg-black/30 border-white/25 text-white hover:border-white opacity-0 group-hover/card:opacity-100"
                  }`}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={isSelected ? { scale: 1 } : { scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <Check size={12} className="stroke-[3]" />
                  </motion.div>
                </motion.div>
              </div>

              {/* Media indicator badges */}
              <div className="flex items-center gap-1">
                {post.thumbnailStatus === "failed" && (
                  <div
                    className="z-30 pointer-events-auto w-6 h-6 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow-md border border-red-400 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      retrySingleThumbnail(post.id);
                      toast.success("Retrying download...");
                    }}
                    title="Scrape preview failed (Click to retry)"
                  >
                    <AlertTriangle size={11} className="stroke-[2.5]" />
                  </div>
                )}
                <span className="px-2 py-0.5 rounded-md text-[8px] font-extrabold tracking-wider uppercase bg-black/45 text-white flex items-center gap-1 backdrop-blur-md border border-white/10 shadow-sm">
                  {isVideo ? (
                    <Film size={8} className="text-m3-primary" />
                  ) : (
                    <ImageIcon size={8} className="text-m3-primary" />
                  )}
                  <span>
                    {post.mediaType || "image"}
                    {post.mediaType === "carousel" && ` (${post.mediaCount || slides.length})`}
                  </span>
                </span>
              </div>
            </div>

            {/* ================= GRID QUICK ACTIONS ROW (HOVER REVEALED) ================= */}
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none z-20 flex items-center justify-center">
              <div className="flex items-center gap-2.5 pointer-events-auto bg-black/30 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10 shadow-lg">
                {/* Favorite toggle */}
                <motion.button
                  type="button"
                  onClick={handleToggleFavorite}
                  whileTap={{ scale: 1.4 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                    post.isFavorite
                      ? "bg-m3-primary text-m3-on-primary"
                      : "text-white hover:bg-white/20"
                  }`}
                  title={post.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Heart size={15} fill={post.isFavorite ? "currentColor" : "none"} />
                </motion.button>

                {/* Archive toggle */}
                <motion.button
                  type="button"
                  onClick={handleToggleArchive}
                  whileTap={{ scale: 1.15 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                    post.isArchived
                      ? "bg-m3-primary text-m3-on-primary"
                      : "text-white hover:bg-white/20"
                  }`}
                  title={post.isArchived ? "Unarchive Post" : "Archive Post"}
                >
                  <Archive size={14} />
                </motion.button>

                {/* Download HD Media / Reel */}
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.promise(downloadPostMedia(post), {
                      loading: "Preparing HD media download...",
                      success: "Download started!",
                      error: "Download failed, opened original post link.",
                    });
                  }}
                  whileTap={{ scale: 1.15 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer text-white hover:bg-white/20"
                  title={isVideo ? "Download HD Reel / Video" : "Download Media"}
                >
                  <Download size={14} />
                </motion.button>

                {/* Inline Tag Input activator */}
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTagInput(true);
                  }}
                  whileTap={{ scale: 1.15 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                    showTagInput
                      ? "bg-m3-primary text-m3-on-primary"
                      : "text-white hover:bg-white/20"
                  }`}
                  title="Add Tag Directly"
                >
                  <Plus size={15} />
                </motion.button>
              </div>
            </div>

            {/* Carousel Dot Indicators at the bottom of Media Area */}
            {slides.length > 1 && (
              <div className="relative z-20 w-full flex gap-1 px-3 pb-2 select-none opacity-80 group-hover/card:opacity-100 transition-opacity">
                {slides.map((_, i) => (
                  <div
                    key={i}
                    className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/30 backdrop-blur-sm cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSlide(i);
                    }}
                  >
                    <div
                      className={`h-full transition-all duration-300 ${i === activeSlide ? "bg-white" : i < activeSlide ? "bg-white/80" : "bg-transparent"}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* ================= CARD BODY (BELOW MEDIA) ================= */}
          {!isImmersive ? (
            <div className="p-4 flex flex-col justify-between gap-2 bg-m3-surface-low flex-1">
              {/* Header & Caption Group */}
              <div className="flex flex-col gap-1.5 w-full">
                {/* Header: Username & Date */}
                <div className="flex items-center justify-between w-full">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreatorClick?.(post.creatorUsername);
                    }}
                    className="font-display font-extrabold text-sm text-m3-on-surface hover:underline cursor-pointer tracking-tight"
                  >
                    @{highlightText(post.creatorUsername || "creator", "creator")}
                  </span>

                  {post.savedAt && (
                    <span className="font-mono text-[10px] text-m3-outline flex items-center gap-0.5 select-none opacity-75">
                      <Calendar size={10} />
                      {new Date(post.savedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>

                {/* Caption Preview */}
                {displayedCaption && (
                  <p className="text-xs text-m3-on-surface-variant leading-relaxed line-clamp-2 mt-0.5 min-h-[2rem]">
                    {displayedCaption}
                  </p>
                )}
              </div>

              {/* Tags & Inline Adder */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {post.tags && post.tags.map((tag) => (
                  <span
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(tag);
                    }}
                    className="interactive-badge px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-m3-outline-variant/20 hover:bg-m3-primary/10 hover:text-m3-primary text-m3-secondary hover:text-m3-primary transition-all cursor-pointer"
                  >
                    #{tag}
                  </span>
                ))}

                {/* Inline Tag Input Form */}
                <AnimatePresence mode="wait">
                  {showTagInput ? (
                    <motion.form
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      onSubmit={(e) => {
                        e.stopPropagation();
                        handleAddTagSubmit(e);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center"
                    >
                      <input
                        autoFocus
                        type="text"
                        placeholder="New tag..."
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onBlur={() => {
                          // Submit if there's text, or hide
                          if (!newTagInput.trim()) {
                            setShowTagInput(false);
                          }
                        }}
                        className="px-2 py-0.5 text-[10px] border border-m3-outline-variant rounded-full bg-m3-surface text-m3-on-surface outline-none focus:border-m3-primary max-w-[80px]"
                      />
                    </motion.form>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTagInput(true);
                      }}
                      className="w-5 h-5 rounded-full border border-m3-outline-variant/30 flex items-center justify-center hover:bg-m3-primary/10 hover:text-m3-primary transition-all text-m3-outline hover:border-m3-primary/40 cursor-pointer"
                      title="Add tag"
                    >
                      <Plus size={11} className="stroke-[2.5]" />
                    </button>
                  )}
                </AnimatePresence>
              </div>

              {/* Note indicator and location footer */}
              {(post.notes || post.location) && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-m3-outline-variant/10">
                  {post.notes && (
                    <span className="font-mono text-[9px] text-m3-outline flex items-center gap-1 font-semibold uppercase tracking-wider bg-m3-primary/5 text-m3-primary border border-m3-primary/10 px-2 py-0.5 rounded-full">
                      <FileText size={9} />
                      {t.personalNote}
                    </span>
                  )}
                  {post.location && (
                    <span className="text-[10px] text-m3-on-surface-variant/70 flex items-center gap-0.5 truncate max-w-[120px]">
                      <MapPin size={9} className="shrink-0 text-m3-outline" />
                      {post.location}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="px-3.5 py-2.5 bg-m3-surface-low/95 backdrop-blur-md border-t border-m3-outline-variant/15 flex items-center justify-between w-full text-xs font-bold shrink-0">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatorClick?.(post.creatorUsername);
                }}
                className="font-display font-extrabold text-xs text-m3-on-surface hover:underline cursor-pointer truncate"
              >
                @{highlightText(post.creatorUsername || "creator", "creator")}
              </span>
              <div className="flex items-center gap-2 shrink-0 text-m3-on-surface-variant">
                {post.isFavorite && (
                  <Heart size={13} fill="currentColor" className="text-m3-primary" />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.promise(downloadPostMedia(post), {
                      loading: "Downloading HD Media...",
                      success: "Download started!",
                      error: "Download failed",
                    });
                  }}
                  className="p-1 rounded-full hover:bg-m3-surface-variant/40 hover:text-m3-primary transition-colors cursor-pointer"
                  title="Download HD Media"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      );
    }

    return (
      <motion.div
        ref={cardRef}
        layoutId={`post-card-${post.id}`}
        onClick={handleCardClick}
        onMouseEnter={onMouseEnter}
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={startHold}
        onTouchEnd={endHold}
        onTouchMove={endHold}
        whileTap={isDetailMode ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={subtleBg ? { backgroundColor: subtleBg } : undefined}
        className={`relative rounded-[20px] overflow-hidden border transition-all duration-300 group/card flex flex-col ${
          isDetailMode
            ? "bg-m3-surface border-m3-outline-variant shadow-2xl w-full max-w-[600px]"
            : isSelected
              ? "bg-m3-primary-container/10 border-m3-primary shadow-glass-md ring-2 ring-m3-primary/20 hover:-translate-y-1 hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:z-10 cursor-pointer"
              : isKeyboardFocused
                ? "bg-m3-primary-container/15 border-m3-primary ring-2 ring-m3-primary/40 shadow-glass-lg scale-[1.01] -translate-y-0.5 hover:-translate-y-1 hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:z-10 cursor-pointer"
                : "bg-m3-surface-low border-m3-outline-variant/25 hover:border-m3-outline/40 hover:-translate-y-1 hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:z-10 cursor-pointer"
        }`}
      >
        {/* ================= FULL COVER MEDIA CAROUSEL ================= */}
        <motion.div
          layoutId={`post-media-${post.id}`}
          className={`relative overflow-hidden w-full ${aspectClass} shrink-0 bg-black select-none flex flex-col justify-between group/carousel`}
        >
          {/* Background Image / Slider */}
          <div className="absolute inset-0 w-full h-full z-0">
            {post.thumbnailUrl || post.postUrl ? (
              <>
                <InstagramImage
                  post={post}
                  src={slides[activeSlide]}
                  alt={post.caption || "Instagram Post"}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                  loading="lazy"
                  onDimensionsLoaded={handleDimensionsLoaded}
                />

                {/* Slider Controls */}
                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide((prev) =>
                          prev > 0 ? prev - 1 : slides.length - 1,
                        );
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover/carousel:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 z-30 shadow-md cursor-pointer"
                      title="Previous image"
                    >
                      <ChevronLeft size={16} className="stroke-[2.5]" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide((prev) =>
                          prev < slides.length - 1 ? prev + 1 : 0,
                        );
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover/carousel:opacity-100 hover:scale-105 active:scale-95 transition-all duration-200 z-30 shadow-md cursor-pointer"
                      title="Next image"
                    >
                      <ChevronRight size={16} className="stroke-[2.5]" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-1 bg-black select-none">
                <ImageIcon size={28} className="stroke-1 animate-pulse" />
                <span className="text-[10px] font-semibold">
                  {t.loadingThumbnail}
                </span>
              </div>
            )}
          </div>

          {/* Gradient Overlays for Readability */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-10" />

          {/* ================= HEADER SECTION (OVERLAY) ================= */}
          <div className="relative z-20 px-3 pt-3 flex items-start justify-between w-full">
            <div className="flex flex-col items-start gap-1">
              {/* Bulk Select Indicator Checkbox in top left */}
              {!isDetailMode && (
                <div
                  className="z-30 animate-none mb-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(e);
                  }}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 border shadow-md backdrop-blur-md cursor-pointer ${
                      isSelected
                        ? "bg-m3-primary border-m3-primary text-m3-on-primary scale-110 opacity-100"
                        : "bg-black/30 border-white/25 text-white hover:border-white hover:scale-105 opacity-0 group-hover/card:opacity-100"
                    }`}
                  >
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                  </div>
                </div>
              )}

              {isDetailMode && onClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="z-30 w-8 h-8 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center border border-white/20 shadow-md backdrop-blur-md cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 mb-1"
                  title="Go Back"
                >
                  <ArrowLeft size={16} className="stroke-[2.5]" />
                </button>
              )}

              {/* Date and Location */}
              <div className="flex items-center gap-1.5 text-[9.5px] text-white/90 font-semibold leading-tight drop-shadow-md">
                {post.savedAt && (
                  <span className="flex items-center gap-0.5">
                    <Calendar size={9} />
                    {new Date(post.savedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </span>
                )}
                {post.location && <span>•</span>}
                {post.location && (
                  <span className="flex items-center gap-0.5 text-white max-w-[100px] truncate">
                    <MapPin size={9} className="shrink-0" />
                    {post.location}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Media type visual badges (top right) */}
              <div className="flex items-center gap-1.5 animate-none">
                {post.thumbnailStatus === "failed" && (
                  <div
                    className="w-6 h-6 rounded-full bg-m3-primary text-m3-on-primary flex items-center justify-center shadow-md border border-white/20"
                    title="Scrape preview failed"
                  >
                    <AlertTriangle size={12} className="stroke-[2.5]" />
                  </div>
                )}
                {(post.thumbnailStatus === "pending" ||
                  !post.thumbnailStatus) && (
                  <div
                    className="w-6 h-6 rounded-full bg-m3-primary text-m3-on-primary flex items-center justify-center shadow-md border border-white/20"
                    title="Fetching preview image..."
                  >
                    <Loader2 size={12} className="animate-spin stroke-[2.5]" />
                  </div>
                )}

                <span className="px-2 py-0.5 rounded-md text-[8px] font-extrabold tracking-wider uppercase bg-black/45 text-white flex items-center gap-1 backdrop-blur-md border border-white/10 shadow-sm">
                  {isVideo ? (
                    <Film size={8} className="text-m3-primary" />
                  ) : (
                    <ImageIcon size={8} className="text-m3-primary" />
                  )}
                  <span>{post.mediaType || "image"}</span>
                </span>
              </div>

              {/* Collections Badges on Header Right */}
              <div className="flex items-center flex-wrap justify-end gap-1 max-w-[140px]">
                {post.collections &&
                  post.collections.map((col) => (
                    <span
                      key={col}
                      className="interactive-badge px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[8px] font-bold border border-white/20 flex items-center gap-1 max-w-[80px] drop-shadow-sm"
                    >
                      <FolderOpen size={8} />
                      <span className="truncate">{col}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCollection(col);
                        }}
                        className="hover:bg-white/30 p-2 sm:p-0.5 -mr-1.5 sm:-mr-0 rounded-full cursor-pointer"
                        title={`Remove from ${col}`}
                      >
                        <X size={7} />
                      </button>
                    </span>
                  ))}

                {/* Add to Collection Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColDropdown((prev) => !prev);
                    }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all cursor-pointer backdrop-blur-md ${
                      showColDropdown
                        ? "bg-m3-primary text-m3-on-primary border-m3-primary"
                        : "bg-black/30 text-white/90 border-white/25 hover:bg-white/20 hover:border-white"
                    }`}
                    title={t.addToCollection}
                  >
                    <Plus size={10} className="stroke-[2.5]" />
                  </button>

                  {/* Collections Selector Dropdown */}
                  <AnimatePresence>
                    {showColDropdown && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        className="absolute right-0 mt-1.5 w-48 bg-m3-surface rounded-xl shadow-xl border border-m3-outline-variant/30 z-40 p-2 overflow-hidden flex flex-col gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-[9px] font-extrabold text-m3-outline uppercase tracking-wider px-2 py-1 select-none">
                          {t.addToCollection}
                        </p>

                        {allCollections.length > 0 && (
                          <div className="max-h-24 overflow-y-auto flex flex-col gap-0.5">
                            {allCollections.map((col) => {
                              const isIncluded =
                                post.collections?.includes(col);
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => {
                                    if (isIncluded) handleRemoveCollection(col);
                                    else handleAddColSubmit(col);
                                  }}
                                  className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                    isIncluded
                                      ? "bg-m3-primary/10 text-m3-primary font-bold"
                                      : "hover:bg-m3-surface-variant/40 text-m3-on-surface"
                                  }`}
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    <FolderOpen size={10} />
                                    {col}
                                  </span>
                                  {isIncluded && (
                                    <Check size={10} className="stroke-[3]" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Input to create a brand new collection inline */}
                        <div className="border-t border-m3-outline-variant/10 pt-1.5 mt-1 flex gap-1">
                          <input
                            type="text"
                            placeholder={t.newCollection}
                            value={newColInput}
                            onChange={(e) => setNewColInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleAddColSubmit(newColInput);
                              }
                            }}
                            className="flex-1 min-w-0 px-2 py-1 text-[10px] border border-m3-outline-variant/25 rounded-md bg-m3-surface outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/15 text-m3-on-surface"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddColSubmit(newColInput)}
                            className="px-2 py-1 rounded-md bg-m3-primary text-m3-on-primary text-[10px] font-bold shrink-0 hover:bg-opacity-90 active:scale-95 cursor-pointer"
                          >
                            {t.add}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Elegant Scrape Failed Overlay */}
          {post.thumbnailStatus === "failed" && (
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] opacity-0 group-hover/card:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 z-20 animate-none">
              <div className="flex items-center gap-1 text-[10px] font-bold text-white bg-red-500/90 px-2.5 py-0.5 rounded-full border border-red-400 shadow-sm">
                <AlertTriangle size={11} className="stroke-[2.5]" />
                <span>{t.scrapeFailed}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {post.postUrl && (
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/10 text-white text-[10px] font-bold backdrop-blur-md transition-all hover:scale-105"
                    title="Open original post on Instagram"
                  >
                    <ExternalLink size={10} />
                    <span>{t.openPost}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await retrySingleThumbnail(post.id);
                  }}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-m3-primary hover:bg-opacity-95 text-m3-on-primary text-[10px] font-bold transition-all hover:scale-105 shadow-sm cursor-pointer"
                  title="Retry fetching preview image"
                >
                  <RefreshCw size={10} />
                  <span>{t.retry}</span>
                </button>
              </div>
            </div>
          )}

          {/* Spacer to push content down */}
          <div className="flex-1 pointer-events-none z-10" />

          {/* ================= CAPTION & INTERACTIONS ROW (OVERLAY) ================= */}
          <div className="relative z-20 flex flex-col w-full text-white px-3 pb-3">
            {/* Username + Caption Overlay */}
            <div className="pointer-events-auto text-white drop-shadow-md">
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatorClick?.(post.creatorUsername);
                }}
                className="font-extrabold text-[13px] hover:underline cursor-pointer mr-2 drop-shadow-lg"
              >
                {highlightText(post.creatorUsername, "creator")}
              </span>
              {displayedCaption && (
                <span className="text-[11.5px] font-medium text-white/95 drop-shadow-lg line-clamp-2 mt-0.5">
                  {displayedCaption}
                </span>
              )}
            </div>

            {/* Subtle Progress Bar indicators */}
            {slides.length > 1 && (
              <div className="w-full flex gap-1 mt-2.5 mb-1.5 z-30 select-none opacity-80 group-hover/card:opacity-100 transition-opacity">
                {slides.map((_, i) => (
                  <div
                    key={i}
                    className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/30 backdrop-blur-sm cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSlide(i);
                    }}
                    title={`Go to image ${i + 1}`}
                  >
                    <div
                      className={`h-full transition-all duration-300 ${i === activeSlide ? "bg-white" : i < activeSlide ? "bg-white/80" : "bg-transparent"}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Interactions Row */}
            <div className="flex items-center justify-between mt-2.5 animate-none">
              <div className="flex items-center gap-4">
                {/* Heart / Favorite */}
                <motion.button
                  type="button"
                  onClick={handleToggleFavorite}
                  whileTap={{ scale: 1.4 }}
                  className={`transition-colors cursor-pointer drop-shadow-md ${
                    post.isFavorite
                      ? "text-m3-primary hover:text-m3-primary"
                      : "text-white/90 hover:text-white"
                  }`}
                  title={
                    post.isFavorite
                      ? "Remove from Favorites"
                      : "Add to Favorites"
                  }
                >
                  <Heart
                    size={22}
                    fill={post.isFavorite ? "currentColor" : "none"}
                    className={
                      post.isFavorite ? "stroke-m3-primary" : "stroke-white"
                    }
                  />
                </motion.button>

                {/* Toggle Notes & Comments Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNotesPanel((prev) => !prev);
                  }}
                  className={`transition-colors cursor-pointer drop-shadow-md ${
                    showNotesPanel
                      ? "text-white"
                      : "text-white/90 hover:text-white"
                  }`}
                  title="Toggle Notes & Comments"
                >
                  <MessageSquare
                    size={22}
                    className={showNotesPanel ? "fill-white/20" : ""}
                  />
                </button>

                {/* Archive / Unarchive Button */}
                <button
                  type="button"
                  onClick={handleToggleArchive}
                  className={`transition-colors cursor-pointer drop-shadow-md ${
                    post.isArchived
                      ? "text-m3-primary hover:text-m3-primary"
                      : "text-white/90 hover:text-white"
                  }`}
                  title={post.isArchived ? "Unarchive Post" : "Archive Post"}
                >
                  <Archive
                    size={21}
                    className={
                      post.isArchived
                        ? "fill-m3-primary/20 stroke-m3-primary"
                        : ""
                    }
                  />
                </button>

                {/* External Original Post Link */}
                {post.postUrl && (
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-white/90 hover:text-white transition-colors flex items-center justify-center cursor-pointer drop-shadow-md"
                    title="Open original post on Instagram"
                  >
                    <ExternalLink size={20} />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Read Later Bookmark */}
                <button
                  type="button"
                  onClick={handleToggleReadLater}
                  className={`transition-colors cursor-pointer drop-shadow-md ${
                    post.readLater
                      ? "text-m3-primary hover:text-m3-primary"
                      : "text-white/90 hover:text-white"
                  }`}
                  title={
                    post.readLater ? "Remove bookmark" : "Bookmark for Later"
                  }
                >
                  <Bookmark
                    size={22}
                    fill={post.readLater ? "currentColor" : "none"}
                    className={post.readLater ? "stroke-m3-primary" : ""}
                  />
                </button>

                {/* Copy Post Link */}
                {post.postUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(post.postUrl || "");
                      toast.success(t.linkCopied);
                    }}
                    className="text-white/90 hover:text-white transition-colors cursor-pointer drop-shadow-md"
                    title="Copy original post URL"
                  >
                    <Copy size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ================= NOTES & COMMENTS EXPANDED PANEL ================= */}
        <AnimatePresence>
          {showNotesPanel && (
            <div className="px-4.5 pb-3.5 flex flex-col gap-2.5 bg-m3-surface-low rounded-b-[20px] flex-1">
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 10 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 bg-m3-surface border border-m3-outline-variant/20 rounded-[16px] flex flex-col gap-3">
                  {/* 1. Personal Curation Notes section */}
                  <div className="flex flex-col gap-1.5 animate-none">
                    <div className="flex items-center justify-between text-[10px] font-bold text-m3-primary uppercase select-none">
                      <span className="flex items-center gap-1">
                        <FileText size={10} />
                        {t.personalNote}
                      </span>

                      {/* Saved Status Indicator */}
                      <AnimatePresence mode="wait">
                        {saveStatus === "saving" && (
                          <motion.span
                            key="saving"
                            initial={{ opacity: 0, x: 5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            className="text-[9px] text-m3-primary font-semibold flex items-center gap-1"
                          >
                            <Loader2 size={8} className="animate-spin" />{" "}
                            {t.saving}
                          </motion.span>
                        )}
                        {saveStatus === "saved" && (
                          <motion.span
                            key="saved"
                            initial={{ opacity: 0, x: 5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            className="text-[9px] text-m3-primary font-bold flex items-center gap-0.5"
                          >
                            <Check size={8} className="stroke-[3]" /> {t.saved}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <textarea
                      placeholder={t.notePlaceholder}
                      value={noteText}
                      onChange={handleNoteChange}
                      onBlur={handleNoteBlur}
                      className="w-full min-h-[50px] max-h-[120px] p-2 text-xs border border-m3-outline-variant/20 rounded-lg bg-m3-surface text-m3-on-surface outline-none focus:ring-1 focus:ring-m3-primary/30 focus:border-m3-primary transition-all resize-none leading-relaxed placeholder-m3-outline/40"
                    />
                  </div>

                  {/* 2. Instagram comments section */}
                  <div className="flex flex-col gap-2 pt-2.5 border-t border-m3-outline-variant/10 animate-none">
                    <div className="text-[10px] font-bold text-m3-on-surface-variant/70 uppercase tracking-wider select-none">
                      {t.instagramComments}
                    </div>

                    {/* Comments Feed List */}
                    {post.comments && post.comments.length > 0 ? (
                      <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1 text-m3-on-surface">
                        {post.comments.map((comment) => {
                          const isCurator =
                            comment.username === "you" ||
                            comment.username === "curator";
                          return (
                            <div
                              key={comment.id}
                              className="flex gap-2 group/comment text-[11px] justify-between items-start leading-normal"
                            >
                              <div className="flex-1">
                                <span
                                  className={`font-bold mr-1.5 ${isCurator ? "text-m3-primary font-extrabold" : "text-m3-on-surface"}`}
                                >
                                  {comment.username}
                                  {isCurator && (
                                    <span className="ml-1.5 px-1 py-0.2 rounded bg-m3-primary/10 text-[8px] font-extrabold tracking-tight uppercase select-none">
                                      {t.you}
                                    </span>
                                  )}
                                </span>
                                <span className="text-m3-on-surface-variant break-words">
                                  {comment.text}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveComment(comment.id)}
                                className="opacity-100 sm:opacity-0 group-hover/comment:opacity-100 hover:text-red-500 p-2 sm:p-0.5 -m-1.5 sm:m-0 rounded-sm transition-opacity cursor-pointer text-m3-outline"
                                title="Delete comment"
                              >
                                <Trash2 size={9.5} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[10px] text-m3-outline italic select-none py-1">
                        {t.noCommentsYet}
                      </div>
                    )}

                    {/* Add New Comment Box */}
                    <form
                      onSubmit={handleAddCommentSubmit}
                      className="flex gap-1.5 mt-1"
                    >
                      <input
                        type="text"
                        placeholder={t.commentPlaceholder}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        className="flex-1 px-3 py-2 sm:py-1.5 text-xs border border-m3-outline-variant/20 rounded-lg bg-m3-surface text-m3-on-surface outline-none focus:ring-1 focus:ring-m3-primary/30 focus:border-m3-primary transition-all placeholder-m3-outline/40"
                      />
                      <button
                        type="submit"
                        disabled={!commentInput.trim()}
                        className="w-10 sm:w-8 h-10 sm:h-8 rounded-lg bg-m3-primary text-m3-on-primary flex items-center justify-center hover:bg-opacity-95 disabled:bg-m3-outline-variant/30 disabled:text-m3-outline transition-all shrink-0 cursor-pointer"
                        title="Post comment"
                      >
                        <Send size={11} className="stroke-[2.5]" />
                      </button>
                    </form>
                  </div>

                  {/* 3. Google Search Grounding & Curation Research */}
                  {isDetailMode && (
                    <div className="flex flex-col gap-2 pt-3 border-t border-m3-outline-variant/10 animate-none">
                      <div className="flex items-center justify-between text-[10px] font-bold text-m3-on-surface-variant/70 uppercase tracking-wider select-none">
                        <span className="flex items-center gap-1">
                          <Globe size={11} className="text-m3-primary" />
                          AI Research & Verification
                        </span>
                        <span className="text-[8px] font-extrabold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded tracking-wide">
                          GOOGLE SEARCH
                        </span>
                      </div>

                      {/* Pre-defined Verification Actions */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <button
                          type="button"
                          onClick={() => handleResearch("creator")}
                          disabled={isResearching || !post.creatorUsername}
                          className="px-2.5 py-1.5 sm:py-1 rounded-md text-[10px] font-bold bg-m3-primary/5 hover:bg-m3-primary text-m3-primary hover:text-m3-on-primary border border-m3-primary/10 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title={`Verify creator @${post.creatorUsername || "username"}`}
                        >
                          <Sparkles size={9} />
                          Verify Creator
                        </button>

                        {post.tags && post.tags.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleResearch("hashtags")}
                            disabled={isResearching}
                            className="px-2.5 py-1.5 sm:py-1 rounded-md text-[10px] font-bold bg-m3-primary/5 hover:bg-m3-primary text-m3-primary hover:text-m3-on-primary border border-m3-primary/10 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Research hashtag context & trends"
                          >
                            <Compass size={9} />
                            Research Hashtags
                          </button>
                        )}
                      </div>

                      {/* Custom query search box */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleResearch("custom");
                        }}
                        className="flex gap-1.5 mt-1"
                      >
                        <input
                          type="text"
                          placeholder="Ask anything about this post, creator, or trends..."
                          value={customResearchQuery}
                          onChange={(e) => setCustomResearchQuery(e.target.value)}
                          disabled={isResearching}
                          className="flex-1 px-3 py-2 sm:py-1.5 text-xs border border-m3-outline-variant/20 rounded-lg bg-m3-surface text-m3-on-surface outline-none focus:ring-1 focus:ring-m3-primary/30 focus:border-m3-primary transition-all placeholder-m3-outline/40"
                        />
                        <button
                          type="submit"
                          disabled={isResearching || !customResearchQuery.trim()}
                          className="w-10 sm:w-8 h-10 sm:h-8 rounded-lg bg-m3-primary text-m3-on-primary flex items-center justify-center hover:bg-opacity-95 disabled:bg-m3-outline-variant/30 disabled:text-m3-outline transition-all shrink-0 cursor-pointer"
                          title="Search"
                        >
                          {isResearching ? (
                            <Loader2 size={11} className="animate-spin stroke-[2.5]" />
                          ) : (
                            <Search size={11} className="stroke-[2.5]" />
                          )}
                        </button>
                      </form>

                      {/* Loading status */}
                      {isResearching && (
                        <div className="flex flex-col items-center justify-center py-4 gap-1.5 border border-dashed border-m3-outline-variant/30 rounded-lg bg-m3-primary/5">
                          <Loader2 size={18} className="animate-spin text-m3-primary" />
                          <span className="text-[10px] font-bold text-m3-primary tracking-wide animate-pulse">
                            Querying Google Search Grounding...
                          </span>
                          <span className="text-[8px] text-m3-outline italic">
                            Analyzing real-time web results for perfect verification.
                          </span>
                        </div>
                      )}

                      {/* Error display */}
                      {researchError && (
                        <div className="p-3 border border-red-200/30 rounded-lg bg-red-50/5 text-red-600 text-[11px] leading-relaxed">
                          <div className="font-extrabold mb-0.5">Verification Error</div>
                          {researchError}
                        </div>
                      )}

                      {/* Grounding response output */}
                      {researchResult && (
                        <div className="mt-2 p-3.5 border border-m3-outline-variant/15 rounded-xl bg-m3-primary/[0.02] flex flex-col gap-3">
                          {renderFormattedResearch(researchResult)}

                          {/* Grounding sources citations list */}
                          {researchSources.length > 0 && (
                            <div className="pt-2.5 border-t border-m3-outline-variant/10 flex flex-col gap-1.5 animate-none">
                              <span className="text-[9px] font-extrabold text-m3-outline uppercase tracking-wider select-none">
                                Sources Verified:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {researchSources.map((src, sIdx) => (
                                  <a
                                    key={sIdx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-0.5 rounded bg-m3-outline-variant/20 hover:bg-m3-primary hover:text-m3-on-primary text-[9.5px] font-medium text-m3-secondary transition-all flex items-center gap-1 cursor-pointer max-w-[150px] truncate"
                                    title={src.title}
                                  >
                                    <Globe size={8} />
                                    <span className="truncate">{src.title}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  },
);

PostCard.displayName = "PostCard";
