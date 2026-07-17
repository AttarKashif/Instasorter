import { useDebounce } from "../../hooks/useDebounce";
import { useFullPost } from "../../hooks/useFullPost";
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
import { usePostStore } from "../../store/useStore";
import { PostCard } from "../../components/ui/PostCard";
import { PostCardSkeleton } from "../../components/ui/PostCardSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { TelegramQuickPeek } from "../../components/ui/TelegramQuickPeek";
import { InstagramImage } from "../../components/ui/InstagramImage";
import { AddBookmarkModal } from "../../components/ui/AddBookmarkModal";
import { SmartRulesManager } from "../../components/ui/SmartRulesManager";
import { SAMPLE_POSTS } from "../../data/samplePosts";
import { normalizeInstagramPost } from "../../lib/parser";
import {
  getThumbnailStats,
  runThumbnailWorker,
  retryFailedThumbnails,
  registerProgressCallback,
  unregisterProgressCallback,
  isWorkerActive,
  getThrottleStatus,
} from "../../lib/thumbnailWorker";
import {
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
} from "lucide-react";
import Fuse from "fuse.js";
import { motion, AnimatePresence } from "motion/react";
import { Virtuoso } from "react-virtuoso";
import { VOCABULARY } from "../../constants/vocabulary";
// import { DashboardAnalytics } from './DashboardAnalytics';

