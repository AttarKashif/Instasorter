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
  Star,
  RotateCcw,
  Pin,
  Hash,
  Plus,
  MoreVertical,
  FolderTree,
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/ui/EmptyState";
import { PostCard } from "../../components/ui/PostCard";
import { usePostStore } from "../../store/useStore";
import { VOCABULARY } from "../../constants/vocabulary";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import { calculateGridColumns, calculateGridGap } from "../../lib/responsive";
import { useMediaQuery } from "../../hooks/useMediaQuery";

interface GroupedViewProps {
  posts: Post[];
  onNavigate: (view: "home" | "grouped" | "analytics" | "settings") => void;
  viewportWidth?: number;
}

export const GroupedView: React.FC<GroupedViewProps> = React.memo(
  ({ posts, onNavigate, viewportWidth }) => {
    const t = VOCABULARY.grouped;

    // Resolve viewportWidth using the prop or fallback to window width
    const currentViewportWidth = viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1024);
    const columns = calculateGridColumns(currentViewportWidth);
    const gapSize = calculateGridGap(currentViewportWidth);

    const [groupFilterType, setGroupFilterType] = useState<
      "collection" | "creator" | "tag"
    >(() => {
      try {
        const savedGroup = localStorage.getItem("grouped_selected_group");
        if (savedGroup) {
          const parsed = JSON.parse(savedGroup);
          if (parsed?.type === "creators_folder") {
            return "creator";
          }
          if (parsed?.type === "tag") {
            return "tag";
          }
        }
      } catch {}
      const savedType = localStorage.getItem("grouped_filter_type");
      return savedType === "creator" ? "creator" : savedType === "tag" ? "tag" : "collection";
    });

    const [selectedGroup, setSelectedGroup] = useState<{
      type: "collection" | "creator" | "creators_folder" | "tag";
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

    const [selectedFolderType, setSelectedFolderType] = useState<
      "collection" | "creator" | "tag" | null
    >(() => {
      try {
        const savedGroup = localStorage.getItem("grouped_selected_group");
        if (savedGroup) {
          const parsed = JSON.parse(savedGroup);
          if (parsed?.type === "creators_folder") {
            return "creator";
          }
          if (parsed?.type === "tag") {
            return "tag";
          }
          if (parsed?.type === "collection" || parsed?.type === "creator") {
            return parsed.type;
          }
        }
        const savedFolder = localStorage.getItem("grouped_selected_folder_type");
        if (savedFolder === "collection" || savedFolder === "creator" || savedFolder === "tag") {
          return savedFolder;
        }
      } catch {}
      return null;
    });

    useEffect(() => {
      if (selectedFolderType) {
        localStorage.setItem("grouped_selected_folder_type", selectedFolderType);
      } else {
        localStorage.removeItem("grouped_selected_folder_type");
      }
    }, [selectedFolderType]);

    const [dbCollectionNames, setDbCollectionNames] = useState<string[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    const loadDbCollections = useCallback(async () => {
      try {
        const colls = await db.collections.toArray();
        const names = colls.map((c) => c.name);
        setDbCollectionNames(names);
      } catch (err) {
        console.error("Failed to load collections from db:", err);
      }
    }, []);

    useEffect(() => {
      loadDbCollections();
    }, [loadDbCollections]);

    const handleCreateCollection = async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      try {
        const existing = await db.collections
          .where("name")
          .equalsIgnoreCase(trimmed)
          .first();
        if (existing) {
          toast.error(`A folder named "${trimmed}" already exists.`);
          return;
        }

        await db.collections.add({
          id: `coll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: trimmed,
          createdAt: new Date().toISOString(),
        });

        triggerVibration("medium");
        toast.success(`Created folder "${trimmed}"!`, { icon: "📁" });
        await loadDbCollections();
      } catch (err) {
        console.error("Failed to create collection:", err);
        toast.error("Failed to create folder.");
      }
    };

    const handleSelectFolderType = (type: "collection" | "creator" | "tag" | null) => {
      triggerVibration(type ? "pulse" : "tap");
      setSelectedFolderType(type);
      if (type) {
        setGroupFilterType(type);
      }
    };

    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      name: string;
      type: "collection" | "creator" | "creators_folder" | "tag";
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

    const collectionCovers = usePostStore((state) => state.collectionCovers);
    const setCollectionCover = usePostStore((state) => state.setCollectionCover);
    const loadCollectionCovers = usePostStore((state) => state.loadCollectionCovers);
    const pinnedCollections = usePostStore((state) => state.pinnedCollections);
    const togglePinCollection = usePostStore((state) => state.togglePinCollection);

    useEffect(() => {
      loadCollectionCovers();
    }, [loadCollectionCovers]);

    const handleSetCollectionCover = useCallback(
      async (collectionName: string, post: Post) => {
        const imageUrl = post.thumbnailUrl || "";
        setCollectionCover(collectionName, post.id, imageUrl);

        try {
          const existing = await db.collections
            .where("name")
            .equals(collectionName)
            .first();
          if (existing) {
            await db.collections.update(existing.id, {
              coverPostId: post.id,
              coverImageUrl: imageUrl,
            });
          } else {
            await db.collections.add({
              id: `coll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: collectionName,
              coverPostId: post.id,
              coverImageUrl: imageUrl,
              createdAt: new Date().toISOString(),
            });
          }
          toast.success(`Set cover image for "${collectionName}"!`, {
            icon: "🖼️",
          });
        } catch (err) {
          console.error("Failed to persist collection cover:", err);
        }
      },
      [setCollectionCover]
    );

    const handleResetCollectionCover = useCallback(
      async (collectionName: string) => {
        setCollectionCover(collectionName, "", "");
        try {
          const existing = await db.collections
            .where("name")
            .equals(collectionName)
            .first();
          if (existing) {
            await db.collections.update(existing.id, {
              coverPostId: "",
              coverImageUrl: "",
            });
          }
          toast.success(`Reset cover image for "${collectionName}"`, {
            icon: "🔄",
          });
        } catch (err) {
          console.error("Failed to reset collection cover:", err);
        }
      },
      [setCollectionCover]
    );

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
        type: "collection" | "creator" | "creators_folder" | "tag";
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

        try {
          const existing = await db.collections.where("name").equals(oldName).first();
          if (existing) {
            await db.collections.update(existing.id, { name: trimmed });
          } else {
            await db.collections.add({
              id: `coll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: trimmed,
              createdAt: new Date().toISOString(),
            });
          }
          await loadDbCollections();
        } catch (err) {
          console.error("Failed to rename db collection record:", err);
        }

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
      triggerVibration("thud");
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

        try {
          const existing = await db.collections.where("name").equals(targetName).first();
          if (existing) {
            await db.collections.delete(existing.id);
          }
          await loadDbCollections();
        } catch (err) {
          console.error("Failed to delete db collection record:", err);
        }

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

    const groupedByTag = useMemo(() => {
      const groups: Record<string, Post[]> = Object.create(null);
      posts.forEach((post) => {
        const postTags = new Set<string>();
        post.tags?.forEach((tag) => postTags.add(tag));
        post.hashtags?.forEach((hashtag) => postTags.add(hashtag));
        postTags.forEach((tag) => {
          if (!tag) return;
          const cleanTag = tag.startsWith("#") ? tag.slice(1) : tag;
          if (!cleanTag) return;
          if (!groups[cleanTag]) groups[cleanTag] = [];
          groups[cleanTag].push(post);
        });
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

    // Map groups to convenient lists, including empty DB collection folders
    const collectionsList = useMemo(() => {
      const allNames = new Set<string>();
      dbCollectionNames.forEach((name) => {
        if (name) allNames.add(name);
      });
      Object.keys(groupedByCollection).forEach((name) => {
        if (name) allNames.add(name);
      });

      return Array.from(allNames).map((name) => ({
        name,
        posts: groupedByCollection[name] || [],
        type: "collection" as const,
      }));
    }, [groupedByCollection, dbCollectionNames]);

    const creatorsList = useMemo(() => {
      return Object.entries(groupedByCreator).map(([name, posts]) => ({
        name,
        posts,
        type: "creator" as const,
      }));
    }, [groupedByCreator]);

    const tagsList = useMemo(() => {
      return Object.entries(groupedByTag).map(([name, posts]) => ({
        name: `#${name}`,
        posts,
        type: "tag" as const,
      }));
    }, [groupedByTag]);

    // Filter and Sort Collections
    const filteredAndSortedCollections = useMemo(() => {
      let result = collectionsList.filter((item) =>
        item.name.toLowerCase().includes(groupSearchQuery.toLowerCase()),
      );

      result.sort((a, b) => {
        const aPinned = pinnedCollections.includes(a.name) ? 1 : 0;
        const bPinned = pinnedCollections.includes(b.name) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        if (groupSortBy === "count-desc")
          return b.posts.length - a.posts.length;
        if (groupSortBy === "count-asc") return a.posts.length - b.posts.length;
        if (groupSortBy === "name-asc") return a.name.localeCompare(b.name);
        if (groupSortBy === "name-desc") return b.name.localeCompare(a.name);
        return 0;
      });

      return result;
    }, [collectionsList, groupSearchQuery, groupSortBy, pinnedCollections]);

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

    // Filter and Sort Tags
    const filteredAndSortedTags = useMemo(() => {
      let result = tagsList.filter((item) =>
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
    }, [tagsList, groupSearchQuery, groupSortBy]);

    const selectedPosts = useMemo(() => {
      if (!selectedGroup) return [];
      if (selectedGroup.type === "collection") {
        return groupedByCollection[selectedGroup.name] || [];
      } else if (selectedGroup.type === "tag") {
        const cleanName = selectedGroup.name.startsWith("#") ? selectedGroup.name.slice(1) : selectedGroup.name;
        return groupedByTag[cleanName] || [];
      } else {
        return groupedByCreator[selectedGroup.name] || [];
      }
    }, [selectedGroup, groupedByCollection, groupedByCreator, groupedByTag]);

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

    const GroupPreviewCover = React.memo(({ posts, type, customIcon, name }: { posts: Post[]; type: "collection" | "creator" | "creators_folder" | "tag"; customIcon?: React.ReactNode; name?: string }) => {
      if (customIcon) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-m3-primary/10 group-hover/card:bg-m3-primary/15 transition-colors">
            {customIcon}
          </div>
        );
      }

      const collectionCovers = usePostStore((state) => state.collectionCovers);
      const customCover = name ? collectionCovers[name] : undefined;
      const customCoverPost = customCover?.coverPostId ? posts.find(p => p.id === customCover.coverPostId) : undefined;
      const customCoverUrl = customCover?.coverImageUrl || customCoverPost?.thumbnailUrl;

      if (type === "collection" && customCoverUrl) {
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
            ) : type === "tag" ? (
              <Hash size={32} className="stroke-[1.5]" />
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
        onClick,
      }: {
        name: string;
        posts: Post[];
        type: "collection" | "creator" | "creators_folder" | "tag";
        customIcon?: React.ReactNode;
        customSubtitle?: string;
        onClick?: () => void;
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

        const longPressTimer = useRef<any>(null);
        const isLongPressActive = useRef(false);

        const startPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
          if (type !== "collection" && type !== "creator") return;
          isLongPressActive.current = false;
          
          const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
          const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

          longPressTimer.current = setTimeout(() => {
            isLongPressActive.current = true;
            triggerVibration("medium");
            setContextMenu({
              x: clientX,
              y: clientY,
              name,
              type: type as any,
            });
          }, 600);
        }, [name, type]);

        const endPress = useCallback(() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
          }
        }, []);

        const movePress = useCallback(() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
          }
        }, []);

        const handleCardClick = useCallback((e: React.MouseEvent) => {
          if (isLongPressActive.current) {
            e.preventDefault();
            e.stopPropagation();
            isLongPressActive.current = false;
            return;
          }
          if (onClick) {
            onClick();
          } else {
            handleSelectGroup({ type, name });
          }
        }, [onClick, type, name]);

        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 25,
            }}
            whileHover={{ scale: 1.015, y: -3 }}
            whileTap={{ scale: 0.985 }}
            key={name}
            onClick={handleCardClick}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
            onTouchMove={movePress}
            onContextMenu={handleContextMenu}
            className="group/card relative p-3 bg-m3-surface-low hover:bg-m3-surface-container rounded-[20px] border border-m3-outline-variant/25 hover:border-m3-primary/30 hover:shadow-glass-md cursor-pointer flex flex-col gap-2.5 h-full transition-all duration-300"
          >
            <div className="aspect-square rounded-xl bg-m3-surface-container-highest overflow-hidden relative shadow-inner">
              <GroupPreviewCover posts={posts} type={type} customIcon={customIcon} name={name} />

              {/* Pin Button for Collections */}
              {type === "collection" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinCollection(name);
                    triggerVibration("medium");
                  }}
                  className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-md shadow-sm border transition-all z-20 cursor-pointer ${
                    pinnedCollections.includes(name)
                      ? "bg-amber-500 text-stone-950 border-amber-300"
                      : "bg-black/60 text-white border-white/10 opacity-0 group-hover/card:opacity-100 hover:bg-black/80"
                  }`}
                  title={pinnedCollections.includes(name) ? "Unpin collection" : "Pin collection"}
                >
                  <Pin size={12} className={pinnedCollections.includes(name) ? "fill-current" : ""} />
                </button>
              )}

              {/* Options Menu Button (Three Dots) */}
              {(type === "collection" || type === "creator") && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    triggerVibration("light");
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      x: rect.left,
                      y: rect.bottom + 5,
                      name,
                      type: type as any,
                    });
                  }}
                  className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10 opacity-0 group-hover/card:opacity-100 md:opacity-0 max-md:opacity-100 hover:bg-black/80 transition-all z-20 cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center h-7 w-7"
                  title="Folder options"
                >
                  <MoreVertical size={12} />
                </button>
              )}

              {/* Subfolder Depth Badge Overlay (for Level 1 Parent Cards) */}
              {customSubtitle && (
                <div className="absolute bottom-2 left-2 bg-m3-surface/90 text-m3-on-surface text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-m3-outline-variant/30 backdrop-blur-md flex items-center gap-1 z-20 font-mono">
                  <FolderTree size={10} className="text-m3-primary shrink-0" />
                  <span>{customSubtitle}</span>
                </div>
              )}

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
      ({
        post,
        onClick,
        isCover,
        onSetCover,
      }: {
        post: Post;
        onClick: () => void;
        isCover?: boolean;
        onSetCover?: () => void;
      }) => {
        const [hasError, setHasError] = useState(false);
        return (
          <div
            className="aspect-square cursor-pointer animate-fade-in relative group/thumb"
            onClick={onClick}
          >
            <div className="aspect-square rounded-xl overflow-hidden bg-m3-surface-container-highest hover:ring-2 hover:ring-m3-primary/60 transition-all duration-200 shadow-sm relative">
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

              {/* Cover Badge or Set Cover Button */}
              {isCover ? (
                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-stone-950 font-extrabold text-[9px] px-2 py-0.5 rounded-md shadow-md flex items-center gap-1 z-20 border border-amber-300">
                  <Star size={9} className="fill-current" />
                  <span>Cover</span>
                </div>
              ) : (
                onSetCover && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetCover();
                    }}
                    className="absolute top-1.5 left-1.5 bg-black/80 hover:bg-amber-500 hover:text-stone-950 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 group-hover/thumb:opacity-100 transition-all duration-200 shadow-md flex items-center gap-1 z-20 cursor-pointer"
                    title="Set as Collection Cover"
                  >
                    <ImageIcon size={10} />
                    <span>Set Cover</span>
                  </button>
                )
              )}
            </div>
          </div>
        );
      },
    );
    GroupedThumbnail.displayName = "GroupedThumbnail";

    return (
      <div className="flex-1 bg-m3-surface select-none flex flex-col min-h-0 h-full overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedFolderType ? (
            /* ==================== LEVEL 1: Parent Folders Grid ==================== */
            <motion.div
              key="parent_folders"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 flex flex-col overflow-hidden h-full min-h-0"
            >
              {/* Standardized Header */}
              <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-sm z-10 shrink-0">
                <div className="px-4 md:px-6 py-2.5 flex items-center justify-between">
                  <h1 className="text-base sm:text-lg md:text-xl font-bold font-display tracking-tight text-m3-on-surface leading-none">
                    Collections &amp; Folders
                  </h1>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-6 max-w-7xl mx-auto w-full space-y-6">
                <div
                  className="grid max-w-7xl mx-auto pt-2 w-full"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: `${gapSize}px`,
                  }}
                >
                  {/* Creators Folder Card */}
                  <GroupCard
                    name="Creators"
                    posts={posts}
                    type="creator"
                    customSubtitle={`${creatorsList.length} sources`}
                    onClick={() => handleSelectFolderType("creator")}
                  />

                  {/* Tags Folder Card */}
                  <GroupCard
                    name="Tags"
                    posts={posts.filter(p => (p.tags && p.tags.length > 0) || (p.hashtags && p.hashtags.length > 0))}
                    type="tag"
                    customSubtitle={`${tagsList.length} tags`}
                    onClick={() => handleSelectFolderType("tag")}
                  />

                  {/* Custom Collection Folders rendered directly */}
                  {filteredAndSortedCollections.map((col) => (
                    <GroupCard
                      key={col.name}
                      name={col.name}
                      posts={col.posts}
                      type="collection"
                    />
                  ))}

                  {/* Plus card to add new custom folder */}
                  <motion.div
                    whileHover={{ scale: 1.015, y: -3 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      setIsCreateModalOpen(true);
                      triggerVibration("light");
                    }}
                    className="group/card relative p-3 bg-m3-surface-low hover:bg-m3-surface-container rounded-[20px] border border-dashed border-m3-outline-variant/60 hover:border-m3-primary/40 hover:shadow-glass-md cursor-pointer flex flex-col items-center justify-center gap-3 aspect-square h-full min-h-[160px] transition-all duration-300 select-none"
                    title="Add a new custom collection folder"
                  >
                    <div className="w-12 h-12 rounded-full bg-m3-surface-container-highest flex items-center justify-center text-m3-outline group-hover/card:text-m3-primary group-hover/card:bg-m3-primary/10 transition-colors duration-300">
                      <Plus size={24} className="stroke-[2]" />
                    </div>
                    <span className="text-xs font-bold font-display text-m3-outline group-hover/card:text-m3-primary transition-colors duration-300 text-center px-1">
                      New Folder
                    </span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : !selectedGroup ? (
            /* ==================== LEVEL 2: Subfolders Grid ==================== */
            <motion.div
              key="subfolders_list"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex-1 flex flex-col overflow-hidden h-full min-h-0"
            >
              {/* Standardized Header inside Level 2 */}
              <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-sm z-10 shrink-0">
                <div className="px-4 md:px-6 py-2.5 flex items-center justify-between">
                  {/* Left Side: Back button & Title */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSelectFolderType(null)}
                      className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer hover:scale-105 active:scale-95 shadow-2xs shrink-0"
                      title="Back to parent directory"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h1 className="text-base sm:text-lg md:text-xl font-bold font-display tracking-tight text-m3-on-surface leading-none capitalize">
                      {selectedFolderType === "collection" ? "Collections" : selectedFolderType === "creator" ? "Creators" : "Tags"}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2">
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
                    </button>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-6 max-w-7xl mx-auto w-full space-y-4">
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
                      <div className="flex items-center justify-between gap-3 p-3 bg-m3-surface-container-low rounded-2xl border border-m3-outline-variant/15 shadow-2xs select-none mb-3">
                        <span className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1.5 pl-1 font-display">
                          <Folder size={13} />
                          <span>Sort &amp; Layout Options</span>
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

                {/* Subfolders Grid Section */}
                <section className="space-y-3">
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      gap: `${gapSize}px`,
                    }}
                  >
                    {(selectedFolderType === "collection"
                      ? filteredAndSortedCollections
                      : selectedFolderType === "tag"
                      ? filteredAndSortedTags
                      : filteredAndSortedCreators
                    )
                      .slice(0, visibleGroupsCount)
                      .map((item) => (
                        <GroupCard
                          key={item.name}
                          name={item.name}
                          posts={item.posts}
                          type={item.type}
                        />
                      ))}
                    <div ref={setupObserver} className="col-span-full h-1" />
                  </div>

                  {/* Empty states */}
                  {selectedFolderType === "collection" &&
                    filteredAndSortedCollections.length === 0 && (
                      <EmptyState
                        title={t.noCollectionsTitle}
                        message={t.noCollectionsDesc}
                        icon={<Folder size={32} />}
                      />
                    )}
                  {selectedFolderType === "creator" &&
                    filteredAndSortedCreators.length === 0 && (
                      <EmptyState
                        title={t.noCreatorsTitle}
                        message={t.noCreatorsDesc}
                        icon={<Users size={32} />}
                      />
                    )}
                  {selectedFolderType === "tag" &&
                    filteredAndSortedTags.length === 0 && (
                      <EmptyState
                        title="No Tags Found"
                        message="Imported posts containing curated tags or hashtags will appear here as folders."
                        icon={<Hash size={32} />}
                      />
                    )}
                </section>
              </div>
            </motion.div>
          ) : (
            /* ==================== LEVEL 3: Selected Group Detail View ==================== */
            <motion.div
              key="selected_group_detail"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex-1 flex flex-col overflow-hidden h-full min-h-0"
            >
              {/* Header Block Level 3: Replicates single-row Material 3 Top App Bar */}
              <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-sm z-10 shrink-0">
                <div className="px-4 md:px-6 py-2.5 flex items-center justify-between">
                  {/* Left Side: Back button & screen/group name */}
                  <div className="flex items-center gap-3 z-10 shrink-0 min-w-0">
                    <button
                      onClick={() => handleSelectGroup(null)}
                      className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer shrink-0"
                      title={t.backToGroups}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-m3-primary flex items-center gap-1 font-display">
                        {selectedGroup.type === "collection" ? (
                          <Folder size={10} />
                        ) : selectedGroup.type === "tag" ? (
                          <Hash size={10} />
                        ) : (
                          <Users size={10} />
                        )}
                        {selectedGroup.type === "collection"
                          ? t.collectionLabel
                          : selectedGroup.type === "tag"
                          ? "Tag Folder"
                          : t.creatorLabel}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <h1 className="text-sm sm:text-base md:text-lg font-bold text-m3-on-surface truncate leading-none font-display">
                          {selectedGroup.name}
                        </h1>
                        {selectedGroup.type === "collection" &&
                          collectionCovers[selectedGroup.name]?.coverImageUrl && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 font-mono">
                                <Star size={9} className="fill-current" />
                                Cover
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResetCollectionCover(selectedGroup.name)}
                                className="p-1 rounded-md text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-container transition-all cursor-pointer"
                                title="Reset cover to default"
                              >
                                <RotateCcw size={11} />
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Curator controls & counters */}
                  <div className="flex items-center gap-2 shrink-0 z-10 ml-auto">
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
                    </button>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-6 max-w-7xl mx-auto w-full space-y-4">
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
                          isCover={
                            selectedGroup.type === "collection" &&
                            collectionCovers[selectedGroup.name]?.coverPostId === post.id
                          }
                          onSetCover={
                            selectedGroup.type === "collection"
                              ? () => handleSetCollectionCover(selectedGroup.name, post)
                              : undefined
                          }
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
              </div>
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
                  isDetailMode={true}
                  onClose={() => setDetailPost(null)}
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

        {/* Real Create Folder Modal Dialog */}
        <AnimatePresence>
          {isCreateModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewFolderName("");
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
                    Create Custom Folder
                  </h3>
                  <p className="text-xs text-m3-on-surface-variant mt-1 font-sans">
                    Add a new custom collection folder to organize your saved items locally.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold font-mono text-m3-outline uppercase tracking-wider">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    className="w-full px-3 py-2 bg-m3-surface-container rounded-lg border border-m3-outline-variant/40 focus:outline-none focus:border-m3-primary text-xs text-m3-on-surface font-sans"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) {
                        handleCreateCollection(newFolderName);
                        setIsCreateModalOpen(false);
                        setNewFolderName("");
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-m3-outline-variant/10">
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setNewFolderName("");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-m3-on-surface-variant hover:bg-m3-surface-container transition-colors cursor-pointer font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handleCreateCollection(newFolderName);
                      setIsCreateModalOpen(false);
                      setNewFolderName("");
                    }}
                    disabled={!newFolderName.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90 transition-all disabled:opacity-50 cursor-pointer font-display"
                  >
                    Create
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
