import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { Post } from "../../types/post";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutGrid,
  Users,
  Folder,
  ArrowLeft,
  Image as ImageIcon,
  Inbox,
  Search,
  SlidersHorizontal,
  X,
  Film,
  Layers,
  Edit2,
  Trash2,
} from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { PostCard } from "../../components/ui/PostCard";
import { usePostStore } from "../../store/useStore";
import { VOCABULARY } from "../../constants/vocabulary";

interface GroupedViewProps {
  posts: Post[];
  onNavigate: (view: "home" | "grouped" | "analytics" | "settings") => void;
}

export const GroupedView: React.FC<GroupedViewProps> = React.memo(
  ({ posts, onNavigate }) => {
    const t = VOCABULARY.grouped;
    const [selectedGroup, setSelectedGroup] = useState<{
      type: "collection" | "creator" | "creators_folder";
      name: string;
    } | null>(() => {
      try {
        const saved = localStorage.getItem("grouped_selected_group");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    });

    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      name: string;
      type: "collection" | "creator" | "creators_folder";
    } | null>(null);

    // Close context menu on click outside
    useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }, []);

    const [visibleGroupsCount, setVisibleGroupsCount] = useState(24);
    const [visiblePostsCount, setVisiblePostsCount] = useState(24);

    // Search, filter and sort state for Group List
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [groupSortBy, setGroupSortBy] = useState<
      "count-desc" | "count-asc" | "name-asc" | "name-desc"
    >(() => {
      return (localStorage.getItem("grouped_sort_by") as any) || "count-desc";
    });
    const [groupFilterType, setGroupFilterType] = useState<
      "all" | "collection" | "creator"
    >(() => {
      return (localStorage.getItem("grouped_filter_type") as any) || "all";
    });

    // Search, filter and sort state for Selected Group Details
    const [postSearchQuery, setPostSearchQuery] = useState("");
    const [postSortBy, setPostSortBy] = useState<
      "newest" | "oldest" | "caption-asc" | "caption-desc"
    >(() => {
      return (localStorage.getItem("grouped_post_sort_by") as any) || "newest";
    });
    const [postFilterType, setPostFilterType] = useState<
      "all" | "image" | "video" | "carousel"
    >(() => {
      return (localStorage.getItem("grouped_post_filter_type") as any) || "all";
    });

    // Selected post for detail modal
    const [detailPost, setDetailPost] = useState<Post | null>(null);
    const storePosts = usePostStore((state) => state.posts);
    const activeDetailPost = useMemo(() => {
      return detailPost
        ? storePosts.find((p) => p.id === detailPost.id) || detailPost
        : null;
    }, [detailPost, storePosts]);

    // Sync selected group to localStorage
    useEffect(() => {
      try {
        if (selectedGroup) {
          localStorage.setItem(
            "grouped_selected_group",
            JSON.stringify(selectedGroup),
          );
        } else {
          localStorage.removeItem("grouped_selected_group");
        }
      } catch (e) {
        console.error("Failed to save selectedGroup to localStorage", e);
      }
    }, [selectedGroup]);

    // Sync group filter type to localStorage
    useEffect(() => {
      localStorage.setItem("grouped_filter_type", groupFilterType);
    }, [groupFilterType]);

    // Sync group sort preference to localStorage
    useEffect(() => {
      localStorage.setItem("grouped_sort_by", groupSortBy);
    }, [groupSortBy]);

    // Sync post sort preference to localStorage
    useEffect(() => {
      localStorage.setItem("grouped_post_sort_by", postSortBy);
    }, [postSortBy]);

    // Sync post filter preference to localStorage
    useEffect(() => {
      localStorage.setItem("grouped_post_filter_type", postFilterType);
    }, [postFilterType]);

    const observer = useRef<IntersectionObserver | null>(null);

    const setupObserver = useCallback(
      (node: HTMLDivElement | null) => {
        if (observer.current) {
          observer.current.disconnect();
        }
        if (node) {
          observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
              if (!selectedGroup) {
                setVisibleGroupsCount((prev) => prev + 24);
              } else {
                setVisiblePostsCount((prev) => prev + 24);
              }
            }
          });
          observer.current.observe(node);
        }
      },
      [selectedGroup],
    );

    // Reset detail-view page state when group changes
    const handleSelectGroup = (
      group: {
        type: "collection" | "creator" | "creators_folder";
        name: string;
      } | null,
    ) => {
      setSelectedGroup(group);
      setPostSearchQuery("");
      setPostSortBy("newest");
      setPostFilterType("all");
      setVisiblePostsCount(24);
    };

    const groupedByCollection = useMemo(() => {
      const groups: Record<string, Post[]> = Object.create(null);
      posts.forEach((post) => {
        post.collections?.forEach((collection) => {
          if (!groups[collection]) groups[collection] = [];
          groups[collection].push(post);
        });
      });
      return groups;
    }, [posts]);

    const groupedByCreator = useMemo(() => {
      const groups: Record<string, Post[]> = Object.create(null);
      posts.forEach((post) => {
        const creator = post.creatorUsername || "Unknown";
        if (!groups[creator]) groups[creator] = [];
        groups[creator].push(post);
      });
      return groups;
    }, [posts]);

    // Unique tags for PostDetailModal
    const allTags = useMemo(() => {
      const tagsSet = new Set<string>();
      posts.forEach((post) => {
        post.tags?.forEach((tag) => tagsSet.add(tag));
        post.hashtags?.forEach((hashtag) => tagsSet.add(hashtag));
      });
      return Array.from(tagsSet);
    }, [posts]);

    // Map groups to convenient lists
    const collectionsList = useMemo(() => {
      return Object.entries(groupedByCollection).map(([name, posts]) => ({
        name,
        posts,
        type: "collection" as const,
      }));
    }, [groupedByCollection]);

    const creatorsList = useMemo(() => {
      return Object.entries(groupedByCreator).map(([name, posts]) => ({
        name,
        posts,
        type: "creator" as const,
      }));
    }, [groupedByCreator]);

    // Filter and Sort Collections
    const filteredAndSortedCollections = useMemo(() => {
      let result = collectionsList.filter((item) =>
        item.name.toLowerCase().includes(groupSearchQuery.toLowerCase()),
      );

      result.sort((a, b) => {
        if (groupSortBy === "count-desc")
          return b.posts.length - a.posts.length;
        if (groupSortBy === "count-asc") return a.posts.length - b.posts.length;
        if (groupSortBy === "name-asc") return a.name.localeCompare(b.name);
        if (groupSortBy === "name-desc") return b.name.localeCompare(a.name);
        return 0;
      });

      return result;
    }, [collectionsList, groupSearchQuery, groupSortBy]);

    // Filter and Sort Creators
    const filteredAndSortedCreators = useMemo(() => {
      let result = creatorsList.filter((item) =>
        item.name.toLowerCase().includes(groupSearchQuery.toLowerCase()),
      );

      result.sort((a, b) => {
        if (groupSortBy === "count-desc")
          return b.posts.length - a.posts.length;
        if (groupSortBy === "count-asc") return a.posts.length - b.posts.length;
        if (groupSortBy === "name-asc") return a.name.localeCompare(b.name);
        if (groupSortBy === "name-desc") return b.name.localeCompare(a.name);
        return 0;
      });

      return result;
    }, [creatorsList, groupSearchQuery, groupSortBy]);

    const selectedPosts = useMemo(() => {
      if (!selectedGroup) return [];
      const group =
        selectedGroup.type === "collection"
          ? groupedByCollection[selectedGroup.name]
          : groupedByCreator[selectedGroup.name];
      return group || [];
    }, [selectedGroup, groupedByCollection, groupedByCreator]);

    // Filter and Sort Posts inside the selected group
    const filteredAndSortedPosts = useMemo(() => {
      if (!selectedGroup) return [];

      let result = [...selectedPosts];

      // 1. Search Query Filter (caption, tags, or username)
      if (postSearchQuery.trim()) {
        const q = postSearchQuery.toLowerCase();
        result = result.filter((post) => {
          const captionMatch = post.caption?.toLowerCase().includes(q);
          const tagMatch = post.tags?.some((tag) =>
            tag.toLowerCase().includes(q),
          );
          const hashtagMatch = post.hashtags?.some((hashtag) =>
            hashtag.toLowerCase().includes(q),
          );
          const creatorMatch = post.creatorUsername?.toLowerCase().includes(q);
          return captionMatch || tagMatch || hashtagMatch || creatorMatch;
        });
      }

      // 2. Media Type Filter
      if (postFilterType !== "all") {
        result = result.filter((post) => {
          const isVideo =
            post.mediaType === "video" ||
            (post.postUrl && post.postUrl.includes("/reel/"));
          if (postFilterType === "image") return post.mediaType === "image";
          if (postFilterType === "video") return isVideo;
          if (postFilterType === "carousel")
            return post.mediaType === "carousel";
          return true;
        });
      }

      // 3. Sorting
      result.sort((a, b) => {
        if (postSortBy === "newest") {
          const timeA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
          const timeB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
          return timeB - timeA;
        }
        if (postSortBy === "oldest") {
          const timeA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
          const timeB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
          return timeA - timeB;
        }
        if (postSortBy === "caption-asc") {
          return (a.caption || "").localeCompare(b.caption || "");
        }
        if (postSortBy === "caption-desc") {
          return (b.caption || "").localeCompare(a.caption || "");
        }
        return 0;
      });

      return result;
    }, [
      selectedGroup,
      selectedPosts,
      postSearchQuery,
      postFilterType,
      postSortBy,
    ]);

    const GroupCard = React.memo(
      ({
        name,
        posts,
        type,
        customIcon,
        customSubtitle,
      }: {
        name: string;
        posts: Post[];
        type: "collection" | "creator" | "creators_folder";
        customIcon?: React.ReactNode;
        customSubtitle?: string;
      }) => {
        // Determine the preview post based on the requested logic
        const previewPost = (() => {
          if (type === "creator" || type === "creators_folder") {
            // Find all image posts
            const imagePosts = posts.filter((p) => p.mediaType === "image");

            // Sort image posts by savedAt (oldest first)
            const sortedImages = [...imagePosts].sort((a, b) => {
              const timeA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
              const timeB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
              return timeA - timeB;
            });

            // Search for the oldest images that have a successful thumbnail status
            const oldestWithThumbnail = sortedImages.find(
              (p) => p.thumbnailStatus === "success" && p.thumbnailUrl,
            );
            if (oldestWithThumbnail) return oldestWithThumbnail;

            // If no image with a successful thumbnail exists, try other media types (carousel, video) sorted by oldest first
            const otherSortedWithThumbnail = [...posts]
              .filter((p) => p.thumbnailStatus === "success" && p.thumbnailUrl)
              .sort((a, b) => {
                const timeA = a.savedAt ? new Date(a.savedAt).getTime() : 0;
                const timeB = b.savedAt ? new Date(b.savedAt).getTime() : 0;
                return timeA - timeB;
              });
            if (otherSortedWithThumbnail.length > 0)
              return otherSortedWithThumbnail[0];

            // If absolutely no successful thumbnail exists, fall back to the overall oldest image post
            if (sortedImages.length > 0) return sortedImages[0];
          }

          // Default fallback (e.g. for collection)
          return posts[0];
        })();

        const countNumber = customSubtitle
          ? customSubtitle.split(" ")[0]
          : posts.length;
        const countLabel = customSubtitle
          ? customSubtitle.split(" ").slice(1).join(" ")
          : posts.length === 1
            ? t.itemLabel
            : t.itemsLabel;

        const handleContextMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            name,
            type,
          });
        };

        return (
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            key={name}
            onClick={() => handleSelectGroup({ type, name })}
            onContextMenu={handleContextMenu}
            className="group/card p-3 bg-m3-surface-container-low hover:bg-m3-surface-container rounded-2xl border border-m3-outline-variant/15 hover:border-m3-primary/30 hover:shadow-glass-md cursor-pointer flex flex-col gap-2.5 h-full transition-all duration-300"
          >
            <div className="aspect-square rounded-xl bg-m3-surface-container-highest overflow-hidden relative shadow-inner">
              {customIcon ? (
                <div className="w-full h-full flex items-center justify-center bg-m3-primary/10 group-hover/card:bg-m3-primary/15 transition-colors">
                  {customIcon}
                </div>
              ) : previewPost?.thumbnailStatus === "success" &&
                previewPost?.thumbnailUrl ? (
                <img
                  src={previewPost.thumbnailUrl}
                  alt={name}
                  className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700 ease-out"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="text-m3-outline/60" size={36} />
                </div>
              )}

              {/* Count Badge Overlay */}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-white/10 flex items-center gap-1 z-10 transition-transform group-hover/card:scale-105">
                <span className="font-mono">{countNumber}</span>
                <span className="opacity-80 text-[8px] uppercase tracking-wider">
                  {countLabel}
                </span>
              </div>
            </div>
            <div className="pt-0.5">
              <h3
                className="font-bold text-sm truncate text-m3-on-surface group-hover/card:text-m3-primary transition-colors text-center"
                title={name}
              >
                {name}
              </h3>
            </div>
          </motion.div>
        );
      },
    );
    GroupCard.displayName = "GroupCard";

    const GroupedThumbnail = React.memo(
      ({ post, onClick }: { post: Post; onClick: () => void }) => {
        const [hasError, setHasError] = useState(false);
        return (
          <div
            className="aspect-square cursor-pointer animate-fade-in"
            onClick={onClick}
          >
            <div className="aspect-square rounded-xl overflow-hidden bg-m3-surface-container-highest hover:ring-2 hover:ring-m3-primary/60 transition-all duration-200 shadow-sm">
              {post.thumbnailStatus === "success" &&
              post.thumbnailUrl &&
              !hasError ? (
                <img
                  src={post.thumbnailUrl}
                  alt={post.caption}
                  className="w-full h-full object-cover"
                  onError={() => setHasError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="text-m3-outline/60" size={24} />
                </div>
              )}
            </div>
          </div>
        );
      },
    );
    GroupedThumbnail.displayName = "GroupedThumbnail";

    return (
      <div className="p-4 md:p-6 space-y-4">
        <AnimatePresence mode="wait">
          {!selectedGroup || selectedGroup.type === "creators_folder" ? (
            <motion.div
              key={selectedGroup?.type || "top_level"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              {/* Header Block with Back Arrow */}
              <div className="flex items-center gap-2.5 pb-2 border-b border-m3-outline-variant/15">
                <button
                  onClick={() => {
                    if (selectedGroup?.type === "creators_folder") {
                      handleSelectGroup(null);
                    } else {
                      onNavigate("home");
                    }
                  }}
                  className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer hover:scale-105 active:scale-95 shadow-2xs"
                  title={
                    selectedGroup?.type === "creators_folder"
                      ? t.backToGroups
                      : VOCABULARY.shell.navDashboard
                  }
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h1 className="text-base font-bold font-display tracking-tight text-m3-on-surface">
                    {selectedGroup?.type === "creators_folder"
                      ? t.creators
                      : t.title}
                  </h1>
                </div>
              </div>

              {/* Search and Sort Bar for Group List */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-2 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant/15 shadow-2xs select-none">
                <div className="relative flex-1 min-w-[120px]">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-m3-on-surface-variant/60">
                    <Search size={13} />
                  </span>
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 bg-m3-surface-container rounded-lg border border-m3-outline-variant/30 focus:outline-none focus:border-m3-primary text-xs placeholder-m3-on-surface-variant/60 text-m3-on-surface transition-all"
                  />
                  {groupSearchQuery && (
                    <button
                      onClick={() => setGroupSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-m3-on-surface-variant/60 hover:text-m3-on-surface cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-m3-surface-container rounded-lg px-2.5 py-1 border border-m3-outline-variant/30 h-8 shrink-0">
                  <span className="text-[11px] font-medium text-m3-on-surface-variant/80 flex items-center gap-1">
                    <SlidersHorizontal size={12} />
                    {t.sortLabel}
                  </span>
                  <select
                    value={groupSortBy}
                    onChange={(e) => setGroupSortBy(e.target.value as any)}
                    className="bg-transparent text-[11px] font-bold focus:outline-none text-m3-on-surface cursor-pointer pr-1"
                  >
                    <option value="count-desc">{t.sortMostItems}</option>
                    <option value="count-asc">{t.sortFewestItems}</option>
                    <option value="name-asc">{t.sortAZ}</option>
                    <option value="name-desc">{t.sortZA}</option>
                  </select>
                </div>
              </div>

              {/* Unified Grid */}
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Show Creators folder card only at top level and if it matches search */}
                  {!selectedGroup &&
                    t.creators
                      .toLowerCase()
                      .includes(groupSearchQuery.toLowerCase()) && (
                      <GroupCard
                        key="creators_folder"
                        name={t.creators}
                        posts={posts}
                        type="creators_folder"
                        customIcon={
                          <Users className="text-m3-primary" size={36} />
                        }
                        customSubtitle={`${creatorsList.length} ${creatorsList.length === 1 ? t.creatorLabel : t.creators}`}
                      />
                    )}

                  {/* Render either Collections or Creators based on state */}
                  {(!selectedGroup
                    ? filteredAndSortedCollections
                    : filteredAndSortedCreators
                  )
                    .slice(0, visibleGroupsCount)
                    .map((item) => (
                      <GroupCard
                        key={item.name}
                        name={item.name}
                        posts={item.posts}
                        type={!selectedGroup ? "collection" : "creator"}
                      />
                    ))}
                  <div ref={setupObserver} className="col-span-full h-1" />
                </div>

                {/* Empty states */}
                {!selectedGroup &&
                  filteredAndSortedCollections.length === 0 &&
                  !t.creators
                    .toLowerCase()
                    .includes(groupSearchQuery.toLowerCase()) && (
                    <EmptyState
                      title={t.noCollectionsTitle}
                      message={t.noCollectionsDesc}
                      icon={<Folder size={32} />}
                    />
                  )}
                {selectedGroup?.type === "creators_folder" &&
                  filteredAndSortedCreators.length === 0 && (
                    <EmptyState
                      title={t.noCreatorsTitle}
                      message={t.noCreatorsDesc}
                      icon={<Users size={32} />}
                    />
                  )}
              </section>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-m3-outline-variant/10 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => {
                      if (selectedGroup.type === "creator") {
                        handleSelectGroup({
                          type: "creators_folder",
                          name: t.creators,
                        });
                      } else {
                        handleSelectGroup(null);
                      }
                    }}
                    className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer"
                    title={t.backToGroups}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-m3-primary flex items-center gap-1">
                      {selectedGroup.type === "collection" ? (
                        <Folder size={10} />
                      ) : (
                        <Users size={10} />
                      )}
                      {selectedGroup.type === "collection"
                        ? t.collectionLabel
                        : t.creatorLabel}
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-m3-on-surface truncate max-w-xs md:max-w-md leading-none">
                      {selectedGroup.name}
                    </h2>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-m3-on-surface-variant/80 px-2.5 py-1 bg-m3-surface-container-low rounded-lg border border-m3-outline-variant/10 w-fit shrink-0 select-none">
                  {filteredAndSortedPosts.length} / {selectedPosts.length}{" "}
                  {filteredAndSortedPosts.length === 1
                    ? t.itemLabel
                    : t.itemsLabel}
                </div>
              </div>

              {/* Filter, Search & Sort inside selected group */}
              <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 p-2 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant/15 shadow-2xs select-none">
                {/* Media Filter Tabs */}
                <div className="flex items-center gap-1 p-0.5 bg-m3-surface-container rounded-lg shrink-0 overflow-x-auto">
                  <button
                    onClick={() => setPostFilterType("all")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      postFilterType === "all"
                        ? "bg-m3-primary text-m3-on-primary shadow-xs"
                        : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                    }`}
                  >
                    {t.allMedia}
                  </button>
                  <button
                    onClick={() => setPostFilterType("image")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      postFilterType === "image"
                        ? "bg-m3-primary text-m3-on-primary shadow-xs"
                        : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                    }`}
                  >
                    <ImageIcon size={11} />
                    {t.images}
                  </button>
                  <button
                    onClick={() => setPostFilterType("video")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      postFilterType === "video"
                        ? "bg-m3-primary text-m3-on-primary shadow-xs"
                        : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                    }`}
                  >
                    <Film size={11} />
                    {t.videos}
                  </button>
                  <button
                    onClick={() => setPostFilterType("carousel")}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      postFilterType === "carousel"
                        ? "bg-m3-primary text-m3-on-primary shadow-xs"
                        : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                    }`}
                  >
                    <Layers size={11} />
                    {t.carousels}
                  </button>
                </div>

                {/* Inside Group Search and Sort controls */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 md:justify-end">
                  <div className="relative flex-1 max-w-xs min-w-[120px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-m3-on-surface-variant/60">
                      <Search size={13} />
                    </span>
                    <input
                      type="text"
                      placeholder={t.searchInGroup}
                      value={postSearchQuery}
                      onChange={(e) => setPostSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-8 py-1.5 bg-m3-surface-container rounded-lg border border-m3-outline-variant/30 focus:outline-none focus:border-m3-primary text-xs placeholder-m3-on-surface-variant/60 text-m3-on-surface transition-all"
                    />
                    {postSearchQuery && (
                      <button
                        onClick={() => setPostSearchQuery("")}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-m3-on-surface-variant/60 hover:text-m3-on-surface cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 bg-m3-surface-container rounded-lg px-2.5 py-1 border border-m3-outline-variant/30 h-8">
                    <span className="text-[11px] font-medium text-m3-on-surface-variant/80 flex items-center gap-1">
                      <SlidersHorizontal size={12} />
                      {t.sortLabel}
                    </span>
                    <select
                      value={postSortBy}
                      onChange={(e) => setPostSortBy(e.target.value as any)}
                      className="bg-transparent text-[11px] font-bold focus:outline-none text-m3-on-surface cursor-pointer pr-1"
                    >
                      <option value="newest">{t.sortSavedNewest}</option>
                      <option value="oldest">{t.sortSavedOldest}</option>
                      <option value="caption-asc">{t.sortCaptionAZ}</option>
                      <option value="caption-desc">{t.sortCaptionZA}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Posts Display */}
              {filteredAndSortedPosts.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {filteredAndSortedPosts
                    .slice(0, visiblePostsCount)
                    .map((post) => (
                      <GroupedThumbnail
                        key={post.id}
                        post={post}
                        onClick={() => setDetailPost(post)}
                      />
                    ))}
                  <div ref={setupObserver} className="col-span-full h-1" />
                </div>
              ) : (
                <EmptyState
                  title={t.noPostsTitle}
                  message={t.noPostsDesc}
                  icon={<Inbox size={32} />}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Detail Lightbox Modal for clicking items in Grouped Screen */}
        <AnimatePresence>
          {activeDetailPost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDetailPost(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="relative max-w-[420px] w-full max-h-[90vh] overflow-y-auto rounded-[24px] shadow-2xl bg-m3-surface"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Floating close button */}
                <button
                  type="button"
                  onClick={() => setDetailPost(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center z-50 cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md"
                  title="Close Preview"
                >
                  <X size={14} className="stroke-[2.5]" />
                </button>

                <PostCard
                  post={activeDetailPost}
                  isSelected={false}
                  onToggleSelect={() => {}}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Right-Click Context Menu */}
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="fixed z-[100] bg-m3-surface border border-m3-outline-variant/20 shadow-xl rounded-xl py-1 w-48 overflow-hidden flex flex-col"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-m3-outline-variant/10">
                <span className="text-[10px] font-bold font-mono text-m3-outline uppercase tracking-wider">
                  {contextMenu.type}
                </span>
                <p className="text-xs font-bold text-m3-on-surface truncate mt-0.5">
                  {contextMenu.name}
                </p>
              </div>

              <button
                onClick={() => setContextMenu(null)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-m3-on-surface hover:bg-m3-surface-container transition-colors w-full text-left cursor-pointer"
              >
                <Edit2 size={13} className="text-m3-primary" />
                Rename
              </button>

              <button
                onClick={() => setContextMenu(null)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left cursor-pointer"
              >
                <Trash2 size={13} className="text-red-500" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
