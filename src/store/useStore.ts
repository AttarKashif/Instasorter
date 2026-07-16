import { create } from "zustand";
import { Post, Collection, SmartRule } from "../types/post";

interface PostState {
  posts: Post[];
  smartRules: SmartRule[];
  smartCollections: Collection[];
  setSmartCollections: (collections: Collection[]) => void;
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
}

export const usePostStore = create<PostState>((set) => ({
  posts: [],
  smartRules: [],
  smartCollections: [],
  setSmartCollections: (collections) => set({ smartCollections: collections }),
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
  setPosts: (posts) =>
    set({
      posts: posts.map((p) => ({
        ...p,
        thumbnailUrl:
          p.thumbnailUrl && p.thumbnailUrl.startsWith("data:")
            ? "base64-placeholder"
            : p.thumbnailUrl,
      })),
      isLoading: false,
    }),
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
        thumbnailUrl:
          post.thumbnailUrl && post.thumbnailUrl.startsWith("data:")
            ? "base64-placeholder"
            : post.thumbnailUrl,
        collections: Array.from(collections),
      };
      return { posts: [...state.posts, lightweightPost] };
    }),
  toggleFavorite: (id) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p,
      ),
    })),
  updatePost: (id, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id === id) {
          const finalUpdates = { ...updates };
          if (
            finalUpdates.thumbnailUrl &&
            finalUpdates.thumbnailUrl.startsWith("data:")
          ) {
            finalUpdates.thumbnailUrl = "base64-placeholder";
          }
          return { ...p, ...finalUpdates };
        }
        return p;
      }),
    })),
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
      return { ...newState, posts: updatedPosts };
    }),
  removeSmartRule: (id) =>
    set((state) => ({
      smartRules: state.smartRules.filter((r) => r.id !== id),
    })),
  applyRulesToPosts: () =>
    set((state) => ({
      posts: state.posts.map((post) => {
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
      }),
    })),
  selectedPostIds: [],
  toggleSelectPost: (id) =>
    set((state) => ({
      selectedPostIds: state.selectedPostIds.includes(id)
        ? state.selectedPostIds.filter((pid) => pid !== id)
        : [...state.selectedPostIds, id],
    })),
  clearSelection: () => set({ selectedPostIds: [] }),
  bulkDeleteSelected: () =>
    set((state) => ({
      posts: state.posts.filter((p) => !state.selectedPostIds.includes(p.id)),
      selectedPostIds: [],
    })),
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
}));
