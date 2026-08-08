import { useDebounce } from "../../hooks/useDebounce";
import { useFullPost } from "../../hooks/useFullPost";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useDeferredValue,
  useCallback,
} from "react";
import toast from "react-hot-toast";
import { Post } from "../../types/post";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import { usePostStore } from "../../store/useStore";
import { PostCard } from "../../components/ui/PostCard";
import { PostCardSkeleton } from "../../components/ui/PostCardSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import emptyDashboardImg from "../../assets/images/empty_dashboard_1786223894917.jpg";
import emptySearchImg from "../../assets/images/empty_search_1786223913709.jpg";
import { TelegramQuickPeek } from "../../components/ui/TelegramQuickPeek";
import { FullScreenMediaViewer } from "../../components/ui/FullScreenMediaViewer";
import { InstagramImage } from "../../components/ui/InstagramImage";
import { AddBookmarkModal } from "../../components/ui/AddBookmarkModal";
import { SmartRulesManager } from "../../components/ui/SmartRulesManager";
import { SAMPLE_POSTS } from "../../data/samplePosts";
import { normalizeInstagramPost } from "../../lib/parser";
import {
  runThumbnailWorker,
} from "../../lib/thumbnailWorker";
import {
  RotateCcw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Menu,
  Tag,
  Folder,
  LayoutGrid,
  List,
  Heart,
  ExternalLink,
  Calendar,
  Check,
  Trash2,
  Archive,
  ArrowUpDown,
  X,
  FolderMinus,
  FolderPlus,
  Compass,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Upload,
  Database,
  BookOpen,
  AlertCircle,
  Plus,
  Hash,
  Smartphone,
  MessageCircle,
  Send,
  Bookmark,
  RefreshCw,
  ArrowUp,
  Inbox,
  SlidersHorizontal,
  Film,
  History,
  MapPin,
  Shuffle,
  Pin,
  Star,
} from "lucide-react";
import Fuse from "fuse.js";
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "motion/react";
import { Virtuoso } from "react-virtuoso";
import { VOCABULARY } from "../../constants/vocabulary";
import { parseSearchQuery, highlightTextHelper } from "../../lib/highlight";
// import { DashboardAnalytics } from './DashboardAnalytics';

// Deterministic PRNG hashing function for randomized but repeatable shuffling
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// Calculate deterministic shuffle score prioritizing forgotten content
function getPostShuffleScore(post: Post, seed: number): number {
  const rawHash = cyrb53(`${post.id}_${seed}`, seed);
  const normalizedHash = (rawHash % 1000000) / 1000000;

  let daysAgo = 0;
  if (post.savedAt) {
    const diffMs = Date.now() - new Date(post.savedAt).getTime();
    daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Forgotten boost factors
  const ageBoost = Math.min(0.5, daysAgo / 100);
  const unnotedBoost = !post.notes || post.notes.trim().length === 0 ? 0.2 : 0;
  const nonFavBoost = !post.isFavorite ? 0.1 : 0;

  return normalizedHash + ageBoost + unnotedBoost + nonFavBoost;
}

interface DashboardViewProps {
  posts: Post[];
  initialFilterFavoriteOnly?: boolean;
  initialFilterArchived?: "all" | "active" | "archived";
  initialSelectedCollections?: string[];
  initialSelectedTags?: string[];
  onNavigate?: (view: any) => void;
  gridDensity: "single" | "double" | "list";
  setGridDensity: (density: "single" | "double" | "list") => void;
  creatorFilter?: string;
  setCreatorFilter: (creator: string) => void;
  initialFilterMediaType?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialSortBy?: string;
  viewportWidth?: number;
}

interface MemoizedPostCardProps {
  post: Post;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onTagClick?: (tag: string) => void;
  onCreatorClick?: (creator: string) => void;
  onPeek?: (post: Post) => void;
  isKeyboardFocused?: boolean;
  onMouseEnter?: () => void;
  onClick?: () => void;
  isDetailMode?: boolean;
  creatorFilter?: string;
  onClose?: () => void;
  isImmersive?: boolean;
}

const MemoizedPostCard = React.memo(
  ({ post, onMouseEnter, ...props }: MemoizedPostCardProps) => {
    const fullPost = useFullPost(post);

    return (
      <div onMouseEnter={onMouseEnter} className="h-full">
        <PostCard post={fullPost} {...props} />
      </div>
    );
  },
);


function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

let savedDashboardScrollTop = 0;

const LocalGroupPreviewCover = React.memo(({ posts, name }: { posts: Post[]; name: string }) => {
  const collectionCovers = usePostStore((state) => state.collectionCovers);
  const customCover = name ? collectionCovers[name] : undefined;
  const customCoverPost = customCover?.coverPostId ? posts.find(p => p.id === customCover.coverPostId) : undefined;
  const customCoverUrl = customCover?.coverImageUrl || customCoverPost?.thumbnailUrl;

  if (customCoverUrl) {
    return (
      <div className="w-full h-full relative overflow-hidden rounded-xl">
        <img
          src={customCoverUrl}
          alt={`${name} Cover`}
          className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700 ease-out"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-2 left-2 bg-amber-500/90 backdrop-blur-md text-stone-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 z-20">
          <Star size={9} className="fill-current" />
          <span>Cover</span>
        </div>
      </div>
    );
  }

  const postsWithThumb = posts.filter(
    (p) => p.thumbnailStatus === "success" && p.thumbnailUrl
  );

  if (postsWithThumb.length >= 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
        {postsWithThumb.slice(0, 4).map((post) => (
          <img
            key={post.id}
            src={post.thumbnailUrl}
            alt="Album tile"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ))}
      </div>
    );
  } else if (postsWithThumb.length > 0) {
    return (
      <div className="relative w-full h-full flex items-center justify-center p-2 bg-transparent">
        {postsWithThumb.length > 1 && (
          <div className="absolute inset-x-5 bottom-0 h-[88%] bg-m3-surface-container border border-m3-outline-variant/15 rounded-xl opacity-40 translate-y-1 scale-95 shadow-2xs" />
        )}
        {postsWithThumb.length > 2 && (
          <div className="absolute inset-x-4 bottom-1.5 h-[88%] bg-m3-surface-container border border-m3-outline-variant/20 rounded-xl opacity-70 translate-y-0.5 scale-[0.98] shadow-2xs" />
        )}
        <div className="w-full h-full rounded-xl overflow-hidden border border-m3-outline-variant/35 shadow-sm relative z-10 bg-m3-surface-container-highest">
          <img
            src={postsWithThumb[0].thumbnailUrl}
            alt="Album Cover"
            className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    );
  } else {
    return (
      <div className="w-full h-full flex items-center justify-center bg-m3-surface-container-highest text-m3-outline/55">
        <Folder size={32} className="stroke-[1.5]" />
      </div>
    );
  }
});
LocalGroupPreviewCover.displayName = "LocalGroupPreviewCover";

