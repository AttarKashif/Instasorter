import { create } from "zustand";
import { Post, Collection, SmartRule } from "../types/post";
import { db } from "../lib/db";
import { FullTextSearchIndex, buildSearchIndex, querySearchIndex, updatePostInIndex } from "../lib/searchIndex";

interface PostState {
  posts: Post[];
  searchIndex: FullTextSearchIndex;
  searchPosts: (query: string) => Post[] | null;
  rebuildSearchIndex: () => void;
  trashPosts: Post[];
  pinnedPostIds: string[];
  togglePinPost: (id: string) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  emptyTrash: () => void;
  recentViewedIds: string[];
  addRecentViewed: (id: string) => void;
  updatePostNotes: (id: string, notes: string) => void;
  updateReadingProgress: (id: string, progress: number) => void;
  bulkToggleFavorite: (favorite: boolean) => void;
  bulkToggleArchive: (archived: boolean) => void;

  smartRules: SmartRule[];
  smartCollections: Collection[];
  setSmartCollections: (collections: Collection[]) => void;
  collectionCovers: Record<string, { coverPostId?: string; coverImageUrl?: string }>;
  setCollectionCover: (collectionName: string, coverPostId: string, coverImageUrl: string) => void;
  loadCollectionCovers: () => Promise<void>;
  pinnedCollections: string[];
  togglePinCollection: (name: string) => void;