const parseSearchQuery = (query: string) => {
  const normalized = query.trim();
  if (!normalized) return { isPrefix: false, prefixes: [], generalText: "" };

  // Check if there is any colon indicating a prefix search
  if (!normalized.includes(":")) {
    return { isPrefix: false, prefixes: [], generalText: normalized };
  }

  // Regex to extract prefix:value pairs. Supports quoted strings like creator:"john doe"
  const regex =
    /(?:(post|caption|creator|user|author|tag|hashtag|collection|folder):\s*)(?:"([^"]+)"|([^\s]+))/gi;

  const matches: Array<{ prefix: string; value: string }> = [];
  let match;
  let remainingText = normalized;

  while ((match = regex.exec(normalized)) !== null) {
    const prefix = match[1].toLowerCase();
    const value = match[2] || match[3];
    matches.push({ prefix, value });

    // Remove the matched part from remaining text
    remainingText = remainingText.replace(match[0], "");
  }

  remainingText = remainingText.replace(/\s+/g, " ").trim();

  return {
    isPrefix: matches.length > 0,
    prefixes: matches,
    generalText: remainingText,
  };
};

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
  }: DashboardViewProps) => {
    const isLoading = usePostStore((state) => state.isLoading);
    const searchQuery = usePostStore((state) => state.searchQuery);
    const setSearchQuery = usePostStore((state) => state.setSearchQuery);

    const highlightText = useCallback((text: string, search: string) => {
      if (!text) return "";
      const trimmedSearch = search.trim();
      if (!trimmedSearch) return text;

      const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedSearch})`, "gi");
      const parts = text.split(regex);

      return (
        <>
          {parts.map((part, index) =>
            regex.test(part) ? (
              <mark
                key={index}
                className="bg-amber-100 text-slate-955 dark:bg-amber-900/60 dark:text-amber-50 rounded-[3px] px-0.5 font-bold border border-amber-200/30 shadow-xs"
              >
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    }, []);

    // Masonry column count based on density and viewport width
    const [masonryColumns, setMasonryColumns] = useState(2);

    useEffect(() => {
      if (gridDensity === "list") return;

      const updateColumns = () => {
        const width = window.innerWidth;
        if (gridDensity === "single") {
          if (width < 640) setMasonryColumns(1);
          else if (width < 1024) setMasonryColumns(2);
          else setMasonryColumns(2);
        } else {
          if (width < 640) setMasonryColumns(2);
          else if (width < 768) setMasonryColumns(3);
          else if (width < 1024) setMasonryColumns(4);
          else setMasonryColumns(5);
        }
      };

      updateColumns();
      window.addEventListener("resize", updateColumns);
      return () => window.removeEventListener("resize", updateColumns);
    }, [gridDensity]);

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
    const debouncedSearchQuery = useDebounce(localSearchQuery, 300);
    useEffect(() => {
      if (debouncedSearchQuery !== searchQuery) {
        setSearchQuery(debouncedSearchQuery);
      }
    }, [debouncedSearchQuery, searchQuery, setSearchQuery]);
    const deferredSearchQuery = debouncedSearchQuery; // keeping variable name for compatibility

    const [tagSearchQuery, setTagSearchQuery] = useState("");
    const deferredTagSearchQuery = useDebounce(tagSearchQuery, 300);

    const [collectionSearchQuery, setCollectionSearchQuery] = useState("");
    const deferredCollectionSearchQuery = useDebounce(collectionSearchQuery, 300);
    const deferredCreatorFilter = useDebounce(creatorFilter || "", 300);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [peekPost, setPeekPost] = useState<Post | null>(null);
    const [detailPost, setDetailPost] = useState<Post | null>(null);
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
    const [sortBy, setSortBy] = useState<string>(initialSortBy);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [hideBrokenLinks, setHideBrokenLinks] = useState(true);

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
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
    const setContainerRef = useCallback((node: HTMLDivElement | null) => {
      containerRef.current = node;
      setScrollElement(node);
    }, []);

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
      if (target.scrollTop > 350) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    const scrollToTop = () => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        savedDashboardScrollTop = 0;
      }
    };

    const [workerStats, setWorkerStats] = useState(() =>
      getThumbnailStats(posts),
    );
    const [isDownloading, setIsDownloading] = useState(() => isWorkerActive());

    useEffect(() => {
      const updateStats = () => {
        const currentPosts = usePostStore.getState().posts;
        setWorkerStats(getThumbnailStats(currentPosts));
        setIsDownloading(isWorkerActive());
      };

      registerProgressCallback(updateStats);
      updateStats();

      return () => {
        unregisterProgressCallback();
      };
    }, [posts]);

    

    // Scraper throttle/rate-limiting status
    const [throttleStatus, setThrottleStatus] = useState({
      throttled: false,
      remaining: 0,
    });

    // Poll throttle/rate limit status from the background worker
    useEffect(() => {
      let timer: any;
      const checkThrottle = () => {
        setThrottleStatus(getThrottleStatus());
      };
      checkThrottle();
      if (isDownloading) {
        timer = setInterval(checkThrottle, 1000);
      }
      return () => {
        if (timer) clearInterval(timer);
      };
    }, [isDownloading]);

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
      setIsDownloading(true);
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
      if (
        confirm(
          `Are you sure you want to permanently delete these ${selectedPostIds.length} selected posts from your library?`,
        )
      ) {
        await db.posts.bulkDelete(selectedPostIds);
        bulkDeleteSelected(); // updates store and clears selection
        
      }
    };

    const sortOptions = useMemo(
      () => [
        { value: "savedAt", label: "Date Saved" },
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
              prefix === "author"
            ) {
              tempResult = tempResult.filter((p) =>
                (p.creatorUsername || "").toLowerCase().includes(valLower),
              );
            } else if (prefix === "post" || prefix === "caption") {
              tempResult = tempResult.filter((p) =>
                (p.caption || "").toLowerCase().includes(valLower),
              );
            } else if (prefix === "tag" || prefix === "hashtag") {
              tempResult = tempResult.filter(
                (p) =>
                  (p.tags || []).some((t) =>
                    t.toLowerCase().includes(valLower),
                  ) ||
                  (p.hashtags || []).some((h) =>
                    h.toLowerCase().includes(valLower),
                  ),
              );
            } else if (prefix === "collection" || prefix === "folder") {
              tempResult = tempResult.filter((p) =>
                (p.collections || []).some((c) =>
                  c.toLowerCase().includes(valLower),
                ),
              );
            }
          });

          if (parsed.generalText) {
            const subFuse = new Fuse(tempResult, {
              keys: [
                "caption",
                "creatorUsername",
                "notes",
                "hashtags",
                "tags",
                "collections",
              ],
              threshold: 0.3,
            });
            result = subFuse.search(parsed.generalText).map((r) => r.item);
          } else {
            result = tempResult;
          }
        } else {
          result = fuse.search(deferredSearchQuery).map((r) => r.item);
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

      const sorted = [...result];
      sorted.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "savedAt") {
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
      hideBrokenLinks,
      deferredCreatorFilter,
    ]);

    const [visibleCount, setVisibleCount] = useState(48);

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
      hideBrokenLinks,
      deferredCreatorFilter,
    ]);

    const visiblePosts = useMemo(() => {
      return filteredPosts.slice(0, visibleCount);
    }, [filteredPosts, visibleCount]);

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
          const searchInput = document.getElementById("search-input");
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
      if (action === "add") {
        bulkAddToCollection(collection);
      } else {
        bulkRemoveFromCollection(collection);
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
    ]);

    const hasActiveFilters = activeFiltersCount > 0 || searchQuery;

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
        {/* Backdropped Frosted Center Modal for Sorting & Filtering */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Dark blur backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 cursor-pointer"
              />

              {/* Floating Dialog Panel */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="fixed inset-0 m-auto w-[calc(100%-2rem)] md:w-full max-w-3xl h-[85vh] max-h-[700px] bg-m3-surface-low/90 backdrop-blur-3xl border border-m3-outline-variant/30 flex flex-col overflow-hidden z-50 shadow-glass-lg rounded-3xl"
              >
                <div className="p-5 border-b border-m3-outline-variant/20 flex items-center justify-between bg-m3-surface-low shrink-0">
                  <div className="flex items-center gap-2.5 font-bold font-display text-m3-on-surface text-base">
                    <SlidersHorizontal size={18} className="text-m3-primary" />
                    <span>{VOCABULARY.dashboard.sortFilterTitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="text-xs font-bold text-m3-primary hover:bg-m3-primary/5 px-2.5 py-1.5 rounded-full transition-colors cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1.5 hover:bg-m3-surface-variant/40 rounded-full transition-colors text-m3-on-surface-variant hover:text-m3-on-surface cursor-pointer"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden">
                    {/* Left Column: Sort Settings */}
                    <div className="md:col-span-5 flex flex-col h-full overflow-y-auto pr-0 md:pr-6 border-b md:border-b-0 md:border-r border-m3-outline-variant/10 pb-6 md:pb-0 gap-5 scrollbar-none">
                      <div className="flex flex-col gap-3">
                        <h3 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1">
                          Sort Options
                        </h3>
                        <div className="space-y-2">
                          {sortOptions.map((opt) => {
                            const isSelected = sortBy === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setSortBy(opt.value)}
                                className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container font-bold shadow-xs"
                                    : "bg-m3-surface border-m3-outline-variant/20 text-m3-on-surface-variant hover:bg-m3-surface-variant/25"
                                }`}
                              >
                                <span>{opt.label}</span>
                                {isSelected && (
                                  <Check size={12} className="stroke-[2.5]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1">
                          Sort Direction
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSortOrder("desc")}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              sortOrder === "desc"
                                ? "bg-m3-primary border-m3-primary text-m3-on-primary shadow-xs"
                                : "bg-m3-surface border-m3-outline-variant/20 text-m3-on-surface-variant hover:bg-m3-surface-variant/25"
                            }`}
                          >
                            Descending
                          </button>
                          <button
                            onClick={() => setSortOrder("asc")}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              sortOrder === "asc"
                                ? "bg-m3-primary border-m3-primary text-m3-on-primary shadow-xs"
                                : "bg-m3-surface border-m3-outline-variant/20 text-m3-on-surface-variant hover:bg-m3-surface-variant/25"
                            }`}
                          >
                            Ascending
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Filter Settings */}
                    <div className="md:col-span-7 flex flex-col h-full overflow-y-auto gap-6 pr-2 scrollbar-thin">
                      {/* General Filter Block */}
                      <div className="flex flex-col gap-4">
                        <h3 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1">
                          Filter Options
                        </h3>

                        {/* Starred Favorite filter chip toggle */}
                        <button
                          onClick={() =>
                            setFilterFavoriteOnly(!filterFavoriteOnly)
                          }
                          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border cursor-pointer ${
                            filterFavoriteOnly
                              ? "bg-m3-primary/10 border-m3-primary text-m3-primary dark:bg-amber-950/40 dark:border-m3-primary dark:text-m3-primary shadow-xs font-bold"
                              : "bg-m3-surface hover:bg-m3-surface-variant/30 border-m3-outline-variant/30 text-m3-on-surface-variant"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Heart
                              size={15}
                              fill={
                                filterFavoriteOnly ? "currentColor" : "none"
                              }
                              className={
                                filterFavoriteOnly
                                  ? "text-m3-primary fill-m3-primary"
                                  : ""
                              }
                            />
                            <span>Starred Favorites</span>
                          </span>
                          {filterFavoriteOnly && (
                            <Check size={14} className="stroke-[2.5]" />
                          )}
                        </button>

                        {/* Broken links filter chip toggle */}
                        {brokenCount > 0 && (
                          <button
                            onClick={() => setHideBrokenLinks(!hideBrokenLinks)}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border cursor-pointer ${
                              !hideBrokenLinks
                                ? "bg-m3-error-container text-m3-on-error-container border-m3-error-container/60 shadow-xs font-bold"
                                : "bg-m3-surface hover:bg-m3-surface-variant/30 border-m3-outline-variant/30 text-m3-on-surface-variant"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <AlertCircle
                                size={15}
                                className={
                                  !hideBrokenLinks ? "text-m3-error" : ""
                                }
                              />
                              <span>
                                {hideBrokenLinks
                                  ? "Show broken posts"
                                  : "Hide broken posts"}{" "}
                                ({brokenCount})
                              </span>
                            </span>
                            {!hideBrokenLinks && (
                              <Check size={14} className="stroke-[2.5]" />
                            )}
                          </button>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Media Format Type Filter */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-m3-on-surface-variant pl-1">
                              Media Format
                            </label>
                            <select
                              value={filterMediaType}
                              onChange={(e) =>
                                setFilterMediaType(e.target.value)
                              }
                              className="w-full px-3 py-2 text-xs bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40 rounded-xl focus:border-m3-primary focus:outline-none transition-all cursor-pointer"
                            >
                              <option value="all">Show All Formats</option>
                              {allMediaTypes.map((m) => (
                                <option
                                  key={m}
                                  value={m}
                                  className="capitalize"
                                >
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Status Archive Filter (only if not forced by route) */}
                          {initialFilterArchived !== "archived" && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-m3-on-surface-variant pl-1">
                                Archive Status
                              </label>
                              <select
                                value={filterArchived}
                                onChange={(e) =>
                                  setFilterArchived(e.target.value as any)
                                }
                                className="w-full px-3 py-2 text-xs bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40 rounded-xl focus:border-m3-primary focus:outline-none transition-all cursor-pointer"
                              >
                                <option value="all">All States</option>
                                <option value="active">Active Only</option>
                                <option value="archived">Archived Only</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Date Filters */}
                        <div className="flex flex-col gap-1.5 border-t border-m3-outline-variant/10 pt-3">
                          <label className="text-xs font-semibold text-m3-on-surface-variant pl-1">
                            Saved Date Range
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 mb-1">
                            {[
                              { id: "all", label: "All Time" },
                              { id: "today", label: "Today" },
                              { id: "7days", label: "7 Days" },
                              { id: "30days", label: "30 Days" },
                              { id: "thisyear", label: "This Year" },
                            ].map((preset) => {
                              let isActive = false;
                              const todayStr = new Date()
                                .toISOString()
                                .split("T")[0];
                              if (preset.id === "all" && !startDate && !endDate)
                                isActive = true;
                              else if (
                                preset.id === "today" &&
                                startDate === todayStr &&
                                endDate === todayStr
                              )
                                isActive = true;
                              else if (preset.id === "7days") {
                                const sevenDaysAgo = new Date();
                                sevenDaysAgo.setDate(
                                  sevenDaysAgo.getDate() - 7,
                                );
                                const sevenStr = sevenDaysAgo
                                  .toISOString()
                                  .split("T")[0];
                                if (
                                  startDate === sevenStr &&
                                  endDate === todayStr
                                )
                                  isActive = true;
                              } else if (preset.id === "30days") {
                                const thirtyDaysAgo = new Date();
                                thirtyDaysAgo.setDate(
                                  thirtyDaysAgo.getDate() - 30,
                                );
                                const thirtyStr = thirtyDaysAgo
                                  .toISOString()
                                  .split("T")[0];
                                if (
                                  startDate === thirtyStr &&
                                  endDate === todayStr
                                )
                                  isActive = true;
                              } else if (preset.id === "thisyear") {
                                const yrStart = new Date(
                                  new Date().getFullYear(),
                                  0,
                                  1,
                                )
                                  .toISOString()
                                  .split("T")[0];
                                if (
                                  startDate === yrStart &&
                                  endDate === todayStr
                                )
                                  isActive = true;
                              }

                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() =>
                                    handleDatePreset(preset.id as any)
                                  }
                                  className={`px-1.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                    isActive
                                      ? "bg-m3-primary/15 border-m3-primary/30 text-m3-primary font-bold"
                                      : "bg-m3-surface hover:bg-m3-surface-variant/15 border-m3-outline-variant/20 text-m3-on-surface-variant"
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-m3-outline uppercase pl-1">
                                From
                              </span>
                              <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-1.5 text-xs text-m3-on-surface-variant bg-m3-surface rounded-xl border border-m3-outline-variant/40 focus:border-m3-primary focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-m3-outline uppercase pl-1">
                                To
                              </span>
                              <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-1.5 text-xs text-m3-on-surface-variant bg-m3-surface rounded-xl border border-m3-outline-variant/40 focus:border-m3-primary focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rich Metadata Filter Block */}
                      <div className="flex flex-col gap-3 pt-4 border-t border-m3-outline-variant/10">
                        <h3 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
                          <Sparkles
                            size={13}
                            className="text-m3-primary animate-pulse"
                          />{" "}
                          Rich Metadata
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Has Notes */}
                          <button
                            onClick={() => setFilterHasNotes(!filterHasNotes)}
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all border text-xs cursor-pointer ${
                              filterHasNotes
                                ? "bg-m3-primary-container text-m3-on-primary-container border-m3-primary/50 font-bold"
                                : "bg-m3-surface hover:bg-m3-surface-variant/30 border-m3-outline-variant/30 text-m3-on-surface-variant"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <BookOpen
                                size={13}
                                className={
                                  filterHasNotes
                                    ? "text-m3-primary"
                                    : "text-m3-outline"
                                }
                              />
                              <span>Has Notes</span>
                            </span>
                            {filterHasNotes && (
                              <Check size={12} className="stroke-[2.5]" />
                            )}
                          </button>

                          {/* Has Location */}
                          <button
                            onClick={() =>
                              setFilterHasLocation(!filterHasLocation)
                            }
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all border text-xs cursor-pointer ${
                              filterHasLocation
                                ? "bg-m3-primary-container text-m3-on-primary-container border-m3-primary/50 font-bold"
                                : "bg-m3-surface hover:bg-m3-surface-variant/30 border-m3-outline-variant/30 text-m3-on-surface-variant"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Compass
                                size={13}
                                className={
                                  filterHasLocation
                                    ? "text-m3-primary"
                                    : "text-m3-outline"
                                }
                              />
                              <span>Has Location</span>
                            </span>
                            {filterHasLocation && (
                              <Check size={12} className="stroke-[2.5]" />
                            )}
                          </button>

                          {/* Has Hashtags */}
                          <button
                            onClick={() =>
                              setFilterHasHashtags(!filterHasHashtags)
                            }
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all border text-xs cursor-pointer ${
                              filterHasHashtags
                                ? "bg-m3-primary-container text-m3-on-primary-container border-m3-primary/50 font-bold"
                                : "bg-m3-surface hover:bg-m3-surface-variant/30 border-m3-outline-variant/30 text-m3-on-surface-variant"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Hash
                                size={13}
                                className={
                                  filterHasHashtags
                                    ? "text-m3-primary"
                                    : "text-m3-outline"
                                }
                              />
                              <span>Has Hashtags</span>
                            </span>
                            {filterHasHashtags && (
                              <Check size={12} className="stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* M3 Interactive Filter Chips for Tags */}
                      <div className="space-y-3 pt-3 border-t border-m3-outline-variant/10">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
                            <Tag size={13} className="text-m3-primary" /> Filter
                            by Tags
                          </h3>
                          {allTags.length > 5 && (
                            <input
                              placeholder="Filter tags..."
                              value={tagSearchQuery}
                              onChange={(e) =>
                                setTagSearchQuery(e.target.value)
                              }
                              className="px-2 py-0.5 text-[10px] w-28 border border-m3-outline-variant/20 bg-m3-surface text-m3-on-surface rounded-md focus:outline-none focus:border-m3-primary"
                            />
                          )}
                        </div>

                        {filteredTagsInSidebar.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-m3-surface-container/30 rounded-2xl border border-m3-outline-variant/10">
                            {filteredTagsInSidebar.map((tag) => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={() => toggleTagFilter(tag)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container shadow-xs font-bold"
                                      : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                                  }`}
                                >
                                  {isSelected && (
                                    <Check size={10} className="stroke-[2.5]" />
                                  )}
                                  <span>#{tag}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs italic text-m3-outline pl-1">
                            No matching tags found.
                          </p>
                        )}
                      </div>

                      {/* M3 Filter Chips for Collections */}
                      <div className="space-y-3 pt-3 border-t border-m3-outline-variant/10">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
                            <Folder size={13} className="text-m3-primary" />{" "}
                            Filter by Collections
                          </h3>
                          {allCollections.length > 4 && (
                            <input
                              placeholder="Filter collections..."
                              value={collectionSearchQuery}
                              onChange={(e) =>
                                setCollectionSearchQuery(e.target.value)
                              }
                              className="px-2 py-0.5 text-[10px] w-32 border border-m3-outline-variant/20 bg-m3-surface text-m3-on-surface rounded-md focus:outline-none focus:border-m3-primary"
                            />
                          )}
                        </div>

                        {filteredCollectionsInSidebar.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 bg-m3-surface-container/20 rounded-2xl border border-m3-outline-variant/10">
                            {filteredCollectionsInSidebar.map((col) => {
                              const isSelected =
                                selectedCollections.includes(col);
                              return (
                                <button
                                  key={col}
                                  onClick={() => toggleCollectionFilter(col)}
                                  className={`flex justify-between items-center px-2.5 py-1.5 rounded-xl text-left border text-[11px] font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary-container shadow-xs font-bold"
                                      : "bg-m3-surface border-m3-outline-variant/20 hover:border-m3-outline text-m3-on-surface-variant hover:text-m3-on-surface"
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5 truncate max-w-[75%]">
                                    <Folder
                                      size={11}
                                      className={
                                        isSelected
                                          ? "text-m3-secondary"
                                          : "text-m3-outline"
                                      }
                                    />
                                    <span className="truncate">{col}</span>
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                      isSelected
                                        ? "bg-m3-surface/30 text-m3-on-secondary-container"
                                        : "bg-m3-surface-variant text-m3-on-surface-variant"
                                    }`}
                                  >
                                    {collectionCounts[col]}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs italic text-m3-outline pl-1">
                            No matching collections found.
                          </p>
                        )}
                      </div>
                      <SmartRulesManager />
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

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
                    onClick={() => {
                      if (confirm(`Delete ${selectedPostIds.length} posts?`)) {
                        usePostStore.getState().bulkDeleteSelected();
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[11px] font-bold hover:bg-red-200 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Delete Selected</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Left side: View title, inline badge */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-m3-surface-container flex items-center justify-center border border-m3-outline-variant/10 shrink-0">
                      {React.cloneElement(viewInfo.icon, { size: 16 })}
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm md:text-base font-bold font-display text-m3-on-surface tracking-tight leading-none">
                        {viewInfo.title}
                      </h2>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${viewInfo.badgeBg} shrink-0`}
                      >
                        {posts.length > 0 ? `${filteredPosts.length}` : "0"}
                      </span>
                    </div>
                  </div>

                  {/* Right side: Compact inline search and layout/filter controls */}
                  {posts.length > 0 && (
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 flex-1 md:flex-initial justify-between md:justify-end">
                      {/* Modern Search bar */}
                      <div className="relative flex-1 max-w-xs md:max-w-[200px] lg:max-w-[260px] min-w-[120px]">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-m3-outline">
                          <Search size={13} />
                        </span>
                        <input
                          id="search-input"
                          placeholder={VOCABULARY.dashboard.searchPlaceholder}
                          value={localSearchQuery}
                          onChange={(e) => setLocalSearchQuery(e.target.value)}
                          className="pl-8 pr-8 py-1.5 w-full border border-m3-outline-variant/40 bg-m3-surface text-m3-on-surface hover:border-m3-outline focus:border-m3-primary focus:ring-1 focus:ring-m3-primary rounded-lg text-xs focus:outline-none transition-all shadow-glass-sm"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-m3-outline hover:text-m3-on-surface transition-all cursor-pointer"
                            title="Clear search query"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Sort & Filter Trigger Button */}
                      <button
                        onClick={() => setIsSidebarOpen(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all cursor-pointer h-8 ${
                          isSidebarOpen
                            ? "bg-m3-primary-container border-m3-primary text-m3-on-primary-container"
                            : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                        }`}
                        title="Open Sort & Filter configurations"
                      >
                        <SlidersHorizontal size={13} />
                        <span className="hidden sm:inline">
                          Sort &amp; Filter
                        </span>
                        {activeFiltersCount > 0 && (
                          <span className="w-4 h-4 rounded-full bg-m3-primary text-m3-on-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                            {activeFiltersCount}
                          </span>
                        )}
                      </button>

                      {/* Layout Selector */}
                      <div className="flex items-center bg-m3-surface-variant/20 border border-m3-outline-variant/20 rounded-lg p-0.5 shrink-0 h-9 sm:h-8">
                        <button
                          onClick={() => setGridDensity("single")}
                          className={`flex items-center justify-center w-10 sm:w-8 h-8 sm:h-7 rounded-md transition-all cursor-pointer ${
                            gridDensity === "single"
                              ? "bg-m3-primary text-m3-on-primary shadow-xs"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                          }`}
                          title="Single column feed (Instagram style)"
                        >
                          <Smartphone size={14} />
                        </button>
                        <button
                          onClick={() => setGridDensity("double")}
                          className={`flex items-center justify-center w-10 sm:w-8 h-8 sm:h-7 rounded-md transition-all cursor-pointer ${
                            gridDensity === "double"
                              ? "bg-m3-primary text-m3-on-primary shadow-xs"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                          }`}
                          title="Two-column masonry grid"
                        >
                          <LayoutGrid size={14} />
                        </button>
                        <button
                          onClick={() => setGridDensity("list")}
                          className={`flex items-center justify-center w-10 sm:w-8 h-8 sm:h-7 rounded-md transition-all cursor-pointer ${
                            gridDensity === "list"
                              ? "bg-m3-primary text-m3-on-primary shadow-xs"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                          }`}
                          title="Compact list layout"
                        >
                          <List size={14} />
                        </button>
                      </div>

                      {/* Active Sort Label on big screens */}
                      <div className="hidden lg:flex items-center gap-1 text-[11px] text-m3-on-surface-variant shrink-0 select-none">
                        <span className="font-semibold text-m3-outline">
                          Sorted:
                        </span>
                        <span className="font-bold text-m3-primary bg-m3-primary-container/10 px-1.5 py-0.5 rounded-md">
                          {sortBy === "savedAt" && "Date Saved"}
                          {sortBy === "creatorUsername" && "Creator"}
                          {sortBy === "mediaType" && "Post Type"}
                          {sortBy === "caption" && "Caption"}
                          {sortBy === "commentsCount" && "Engagement"}
                          {sortBy === "notesLength" && "Notes"}
                          {sortBy === "tagsLength" && "Tags"} (
                          {sortOrder === "desc" ? "Desc" : "Asc"})
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </header>

          {/* Active Filters Toolbar */}
          {posts.length > 0 && hasActiveFilters && (
            <div className="px-6 py-2 bg-m3-surface-container-lowest/40 border-b border-m3-outline-variant/10 flex flex-wrap items-center gap-1.5 text-xs shrink-0 select-none">
              <span className="text-[10px] font-bold text-m3-outline uppercase tracking-wider">
                Active Search Filters:
              </span>

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface text-[11px] font-medium">
                  <span className="text-m3-outline text-[10px]">Query:</span>
                  <span>"{searchQuery}"</span>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-m3-primary-container text-m3-on-primary-container border border-m3-primary/20 text-[11px] font-semibold"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => toggleTagFilter(tag)}
                    className="p-1.5 sm:p-0.5 -mr-1 text-m3-on-primary-container/60 hover:text-red-500 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}

              {selectedCollections.map((col) => (
                <span
                  key={col}
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
                </span>
              ))}

              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/30 text-m3-on-surface text-[11px] font-medium">
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
                </span>
              )}

              {filterMediaType !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface border border-m3-outline-variant/20 text-m3-on-surface capitalize text-[11px] font-medium">
                  <span className="text-m3-outline text-[10px]">Format:</span>
                  <span>{filterMediaType}</span>
                  <button
                    onClick={() => setFilterMediaType("all")}
                    className="p-1.5 sm:p-0.5 -mr-1 text-m3-outline hover:text-red-500 rounded-md transition-colors cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              {filterFavoriteOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-tertiary-container text-m3-on-tertiary-container border border-m3-tertiary-container/30 text-[11px] font-semibold">
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
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-[10px] text-m3-primary hover:text-m3-primary/80 font-bold uppercase tracking-wider ml-auto hover:underline cursor-pointer p-2 sm:p-0 -m-2 sm:m-0"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Scraper Health & Progress Dashboard - Compact single-row banner */}
          {workerStats.total > 0 &&
            (workerStats.pending > 0 ||
              workerStats.failed > 0 ||
              isDownloading ||
              throttleStatus.throttled) && (
              <div className="bg-m3-surface-low border-b border-m3-outline-variant/10 px-4 md:px-6 py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-3 shrink-0 transition-all shadow-xs animate-fade-in text-xs select-none">
                {/* Status & Stats */}
                <div className="flex items-center gap-2 max-w-full">
                  {throttleStatus.throttled ? (
                    <AlertCircle
                      size={14}
                      className="text-m3-primary shrink-0 animate-pulse"
                    />
                  ) : isDownloading ? (
                    <RefreshCw
                      size={14}
                      className="text-m3-primary animate-spin shrink-0"
                    />
                  ) : workerStats.failed > 0 ? (
                    <AlertCircle
                      size={14}
                      className="text-m3-primary shrink-0"
                    />
                  ) : (
                    <Check size={14} className="text-m3-primary shrink-0" />
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-m3-on-surface">
                      {throttleStatus.throttled
                        ? "Scraper Rate Limited"
                        : isDownloading
                          ? "Scraper Running"
                          : "Scraper Idle"}
                    </span>
                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-m3-surface-variant text-m3-on-surface-variant shrink-0">
                      {throttleStatus.throttled
                        ? "COOLDOWN"
                        : isDownloading
                          ? "ACTIVE"
                          : "STANDBY"}
                    </span>
                    <span className="text-m3-on-surface-variant text-[11px] shrink-0">
                      (Scraped: <strong>{workerStats.success}</strong> &bull;
                      Pending: <strong>{workerStats.pending}</strong> &bull;
                      Failed: <strong>{workerStats.failed}</strong>)
                    </span>
                  </div>
                </div>

                {/* Progress & Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end flex-wrap md:flex-nowrap">
                  {throttleStatus.throttled ? (
                    <div className="flex items-center gap-2 bg-m3-primary/50/10 border border-m3-primary/100/10 px-2 py-0.5 rounded-md text-[11px] text-m3-primary dark:text-m3-primary">
                      <span>
                        Pausing queries. Resuming in{" "}
                        <strong>{throttleStatus.remaining}s</strong>
                      </span>
                      <button
                        onClick={() => retryFailedThumbnails()}
                        className="px-1.5 py-0.5 bg-m3-primary/50/20 hover:bg-m3-primary/50/30 rounded text-[9px] font-bold uppercase transition-colors cursor-pointer"
                      >
                        Bypass
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 md:w-32 h-1 bg-m3-surface-container rounded-full overflow-hidden border border-m3-outline-variant/10 shrink-0">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          workerStats.failed > 0 && workerStats.pending === 0
                            ? "bg-m3-primary/50"
                            : "bg-m3-primary"
                        }`}
                        style={{
                          width: `${workerStats.total > 0 ? (workerStats.success / workerStats.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    {workerStats.failed > 0 && (
                      <button
                        onClick={() => retryFailedThumbnails()}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-m3-primary bg-m3-primary/50/10 hover:bg-m3-primary/50/20 rounded-md transition-all cursor-pointer"
                      >
                        <RefreshCw size={9} />
                        <span>Retry Failed</span>
                      </button>
                    )}
                    {isDownloading && !throttleStatus.throttled && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-m3-primary bg-m3-primary/10 px-1.5 py-0.5 rounded-md animate-pulse shrink-0">
                        Downloading...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Dashboard Catalog Content Panel */}
          <div
            ref={setContainerRef}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-y-auto p-4 md:p-6 bg-m3-surface/40 relative"
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
                  className={
                    gridDensity === "single"
                      ? "grid grid-cols-1 gap-8 max-w-xl mx-auto w-full"
                      : gridDensity === "double"
                        ? "grid grid-cols-2 gap-4 w-full"
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
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="max-w-3xl mx-auto py-8 md:py-16 flex flex-col gap-10 items-center justify-center text-center"
                >
                  <div className="flex flex-col gap-3 max-w-xl">
                    <div className="w-16 h-16 rounded-full bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center mx-auto shadow-md">
                      <Database size={28} className="animate-pulse" />
                    </div>
                    <h1 className="text-3xl font-extrabold font-display text-m3-on-surface tracking-tight">
                      Welcome to Instasorter
                    </h1>
                  </div>

                  {/* Two modern visual CTA pathways */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-2">
                    {/* CTA 1: Load Sample Space */}
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={loadDemoData}
                      className="p-6 md:p-8 bg-m3-primary-container/30 border border-m3-primary-container rounded-[28px] text-left cursor-pointer flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden group min-h-[220px]"
                    >
                      <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform">
                        <Database size={160} />
                      </div>

                      <div className="flex flex-col gap-3 relative z-10">
                        <div className="w-11 h-11 bg-m3-primary-container rounded-xl flex items-center justify-center text-m3-on-primary-container shadow-xs">
                          <Database size={20} />
                        </div>
                        <h3 className="text-lg font-bold font-display text-m3-on-surface-variant">
                          Explore with Demo Space
                        </h3>
                        <p className="text-xs text-m3-on-surface-variant/95 leading-relaxed">
                          Instantly seed your workspace with beautiful Unsplash
                          photography mockups, custom tags, and collections to
                          explore features.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={demoLoading}
                        className="mt-6 py-2.5 px-5 bg-m3-primary text-m3-on-primary rounded-full font-bold text-xs shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 relative z-10"
                      >
                        {demoLoading
                          ? "Seeding data..."
                          : "Load Sample Catalog"}
                        <Sparkles size={13} />
                      </button>
                    </motion.div>

                    {/* CTA 2: Import Archive file */}
                    {onNavigate && (
                      <motion.div
                        whileHover={{ y: -4, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() =>
                          usePostStore.getState().setIsImportModalOpen(true)
                        }
                        className="p-6 md:p-8 bg-m3-secondary-container/30 border border-m3-secondary-container rounded-[28px] text-left cursor-pointer flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden group min-h-[220px]"
                      >
                        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform">
                          <Upload size={160} />
                        </div>

                        <div className="flex flex-col gap-3 relative z-10">
                          <div className="w-11 h-11 bg-m3-secondary-container rounded-xl flex items-center justify-center text-m3-on-secondary-container shadow-xs">
                            <Upload size={20} />
                          </div>
                          <h3 className="text-lg font-bold font-display text-m3-on-surface-variant">
                            Import Personal Data
                          </h3>
                          <p className="text-xs text-m3-on-surface-variant/95 leading-relaxed">
                            Directly import your exported Meta Instagram JSON
                            dataset or full ZIP archives to parse your real
                            saved bookmarks offline.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="mt-6 py-2.5 px-5 bg-m3-secondary text-m3-on-secondary-container rounded-full font-bold text-xs shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 relative z-10"
                        >
                          Upload Export file
                          <Upload size={13} />
                        </button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ) : filteredPosts.length === 0 ? (
                /* FILTERS RETURNED EMPTY STATE */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full flex flex-col items-center justify-center text-m3-outline gap-4 py-24 text-center max-w-sm mx-auto"
                >
                  <div className="w-16 h-16 rounded-full bg-m3-surface-container flex items-center justify-center text-m3-outline/80 shadow-inner">
                    <EyeOff size={28} className="stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-m3-on-surface">
                      No matches found
                    </p>
                    <p className="text-xs text-m3-on-surface-variant/80 mt-1.5 leading-relaxed">
                      Try clearing search strings, active collections, or date
                      selectors to expand results.
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="mt-2 px-5 py-2.5 bg-m3-primary text-m3-on-primary font-bold text-xs rounded-full shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </motion.div>
              ) : (
                <>
                  {/* <DashboardAnalytics posts={posts} /> */}

                  {/* CONTENT VIEWS */}
                  <motion.div
                    layout
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.03 } },
                    }}
                    className="w-full"
                  >
                    {gridDensity === "list" ? (
                      <Virtuoso
                        customScrollParent={scrollElement || undefined}
                        data={chunkArray(visiblePosts, 1)}
                        itemContent={(index, row) => {
                          if (gridDensity === "list") {
                            return (
                              <div className="flex flex-col w-full max-w-4xl mx-auto bg-m3-surface border-x border-b border-m3-outline-variant/40 first:border-t first:rounded-t-xl last:rounded-b-xl shadow-sm">
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
                                    <div
                                      key={post.id}
                                      id={`post-card-container-${post.id}`}
                                    >
                                      <motion.div
                                        onClick={(e) => toggleSelect(post.id, e)}
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
                                          type: "spring",
                                          stiffness: 400,
                                          damping: 22,
                                        }}
                                        className={`group flex items-center gap-3 sm:gap-4 p-2 sm:p-3 transition-all duration-300 cursor-pointer relative hover:scale-[1.01] hover:shadow-md hover:z-10 hover:bg-m3-surface rounded-xl ${
                                          selectedPostIds.includes(post.id)
                                            ? "bg-m3-primary-container/20"
                                            : isKeyboardFocused
                                              ? "bg-m3-primary-container/10"
                                              : "bg-transparent"
                                        }`}
                                      >
                                        {/* Checkbox for Select */}
                                        <div
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSelect(post.id, e);
                                          }}
                                          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                            selectedPostIds.includes(post.id)
                                              ? "bg-m3-primary border-m3-primary text-white scale-100"
                                              : "bg-black/35 border-white/40 text-transparent opacity-0 group-hover:opacity-100 scale-95"
                                          }`}
                                        >
                                          <Check size={11} className="stroke-[3]" />
                                        </div>
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
                                              @{highlightText(fullPost.creatorUsername || "creator", searchQuery)}
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
                                              highlightText(fullPost.caption, searchQuery)
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
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          
                          return null;
                        }}
                      />
                    ) : (
                      <div className="flex gap-4 w-full items-start justify-center">
                        {Array.from({ length: masonryColumns }).map((_, colIdx) => (
                          <div key={colIdx} className="flex-1 flex flex-col gap-4 min-w-0">
                            {visiblePosts
                              .filter((_, postIdx) => postIdx % masonryColumns === colIdx)
                              .map((post) => (
                                <div
                                  key={post.id}
                                  id={`post-card-container-${post.id}`}
                                  className="w-full"
                                >
                                  <MemoizedPostCard
                                    post={post}
                                    isSelected={selectedPostIds.includes(post.id)}
                                    onToggleSelect={(e) => toggleSelect(post.id, e)}
                                    onTagClick={toggleTagFilter}
                                    onCreatorClick={setCreatorFilter}
                                    onPeek={setPeekPost}
                                    onClick={() => setDetailPost(post)}
                                    isKeyboardFocused={
                                      keyboardFocusedId === post.id
                                    }
                                    onMouseEnter={() =>
                                      setKeyboardFocusedId(post.id)
                                    }
                                  />
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
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
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 15 }}
                onClick={scrollToTop}
                className="fixed bottom-24 md:bottom-8 right-6 z-40 w-12 h-12 rounded-full bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer border border-white/10"
                title="Scroll back to top"
              >
                <ArrowUp size={20} className="stroke-[2.5]" />
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

        {/* Telegram Quick Peek Modal Overlay */}
        <AnimatePresence>
          {peekPost && (
            <TelegramQuickPeek
              post={peekPost}
              onClose={() => setPeekPost(null)}
            />
          )}
        </AnimatePresence>

        {/* Full Page Post Detail Modal */}
        <AnimatePresence>
          {detailPost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto"
              onClick={() => setDetailPost(null)}
            >
              <div
                className="relative w-full max-w-[600px] my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Floating close button */}
                <button
                  type="button"
                  onClick={() => setDetailPost(null)}
                  className="absolute -top-10 right-0 w-10 sm:w-8 h-10 sm:h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center z-50 cursor-pointer transition-all"
                  title="Close Preview"
                >
                  <X size={16} />
                </button>

                <MemoizedPostCard
                  post={detailPost}
                  isSelected={false}
                  onToggleSelect={() => {}}
                  onTagClick={toggleTagFilter}
                  onCreatorClick={setCreatorFilter}
                  isDetailMode={true}
                />
              </div>
            </motion.div>
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