const LocalGroupCard = React.memo(({ name, posts, onClick }: { name: string; posts: Post[]; onClick: () => void }) => {
  const pinnedCollections = usePostStore((state) => state.pinnedCollections);
  const togglePinCollection = usePostStore((state) => state.togglePinCollection);
  const isPinned = pinnedCollections.includes(name);
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { scale: 1.015, y: -3 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
      onClick={onClick}
      className="group/card relative p-3 bg-m3-surface-low hover:bg-m3-surface-container rounded-[20px] border border-m3-outline-variant/25 hover:border-m3-primary/30 hover:shadow-glass-md cursor-pointer flex flex-col gap-2.5 h-full transition-all duration-300"
    >
      <div className="aspect-square rounded-xl bg-m3-surface-container-highest overflow-hidden relative shadow-inner">
        <LocalGroupPreviewCover posts={posts} name={name} />

        {/* Pin Button for Collections */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePinCollection(name);
            triggerVibration("medium");
          }}
          className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-md shadow-sm border transition-all z-20 cursor-pointer ${
            isPinned
              ? "bg-amber-500 text-stone-950 border-amber-300"
              : "bg-black/60 text-white border-white/10 opacity-0 group-hover/card:opacity-100 hover:bg-black/80"
          }`}
          title={isPinned ? "Unpin collection" : "Pin collection"}
        >
          <Pin size={12} className={isPinned ? "fill-current" : ""} />
        </button>

        {/* Count Badge Overlay */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-white/10 flex items-center gap-1 z-20 transition-transform group-hover/card:scale-105">
          <span className="font-mono">{posts.length}</span>
          <span className="opacity-80 text-[8px] uppercase tracking-wider">
            {posts.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
      <div className="pt-0.5">
        <h3
          className="font-bold font-display text-xs truncate text-m3-on-surface group-hover/card:text-m3-primary transition-colors text-center"
          title={name}
        >
          {name}
        </h3>
      </div>
    </motion.div>
  );
});
LocalGroupCard.displayName = "LocalGroupCard";

export const DashboardView = React.memo(
  ({
    posts,
    initialFilterFavoriteOnly = false,
    initialFilterArchived = "active",
    initialSelectedCollections = [],
    initialSelectedTags = [],
    onNavigate,
    gridDensity,
    setGridDensity,
    creatorFilter,
    setCreatorFilter,
    initialFilterMediaType = "all",
    initialStartDate = "",
    initialEndDate = "",
    initialSortBy = "savedAt",
    viewportWidth,
  }: DashboardViewProps) => {
    const isLoading = usePostStore((state) => state.isLoading);
    const searchQuery = usePostStore((state) => state.searchQuery);
    const setSearchQuery = usePostStore((state) => state.setSearchQuery);
    const searchPosts = usePostStore((state) => state.searchPosts);
    const shouldReduceMotion = Boolean(useReducedMotion());

    const [isImmersive, setIsImmersive] = useState<boolean>(() => {
      return localStorage.getItem("instasorter_immersive") === "true";
    });

    useEffect(() => {
      localStorage.setItem("instasorter_immersive", isImmersive ? "true" : "false");
    }, [isImmersive]);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
    const setContainerRef = useCallback((node: HTMLDivElement | null) => {
      containerRef.current = node;
      setScrollElement(node);
    }, []);

    const highlightText = useCallback(
      (text: string, fieldType: "caption" | "creator") => {
        return highlightTextHelper(text, fieldType, searchQuery, creatorFilter);
      },
      [searchQuery, creatorFilter]
    );

    // Masonry column count based on density and viewport container width
    const [masonryColumns, setMasonryColumns] = useState(2);
    const resizeTimeoutRef = useRef<any>(null);

    useEffect(() => {
      if (!scrollElement || gridDensity === "list") return;

      const updateColumns = (width: number) => {
        let cols = 2;
        if (gridDensity === "single") {
          // Target width for single-feed layout is around 480px per card
          cols = Math.max(1, Math.floor(width / 480));
          // Cap it at a maximum of 3 columns for single mode to keep the Instagram-feed feel
          if (cols > 3) cols = 3;
        } else if (gridDensity === "double") {
          // Ensure grid layout switches automatically between single (1), double (2), and quad (4) columns based on screen width/device size
          if (width <= 640) {
            cols = 1;
          } else if (width <= 1024) {
            cols = 2;
          } else {
            cols = 4;
          }
        }
        setMasonryColumns(cols);
      };

      const resizeObserver = new ResizeObserver((entries) => {
        if (!entries || entries.length === 0) return;
        const width = entries[0].contentRect.width;
        
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }

        // Debounce by 80ms for buttery-smooth transitions and zero layout thrashing on rapid resizing
        resizeTimeoutRef.current = setTimeout(() => {
          updateColumns(width);
        }, 80);
      });

      resizeObserver.observe(scrollElement);

      // Trigger initial calculation based on the current bounding box immediately
      const initialWidth = scrollElement.getBoundingClientRect().width;
      updateColumns(initialWidth);

      return () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeObserver.disconnect();
      };
    }, [scrollElement, gridDensity]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
      try {
        const saved = localStorage.getItem("isSidebarOpen");
        return saved ? JSON.parse(saved) : false;
      } catch {
        return false;
      }
    });

    useEffect(() => {
      localStorage.setItem("isSidebarOpen", JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    useEffect(() => {
      setLocalSearchQuery(searchQuery);
    }, [searchQuery]);
    
    // Propagate search query changes instantly for real-time filtering & highlighting as the user types
    useEffect(() => {
      if (localSearchQuery !== searchQuery) {
        setSearchQuery(localSearchQuery);
      }
    }, [localSearchQuery, searchQuery, setSearchQuery]);
    const deferredSearchQuery = useDebounce(localSearchQuery, 100);

    // Recent search history states & persistence
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
      try {
        const saved = localStorage.getItem("instasorter_search_history");
        return saved ? JSON.parse(saved) : [];
      } catch (err) {
        console.error("Failed to load search history from localStorage:", err);
        return [];
      }
    });

    const [isSearchHistoryOpen, setIsSearchHistoryOpen] = useState(false);
    const searchHistoryRef = useRef<HTMLDivElement>(null);

    // Save a query to search history
    const addToSearchHistory = useCallback((query: string) => {
      const trimmed = query.trim();
      if (!trimmed || trimmed.length < 2) return;

      setSearchHistory((prev) => {
        const filtered = prev.filter((item) => item !== trimmed);
        const updated = [trimmed, ...filtered].slice(0, 8); // limit to 8 entries
        try {
          localStorage.setItem("instasorter_search_history", JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to save search history to localStorage:", err);
        }
        return updated;
      });
    }, []);

    // Remove a single item from search history
    const removeFromSearchHistory = useCallback((query: string) => {
      setSearchHistory((prev) => {
        const updated = prev.filter((item) => item !== query);
        try {
          localStorage.setItem("instasorter_search_history", JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to save search history to localStorage:", err);
        }
        return updated;
      });
    }, []);

    // Clear all search history
    const clearSearchHistory = useCallback(() => {
      setSearchHistory([]);
      try {
        localStorage.removeItem("instasorter_search_history");
      } catch (err) {
        console.error("Failed to clear search history in localStorage:", err);
      }
    }, []);

    // Outside click listener to close search history dropdown
    useEffect(() => {
      const handleOutsideClick = (event: MouseEvent) => {
        if (
          isSearchHistoryOpen &&
          searchHistoryRef.current &&
          !searchHistoryRef.current.contains(event.target as Node)
        ) {
          setIsSearchHistoryOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
    }, [isSearchHistoryOpen]);



    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const exportDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleOutsideClick = (event: MouseEvent) => {
        if (
          isExportDropdownOpen &&
          exportDropdownRef.current &&
          !exportDropdownRef.current.contains(event.target as Node)
        ) {
          setIsExportDropdownOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
    }, [isExportDropdownOpen]);

    const [tagSearchQuery, setTagSearchQuery] = useState("");
    const deferredTagSearchQuery = useDebounce(tagSearchQuery, 300);

    const [collectionSearchQuery, setCollectionSearchQuery] = useState("");
    const deferredCollectionSearchQuery = useDebounce(collectionSearchQuery, 300);
    const deferredCreatorFilter = useDebounce(creatorFilter || "", 300);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [peekPost, setPeekPost] = useState<Post | null>(null);
    const [detailPost, setDetailPost] = useState<Post | null>(null);
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
    const [keyboardFocusedId, setKeyboardFocusedId] = useState<string | null>(
      null,
    );

    // Local active filters states
    const [filterFavoriteOnly, setFilterFavoriteOnly] = useState(
      initialFilterFavoriteOnly,
    );
    const [filterArchived, setFilterArchived] = useState<
      "all" | "active" | "archived"
    >(initialFilterArchived);
    const [filterMediaType, setFilterMediaType] = useState<string>(
      initialFilterMediaType,
    );
    const [filterHasNotes, setFilterHasNotes] = useState(false);
    const [filterHasLocation, setFilterHasLocation] = useState(false);
    const [filterHasHashtags, setFilterHasHashtags] = useState(false);
    const [selectedTags, setSelectedTags] =
      useState<string[]>(initialSelectedTags);
    const [selectedCollections, setSelectedCollections] = useState<string[]>(
      initialSelectedCollections,
    );
    const [dashboardTab, setDashboardTab] = useState<"feed" | "collections">("feed");
    const [sortBy, setSortBy] = useState<string>(initialSortBy);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [shuffleSeed, setShuffleSeed] = useState<number>(42);
    const [isShuffling, setIsShuffling] = useState(false);
    const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("visible");

    const handleShuffleFeed = useCallback(() => {
      setIsShuffling(true);
      const nextSeed = Date.now();
      setShuffleSeed(nextSeed);
      setSortBy("shuffle");
      triggerVibration(15);
      setTimeout(() => setIsShuffling(false), 450);
      toast.success(
        sortBy === "shuffle"
          ? "Reshuffled feed! Surfacing forgotten content."
          : "Shuffled post grid! Surfacing forgotten content.",
        { id: "shuffle-toast", icon: "🎲" }
      );
    }, [sortBy]);

    useEffect(() => {
      setFilterFavoriteOnly(initialFilterFavoriteOnly);
    }, [initialFilterFavoriteOnly]);

    useEffect(() => {
      setFilterArchived(initialFilterArchived);
    }, [initialFilterArchived]);

    useEffect(() => {
      setFilterMediaType(initialFilterMediaType);
    }, [initialFilterMediaType]);

    useEffect(() => {
      setStartDate(initialStartDate);
    }, [initialStartDate]);

    useEffect(() => {
      setEndDate(initialEndDate);
    }, [initialEndDate]);

    useEffect(() => {
      setSortBy(initialSortBy);
    }, [initialSortBy]);

    useEffect(() => {
      setSelectedCollections(initialSelectedCollections);
    }, [initialSelectedCollections]);

    useEffect(() => {
      setSelectedTags(initialSelectedTags);
    }, [initialSelectedTags]);

    const brokenCount = useMemo(() => {
      return posts.filter((p) => p.thumbnailStatus === "failed").length;
    }, [posts]);

    const hiddenCount = useMemo(() => {
      return posts.filter((p) => p.visibility === "hidden").length;
    }, [posts]);

    const selectedPostIds = usePostStore((state) => state.selectedPostIds);
    const toggleSelectPost = usePostStore((state) => state.toggleSelectPost);
    const bulkDeleteSelected = usePostStore(
      (state) => state.bulkDeleteSelected,
    );
    const bulkAddToCollection = usePostStore(
      (state) => state.bulkAddToCollection,
    );
    const bulkRemoveFromCollection = usePostStore(
      (state) => state.bulkRemoveFromCollection,
    );
    const clearSelection = usePostStore((state) => state.clearSelection);
    const [bulkCollection, setBulkCollection] = useState("");
    const [demoLoading, setDemoLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Pull-to-refresh & scroll-to-top states and handlers
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshState, setRefreshState] = useState<
      "idle" | "pulling" | "ready" | "refreshing"
    >("idle");
    const touchStartY = useRef<number>(-1);

    const isInitialRestore = useRef(true);

    useEffect(() => {
      if (scrollElement && savedDashboardScrollTop > 0 && isInitialRestore.current) {
        const restoreScroll = () => {
          if (scrollElement) {
            scrollElement.scrollTop = savedDashboardScrollTop;
          }
        };

        restoreScroll();
        const t1 = setTimeout(restoreScroll, 50);
        const t2 = setTimeout(restoreScroll, 150);
        const t3 = setTimeout(restoreScroll, 300);

        const t4 = setTimeout(() => {
          isInitialRestore.current = false;
        }, 500);

        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
          clearTimeout(t4);
        };
      } else {
        isInitialRestore.current = false;
      }
    }, [scrollElement]);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (containerRef.current && containerRef.current.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
        setRefreshState("idle");
      } else {
        touchStartY.current = -1;
      }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartY.current === -1) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0) {
        console.log("Math:", Math);
        const distance = diff * 0.45 < 90 ? diff * 0.45 : 90;
        setPullDistance(distance);
        if (distance >= 60) {
          setRefreshState("ready");
        } else {
          setRefreshState("pulling");
        }
      }
    };

    const handleTouchEnd = async () => {
      if (touchStartY.current === -1) return;
      touchStartY.current = -1;

      if (refreshState === "ready" || pullDistance >= 60) {
        setRefreshState("refreshing");
        setPullDistance(60);
        try {
          await reload();
          runThumbnailWorker();
          await new Promise((resolve) => setTimeout(resolve, 850));
        } catch (err) {
          console.error("Manual refresh failed:", err);
        } finally {
          setRefreshState("idle");
          setPullDistance(0);
        }
      } else {
        setRefreshState("idle");
        setPullDistance(0);
      }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      savedDashboardScrollTop = target.scrollTop;
      const viewportHeight = containerRef.current?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 800);
      const threshold = viewportHeight * 1.5;
      if (target.scrollTop > threshold) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    const scrollToTop = () => {
      if (containerRef.current) {
        triggerVibration("light");
        containerRef.current.scrollTo({
          top: 0,
          behavior: shouldReduceMotion ? "auto" : "smooth",
        });
        savedDashboardScrollTop = 0;
      }
    };

    // Zustand Store
    const setPosts = usePostStore((state) => state.setPosts);
    const toggleFavorite = usePostStore((state) => state.toggleFavorite);
    const reload = async () => {
      let freshPosts = await db.posts.toArray();
      let hasModified = false;
      freshPosts = freshPosts.map((p) => {
        if (!p.thumbnailUrl) {
          hasModified = true;
          return normalizeInstagramPost(p);
        }
        return p;
      });
      if (hasModified) {
        await db.posts.bulkPut(freshPosts);
      }
      setPosts(freshPosts);
    };

    const loadDemoData = async () => {
      setDemoLoading(true);
      try {
        await db.posts.bulkPut(SAMPLE_POSTS.map(normalizeInstagramPost));
        await reload();
      } catch (e) {
        console.error("Failed to load sample posts", e);
      } finally {
        setDemoLoading(false);
      }
    };

    // Perform full database backup export (including base64 offline thumbnails)
    const exportData = async () => {
      try {
        const allDbPosts = await db.posts.toArray();
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(allDbPosts));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute(
          "download",
          `instasorter_export_${new Date().toISOString().split("T")[0]}.json`,
        );
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      } catch (err) {
        console.error("Failed to export full database backup:", err);
        alert("Failed to export database backup.");
      }
    };

    // Bulk / multi-select actions
    const handleToggleSelectAll = () => {
      const allFilteredIds = filteredPosts.map((p) => p.id);
      const allSelected = allFilteredIds.every((id) =>
        selectedPostIds.includes(id),
      );

      if (allSelected) {
        // Deselect all matching posts
        allFilteredIds.forEach((id) => {
          if (selectedPostIds.includes(id)) {
            toggleSelectPost(id);
          }
        });
      } else {
        // Select all matching posts (up to a safe 200 items limit to prevent overload)
        const MAX_BATCH = 200;
        const idsToSelect = allFilteredIds.slice(0, MAX_BATCH);
        idsToSelect.forEach((id) => {
          if (!selectedPostIds.includes(id)) {
            toggleSelectPost(id);
          }
        });
        if (allFilteredIds.length > MAX_BATCH) {
          console.warn(
            `[Batch Selection] Limited batch selection to first ${MAX_BATCH} matching items.`,
          );
        }
      }
    };

    const handleBulkRescrape = async () => {
      if (selectedPostIds.length === 0) return;
      await Promise.all(
        selectedPostIds.map(async (id) => {
          await db.posts.update(id, {
            thumbnailStatus: "pending",
            thumbnailAttempts: 0,
          });
          usePostStore.getState().updatePost(id, {
            thumbnailStatus: "pending",
            thumbnailAttempts: 0,
          });
        }),
      );
      clearSelection();
      runThumbnailWorker();
    };

    const handleBulkDelete = async () => {
      if (selectedPostIds.length === 0) return;
      triggerVibration("light");
      const count = selectedPostIds.length;
      if (
        confirm(
          `Are you sure you want to permanently delete these ${count} selected posts from your library?`,
        )
      ) {
        triggerVibration("warning");
        try {
          await db.posts.bulkDelete(selectedPostIds);
          bulkDeleteSelected(); // updates store and clears selection
          toast.success(`Successfully deleted ${count} posts!`, {
            icon: "🗑️",
          });
        } catch (err) {
          console.error("Bulk delete failed", err);
          toast.error("Failed to delete selected posts.");
        }
      }
    };

    const sortOptions = useMemo(
      () => [
        { value: "savedAt", label: "Date Saved" },
        { value: "shuffle", label: "🎲 Shuffled / Forgotten Gems" },
        { value: "creatorUsername", label: "Creator Username" },
        { value: "mediaType", label: "Post Type / Format" },
        { value: "caption", label: "Caption Text" },
        { value: "commentsCount", label: "Engagement" },
        { value: "notesLength", label: "Notes Depth" },
        { value: "tagsLength", label: "Number of Tags" },
      ],
      [],
    );

    // Derive unique tags / collections / formats for filtering
    const allTags = useMemo(
      () => Array.from(new Set(posts.flatMap((p) => p.tags || []))),
      [posts],
    );
    const allCollections = useMemo(
      () => Array.from(new Set(posts.flatMap((p) => p.collections || []))),
      [posts],
    );
    const allMediaTypes = useMemo(
      () => Array.from(new Set(posts.map((p) => p.mediaType || "image"))),
      [posts],
    );

    const collectionCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      posts.forEach((p) => {
        (p.collections || []).forEach((c) => {
          counts[c] = (counts[c] || 0) + 1;
        });
      });
      return counts;
    }, [posts]);

    const pinnedCollections = usePostStore((state) => state.pinnedCollections);

    const collectionsList = useMemo(() => {
      return allCollections.map((name) => {
        const colPosts = posts.filter((p) => (p.collections || []).includes(name));
        return {
          name,
          posts: colPosts,
        };
      });
    }, [allCollections, posts]);

    const sortedCollections = useMemo(() => {
      let result = [...collectionsList];
      
      result.sort((a, b) => {
        const aPinned = pinnedCollections.includes(a.name) ? 1 : 0;
        const bPinned = pinnedCollections.includes(b.name) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        
        return a.name.localeCompare(b.name);
      });
      
      return result;
    }, [collectionsList, pinnedCollections]);

    const handleDatePreset = (
      preset: "today" | "7days" | "30days" | "thisyear" | "all",
    ) => {
      const today = new Date();
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      if (preset === "today") {
        setStartDate(formatDate(today));
        setEndDate(formatDate(today));
      } else if (preset === "7days") {
        const past = new Date();
        past.setDate(today.getDate() - 7);
        setStartDate(formatDate(past));
        setEndDate(formatDate(today));
      } else if (preset === "30days") {
        const past = new Date();
        past.setDate(today.getDate() - 30);
        setStartDate(formatDate(past));
        setEndDate(formatDate(today));
      } else if (preset === "thisyear") {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        setStartDate(formatDate(startOfYear));
        setEndDate(formatDate(today));
      } else {
        setStartDate("");
        setEndDate("");
      }
    };

    const filteredTagsInSidebar = useMemo(() => {
      if (!deferredTagSearchQuery) return allTags;
      return allTags.filter((t) =>
        t.toLowerCase().includes(deferredTagSearchQuery.toLowerCase()),
      );
    }, [allTags, deferredTagSearchQuery]);

    const filteredCollectionsInSidebar = useMemo(() => {
      if (!deferredCollectionSearchQuery) return allCollections;
      return allCollections.filter((c) =>
        c.toLowerCase().includes(deferredCollectionSearchQuery.toLowerCase()),
      );
    }, [allCollections, deferredCollectionSearchQuery]);

    // Fuse search
    const fuse = useMemo(
      () =>
        new Fuse(posts, {
          keys: [
            "caption",
            "creatorUsername",
            "notes",
            "hashtags",
            "tags",
            "collections",
          ],
          threshold: 0.3,
        }),
      [posts],
    );

    // Main filter/sort computation
    const filteredPosts = useMemo(() => {
      let result = posts;
      if (deferredSearchQuery) {
        const parsed = parseSearchQuery(deferredSearchQuery);
        if (parsed.isPrefix) {
          let tempResult = [...posts];
          parsed.prefixes.forEach(({ prefix, value }) => {
            const valLower = value.toLowerCase();
            if (
              prefix === "creator" ||
              prefix === "user" ||
              prefix === "author" ||
              prefix === "from"
            ) {
              tempResult = tempResult.filter((p) =>
                (p.creatorUsername || "").toLowerCase().includes(valLower) ||
                (p.creatorName || "").toLowerCase().includes(valLower)
              );
            } else if (prefix === "post" || prefix === "caption") {
              tempResult = tempResult.filter((p) =>
                (p.caption || "").toLowerCase().includes(valLower),
              );
            } else if (prefix === "tag" || prefix === "hashtag") {
              tempResult = tempResult.filter((p) => {
                const pTags = [...(p.tags || []), ...(p.hashtags || [])].map((t) => t.toLowerCase());
                return pTags.some((pt) => pt.includes(valLower));
              });
            } else if (prefix === "collection" || prefix === "folder") {
              tempResult = tempResult.filter((p) =>
                (p.collections || []).some((c) =>
                  c.toLowerCase().includes(valLower),
                ),
              );
            } else if (prefix === "is") {
              if (valLower === "favorite" || valLower === "starred") {
                tempResult = tempResult.filter((p) => p.isFavorite);
              } else if (valLower === "archived") {
                tempResult = tempResult.filter((p) => p.isArchived);
              } else if (valLower === "active" || valLower === "unarchived") {
                tempResult = tempResult.filter((p) => !p.isArchived);
              } else if (valLower === "reel") {
                tempResult = tempResult.filter((p) => p.isReel);
              } else if (valLower === "video") {
                tempResult = tempResult.filter((p) => p.mediaType === "video");
              } else if (valLower === "image") {
                tempResult = tempResult.filter((p) => p.mediaType === "image");
              } else if (valLower === "carousel") {
                tempResult = tempResult.filter((p) => p.mediaType === "carousel");
              } else if (valLower === "read-later" || valLower === "readlater") {
                tempResult = tempResult.filter((p) => p.readLater);
              } else if (valLower === "notes" || valLower === "has-notes") {
                tempResult = tempResult.filter((p) => p.notes && p.notes.trim().length > 0);
              } else if (valLower === "location" || valLower === "has-location") {
                tempResult = tempResult.filter((p) => p.location && p.location.trim().length > 0);
              }
            }
          });

          if (parsed.generalText) {
            const genLower = parsed.generalText.toLowerCase();
            tempResult = tempResult.filter((p) =>
              (p.caption || "").toLowerCase().includes(genLower) ||
              (p.creatorUsername || "").toLowerCase().includes(genLower) ||
              (p.creatorName || "").toLowerCase().includes(genLower) ||
              (p.notes || "").toLowerCase().includes(genLower)
            );
          }
          result = tempResult;
        } else {
          // Full-Text Inverted Search Index query execution
          const indexedMatches = searchPosts(deferredSearchQuery);
          if (indexedMatches !== null && indexedMatches.length > 0) {
            result = indexedMatches;
          } else {
            const valLower = deferredSearchQuery.toLowerCase();
            result = posts.filter((p) => {
              const matchesCreator =
                (p.creatorUsername || "").toLowerCase().includes(valLower) ||
                (p.creatorName || "").toLowerCase().includes(valLower);
              const matchesHashtags =
                (p.hashtags || []).some((h) => h.toLowerCase().includes(valLower)) ||
                (p.tags || []).some((t) => t.toLowerCase().includes(valLower));
              const matchesCaption = (p.caption || "").toLowerCase().includes(valLower);
              const matchesNotes = (p.notes || "").toLowerCase().includes(valLower);

              return matchesCreator || matchesHashtags || matchesCaption || matchesNotes;
            });
          }

          // Fallback to fuzzy search if no exact, synonym, or indexed matches found
          if (result.length === 0) {
            result = fuse.search(deferredSearchQuery).map((r) => r.item);
          }
        }
      }

      if (filterFavoriteOnly) {
        result = result.filter((p) => p.isFavorite);
      }

      if (filterArchived === "active") {
        result = result.filter((p) => !p.isArchived);
      } else if (filterArchived === "archived") {
        result = result.filter((p) => p.isArchived);
      }

      if (filterMediaType !== "all") {
        result = result.filter(
          (p) => (p.mediaType || "image") === filterMediaType,
        );
      }

      if (filterHasNotes) {
        result = result.filter((p) => p.notes && p.notes.trim().length > 0);
      }

      if (filterHasLocation) {
        result = result.filter(
          (p) => p.location && p.location.trim().length > 0,
        );
      }

      if (filterHasHashtags) {
        result = result.filter((p) => p.hashtags && p.hashtags.length > 0);
      }

      if (startDate) {
        result = result.filter(
          (p) => p.savedAt && new Date(p.savedAt) >= new Date(startDate),
        );
      }
      if (endDate) {
        result = result.filter(
          (p) => p.savedAt && new Date(p.savedAt) <= new Date(endDate),
        );
      }

      if (selectedTags.length > 0) {
        result = result.filter((p) =>
          selectedTags.every((t) => (p.tags || []).includes(t)),
        );
      }

      if (selectedCollections.length > 0) {
        result = result.filter((p) =>
          selectedCollections.every((c) => (p.collections || []).includes(c)),
        );
      }

      if (deferredCreatorFilter) {
        result = result.filter((p) =>
          (p.creatorUsername || "")
            .toLowerCase()
            .includes(deferredCreatorFilter.toLowerCase()),
        );
      }

      if (visibilityFilter === "visible") {
        result = result.filter((p) => p.visibility !== "hidden");
      } else if (visibilityFilter === "hidden") {
        result = result.filter((p) => p.visibility === "hidden");
      }

      const sorted = [...result];
      sorted.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "shuffle") {
          const scoreA = getPostShuffleScore(a, shuffleSeed);
          const scoreB = getPostShuffleScore(b, shuffleSeed);
          cmp = scoreB - scoreA;
        } else if (sortBy === "savedAt") {
          const timeA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
          const timeB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
          cmp = timeB - timeA;
        } else if (sortBy === "commentsCount") {
          const valA = a.comments?.length || 0;
          const valB = b.comments?.length || 0;
          cmp = valB - valA;
        } else if (sortBy === "notesLength") {
          const valA = a.notes?.length || 0;
          const valB = b.notes?.length || 0;
          cmp = valB - valA;
        } else if (sortBy === "tagsLength") {
          const valA = a.tags?.length || 0;
          const valB = b.tags?.length || 0;
          cmp = valB - valA;
        } else {
          const valA = (a[sortBy as keyof Post] as string) || "";
          const valB = (b[sortBy as keyof Post] as string) || "";
          cmp = valA.localeCompare(valB);
        }
        return sortOrder === "asc" ? -cmp : cmp;
      });

      return sorted;
    }, [
      posts,
      deferredSearchQuery,
      fuse,
      filterFavoriteOnly,
      filterArchived,
      filterMediaType,
      filterHasNotes,
      filterHasLocation,
      filterHasHashtags,
      startDate,
      endDate,
      selectedTags,
      selectedCollections,
      sortBy,
      sortOrder,
      shuffleSeed,
      visibilityFilter,
      deferredCreatorFilter,
    ]);

    const handleOpenFullscreen = useCallback((post: Post) => {
      const idx = filteredPosts.findIndex(p => p.id === post.id);
      setFullscreenIndex(idx >= 0 ? idx : 0);
    }, [filteredPosts]);

    const [visibleCount, setVisibleCount] = useState(48);

    const exportFilteredJSON = useCallback(() => {
      if (filteredPosts.length === 0) {
        toast.error("No posts to export!");
        return;
      }

      try {
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(filteredPosts, null, 2));
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute(
          "download",
          `instasorter_filtered_export_${new Date().toISOString().split("T")[0]}.json`,
        );
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success(`Successfully exported ${filteredPosts.length} posts as JSON!`);
      } catch (err) {
        console.error("Failed to export filtered posts:", err);
        toast.error("Failed to export posts.");
      }
    }, [filteredPosts]);

    const exportFilteredCSV = useCallback(() => {
      if (filteredPosts.length === 0) {
        toast.error("No posts to export!");
        return;
      }

      const escapeCSV = (val: any): string => {
        if (val === undefined || val === null) return "";
        let str = "";
        if (Array.isArray(val)) {
          str = val.join(";");
        } else {
          str = String(val);
        }
        const needsQuotes = str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r");
        if (needsQuotes) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const headers = [
        "ID",
        "Post URL",
        "Creator Username",
        "Creator Name",
        "Caption",
        "Media Type",
        "Saved At",
        "Hashtags",
        "Tags",
        "Collections",
        "Is Favorite",
        "Is Archived",
        "Read Later",
        "Is Reel",
        "Notes",
        "Location",
        "Instagram Likes"
      ];

      const csvRows = [headers.join(",")];

      filteredPosts.forEach((post) => {
        const row = [
          escapeCSV(post.id),
          escapeCSV(post.postUrl),
          escapeCSV(post.creatorUsername),
          escapeCSV(post.creatorName),
          escapeCSV(post.caption),
          escapeCSV(post.mediaType),
          escapeCSV(post.savedAt),
          escapeCSV(post.hashtags),
          escapeCSV(post.tags),
          escapeCSV(post.collections),
          escapeCSV(post.isFavorite),
          escapeCSV(post.isArchived),
          escapeCSV(post.readLater),
          escapeCSV(post.isReel),
          escapeCSV(post.notes),
          escapeCSV(post.location),
          escapeCSV(post.instagramLikes)
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = "\ufeff" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute(
        "download",
        `instasorter_filtered_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
      toast.success(`Successfully exported ${filteredPosts.length} posts as CSV!`);
    }, [filteredPosts]);

    useEffect(() => {
      setVisibleCount(48);
    }, [
      filteredPosts.length,
      filterFavoriteOnly,
      filterArchived,
      filterMediaType,
      filterHasNotes,
      filterHasLocation,
      filterHasHashtags,
      selectedTags,
      selectedCollections,
      sortBy,
      sortOrder,
      visibilityFilter,
      deferredCreatorFilter,
    ]);

    const visiblePosts = useMemo(() => {
      return filteredPosts.slice(0, visibleCount);
    }, [filteredPosts, visibleCount]);

    const filterKey = useMemo(() => {
      return [
        searchQuery,
        creatorFilter || "",
        filterFavoriteOnly ? "fav" : "all",
        filterArchived,
        filterMediaType,
        filterHasNotes ? "notes" : "no-notes",
        filterHasLocation ? "loc" : "no-loc",
        filterHasHashtags ? "tags" : "no-tags",
        selectedTags.join(","),
        selectedCollections.join(","),
        sortBy,
        sortOrder,
        visiblePosts.length
      ].join("|");
    }, [
      searchQuery,
      creatorFilter,
      filterFavoriteOnly,
      filterArchived,
      filterMediaType,
      filterHasNotes,
      filterHasLocation,
      filterHasHashtags,
      selectedTags,
      selectedCollections,
      sortBy,
      sortOrder,
      visiblePosts.length
    ]);

    // Library Stats Storage Estimation (JSON serialized posts representation in IndexedDB)
    const formattedPayloadSize = useMemo(() => {
      if (!posts || posts.length === 0) return "0 B";
      try {
        const jsonString = JSON.stringify(posts);
        const bytes = jsonString.length;
        if (bytes < 1024) return `${bytes} B`;
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
      } catch (e) {
        console.error("Payload size estimation error:", e);
        return "N/A";
      }
    }, [posts]);

    // Estimated disk storage usage from browser navigator API
    const [browserStorage, setBrowserStorage] = useState<{ usage: number; quota: number } | null>(null);

    useEffect(() => {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          setBrowserStorage({
            usage: est.usage || 0,
            quota: est.quota || 0,
          });
        }).catch((err) => {
          console.error("Storage estimation error:", err);
        });
      }
    }, [posts]);

    const formattedBrowserSize = useMemo(() => {
      if (!browserStorage || !browserStorage.usage) return null;
      const bytes = browserStorage.usage;
      if (bytes < 1024) return `${bytes} B`;
      const kb = bytes / 1024;
      if (kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      return `${mb.toFixed(1)} MB`;
    }, [browserStorage]);

    // Keyboard Navigation inside Main View
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          const active = document.activeElement;
          if (active && (active.tagName.toLowerCase() === "input" || active.tagName.toLowerCase() === "textarea")) {
            (active as HTMLElement).blur();
            return;
          }
          if (keyboardFocusedId) {
            setKeyboardFocusedId(null);
            return;
          }
        }
        
        // 1. Ignore when typing in an input/textarea
        const activeElement = document.activeElement;
        if (activeElement) {
          const tagName = activeElement.tagName.toLowerCase();
          const contentEditable = activeElement.getAttribute("contenteditable");
          if (
            tagName === "input" ||
            tagName === "textarea" ||
            contentEditable === "true" ||
            contentEditable === ""
          ) {
            return;
          }
        }
        // 1.5 Global shortcuts inside Dashboard View
        if (e.key === "/") {
          e.preventDefault();
          const searchInput = document.getElementById("curator-search-input");
          if (searchInput) searchInput.focus();
          return;
        }

        if (visiblePosts.length === 0) return;

        const currentIndex = keyboardFocusedId
          ? visiblePosts.findIndex((p) => p.id === keyboardFocusedId)
          : -1;

        switch (e.key) {
          case "ArrowRight":
          case "j":
          case "J": {
            e.preventDefault();
            const nextIndex =
              currentIndex < visiblePosts.length - 1 ? currentIndex + 1 : 0;
            const targetPost = visiblePosts[nextIndex];
            setKeyboardFocusedId(targetPost.id);
            // Scroll the item smoothly into view if needed
            const element = document.getElementById(
              `post-card-container-${targetPost.id}`,
            );
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            break;
          }
          case "ArrowLeft":
          case "k":
          case "K": {
            e.preventDefault();
            const prevIndex =
              currentIndex > 0 ? currentIndex - 1 : visiblePosts.length - 1;
            const targetPost = visiblePosts[prevIndex];
            setKeyboardFocusedId(targetPost.id);
            // Scroll item smoothly into view
            const element = document.getElementById(
              `post-card-container-${targetPost.id}`,
            );
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            break;
          }
          case "Enter":
          case " ": {
            if (keyboardFocusedId) {
              const post = visiblePosts.find((p) => p.id === keyboardFocusedId);
              if (post) {
                e.preventDefault();
                // Toggle selection for bulk actions
                toggleSelectPost(post.id);
              }
            }
            break;
          }
          case "f":
          case "F": {
            if (keyboardFocusedId) {
              const post = visiblePosts.find((p) => p.id === keyboardFocusedId);
              if (post) {
                e.preventDefault();
                const nextVal = !post.isFavorite;
                db.posts.update(post.id, { isFavorite: nextVal }).then(() => {
                  usePostStore.getState().toggleFavorite(post.id);
                  toast.success(nextVal ? "Starred post!" : "Unstarred post!");
                });
              }
            }
            break;
          }
          case "a":
          case "A": {
            if (keyboardFocusedId) {
              const post = visiblePosts.find((p) => p.id === keyboardFocusedId);
              if (post) {
                e.preventDefault();
                const nextVal = !post.isArchived;
                db.posts.update(post.id, { isArchived: nextVal }).then(() => {
                  usePostStore
                    .getState()
                    .updatePost(post.id, { isArchived: nextVal });
                  toast.success(nextVal ? "Archived post!" : "Restored post!");
                });
              }
            }
            break;
          }
          case "r":
          case "R": {
            if (keyboardFocusedId) {
              const post = visiblePosts.find((p) => p.id === keyboardFocusedId);
              if (post) {
                e.preventDefault();
                const nextVal = !post.readLater;
                db.posts.update(post.id, { readLater: nextVal }).then(() => {
                  usePostStore
                    .getState()
                    .updatePost(post.id, { readLater: nextVal });
                  toast.success(
                    nextVal
                      ? "Added to Read Later!"
                      : "Removed from Read Later!",
                  );
                });
              }
            }
            break;
          }
          case "c":
          case "C": {
            if (keyboardFocusedId) {
              const post = visiblePosts.find((p) => p.id === keyboardFocusedId);
              if (post && post.postUrl) {
                e.preventDefault();
                navigator.clipboard.writeText(post.postUrl).then(() => {
                  toast.success("Copied link!");
                });
              }
            }
            break;
          }
          default:
            break;
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [keyboardFocusedId, visiblePosts]);

    

    // IntersectionObserver to auto-load more items when scrolling to the bottom
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const target = observerTarget.current;
      if (!target) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCount((prev) => {
              if (prev < filteredPosts.length) {
                return prev + 24 < filteredPosts.length
                  ? prev + 24
                  : filteredPosts.length;
              }
              return prev;
            });
          }
        },
        {
          threshold: 0.05,
          rootMargin: "350px", // Preload when 350px away from viewport bottom for smooth seamless scrolling
        },
      );

      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }, [filteredPosts.length]);

    const handleToggleFavorite = async (
      postId: string,
      e: React.MouseEvent,
    ) => {
      e.stopPropagation();
      toggleFavorite(postId);
      const post = posts.find((p) => p.id === postId);
      if (post) {
        await db.posts.update(postId, { isFavorite: !post.isFavorite });
      }
    };

    const toggleSelect = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      toggleSelectPost(id);
    };

    const handleBulkAction = async (action: "archive" | "unarchive") => {
      const isArchived = action === "archive";
      await Promise.all(
        selectedPostIds.map((id: string) =>
          db.posts.update(id, { isArchived }),
        ),
      );
      reload();
      clearSelection();
    };

    const handleBulkCollection = async (
      action: "add" | "remove",
      collection: string,
    ) => {
      if (!collection) return;
      const count = selectedPostIds.length;
      if (count === 0) {
        toast.error("No posts selected to update collections.");
        return;
      }

      try {
        await Promise.all(
          selectedPostIds.map(async (id) => {
            const post = await db.posts.get(id);
            if (post) {
              const currentCollections = post.collections || [];
              let nextCollections: string[];
              if (action === "add") {
                nextCollections = Array.from(new Set([...currentCollections, collection]));
              } else {
                nextCollections = currentCollections.filter((c) => c !== collection);
              }
              await db.posts.update(id, { collections: nextCollections });
            }
          }),
        );

        if (action === "add") {
          bulkAddToCollection(collection);
          toast.success(`Successfully added ${count} posts to collection "${collection}"`, {
            icon: "📁",
          });
        } else {
          bulkRemoveFromCollection(collection);
          toast.success(`Successfully removed ${count} posts from collection "${collection}"`, {
            icon: "📁",
          });
        }
      } catch (err) {
        console.error("Bulk collection update failed", err);
        toast.error("Failed to update collections.");
      }
      setBulkCollection("");
    };

    const toggleTagFilter = (tag: string) => {
      setSelectedTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
      );
    };

    const toggleCollectionFilter = (col: string) => {
      setSelectedCollections((prev) =>
        prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
      );
    };

    const clearAllFilters = () => {
      setFilterFavoriteOnly(false);
      setFilterMediaType("all");
      setFilterHasNotes(false);
      setFilterHasLocation(false);
      setFilterHasHashtags(false);
      setStartDate("");
      setEndDate("");
      setSelectedTags([]);
      setSelectedCollections([]);
      setSearchQuery("");
      setVisibilityFilter("visible");
      if (setCreatorFilter) {
        setCreatorFilter("");
      }
    };

    const activeFiltersCount = useMemo(() => {
      let count = 0;
      if (filterFavoriteOnly !== initialFilterFavoriteOnly) count++;
      if (filterMediaType !== "all") count++;
      if (filterHasNotes) count++;
      if (filterHasLocation) count++;
      if (filterHasHashtags) count++;
      if (startDate) count++;
      if (endDate) count++;
      if (visibilityFilter !== "visible") count++;
      count += selectedTags.length;
      count += selectedCollections.length;
      return count;
    }, [
      filterFavoriteOnly,
      initialFilterFavoriteOnly,
      filterMediaType,
      filterHasNotes,
      filterHasLocation,
      filterHasHashtags,
      startDate,
      endDate,
      selectedTags,
      selectedCollections,
      visibilityFilter,
    ]);

    const hasActiveFilters = activeFiltersCount > 0 || searchQuery || !!creatorFilter;

    // Derive Header Info depending on active path view
    const viewInfo = useMemo(() => {
      if (initialFilterFavoriteOnly) {
        return {
          title: VOCABULARY.dashboard.filterFavorites,
          subtitle: "Browse your hand-picked, starred Instagram items.",
          icon: (
            <Heart size={24} className="text-m3-tertiary fill-m3-tertiary" />
          ),
          badgeBg: "bg-m3-tertiary-container text-m3-on-tertiary-container",
        };
      } else if (initialFilterArchived === "archived") {
        return {
          title: "Archive Vault",
          subtitle:
            "Tucked away items preserved for indexing and local lookup.",
          icon: <Archive size={24} className="text-m3-secondary" />,
          badgeBg: "bg-m3-secondary-container text-m3-on-secondary-container",
        };
      } else {
        return {
          title: VOCABULARY.dashboard.title,
          subtitle: VOCABULARY.dashboard.subtitle,
          icon: <Compass size={24} className="text-m3-primary" />,
          badgeBg: "bg-m3-primary-container text-m3-on-primary-container",
        };
      }
    }, [initialFilterFavoriteOnly, initialFilterArchived]);

    return (
      <div className="flex flex-1 min-h-0 overflow-hidden bg-m3-surface text-m3-on-surface relative">


        {/* Right Column / Primary Applet Dashboard Contents */}
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          {/* OPTIMIZED HEADER: A highly compact, single-row Material 3 Top App Bar */}
          <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-sm z-10 shrink-0 flex flex-col">
            <div className="px-4 md:px-6 py-2.5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {selectedPostIds.length > 0 ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-m3-on-surface bg-m3-primary-container/30 px-2.5 py-1 rounded-lg">
                      {selectedPostIds.length} selected
                    </span>
                    <button
                      onClick={() => usePostStore.getState().clearSelection()}
                      className="flex items-center gap-1 px-2.5 py-1 border border-m3-outline-variant/30 rounded-lg text-[11px] font-bold text-m3-on-surface hover:bg-m3-surface-variant/40 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[11px] font-bold hover:bg-red-200 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Delete Selected</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 py-1 shrink-0">
                    <h1 className="text-base sm:text-lg md:text-xl font-bold font-display tracking-tight text-m3-on-surface leading-none">
                      {viewInfo.title}
                    </h1>
                  </div>

                  {/* Right side: Compact layout selectors & unified Curator Bar Toggle */}
                  {posts.length > 0 && (
                    <div className="flex items-center gap-2 md:gap-3 flex-1 md:flex-initial justify-start md:justify-end ml-auto overflow-x-auto scrollbar-none pb-1 -mb-1 max-w-full select-none">
                      {/* Dashboard Search Input with Recent Search History & Presets */}
                      <div ref={searchHistoryRef} className="relative w-36 sm:w-48 md:w-60 lg:w-64 shrink-0">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-m3-outline">
                          <Search size={12} />
                        </span>
                        <input
                          id="curator-search-input"
                          placeholder="What are you looking for? (caption, tag, creator)"
                          value={localSearchQuery}
                          onChange={(e) => {
                            setLocalSearchQuery(e.target.value);
                            setIsSearchHistoryOpen(true);
                          }}
                          onFocus={() => setIsSearchHistoryOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value;
                              addToSearchHistory(val);
                              (e.target as HTMLInputElement).blur();
                              setIsSearchHistoryOpen(false);
                            }
                          }}
                          onBlur={(e) => {
                            // Only add to history if not clicking inside the history menu
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (!searchHistoryRef.current?.contains(relatedTarget)) {
                              addToSearchHistory(localSearchQuery);
                            }
                          }}
                          className="pl-7 pr-7 py-1 w-full border border-m3-outline-variant/30 bg-m3-surface-container-low text-m3-on-surface hover:border-m3-outline focus:border-m3-primary focus:bg-m3-surface rounded-lg text-[11px] focus:outline-none transition-all h-8 font-sans"
                        />
                        {localSearchQuery && (
                          <button
                            onClick={() => {
                              setLocalSearchQuery("");
                              setSearchQuery("");
                            }}
                            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-m3-outline hover:text-m3-on-surface transition-all cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}

                        {/* Recent Search History Dropdown Card */}
                        <AnimatePresence>
                          {isSearchHistoryOpen && searchHistory.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 5, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.98 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                              className="absolute top-full left-0 right-0 mt-1.5 bg-m3-surface border border-m3-outline-variant/40 rounded-xl shadow-lg p-2.5 z-50 flex flex-col gap-1.5 min-w-[220px]"
                            >
                              <div className="flex items-center justify-between px-1.5 pb-1 border-b border-m3-outline-variant/15">
                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-m3-outline font-mono flex items-center gap-1">
                                  <History size={10} />
                                  Recent Searches
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearSearchHistory();
                                  }}
                                  className="text-[9px] font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer select-none px-1.5 py-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20"
                                >
                                  Clear All
                                </button>
                              </div>
                              <div className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5 no-scrollbar">
                                {searchHistory.map((query, index) => (
                                  <div
                                    key={`${query}-${index}`}
                                    className="group/item flex items-center justify-between rounded-lg hover:bg-m3-surface-variant/40 transition-colors duration-150 pl-2 pr-1 py-1 cursor-pointer"
                                    onMouseDown={(e) => {
                                      // Prevent input blur from triggering before the click event can execute
                                      e.preventDefault();
                                    }}
                                    onClick={() => {
                                      setLocalSearchQuery(query);
                                      setSearchQuery(query);
                                      addToSearchHistory(query);
                                      setIsSearchHistoryOpen(false);
                                      triggerVibration("light");
                                    }}
                                  >
                                    <span className="text-[11px] font-sans text-m3-on-surface truncate pr-2 flex items-center gap-2">
                                      <Search size={10} className="text-m3-outline group-hover/item:text-m3-primary transition-colors" />
                                      {query}
                                    </span>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromSearchHistory(query);
                                        triggerVibration("light");
                                      }}
                                      className="p-1 rounded-md text-m3-outline hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all opacity-0 group-hover/item:opacity-100 cursor-pointer"
                                      title="Remove from history"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>



                      {/* Unified Curator Bar Toggle Button */}
                      <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`flex items-center gap-1.5 px-4 md:px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer h-11 md:h-8 ${
                          isSidebarOpen
                            ? "bg-m3-primary border-m3-primary text-m3-on-primary"
                            : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                        }`}
                        title="Toggle Curator Bar Search & Filters"
                      >
                        <SlidersHorizontal size={13} />
                        <span className="hidden sm:inline">Curator Bar</span>
                        {hasActiveFilters && (
                          <span className={`w-1.5 h-1.5 rounded-full ${isSidebarOpen ? "bg-white" : "bg-m3-primary"} shrink-0`} />
                        )}
                      </button>

                      {/* Shuffle Button */}
                      <button
                        onClick={handleShuffleFeed}
                        className={`flex items-center gap-1.5 px-4 md:px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer h-11 md:h-8 active:scale-95 ${
                          sortBy === "shuffle"
                            ? "bg-amber-500 border-amber-500 text-stone-950 shadow-xs font-bold"
                            : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                        }`}
                        title="Shuffle post feed using a deterministic forgotten-gems algorithm"
                      >
                        <Shuffle size={13} className={isShuffling ? "animate-spin" : ""} />
                        <span className="hidden sm:inline">Shuffle</span>
                        {sortBy === "shuffle" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-950 shrink-0" />
                        )}
                      </button>

                      {/* Immersive View Mode Toggle Button */}
                      <button
                        onClick={() => setIsImmersive(!isImmersive)}
                        className={`flex items-center gap-1.5 px-4 md:px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer h-11 md:h-8 ${
                          isImmersive
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                            : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                        }`}
                        title="Toggle Immersive Mode (Hides non-essential metadata for clean high-res media browsing)"
                      >
                        <Eye size={13} />
                        <span className="hidden sm:inline">Immersive</span>
                        {isImmersive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0 animate-pulse" />
                        )}
                      </button>

                      {/* Layout Selector */}
                      <div className="flex items-center bg-m3-surface-variant/20 border border-m3-outline-variant/20 rounded-lg p-0.5 shrink-0 h-11 md:h-8 relative z-0">
                        <button
                          onClick={() => setGridDensity("single")}
                          className={`relative flex items-center justify-center w-10 h-9 md:w-8 md:h-7 rounded-md transition-colors duration-300 cursor-pointer ${
                            gridDensity === "single"
                              ? "text-m3-on-primary font-bold"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/20"
                          }`}
                          title="Single column feed (Instagram style)"
                        >
                          {gridDensity === "single" && (
                            <motion.div
                              layoutId="active-density-bg"
                              className="absolute inset-0 bg-m3-primary rounded-md shadow-xs -z-10"
                              transition={shouldReduceMotion ? { duration: 0.05 } : { type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <Smartphone size={14} className="relative z-10" />
                        </button>
                        <button
                          onClick={() => setGridDensity("double")}
                          className={`relative flex items-center justify-center w-10 h-9 md:w-8 md:h-7 rounded-md transition-colors duration-300 cursor-pointer ${
                            gridDensity === "double"
                              ? "text-m3-on-primary font-bold"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/20"
                          }`}
                          title="Two-column masonry grid"
                        >
                          {gridDensity === "double" && (
                            <motion.div
                              layoutId="active-density-bg"
                              className="absolute inset-0 bg-m3-primary rounded-md shadow-xs -z-10"
                              transition={shouldReduceMotion ? { duration: 0.05 } : { type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <LayoutGrid size={14} className="relative z-10" />
                        </button>
                        <button
                          onClick={() => setGridDensity("list")}
                          className={`relative flex items-center justify-center w-10 h-9 md:w-8 md:h-7 rounded-md transition-colors duration-300 cursor-pointer ${
                            gridDensity === "list"
                              ? "text-m3-on-primary font-bold"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/20"
                          }`}
                          title="Compact list layout"
                        >
                          {gridDensity === "list" && (
                            <motion.div
                              layoutId="active-density-bg"
                              className="absolute inset-0 bg-m3-primary rounded-md shadow-xs -z-10"
                              transition={shouldReduceMotion ? { duration: 0.05 } : { type: "spring", stiffness: 380, damping: 30 }}
                            />
                          )}
                          <List size={14} className="relative z-10" />
                        </button>
                      </div>

                      {/* Active Sort Label on big screens */}
                      <div className="hidden xl:flex items-center gap-1 text-[11px] text-m3-on-surface-variant shrink-0 select-none">
                        <span className="font-semibold text-m3-outline">Sorted:</span>
                        <span className="font-bold text-m3-primary bg-m3-primary-container/10 px-1.5 py-0.5 rounded-md capitalize">
                          {sortBy === "savedAt" && "Date Saved"}
                          {sortBy === "shuffle" && "Shuffled Gems"}
                          {sortBy === "creatorUsername" && "Creator"}
                          {sortBy === "mediaType" && "Post Type"}
                          {sortBy === "caption" && "Caption"}
                          {sortBy === "commentsCount" && "Engagement"}
                          {sortBy === "notesLength" && "Notes"}
                          {sortBy === "tagsLength" && `Tags (${sortOrder})`}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </header>

          {/* Collapsible Unified Curator Bar Panel */}
          <AnimatePresence>
            {isSidebarOpen && posts.length > 0 && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={shouldReduceMotion ? { duration: 0.05 } : { duration: 0.2, ease: "easeInOut" }}
                className="border-b border-m3-outline-variant/40 bg-m3-surface-low shadow-xs overflow-hidden z-10 shrink-0"
              >
                <div className="px-4 md:px-6 py-4 flex flex-col gap-4 select-none">
                  {/* Row 1: Format Quick Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-m3-outline-variant/10 pb-3">
                    <span className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1.5 pl-1">
                      <Layers size={13} />
                      <span>Filter by Media Format</span>
                    </span>

                    {/* Quick Media Format Selector Chips */}
                    <div className="flex items-center gap-1 bg-m3-surface border border-m3-outline-variant/20 rounded-xl p-1 shadow-glass-sm overflow-x-auto shrink-0 scrollbar-none">
                      {[
                        { id: "all", label: "All Formats" },
                        { id: "photo", label: "Photos" },
                        { id: "video", label: "Videos" },
                        { id: "carousel", label: "Carousels" },
                        { id: "thread", label: "Threads" },
                      ].map((fmt) => {
                        const isSel = filterMediaType === fmt.id;
                        return (
                          <button
                            key={fmt.id}
                            onClick={() => setFilterMediaType(fmt.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                              isSel
                                ? "bg-m3-primary text-m3-on-primary font-bold shadow-xs"
                                : "text-m3-on-surface-variant hover:bg-m3-surface-variant/30"
                            }`}
                          >
                            {fmt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 2: Bento Columns Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3.5 border-t border-m3-outline-variant/10">
                    {/* Card 1: Sort Settings */}
                    <div className="flex flex-col gap-2 bg-m3-surface-container/35 p-3 rounded-2xl border border-m3-outline-variant/10">
                      <span className="text-[10px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
                        <SlidersHorizontal size={11} />
                        <span>Sort Settings</span>
                      </span>
                      <div className="flex gap-2">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-m3-surface text-m3-on-surface border border-m3-outline-variant/30 rounded-xl focus:border-m3-primary focus:outline-none cursor-pointer"
                        >
                          {sortOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                          className="px-2.5 bg-m3-surface border border-m3-outline-variant/30 rounded-xl text-m3-on-surface-variant hover:text-m3-on-surface transition-colors cursor-pointer flex items-center justify-center"
                          title={sortOrder === "desc" ? "Sort Descending" : "Sort Ascending"}
                        >
                          {sortOrder === "desc" ? (
                            <ChevronDown size={14} className="stroke-[2.5]" />
                          ) : (
                            <ChevronUp size={14} className="stroke-[2.5]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Card 2: Saved Period Range */}
                    <div className="flex flex-col gap-2 bg-m3-surface-container/35 p-3 rounded-2xl border border-m3-outline-variant/10">
                      <span className="text-[10px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
                        <Calendar size={11} />
                        <span>Saved Period</span>
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="px-2.5 py-1 text-[11px] text-m3-on-surface-variant bg-m3-surface rounded-xl border border-m3-outline-variant/30 focus:border-m3-primary focus:outline-none"
                          placeholder="From"
                        />
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="px-2.5 py-1 text-[11px] text-m3-on-surface-variant bg-m3-surface rounded-xl border border-m3-outline-variant/30 focus:border-m3-primary focus:outline-none"
                          placeholder="To"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: "all", label: "All" },
                          { id: "today", label: "Today" },
                          { id: "7days", label: "7d" },
                          { id: "30days", label: "30d" },
                          { id: "thisyear", label: "Yr" },
                        ].map((preset) => {
                          let isActive = false;
                          const todayStr = new Date().toISOString().split("T")[0];
                          if (preset.id === "all" && !startDate && !endDate) isActive = true;
                          else if (preset.id === "today" && startDate === todayStr && endDate === todayStr) isActive = true;
                          else if (preset.id === "7days") {
                            const sevenDaysAgo = new Date();
                            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                            const sevenStr = sevenDaysAgo.toISOString().split("T")[0];
                            if (startDate === sevenStr && endDate === todayStr) isActive = true;
                          } else if (preset.id === "30days") {
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            const thirtyStr = thirtyDaysAgo.toISOString().split("T")[0];
                            if (startDate === thirtyStr && endDate === todayStr) isActive = true;
                          } else if (preset.id === "thisyear") {
                            const yrStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
                            if (startDate === yrStart && endDate === todayStr) isActive = true;
                          }
                          return (
                            <button
                              key={preset.id}
                              onClick={() => handleDatePreset(preset.id as any)}
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                isActive
                                  ? "bg-m3-primary/15 border-m3-primary/30 text-m3-primary"
                                  : "bg-m3-surface border-m3-outline-variant/20 text-m3-on-surface-variant hover:bg-m3-surface-variant/15"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 3: Refined Flags */}
                    <div className="flex flex-col gap-2 bg-m3-surface-container/35 p-3 rounded-2xl border border-m3-outline-variant/10">
                      <span className="text-[10px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
                        <Sparkles size={11} className="text-m3-primary" />
                        <span>Refined Flags</span>
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setFilterFavoriteOnly(!filterFavoriteOnly)}
                          className={`px-2 py-1 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            filterFavoriteOnly
                              ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container shadow-xs"
                              : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/30"
                          }`}
                        >
                          <Heart size={10} fill={filterFavoriteOnly ? "currentColor" : "none"} />
                          <span>Starred</span>
                        </button>

                        <button
                          onClick={() => setFilterHasNotes(!filterHasNotes)}
                          className={`px-2 py-1 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            filterHasNotes
                              ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container shadow-xs"
                              : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/30"
                          }`}
                        >
                          <BookOpen size={10} />
                          <span>Notes</span>
                        </button>

                        <button
                          onClick={() => setFilterHasLocation(!filterHasLocation)}
                          className={`px-2 py-1 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            filterHasLocation
                              ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container shadow-xs"
                              : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/30"
                          }`}
                        >
                          <Compass size={10} />
                          <span>Location</span>
                        </button>

                        <button
                          onClick={() => setFilterHasHashtags(!filterHasHashtags)}
                          className={`px-2 py-1 border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            filterHasHashtags
                              ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container shadow-xs"
                              : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/30"
                          }`}
                        >
                          <Hash size={10} />
                          <span>Hashtag</span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1 border-t border-m3-outline-variant/20 pt-2 w-full">
                        <span className="text-[9px] font-mono tracking-wider text-m3-outline uppercase flex items-center gap-1 pl-1">
                          <Eye size={9} className="text-m3-primary" />
                          <span>Post Visibility {hiddenCount > 0 && <span className="text-red-500 font-extrabold font-sans normal-case animate-pulse ml-1">• {hiddenCount} Hidden</span>}</span>
                        </span>
                        <div className="grid grid-cols-3 gap-1 bg-m3-surface-variant/25 p-0.5 rounded-lg border border-m3-outline-variant/10">
                          {(["all", "visible", "hidden"] as const).map((mode) => {
                            const isActive = visibilityFilter === mode;
                            let label = "All";
                            if (mode === "visible") label = "Visible";
                            if (mode === "hidden") label = "Hidden";
                            return (
                              <button
                                key={mode}
                                onClick={() => setVisibilityFilter(mode)}
                                className={`py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center ${
                                  isActive
                                    ? "bg-m3-surface text-m3-on-surface shadow-xs font-extrabold border border-m3-outline-variant/25"
                                    : "text-m3-on-surface-variant hover:bg-m3-surface-variant/15 font-medium border border-transparent"
                                }`}
                                title={
                                  mode === "all"
                                    ? "Show all posts"
                                    : mode === "visible"
                                    ? "Show visible posts only"
                                    : "Show hidden posts only"
                                }
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Tags & Collections Lists */}
                    <div className="flex flex-col gap-2 bg-m3-surface-container/35 p-3 rounded-2xl border border-m3-outline-variant/10 max-h-[140px] overflow-hidden">
                      <div className="flex items-center justify-between text-[10px] font-bold text-m3-outline uppercase tracking-wider pl-1 shrink-0">
                        <span className="flex items-center gap-1">
                          <Tag size={10} />
                          <span>Tags &amp; Colls</span>
                        </span>
                        {allTags.length > 3 && (
                          <input
                            placeholder="Filter..."
                            value={tagSearchQuery}
                            onChange={(e) => setTagSearchQuery(e.target.value)}
                            className="px-1.5 py-0.5 text-[9px] w-20 border border-m3-outline-variant/20 bg-m3-surface text-m3-on-surface rounded-md focus:outline-none"
                          />
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
                        <div className="flex flex-wrap gap-1">
                          {filteredTagsInSidebar.slice(0, 15).map((tag) => {
                            const isSelected = selectedTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                onClick={() => toggleTagFilter(tag)}
                                className={`px-2 py-0.5 rounded-lg text-[9px] font-semibold border flex items-center gap-0.5 transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container font-bold"
                                    : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                                }`}
                              >
                                <span>#{tag}</span>
                              </button>
                            );
                          })}
                          {filteredCollectionsInSidebar.slice(0, 10).map((col) => {
                            const isSelected = selectedCollections.includes(col);
                            return (
                              <button
                                key={col}
                                onClick={() => toggleCollectionFilter(col)}
                                className={`px-2 py-0.5 rounded-lg text-[9px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary font-bold"
                                    : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                                }`}
                              >
                                <Folder size={8} />
                                <span className="truncate max-w-[50px]">{col}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Smart Rules Management shortcut trigger */}
                  <div className="flex justify-between items-center border-t border-m3-outline-variant/10 pt-3 text-[11px] shrink-0">
                    <span className="text-m3-outline flex items-center gap-1">
                      <Sparkles size={11} className="text-m3-primary animate-pulse" />
                      <span>Configure automated curation &amp; smart categorizer rule set:</span>
                    </span>
                    <SmartRulesManager />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filters Toolbar */}
          {posts.length > 0 && hasActiveFilters && (
            <LayoutGroup id="active-filters-bar">
              <motion.div
                layout={!shouldReduceMotion}
                className="px-6 py-2 bg-m3-surface-container-lowest/40 border-b border-m3-outline-variant/10 flex flex-wrap items-center gap-1.5 text-xs shrink-0 select-none overflow-hidden"
              >
                <motion.span
                  layout={!shouldReduceMotion}
                  key="title-label"
                  className="text-[10px] font-bold text-m3-outline uppercase tracking-wider mr-1"
                >
                  Active Search Filters:
                </motion.span>

                <AnimatePresence mode="popLayout">
                  {searchQuery && (
                    <motion.span
                      layout
                      key="query"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface text-[11px] font-medium"
                    >
                      <span className="text-m3-outline text-[10px]">Query:</span>
                      <span>"{searchQuery}"</span>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {creatorFilter && (
                    <motion.span
                      layout
                      key="creator"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface text-[11px] font-medium"
                    >
                      <span className="text-m3-outline text-[10px]">User:</span>
                      <span>@{creatorFilter}</span>
                      <button
                        onClick={() => setCreatorFilter("")}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {selectedTags.map((tag) => (
                    <motion.span
                      layout
                      key={`tag-${tag}`}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/20 text-[11px] font-semibold"
                    >
                      <span>#{tag}</span>
                      <button
                        onClick={() => toggleTagFilter(tag)}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-on-primary-container/60 hover:text-red-500 rounded-full transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  ))}

                  {selectedCollections.map((col) => (
                    <motion.span
                      layout
                      key={`col-${col}`}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-secondary-container text-m3-on-secondary-container border border-m3-secondary/20 text-[11px] font-semibold"
                    >
                      <Folder size={10} className="text-m3-secondary" />
                      <span>{col}</span>
                      <button
                        onClick={() => toggleCollectionFilter(col)}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-on-secondary-container/60 hover:text-red-500 rounded-full transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  ))}

                  {(startDate || endDate) && (
                    <motion.span
                      layout
                      key="dates"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/30 text-m3-on-surface text-[11px] font-medium"
                    >
                      <Calendar size={10} className="text-m3-outline" />
                      <span>
                        {startDate && endDate
                          ? `${startDate} to ${endDate}`
                          : startDate
                            ? `Since ${startDate}`
                            : `Until ${endDate}`}
                      </span>
                      <button
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {filterMediaType !== "all" && (
                    <motion.span
                      layout
                      key="mediaType"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface capitalize text-[11px] font-medium"
                    >
                      <span className="text-m3-outline text-[10px]">Format:</span>
                      <span>{filterMediaType}</span>
                      <button
                        onClick={() => setFilterMediaType("all")}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {filterFavoriteOnly && (
                    <motion.span
                      layout
                      key="favorite"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-tertiary-container text-m3-on-tertiary-container border border-m3-tertiary-container/30 text-[11px] font-semibold"
                    >
                      <Heart
                        size={10}
                        fill="currentColor"
                        className="text-m3-tertiary"
                      />
                      <span>Starred Only</span>
                      <button
                        onClick={() => setFilterFavoriteOnly(false)}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-on-tertiary-container/60 hover:text-red-500 rounded-full transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {filterHasNotes && (
                    <motion.span
                      layout
                      key="hasNotes"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface text-[11px] font-medium"
                    >
                      <MessageCircle size={10} className="text-m3-outline" />
                      <span>Has Notes</span>
                      <button
                        onClick={() => setFilterHasNotes(false)}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {filterHasLocation && (
                    <motion.span
                      layout
                      key="hasLocation"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface text-[11px] font-medium"
                    >
                      <MapPin size={10} className="text-m3-outline" />
                      <span>Has Location</span>
                      <button
                        onClick={() => setFilterHasLocation(false)}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {filterHasHashtags && (
                    <motion.span
                      layout
                      key="hasHashtags"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface text-[11px] font-medium"
                    >
                      <Hash size={10} className="text-m3-outline" />
                      <span>Has Hashtags</span>
                      <button
                        onClick={() => setFilterHasHashtags(false)}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}

                  {visibilityFilter !== "visible" && (
                    <motion.span
                      layout
                      key="visibilityFilterChip"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 450, damping: 28 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-primary/10 text-m3-primary border border-m3-primary/20 text-[11px] font-semibold"
                    >
                      <Eye size={10} className="text-m3-primary" />
                      <span>{visibilityFilter === "hidden" ? "Hidden Only" : "All Posts"}</span>
                      <button
                        onClick={() => setVisibilityFilter("visible")}
                        className="p-1.5 sm:p-0.5 -mr-1 text-m3-primary/70 hover:text-m3-primary hover:bg-m3-primary/10 rounded-full transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </motion.span>
                  )}
                </AnimatePresence>

                <motion.button
                  layout
                  key="clear-all-button"
                  onClick={clearAllFilters}
                  className="text-[10px] text-m3-primary hover:text-m3-primary/80 font-bold uppercase tracking-wider ml-auto hover:underline cursor-pointer p-2 sm:p-0 -m-2 sm:m-0"
                >
                  Clear All
                </motion.button>
              </motion.div>
            </LayoutGroup>
          )}

          {/* Dashboard Catalog Content Panel */}
          <div
            ref={setContainerRef}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-6 bg-m3-surface/40 relative"
          >
            {/* Pull to Refresh Dynamic Indicator Overlay */}
            {(pullDistance > 0 || refreshState === "refreshing") && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    y:
                      refreshState === "refreshing"
                        ? 24
                        : pullDistance < 60
                          ? pullDistance
                          : 60,
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="bg-m3-surface-low text-m3-primary border border-m3-outline-variant/30 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold backdrop-blur-md"
                >
                  <RefreshCw
                    size={13}
                    className={`text-m3-primary ${
                      refreshState === "refreshing" ? "animate-spin" : ""
                    }`}
                    style={{
                      transform:
                        refreshState === "refreshing"
                          ? undefined
                          : `rotate(${pullDistance * 4}deg)`,
                    }}
                  />
                  <span>
                    {refreshState === "refreshing"
                      ? "Refreshing feed..."
                      : refreshState === "ready"
                        ? "Release to refresh"
                        : "Pull to refresh"}
                  </span>
                </motion.div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading-skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={gridDensity !== "list" ? { gridTemplateColumns: `repeat(${masonryColumns}, minmax(0, 1fr))` } : undefined}
                  className={
                    gridDensity === "single"
                      ? "grid gap-8 max-w-7xl mx-auto w-full"
                      : gridDensity === "double"
                        ? "grid gap-4 w-full"
                        : "flex flex-col divide-y divide-m3-outline-variant/15 max-w-4xl mx-auto w-full bg-m3-surface border border-m3-outline-variant/40 shadow-sm rounded-xl overflow-hidden shadow-sm"
                  }
                >
                  {gridDensity === "list"
                    ? Array.from({ length: 8 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 bg-m3-surface animate-pulse"
                        >
                          <div className="w-10 h-10 rounded-md bg-m3-surface-variant/50 shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-2.5 bg-m3-surface-variant/60 rounded w-1/4 animate-pulse" />
                            <div className="h-3 bg-m3-surface-variant/40 rounded w-3/4 animate-pulse" />
                          </div>
                        </div>
                      ))
                    : Array.from({ length: 8 }).map((_, idx) => (
                        <div key={idx} className="w-full">
                          <PostCardSkeleton index={idx} />
                        </div>
                      ))}
                </motion.div>
              ) : posts.length === 0 ? (
                <EmptyState
                  title="Welcome to Instasorter"
                  message="Your high-efficiency offline-first curator space is empty. Import your personal Instagram data export file (JSON/ZIP) to index, search, and sort your saved bookmarks offline."
                  illustrationSrc={emptyDashboardImg}
                  illustrationAlt="Empty Curator Space Illustration"
                  action={
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        usePostStore.getState().setIsImportModalOpen(true)
                      }
                      className="px-6 py-3 rounded-2xl bg-m3-primary text-m3-on-primary font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:bg-opacity-90 active:scale-95 transition-all"
                    >
                      <Upload size={14} />
                      <span>Import Personal Data</span>
                    </motion.button>
                  }
                />
              ) : dashboardTab === "collections" && selectedCollections.length === 0 ? (
                /* RENDER THE DETAILED COLLECTIONS GRID AT PARENT LEVEL IN MAIN AREA */
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="w-full"
                >
                  {sortedCollections.length === 0 ? (
                    <EmptyState
                      title="No collections created yet"
                      message="Add items to a collection using post context menus or active curation tools to organize your saved media."
                      illustrationSrc={emptySearchImg}
                      illustrationAlt="Empty Collections Illustration"
                    />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 max-w-7xl mx-auto w-full">
                      {sortedCollections.map((col) => (
                        <LocalGroupCard
                          key={col.name}
                          name={col.name}
                          posts={col.posts}
                          onClick={() => {
                            setSelectedCollections([col.name]);
                            setDashboardTab("feed");
                            triggerVibration("medium");
                          }}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : filteredPosts.length === 0 ? (
                /* FILTERS RETURNED EMPTY STATE */
                <EmptyState
                  title="No results match your search"
                  message="We couldn't find any posts matching your search criteria or active filters. Try adjusting your search query or clearing active filters."
                  illustrationSrc={emptySearchImg}
                  illustrationAlt="No Matching Search Results Illustration"
                  action={
                    <button
                      onClick={clearAllFilters}
                      className="px-6 py-2.5 bg-m3-primary text-m3-on-primary font-bold text-xs rounded-full shadow-xs hover:shadow-md hover:scale-[1.02] transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 mx-auto border border-m3-outline-variant/20"
                    >
                      <RotateCcw size={14} className="shrink-0" />
                      <span>Clear Search & All Filters</span>
                    </button>
                  }
                />
              ) : (
                <>
                  {/* <DashboardAnalytics posts={posts} /> */}



                  {/* CONTENT VIEWS */}
                  <LayoutGroup id="dashboard-post-grid">
                    <motion.div
                      layout={!shouldReduceMotion}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.05 }
                          : { layout: { type: "spring", stiffness: 280, damping: 28 } }
                      }
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.03 } },
                      }}
                      className="w-full"
                    >
                      {gridDensity === "list" ? (
                        <Virtuoso
                          key={`virtuoso-list-${gridDensity}`}
                          customScrollParent={scrollElement || undefined}
                          data={chunkArray(visiblePosts, 1)}
                          itemContent={(index, row) => {
                            if (gridDensity === "list") {
                              return (
                                <motion.div
                                  layout={!shouldReduceMotion}
                                  transition={
                                    shouldReduceMotion
                                      ? { duration: 0.05 }
                                      : { layout: { type: "spring", stiffness: 280, damping: 28 } }
                                  }
                                  className="flex flex-col w-full max-w-4xl mx-auto bg-m3-surface border-x border-b border-m3-outline-variant/40 first:border-t first:rounded-t-xl last:rounded-b-xl shadow-sm"
                                >
                                  {row.map((post) => {
                                    const fullPost = post;
                                    const isVideo =
                                      fullPost.mediaType === "video" ||
                                      (fullPost.postUrl &&
                                        fullPost.postUrl.includes("/reel/"));
                                    const formattedDate = fullPost.savedAt
                                      ? new Date(fullPost.savedAt).toLocaleDateString(
                                          undefined,
                                          {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          },
                                        )
                                      : "";
                                    const isKeyboardFocused =
                                      keyboardFocusedId === post.id;
                                    return (
                                      <motion.div
                                        key={`${filterKey}-${post.id}`}
                                        layout
                                        id={`post-card-container-${post.id}`}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                          layout: { type: "spring", stiffness: 280, damping: 28 },
                                          type: "spring",
                                          stiffness: 260,
                                          damping: 24,
                                          delay: Math.min(index * 0.012, 0.25),
                                        }}
                                      >
                                        <motion.div
                                          layoutId={`post-card-${post.id}`}
                                          layout
                                          onClick={() => handleOpenFullscreen(post)}
                                          onMouseEnter={() =>
                                            setKeyboardFocusedId(post.id)
                                          }
                                          whileHover={{
                                            y: -3,
                                            scale: 1.012,
                                            boxShadow:
                                              "0 10px 20px -5px rgba(0, 0, 0, 0.05), 0 8px 8px -6px rgba(0, 0, 0, 0.05)",
                                          }}
                                          whileTap={{ scale: 0.992 }}
                                          transition={{
                                            layout: { type: "spring", stiffness: 280, damping: 28 },
                                            default: { type: "spring", stiffness: 400, damping: 22 }
                                          }}
                                          className={`group flex items-center gap-3 sm:gap-4 p-2 sm:p-3 transition-all duration-300 cursor-pointer relative hover:scale-[1.01] hover:shadow-md hover:z-10 hover:bg-m3-surface rounded-xl ${
                                            selectedPostIds.includes(post.id)
                                              ? "bg-m3-primary-container/20"
                                              : isKeyboardFocused
                                                ? "bg-m3-primary-container/10"
                                                : "bg-transparent"
                                          }`}>
                                                                  {/* Checkbox for Select */}
                                          <motion.div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleSelect(post.id, e);
                                            }}
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.9 }}
                                            animate={selectedPostIds.includes(post.id) ? { scale: [0.95, 1.15, 1.05, 1] } : { scale: 1 }}
                                            transition={{ type: "spring", stiffness: 420, damping: 16 }}
                                            className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                                              selectedPostIds.includes(post.id)
                                                ? "bg-m3-primary border-m3-primary text-m3-on-primary"
                                                : "bg-black/35 border-white/40 text-transparent opacity-0 group-hover:opacity-100"
                                            }`}
                                          >
                                            <motion.div
                                              initial={{ scale: 0 }}
                                              animate={selectedPostIds.includes(post.id) ? { scale: 1 } : { scale: 0 }}
                                              transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                            >
                                              <Check size={11} className="stroke-[3]" />
                                            </motion.div>
                                          </motion.div>
                                          {/* Thumbnail */}
                                          <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-m3-surface-low border border-m3-outline-variant/10 relative">
                                            <InstagramImage
                                              post={fullPost}
                                              src={fullPost.thumbnailUrl || ""}
                                              alt={fullPost.caption || "Thumbnail"}
                                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            {/* Overlay video indicator */}
                                            {isVideo && (
                                              <div className="absolute right-1 bottom-1 px-1 py-0.5 rounded-sm text-[8px] font-extrabold tracking-wider bg-black/55 text-white flex items-center gap-0.5 z-10">
                                                <Film
                                                  size={8}
                                                  className="text-m3-primary"
                                                />
                                              </div>
                                            )}
                                          </div>
                                          {/* Details */}
                                          <div className="flex-1 min-w-0 pr-2">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                              <span
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (fullPost.creatorUsername)
                                                    setCreatorFilter(
                                                      fullPost.creatorUsername,
                                                    );
                                                }}
                                                className="text-xs font-bold text-m3-primary hover:underline"
                                              >
                                                @{highlightText(fullPost.creatorUsername || "creator", "creator")}
                                              </span>
                                              {formattedDate && (
                                                <>
                                                  <span className="text-[10px] text-m3-outline-variant">
                                                    •
                                                  </span>
                                                  <span className="text-[10px] font-medium text-m3-on-surface-variant/70 flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    {formattedDate}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                            <p className="text-[11px] sm:text-xs text-m3-on-surface font-semibold line-clamp-1 mt-0.5 leading-normal">
                                              {fullPost.caption ? (
                                                highlightText(fullPost.caption, "caption")
                                              ) : (
                                                <span className="italic font-normal text-m3-outline">
                                                  No caption text
                                                </span>
                                              )}
                                            </p>
                                            {/* Tags display */}
                                            {fullPost.tags &&
                                              fullPost.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1 overflow-hidden max-h-4">
                                                  {fullPost.tags
                                                    .slice(0, 5)
                                                    .map((tag) => (
                                                      <span
                                                        key={tag}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          toggleTagFilter(tag);
                                                        }}
                                                        className="inline-flex items-center gap-0.5 px-2 py-0 rounded-sm text-[8px] font-bold bg-m3-surface-variant/35 text-m3-on-surface-variant hover:bg-m3-primary/10 hover:text-m3-primary transition-all shrink-0 cursor-pointer"
                                                      >
                                                        #{tag}
                                                      </span>
                                                    ))}
                                                  {fullPost.tags.length > 5 && (
                                                    <span className="text-[9px] font-extrabold text-m3-outline px-1 shrink-0">
                                                      +{fullPost.tags.length - 5} more
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                          </div>
                                          {/* Right Action Buttons */}
                                          <div className="flex items-center gap-2 shrink-0">
                                            {fullPost.mediaType === "carousel" && (
                                              <div
                                                className="w-6 h-6 rounded-md bg-m3-surface-variant/30 flex items-center justify-center text-m3-on-surface-variant/70"
                                                title="Carousel post"
                                              >
                                                <Layers size={10} />
                                              </div>
                                            )}
                                          </div>
                                        </motion.div>
                                      </motion.div>
                                    );
                                  })}
                                </motion.div>
                              );
                            }
                            
                            return null;
                          }}
                        />
                      ) : (
                        <Virtuoso
                          key={`virtuoso-grid-${gridDensity}-${masonryColumns}`}
                          customScrollParent={scrollElement || undefined}
                          data={chunkArray(visiblePosts, masonryColumns)}
                          itemContent={(rowIndex, rowPosts) => (
                            <motion.div
                              layout={!shouldReduceMotion}
                              transition={
                                shouldReduceMotion
                                  ? { duration: 0.05 }
                                  : { layout: { type: "spring", stiffness: 280, damping: 28 } }
                              }
                              key={`grid-row-${rowIndex}`}
                              className="grid gap-4 w-full mb-4 px-1"
                              style={{
                                gridTemplateColumns: `repeat(${masonryColumns}, minmax(0, 1fr))`,
                              }}
                            >
                              {rowPosts.map((post, colIdx) => {
                                const globalIdx = rowIndex * masonryColumns + colIdx;
                                const isSelected = selectedPostIds.includes(post.id);
                                const isKeyboardFocused = keyboardFocusedId === post.id;
                                return (
                                  <motion.div
                                    key={`${filterKey}-${post.id}`}
                                    layout={!shouldReduceMotion}
                                    id={`post-card-container-${post.id}`}
                                    className="w-full post-card-container gpu-accelerated"
                                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                    transition={
                                      shouldReduceMotion
                                        ? { duration: 0.05 }
                                        : {
                                            layout: { type: "spring", stiffness: 280, damping: 28 },
                                            type: "spring",
                                            stiffness: 260,
                                            damping: 24,
                                            delay: Math.min(globalIdx * 0.008, 0.2),
                                          }
                                    }
                                  >
                                    <MemoizedPostCard
                                      post={post}
                                      isSelected={isSelected}
                                      onToggleSelect={(e) => toggleSelect(post.id, e)}
                                      onTagClick={toggleTagFilter}
                                      onCreatorClick={setCreatorFilter}
                                      onPeek={setPeekPost}
                                      onClick={() => handleOpenFullscreen(post)}
                                      creatorFilter={creatorFilter}
                                      isImmersive={isImmersive}
                                      isKeyboardFocused={isKeyboardFocused}
                                      onMouseEnter={() =>
                                        setKeyboardFocusedId(post.id)
                                      }
                                    />
                                  </motion.div>
                                );
                              })}
                            </motion.div>
                          )}
                        />
                      )}
                    </motion.div>
                  </LayoutGroup>
                </>
              )}
            </AnimatePresence>

            {/* Sentinel for progressive infinite scroll loading */}
            {visibleCount < filteredPosts.length && (
              <div
                ref={observerTarget}
                className="py-12 flex flex-col items-center justify-center gap-3 mt-6 border-t border-m3-outline-variant/10"
              >
                <RefreshCw className="animate-spin text-m3-primary" size={24} />
                <button
                  onClick={() =>
                    setVisibleCount((prev) =>
                      prev + 48 < filteredPosts.length
                        ? prev + 48
                        : filteredPosts.length,
                    )
                  }
                  className="text-xs font-bold text-m3-primary hover:underline cursor-pointer flex items-center gap-1.5"
                >
                  <span>
                    Showing {visibleCount} of {filteredPosts.length} posts.
                  </span>
                  <span className="opacity-80 font-normal">
                    (Click or scroll down to load more)
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Scroll-To-Top up arrow floating action button (FAB) */}
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 15 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 15 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0.05 }
                    : { type: "spring", stiffness: 350, damping: 25 }
                }
                whileHover={shouldReduceMotion ? undefined : { scale: 1.08, y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                onClick={scrollToTop}
                aria-label="Back to top"
                className="fixed bottom-24 md:bottom-8 right-6 z-40 px-3.5 py-2.5 rounded-full bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 flex items-center gap-2 shadow-xl hover:shadow-2xl transition-all cursor-pointer border border-m3-outline-variant/30 font-bold text-xs group backdrop-blur-md"
                title="Scroll back to top"
              >
                <ArrowUp size={16} className="stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
                <span className="hidden sm:inline font-display">Back to Top</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Material 3 Floating Bulk Actions Bar (Floating Bottom Sheet pattern) */}
        <AnimatePresence>
          {selectedPostIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 80, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 80, x: "-50%" }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-m3-surface-highest text-m3-on-surface border border-m3-outline-variant/60 shadow-xl px-5 py-4 rounded-[24px] z-50 flex flex-col md:flex-row items-stretch md:items-center gap-4 max-w-full w-[90%] md:w-auto md:min-w-[640px]"
            >
              {/* Left Selection Stat count */}
              <div className="flex items-center justify-between border-b md:border-b-0 md:border-r border-m3-outline-variant/30 pb-2 md:pb-0 md:pr-4 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-m3-primary text-m3-on-primary text-[11px] font-bold flex items-center justify-center shadow-xs">
                    {selectedPostIds.length}
                  </span>
                  <span className="text-xs font-bold font-display text-m3-on-surface">
                    Items Selected
                  </span>
                </div>
                <button
                  onClick={() => clearSelection()}
                  className="p-3 sm:p-1 -mr-2 sm:-mr-0 rounded-full text-m3-outline hover:text-m3-on-surface md:hidden"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Middle: Collection Batch tagging */}
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  value={bulkCollection}
                  onChange={(e) => setBulkCollection(e.target.value)}
                  placeholder="Collection Name"
                  className="flex-1 px-3.5 py-2.5 text-xs border border-m3-outline-variant/40 rounded-xl bg-m3-surface focus:outline-m3-primary text-m3-on-surface"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleBulkCollection("add", bulkCollection)}
                    disabled={!bulkCollection}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-m3-primary text-m3-on-primary disabled:opacity-40 rounded-full text-[11px] font-bold cursor-pointer hover:shadow-xs transition-all shrink-0"
                  >
                    <FolderPlus size={11} />
                    Add
                  </button>
                  <button
                    onClick={() =>
                      handleBulkCollection("remove", bulkCollection)
                    }
                    disabled={!bulkCollection}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-m3-secondary-container text-m3-on-secondary-container disabled:opacity-40 rounded-full text-[11px] font-bold cursor-pointer transition-all shrink-0"
                  >
                    <FolderMinus size={11} />
                    Remove
                  </button>
                </div>
              </div>

              {/* Right: Batch Archive, Re-scrape and Delete Actions */}
              <div className="flex items-center gap-2 border-t md:border-t-0 border-m3-outline-variant/30 pt-2.5 md:pt-0 md:pl-4 justify-end shrink-0">
                <button
                  onClick={() => handleBulkAction("archive")}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1 px-3 py-2 text-xs bg-m3-surface-variant hover:bg-m3-surface-container-highest text-m3-on-surface-variant rounded-full font-semibold transition-all cursor-pointer"
                  title="Archive selected posts"
                >
                  <Archive size={11} />
                  <span>Archive</span>
                </button>
                <button
                  onClick={() => handleBulkAction("unarchive")}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1 px-3 py-2 text-xs bg-m3-surface-variant hover:bg-m3-surface-container-highest text-m3-on-surface-variant rounded-full font-semibold transition-all cursor-pointer"
                  title="Unarchive selected posts"
                >
                  <Layers size={11} />
                  <span>Activate</span>
                </button>
                <button
                  onClick={handleBulkRescrape}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1 px-3 py-2 text-xs bg-m3-primary/50/10 hover:bg-m3-primary/50/20 text-m3-primary rounded-full font-semibold transition-all cursor-pointer"
                  title="Rescrape selected posts"
                >
                  <RefreshCw size={11} />
                  <span>Re-scrape</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-1 px-3 py-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-700 rounded-full font-semibold transition-all cursor-pointer"
                  title="Delete selected posts from library"
                >
                  <Trash2 size={11} />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => clearSelection()}
                  className="hidden md:flex p-2 rounded-full hover:bg-m3-surface-variant/40 text-m3-outline hover:text-m3-on-surface transition-colors cursor-pointer"
                  title="Clear selection"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Peek Modal Overlay */}
        <AnimatePresence>
          {peekPost && (
            <TelegramQuickPeek
              post={peekPost}
              onClose={() => setPeekPost(null)}
            />
          )}
        </AnimatePresence>

        {/* Immersive Fullscreen Media Viewer */}
        <AnimatePresence>
          {fullscreenIndex !== null && (
            <FullScreenMediaViewer
              posts={filteredPosts}
              initialIndex={fullscreenIndex}
              onClose={() => setFullscreenIndex(null)}
              onSelectIndex={(idx) => setFullscreenIndex(idx)}
              onTagClick={toggleTagFilter}
              onCreatorClick={setCreatorFilter}
            />
          )}
        </AnimatePresence>

        {/* Manual Bookmark Creator Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <AddBookmarkModal
              isOpen={isAddModalOpen}
              onClose={() => setIsAddModalOpen(false)}
              onAdd={async (newPost) => {
                await db.posts.put(newPost);
                await reload();
              }}
              allTags={allTags}
              allCollections={allCollections}
            />
          )}
        </AnimatePresence>
      </div>
    );
  },
);