  isLoading: boolean;
  isImporting: boolean;
  importMessage: string | null;
  setIsImporting: (isImporting: boolean, message?: string | null) => void;
  setPosts: (posts: Post[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  addPost: (post: Post) => void;
  toggleFavorite: (id: string) => void;
  updatePost: (id: string, updates: Partial<Post>) => void;
  addSmartRule: (rule: SmartRule) => void;
  removeSmartRule: (id: string) => void;
  applyRulesToPosts: () => void;
  selectedPostIds: string[];
  toggleSelectPost: (id: string) => void;
  clearSelection: () => void;
  bulkDeleteSelected: () => void;
  bulkAddToCollection: (collection: string) => void;
  bulkRemoveFromCollection: (collection: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activePreviewPost: Post | null;
  setActivePreviewPost: (post: Post | null) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
  isBackgroundOrganizerEnabled: boolean;
  setIsBackgroundOrganizerEnabled: (enabled: boolean) => void;
  backgroundOrganizerStatus: "idle" | "running" | "completed" | "error";
  setBackgroundOrganizerStatus: (status: "idle" | "running" | "completed" | "error") => void;
  backgroundOrganizerProgress: number;
  setBackgroundOrganizerProgress: (progress: number) => void;
}

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  searchIndex: { tokenMap: new Map(), postTokensMap: new Map() },
  searchPosts: (query: string) => {
    return querySearchIndex(get().searchIndex, query, get().posts);
  },
  rebuildSearchIndex: () => {
    set({ searchIndex: buildSearchIndex(get().posts) });
  },
  smartRules: [],
  smartCollections: [],
  setSmartCollections: (collections) => set({ smartCollections: collections }),
  collectionCovers: {},
  setCollectionCover: (collectionName, coverPostId, coverImageUrl) =>
    set((state) => ({
      collectionCovers: {
        ...state.collectionCovers,
        [collectionName]: { coverPostId, coverImageUrl },
      },
    })),
  loadCollectionCovers: async () => {
    try {
      const colls = await db.collections.toArray();
      const map: Record<string, { coverPostId?: string; coverImageUrl?: string }> = {};
      colls.forEach((c) => {
        if (c.coverPostId || c.coverImageUrl) {
          map[c.name] = { coverPostId: c.coverPostId, coverImageUrl: c.coverImageUrl };
        }
      });
      set({ collectionCovers: map });
    } catch (err) {
      console.error("Error loading collection covers:", err);
    }
  },
  pinnedCollections: (() => {
    try {
      const saved = localStorage.getItem("instasorter_pinned_collections");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  togglePinCollection: (name) =>
    set((state) => {
      const next = state.pinnedCollections.includes(name)
        ? state.pinnedCollections.filter((c) => c !== name)
        : [...state.pinnedCollections, name];
      try {
        localStorage.setItem("instasorter_pinned_collections", JSON.stringify(next));
      } catch {}
      return { pinnedCollections: next };
    }),

  isLoading: true,
  isImporting: false,
  importMessage: null,
  setIsImporting: (isImporting, importMessage) =>
    set({ isImporting, importMessage }),
  isImportModalOpen: false,
  setIsImportModalOpen: (open) => set({ isImportModalOpen: open }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  activePreviewPost: null,
  setActivePreviewPost: (post) => set({ activePreviewPost: post }),
  setPosts: (posts) => {
    set({
      posts,
      searchIndex: buildSearchIndex(posts),
      isLoading: false,
    });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  addPost: (post) =>
    set((state) => {
      const collections = new Set(post.collections);
      state.smartRules.forEach((rule) => {
        if (rule.type === "username" && post.creatorUsername === rule.value) {
          collections.add(rule.collectionName);
        } else if (
          rule.type === "keyword" &&
          (post.caption.toLowerCase().includes(rule.value.toLowerCase()) ||
            post.hashtags.some((h) =>
              h.toLowerCase().includes(rule.value.toLowerCase()),
            ))
        ) {
          collections.add(rule.collectionName);
        }
      });
      const lightweightPost = {
        ...post,
        collections: Array.from(collections),
      };
      const nextPosts = [...state.posts, lightweightPost];
      const updatedIndex = updatePostInIndex(state.searchIndex, lightweightPost, false);
      return { posts: nextPosts, searchIndex: updatedIndex };
    }),
  toggleFavorite: (id) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p,
      ),
    })),
  updatePost: (id, updates) =>
    set((state) => {
      let targetPost: Post | undefined;
      const nextPosts = state.posts.map((p) => {
        if (p.id === id) {
          targetPost = { ...p, ...updates };
          return targetPost;
        }
        return p;
      });
      const updatedIndex = targetPost
        ? updatePostInIndex(state.searchIndex, targetPost, false)
        : state.searchIndex;
      return { posts: nextPosts, searchIndex: updatedIndex };
    }),
  addSmartRule: (rule) =>
    set((state) => {
      const newState = { smartRules: [...state.smartRules, rule] };
      // We need to apply it to existing posts
      const updatedPosts = state.posts.map((post) => {
        const collections = new Set(post.collections);
        if (rule.type === "username" && post.creatorUsername === rule.value) {
          collections.add(rule.collectionName);
        } else if (
          rule.type === "keyword" &&
          (post.caption.toLowerCase().includes(rule.value.toLowerCase()) ||
            post.hashtags.some((h) =>
              h.toLowerCase().includes(rule.value.toLowerCase()),
            ))
        ) {
          collections.add(rule.collectionName);
        }
        return { ...post, collections: Array.from(collections) };
      });
      return { ...newState, posts: updatedPosts, searchIndex: buildSearchIndex(updatedPosts) };
    }),
  removeSmartRule: (id) =>
    set((state) => ({
      smartRules: state.smartRules.filter((r) => r.id !== id),
    })),
  applyRulesToPosts: () =>
    set((state) => {
      const updatedPosts = state.posts.map((post) => {
        const collections = new Set(post.collections);
        state.smartRules.forEach((rule) => {
          if (rule.type === "username" && post.creatorUsername === rule.value) {
            collections.add(rule.collectionName);
          } else if (
            rule.type === "keyword" &&
            (post.caption.toLowerCase().includes(rule.value.toLowerCase()) ||
              post.hashtags.some((h) =>
                h.toLowerCase().includes(rule.value.toLowerCase()),
              ))
          ) {
            collections.add(rule.collectionName);
          }
        });
        return { ...post, collections: Array.from(collections) };
      });
      return { posts: updatedPosts, searchIndex: buildSearchIndex(updatedPosts) };
    }),
  selectedPostIds: [],
  trashPosts: (() => {
    try {
      const saved = localStorage.getItem("instasorter_trash_posts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  pinnedPostIds: (() => {
    try {
      const saved = localStorage.getItem("instasorter_pinned_posts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),
  recentViewedIds: (() => {
    try {
      const saved = localStorage.getItem("instasorter_recent_views");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  })(),

  togglePinPost: (id) =>
    set((state) => {
      const next = state.pinnedPostIds.includes(id)
        ? state.pinnedPostIds.filter((pid) => pid !== id)
        : [...state.pinnedPostIds, id];
      try {
        localStorage.setItem("instasorter_pinned_posts", JSON.stringify(next));
      } catch {}
      return { pinnedPostIds: next };
    }),

  moveToTrash: (id) =>
    set((state) => {
      const postToTrash = state.posts.find((p) => p.id === id);
      if (!postToTrash) return state;
      const nextPosts = state.posts.filter((p) => p.id !== id);
      const nextTrash = [postToTrash, ...state.trashPosts];
      try {
        localStorage.setItem("instasorter_trash_posts", JSON.stringify(nextTrash));
      } catch {}
      return { posts: nextPosts, trashPosts: nextTrash, searchIndex: buildSearchIndex(nextPosts) };
    }),

  restoreFromTrash: (id) =>
    set((state) => {
      const postToRestore = state.trashPosts.find((p) => p.id === id);
      if (!postToRestore) return state;
      const nextTrash = state.trashPosts.filter((p) => p.id !== id);
      const nextPosts = [postToRestore, ...state.posts];
      try {
        localStorage.setItem("instasorter_trash_posts", JSON.stringify(nextTrash));
      } catch {}
      return { posts: nextPosts, trashPosts: nextTrash, searchIndex: buildSearchIndex(nextPosts) };
    }),

  emptyTrash: () =>
    set(() => {
      try {
        localStorage.removeItem("instasorter_trash_posts");
      } catch {}
      return { trashPosts: [] };
    }),

  addRecentViewed: (id) =>
    set((state) => {
      const filtered = state.recentViewedIds.filter((pid) => pid !== id);
      const next = [id, ...filtered].slice(0, 20);
      try {
        localStorage.setItem("instasorter_recent_views", JSON.stringify(next));
      } catch {}
      return { recentViewedIds: next };
    }),

  updatePostNotes: (id, notes) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, notes } : p)),
    })),

  updateReadingProgress: (id, readingProgress) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? { ...p, readingProgress } : p)),
    })),

  bulkToggleFavorite: (isFavorite) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        state.selectedPostIds.includes(p.id) ? { ...p, isFavorite } : p,
      ),
      selectedPostIds: [],
    })),

  bulkToggleArchive: (isArchived) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        state.selectedPostIds.includes(p.id) ? { ...p, isArchived } : p,
      ),
      selectedPostIds: [],
    })),

  toggleSelectPost: (id) =>
    set((state) => ({
      selectedPostIds: state.selectedPostIds.includes(id)
        ? state.selectedPostIds.filter((pid) => pid !== id)
        : [...state.selectedPostIds, id],
    })),
  clearSelection: () => set({ selectedPostIds: [] }),
  bulkDeleteSelected: () =>
    set((state) => {
      const trashed = state.posts.filter((p) => state.selectedPostIds.includes(p.id));
      const remaining = state.posts.filter((p) => !state.selectedPostIds.includes(p.id));
      const nextTrash = [...trashed, ...state.trashPosts];
      try {
        localStorage.setItem("instasorter_trash_posts", JSON.stringify(nextTrash));
      } catch {}
      return {
        posts: remaining,
        trashPosts: nextTrash,
        selectedPostIds: [],
      };
    }),
  bulkAddToCollection: (collection) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        state.selectedPostIds.includes(p.id)
          ? {
              ...p,
              collections: Array.from(
                new Set([...(p.collections || []), collection]),
              ),
            }
          : p,
      ),
      selectedPostIds: [],
    })),
  bulkRemoveFromCollection: (collection) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        state.selectedPostIds.includes(p.id)
          ? {
              ...p,
              collections: (p.collections || []).filter(
                (c) => c !== collection,
              ),
            }
          : p,
      ),
      selectedPostIds: [],
    })),
  isBackgroundOrganizerEnabled: (() => {
    try {
      const saved = localStorage.getItem("instasorter_bg_organizer_enabled");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  })(),
  setIsBackgroundOrganizerEnabled: (enabled) =>
    set(() => {
      try {
        localStorage.setItem("instasorter_bg_organizer_enabled", String(enabled));
      } catch {}
      return { isBackgroundOrganizerEnabled: enabled };
    }),
  backgroundOrganizerStatus: "idle",
  setBackgroundOrganizerStatus: (status) => set({ backgroundOrganizerStatus: status }),
  backgroundOrganizerProgress: 0,
  setBackgroundOrganizerProgress: (progress) => set({ backgroundOrganizerProgress: progress }),
}));
