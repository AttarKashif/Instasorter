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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { PostCard } from "../../components/ui/PostCard";
import { usePostStore } from "../../store/useStore";
import { VOCABULARY } from "../../constants/vocabulary";
import { db } from "../../lib/db";

interface GroupedViewProps {
  posts: Post[];
  onNavigate: (view: "home" | "grouped" | "analytics" | "settings") => void;
}

export const GroupedView: React.FC<GroupedViewProps> = React.memo(
  ({ posts, onNavigate }) => {
    const t = VOCABULARY.grouped;

    const [groupFilterType, setGroupFilterType] = useState<
      "collection" | "creator"
    >(() => {
      try {
        const savedGroup = localStorage.getItem("grouped_selected_group");
        if (savedGroup) {
          const parsed = JSON.parse(savedGroup);
          if (parsed?.type === "creators_folder") {
            return "creator";
          }
        }
      } catch {}
      const savedType = localStorage.getItem("grouped_filter_type");
      return savedType === "creator" ? "creator" : "collection";
    });

    const [selectedGroup, setSelectedGroup] = useState<{
      type: "collection" | "creator" | "creators_folder";
      name: string;
    } | null>(() => {
      try {
        const saved = localStorage.getItem("grouped_selected_group");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.type === "creators_folder") {
            return null;
          }
          return parsed;
        }
        return null;
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

    // Dialog state for renaming collections/creators
    const [renamingGroup, setRenamingGroup] = useState<{
      type: "collection" | "creator";
      name: string;
    } | null>(null);
    const [newName, setNewName] = useState("");

    // Dialog state for deleting collections/creators
    const [deletingGroup, setDeletingGroup] = useState<{
      type: "collection" | "creator";
      name: string;
    } | null>(null);

    // Collapsible Advanced Curator Bar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
      try {
        const saved = localStorage.getItem("grouped_is_sidebar_open");
        return saved ? JSON.parse(saved) : false;
      } catch {
        return false;
      }
    });

    useEffect(() => {
      localStorage.setItem("grouped_is_sidebar_open", JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);

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

    const handleRenameExecute = async (oldName: string, targetName: string) => {
      const trimmed = targetName.trim();
      if (!trimmed || trimmed === oldName) return;

      if (renamingGroup?.type === "collection") {
        const allPosts = await db.posts.toArray();
        const updatedPosts = allPosts.map(post => {
          if (post.collections?.includes(oldName)) {
            const nextCollections = post.collections.map(c => c === oldName ? trimmed : c);
            return { ...post, collections: nextCollections };
          }
          return post;
        });

        const postsToUpdate = allPosts.filter(post => post.collections?.includes(oldName));
        for (const post of postsToUpdate) {
          const nextCollections = (post.collections || []).map(c => c === oldName ? trimmed : c);
          await db.posts.update(post.id, { collections: nextCollections });
        }

        usePostStore.getState().setPosts(updatedPosts);

        if (selectedGroup && selectedGroup.type === "collection" && selectedGroup.name === oldName) {
          setSelectedGroup({ type: "collection", name: trimmed });
        }
      } else if (renamingGroup?.type === "creator") {
        const allPosts = await db.posts.toArray();
        const updatedPosts = allPosts.map(post => {
          if (post.creatorUsername === oldName) {
            return { ...post, creatorUsername: trimmed };
          }
          return post;
        });

        const postsToUpdate = allPosts.filter(post => post.creatorUsername === oldName);
        for (const post of postsToUpdate) {
          await db.posts.update(post.id, { creatorUsername: trimmed });
        }

        usePostStore.getState().setPosts(updatedPosts);

        if (selectedGroup && selectedGroup.type === "creator" && selectedGroup.name === oldName) {
          setSelectedGroup({ type: "creator", name: trimmed });
        }
      }
      setRenamingGroup(null);
      setNewName("");
    };

    const handleDeleteExecute = async (targetName: string) => {
      if (deletingGroup?.type === "collection") {
        const allPosts = await db.posts.toArray();
        const updatedPosts = allPosts.map(post => {
          if (post.collections?.includes(targetName)) {
            const nextCollections = post.collections.filter(c => c !== targetName);
            return { ...post, collections: nextCollections };
          }
          return post;
        });

        const postsToUpdate = allPosts.filter(post => post.collections?.includes(targetName));
        for (const post of postsToUpdate) {
          const nextCollections = (post.collections || []).filter(c => c !== targetName);
          await db.posts.update(post.id, { collections: nextCollections });
        }

        usePostStore.getState().setPosts(updatedPosts);

        if (selectedGroup && selectedGroup.type === "collection" && selectedGroup.name === targetName) {
          setSelectedGroup(null);
        }
      } else if (deletingGroup?.type === "creator") {
        const allPosts = await db.posts.toArray();
        const postsToDelete = allPosts.filter(post => post.creatorUsername === targetName);
        const idsToDelete = postsToDelete.map(p => p.id);

        await db.posts.bulkDelete(idsToDelete);

        const updatedPosts = allPosts.filter(post => post.creatorUsername !== targetName);
        usePostStore.getState().setPosts(updatedPosts);

        if (selectedGroup && selectedGroup.type === "creator" && selectedGroup.name === targetName) {
          setSelectedGroup(null);
        }
      }
      setDeletingGroup(null);
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

    const GroupPreviewCover = React.memo(({ posts, type, customIcon }: { posts: Post[]; type: "collection" | "creator" | "creators_folder"; customIcon?: React.ReactNode }) => {
      if (customIcon) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-m3-primary/10 group-hover/card:bg-m3-primary/15 transition-colors">
            {customIcon}
          </div>
        );
      }

      // Filter for posts with successful thumbnails
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
            {/* Ambient shadow album stacks */}
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
            {type === "creator" ? (
              <Users size={32} className="stroke-[1.5]" />
            ) : (
              <Folder size={32} className="stroke-[1.5]" />
            )}
          </div>
        );
      }
    });
    GroupPreviewCover.displayName = "GroupPreviewCover";

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
            whileHover={{ scale: 1.015, y: -3 }}
            whileTap={{ scale: 0.985 }}
            key={name}
            onClick={() => handleSelectGroup({ type, name })}
            onContextMenu={handleContextMenu}
            className="group/card p-3 bg-m3-surface-low hover:bg-m3-surface-container rounded-[20px] border border-m3-outline-variant/25 hover:border-m3-primary/30 hover:shadow-glass-md cursor-pointer flex flex-col gap-2.5 h-full transition-all duration-300"
          >
            <div className="aspect-square rounded-xl bg-m3-surface-container-highest overflow-hidden relative shadow-inner">
              <GroupPreviewCover posts={posts} type={type} customIcon={customIcon} />

              {/* Count Badge Overlay */}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-white/10 flex items-center gap-1 z-20 transition-transform group-hover/card:scale-105">
                <span className="font-mono">{countNumber}</span>
                <span className="opacity-80 text-[8px] uppercase tracking-wider">
                  {countLabel}
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
                  referrerPolicy="no-referrer"
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
      <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-6 max-w-7xl mx-auto w-full select-none space-y-4">
        <AnimatePresence mode="wait">
          {!selectedGroup ? (
            <motion.div
              key="top_level_groups"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              {/* Compact Unified Control Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-m3-outline-variant/15">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onNavigate("home")}
                    className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer hover:scale-105 active:scale-95 shadow-2xs shrink-0"
                    title={VOCABULARY.shell.navDashboard}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex justify-center p-1 bg-m3-surface-container-low border border-m3-outline-variant/15 rounded-2xl w-full max-w-xs select-none shadow-glass-sm shrink-0">
                    <button
                      onClick={() => setGroupFilterType("collection")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative px-2.5`}
                    >
                      {groupFilterType === "collection" && (
                        <motion.div
                          layoutId="active-group-tab"
                          className="absolute inset-0 bg-m3-primary rounded-xl shadow-xs"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Folder size={13} className={`relative z-10 transition-colors duration-200 ${groupFilterType === "collection" ? "text-m3-on-primary" : "text-m3-on-surface-variant"}`} />
                      <span className={`relative z-10 transition-colors duration-200 font-display ${groupFilterType === "collection" ? "text-m3-on-primary" : "text-m3-on-surface-variant"}`}>
                        Collections ({collectionsList.length})
                      </span>
                    </button>
                    <button
                      onClick={() => setGroupFilterType("creator")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer relative px-2.5`}
                    >
                      {groupFilterType === "creator" && (
                        <motion.div
                          layoutId="active-group-tab"
                          className="absolute inset-0 bg-m3-primary rounded-xl shadow-xs"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Users size={13} className={`relative z-10 transition-colors duration-200 ${groupFilterType === "creator" ? "text-m3-on-primary" : "text-m3-on-surface-variant"}`} />
                      <span className={`relative z-10 transition-colors duration-200 font-display ${groupFilterType === "creator" ? "text-m3-on-primary" : "text-m3-on-surface-variant"}`}>
                        Creators ({creatorsList.length})
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {/* Grouped View Search Input */}
                  <div className="relative w-36 sm:w-48 md:w-60 lg:w-64 shrink-0">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-m3-outline">
                      <Search size={12} />
                    </span>
                    <input
                      placeholder="Search..."
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      className="pl-7 pr-7 py-1 w-full border border-m3-outline-variant/30 bg-m3-surface-container-low text-m3-on-surface hover:border-m3-outline focus:border-m3-primary focus:bg-m3-surface rounded-lg text-[11px] focus:outline-none transition-all h-8 font-sans"
                    />
                    {groupSearchQuery && (
                      <button
                        onClick={() => setGroupSearchQuery("")}
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-m3-outline hover:text-m3-on-surface transition-all cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Curator Bar Button */}
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer h-8 shadow-glass-sm font-display shrink-0 ${
                      isSidebarOpen
                        ? "bg-m3-primary border-m3-primary text-m3-on-primary"
                        : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface hover:bg-m3-surface-container"
                    }`}
                    title="Toggle Curator Bar search & filters"
                  >
                    <SlidersHorizontal size={12} className="stroke-[2]" />
                    <span>Curator Bar</span>
                    {groupSearchQuery && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSidebarOpen ? "bg-white animate-pulse" : "bg-m3-primary"}`} />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Advanced Curator Bar panel */}
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant/15 shadow-2xs select-none">
                      <span className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1.5 pl-1 font-display">
                        <Folder size={13} />
                        <span>Sort & Layout Options</span>
                      </span>

                      <div className="flex items-center gap-1.5 bg-m3-surface rounded-xl px-2.5 py-1 border border-m3-outline-variant/20 h-8 shrink-0 shadow-glass-sm">
                        <span className="text-[11px] font-medium text-m3-on-surface-variant/80 flex items-center gap-1 font-display">
                          <SlidersHorizontal size={12} />
                          {t.sortLabel}
                        </span>
                        <select
                          value={groupSortBy}
                          onChange={(e) => setGroupSortBy(e.target.value as any)}
                          className="bg-transparent text-[11px] font-bold focus:outline-none text-m3-on-surface cursor-pointer pr-1 font-sans"
                        >
                          <option value="count-desc">{t.sortMostItems}</option>
                          <option value="count-asc">{t.sortFewestItems}</option>
                          <option value="name-asc">{t.sortAZ}</option>
                          <option value="name-desc">{t.sortZA}</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid Section */}
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {(groupFilterType === "collection"
                    ? filteredAndSortedCollections
                    : filteredAndSortedCreators
                  )
                    .slice(0, visibleGroupsCount)
                    .map((item) => (
                      <GroupCard
                        key={item.name}
                        name={item.name}
                        posts={item.posts}
                        type={groupFilterType}
                      />
                    ))}
                  <div ref={setupObserver} className="col-span-full h-1" />
                </div>

                {/* Empty states */}
                {groupFilterType === "collection" &&
                  filteredAndSortedCollections.length === 0 && (
                    <EmptyState
                      title={t.noCollectionsTitle}
                      message={t.noCollectionsDesc}
                      icon={<Folder size={32} />}
                    />
                  )}
                {groupFilterType === "creator" &&
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
              {/* Header Block Level 2 */}
              <div className="flex items-center justify-between gap-2 border-b border-m3-outline-variant/10 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleSelectGroup(null)}
                    className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer"
                    title={t.backToGroups}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-m3-primary flex items-center gap-1 font-display">
                      {selectedGroup.type === "collection" ? (
                        <Folder size={10} />
                      ) : (
                        <Users size={10} />
                      )}
                      {selectedGroup.type === "collection"
                        ? t.collectionLabel
                        : t.creatorLabel}
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-m3-on-surface truncate max-w-xs md:max-w-md leading-none font-display">
                      {selectedGroup.name}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[11px] font-bold text-m3-on-surface-variant/80 px-2.5 py-1 bg-m3-surface-container-low rounded-lg border border-m3-outline-variant/10 select-none h-8 flex items-center">
                    {filteredAndSortedPosts.length} / {selectedPosts.length}{" "}
                    {filteredAndSortedPosts.length === 1
                      ? t.itemLabel
                      : t.itemsLabel}
                  </div>

                  {/* Curator Bar Toggle Button */}
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer h-8 shadow-glass-sm font-display ${
                      isSidebarOpen
                        ? "bg-m3-primary border-m3-primary text-m3-on-primary"
                        : "bg-m3-surface border-m3-outline-variant/30 text-m3-on-surface hover:bg-m3-surface-container"
                    }`}
                    title="Toggle Curator Bar search & filters"
                  >
                    <SlidersHorizontal size={12} className="stroke-[2]" />
                    <span className="hidden sm:inline">Curator Bar</span>
                    {(postSearchQuery || postFilterType !== "all") && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSidebarOpen ? "bg-white animate-pulse" : "bg-m3-primary"}`} />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Advanced Curator Bar for selected group */}
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant/15 shadow-2xs select-none mb-3">
                      {/* Media Filter Tabs */}
                      <div className="flex items-center gap-1 p-0.5 bg-m3-surface-container rounded-lg shrink-0 overflow-x-auto">
                        <button
                          onClick={() => setPostFilterType("all")}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer font-sans ${
                            postFilterType === "all"
                              ? "bg-m3-primary text-m3-on-primary shadow-xs"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                          }`}
                        >
                          {t.allMedia}
                        </button>
                        <button
                          onClick={() => setPostFilterType("image")}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer font-sans ${
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
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer font-sans ${
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
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer font-sans ${
                            postFilterType === "carousel"
                              ? "bg-m3-primary text-m3-on-primary shadow-xs"
                              : "text-m3-on-surface-variant hover:bg-m3-surface-variant/40"
                          }`}
                        >
                          <Layers size={11} />
                          {t.carousels}
                        </button>
                      </div>

                      {/* Search and Sort */}
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
                            className="w-full pl-8 pr-8 py-1.5 bg-m3-surface-container rounded-lg border border-m3-outline-variant/30 focus:outline-none focus:border-m3-primary text-xs placeholder-m3-on-surface-variant/60 text-m3-on-surface transition-all font-sans"
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
                          <span className="text-[11px] font-medium text-m3-on-surface-variant/80 flex items-center gap-1 font-display">
                            <SlidersHorizontal size={12} />
                            {t.sortLabel}
                          </span>
                          <select
                            value={postSortBy}
                            onChange={(e) => setPostSortBy(e.target.value as any)}
                            className="bg-transparent text-[11px] font-bold focus:outline-none text-m3-on-surface cursor-pointer pr-1 font-sans"
                          >
                            <option value="newest">{t.sortSavedNewest}</option>
                            <option value="oldest">{t.sortSavedOldest}</option>
                            <option value="caption-asc">{t.sortCaptionAZ}</option>
                            <option value="caption-desc">{t.sortCaptionZA}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

        {/* Dynamic Detail Lightbox Modal */}
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
          {contextMenu && (contextMenu.type === "collection" || contextMenu.type === "creator") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="fixed z-[100] bg-m3-surface border border-m3-outline-variant/20 shadow-xl rounded-xl py-1 w-48 overflow-hidden flex flex-col select-none"
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
                onClick={() => {
                  setRenamingGroup({ type: contextMenu.type as any, name: contextMenu.name });
                  setNewName(contextMenu.name);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-m3-on-surface hover:bg-m3-surface-container transition-colors w-full text-left cursor-pointer font-sans"
              >
                <Edit2 size={13} className="text-m3-primary" />
                Rename
              </button>

              <button
                onClick={() => {
                  setDeletingGroup({ type: contextMenu.type as any, name: contextMenu.name });
                  setContextMenu(null);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full text-left cursor-pointer font-sans"
              >
                <Trash2 size={13} className="text-red-500" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real Renaming Modal Dialog */}
        <AnimatePresence>
          {renamingGroup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4"
              onClick={() => {
                setRenamingGroup(null);
                setNewName("");
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-m3-surface border border-m3-outline-variant/30 p-5 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col gap-4 select-none text-m3-on-surface"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h3 className="font-bold font-display text-base">
                    Rename {renamingGroup.type === "collection" ? "Collection" : "Creator"}
                  </h3>
                  <p className="text-xs text-m3-on-surface-variant mt-1 font-sans">
                    Change the custom name across all matching bookmark records locally.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono text-m3-outline uppercase tracking-wider">
                    New Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter new label..."
                    className="w-full px-3 py-2 bg-m3-surface-container rounded-lg border border-m3-outline-variant/40 focus:outline-none focus:border-m3-primary text-xs text-m3-on-surface font-sans"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-m3-outline-variant/10">
                  <button
                    onClick={() => {
                      setRenamingGroup(null);
                      setNewName("");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-m3-on-surface-variant hover:bg-m3-surface-container transition-colors cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRenameExecute(renamingGroup.name, newName)}
                    disabled={!newName.trim() || newName.trim() === renamingGroup.name}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 transition-all disabled:opacity-50 cursor-pointer font-display"
                  >
                    Rename
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Real Deletion Modal Dialog */}
        <AnimatePresence>
          {deletingGroup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4"
              onClick={() => setDeletingGroup(null)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-m3-surface border border-m3-outline-variant/30 p-5 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col gap-4 select-none text-m3-on-surface"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h3 className="font-bold font-display text-base text-red-600 dark:text-red-400">
                    Delete {deletingGroup.type === "collection" ? "Collection" : "Creator"}?
                  </h3>
                  <p className="text-xs text-m3-on-surface-variant mt-2 font-sans leading-relaxed">
                    {deletingGroup.type === "collection" ? (
                      <>
                        Are you sure you want to delete collection <span className="font-bold text-m3-on-surface font-mono">"{deletingGroup.name}"</span>?
                        This will remove this collection label from all posts. The saved posts themselves will not be deleted.
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete creator <span className="font-bold text-m3-on-surface font-mono">"{deletingGroup.name}"</span>?
                        This will irreversibly delete <span className="font-bold text-red-500">all saved posts</span> belonging to this creator.
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-m3-outline-variant/10">
                  <button
                    onClick={() => setDeletingGroup(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-m3-on-surface-variant hover:bg-m3-surface-container transition-colors cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteExecute(deletingGroup.name)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer font-display"
                  >
                    Delete Irreversibly
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
