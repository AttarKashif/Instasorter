import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Globe,
  User,
  FileText,
  Tag,
  Folder,
  Sparkles,
  Check,
  Info,
} from "lucide-react";
import { Post } from "../../types/post";
import { VOCABULARY } from "../../constants/vocabulary";

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (post: Post) => void;
  allTags: string[];
  allCollections: string[];
}

// Visual covers from Unsplash for manual entries to look gorgeous
const COVER_PLACEHOLDERS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618005198143-e5283464303b?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1574169208507-84376144848b?w=600&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600&auto=format&fit=crop&q=80",
];

export const AddBookmarkModal = ({
  isOpen,
  onClose,
  onAdd,
  allTags,
  allCollections,
}: AddBookmarkModalProps) => {
  const t = VOCABULARY.modal;
  const [creatorUsername, setCreatorUsername] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "carousel">(
    "image",
  );
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Tags & Collections list
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [collectionInput, setCollectionInput] = useState("");
  const [collections, setCollections] = useState<string[]>([]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase();
      if (!tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddCollection = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && collectionInput.trim()) {
      e.preventDefault();
      const cleaned = collectionInput.trim();
      if (!collections.includes(cleaned)) {
        setCollections([...collections, cleaned]);
      }
      setCollectionInput("");
    }
  };

  const handleRemoveCollection = (colToRemove: string) => {
    setCollections(collections.filter((c) => c !== colToRemove));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!creatorUsername.trim()) {
      newErrors.creatorUsername = "Instagram username is required";
    }

    if (postUrl.trim()) {
      try {
        new URL(postUrl);
      } catch {
        newErrors.postUrl = "Please enter a valid URL (including https://)";
      }
    }

    if (thumbnailUrl.trim()) {
      try {
        new URL(thumbnailUrl);
      } catch {
        newErrors.thumbnailUrl = "Please enter a valid cover URL";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Pick a random cover if not specified
    const finalCover =
      thumbnailUrl.trim() ||
      COVER_PLACEHOLDERS[Math.floor(Math.random() * COVER_PLACEHOLDERS.length)];

    // Parse hashtags from caption
    const hashtagRegex = /#(\w+)/g;
    const captionHashtags = [...caption.matchAll(hashtagRegex)].map(
      (m) => m[1],
    );

    const newPost: Post = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(4, 9)}`,
      postUrl: postUrl.trim(),
      creatorUsername: creatorUsername.trim().replace(/^@/, ""), // strip leading @ if entered
      caption: caption.trim(),
      hashtags: captionHashtags,
      savedAt: new Date().toISOString(),
      mediaType,
      thumbnailUrl: finalCover,
      tags: Array.from(new Set([...tags])),
      collections: Array.from(new Set([...collections])),
      isFavorite: false,
      isArchived: false,
      readLater: false,
      isReel: false,
      notes: notes.trim(),
    };

    onAdd(newPost);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", damping: 30, stiffness: 380 }}
            className="bg-m3-surface rounded-[28px] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl border border-m3-outline-variant/20 max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4.5 flex justify-between items-center border-b border-m3-outline-variant/20 bg-m3-surface-low shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold font-display text-m3-on-surface text-base">
                    {t.addTitle}
                  </h3>
                  <p className="text-[10px] text-m3-on-surface-variant font-medium">
                    {t.addSubtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface-variant hover:text-m3-on-surface transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5 text-sm"
            >
              {/* Creator & Link info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1">
                    <User size={13} className="text-m3-primary" />{" "}
                    {t.creatorLabel} <span className="text-m3-tertiary">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-m3-outline font-semibold">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      placeholder={t.creatorPlaceholder}
                      value={creatorUsername}
                      onChange={(e) => setCreatorUsername(e.target.value)}
                      className={`w-full pl-7 pr-3.5 py-2.5 bg-m3-surface text-m3-on-surface border rounded-xl text-xs focus:outline-none focus:ring-1 transition-all ${
                        errors.creatorUsername
                          ? "border-m3-tertiary focus:ring-m3-tertiary"
                          : "border-m3-outline-variant/40 focus:border-m3-primary focus:ring-m3-primary"
                      }`}
                    />
                  </div>
                  {errors.creatorUsername && (
                    <p className="text-m3-tertiary text-[10px] font-bold pl-1">
                      {errors.creatorUsername}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1">
                    <Globe size={13} className="text-m3-primary" /> {t.urlLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.urlPlaceholder}
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-m3-surface text-m3-on-surface border rounded-xl text-xs focus:outline-none focus:ring-1 transition-all ${
                      errors.postUrl
                        ? "border-m3-tertiary focus:ring-m3-tertiary"
                        : "border-m3-outline-variant/40 focus:border-m3-primary focus:ring-m3-primary"
                    }`}
                  />
                  {errors.postUrl && (
                    <p className="text-m3-tertiary text-[10px] font-bold pl-1">
                      {errors.postUrl}
                    </p>
                  )}
                </div>
              </div>

              {/* Media format & Thumbnail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-m3-on-surface-variant">
                    {t.typeLabel}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-m3-surface-container/40 p-1 rounded-xl border border-m3-outline-variant/20">
                    {(["image", "video", "carousel"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setMediaType(type)}
                        className={`py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                          mediaType === type
                            ? "bg-m3-primary text-m3-on-primary shadow-xs"
                            : "text-m3-on-surface-variant hover:text-m3-on-surface"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-m3-on-surface-variant">
                    {t.coverLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.coverPlaceholder}
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    className={`w-full px-3.5 py-2.5 bg-m3-surface text-m3-on-surface border rounded-xl text-xs focus:outline-none focus:ring-1 transition-all ${
                      errors.thumbnailUrl
                        ? "border-m3-tertiary focus:ring-m3-tertiary"
                        : "border-m3-outline-variant/40 focus:border-m3-primary focus:ring-m3-primary"
                    }`}
                  />
                  {errors.thumbnailUrl && (
                    <p className="text-m3-tertiary text-[10px] font-bold pl-1">
                      {errors.thumbnailUrl}
                    </p>
                  )}
                </div>
              </div>

              {/* Caption */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1">
                  <FileText size={13} className="text-m3-primary" />{" "}
                  {t.captionLabel}
                </label>
                <textarea
                  placeholder={t.captionPlaceholder}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full h-20 p-3 bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary focus:outline-none transition-all resize-none font-sans shadow-inner"
                />
              </div>

              {/* Tags manager */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1">
                  <Tag size={13} className="text-m3-primary" /> {t.tagsLabel}
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder={t.tagsPlaceholder}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="w-full px-3.5 py-2.5 bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary focus:outline-none transition-all shadow-xs"
                  />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-m3-surface-container/30 rounded-xl border border-m3-outline-variant/10">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-m3-surface-variant text-m3-on-surface-variant px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-m3-outline hover:text-m3-tertiary font-extrabold cursor-pointer text-xs"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {allTags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pl-1 mt-0.5">
                      <span className="text-[10px] text-m3-outline font-bold">
                        Suggested:
                      </span>
                      {allTags.slice(0, 6).map((tag) => {
                        const exists = tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            disabled={exists}
                            onClick={() => setTags([...tags, tag])}
                            className="text-[10px] px-2 py-0.5 border border-m3-outline-variant/20 rounded-md bg-m3-surface text-m3-on-surface-variant hover:border-m3-primary hover:text-m3-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Collections manager */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-m3-on-surface-variant flex items-center gap-1">
                  <Folder size={13} className="text-m3-primary" />{" "}
                  {t.collectionsLabel}
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder={t.collectionsPlaceholder}
                    value={collectionInput}
                    onChange={(e) => setCollectionInput(e.target.value)}
                    onKeyDown={handleAddCollection}
                    className="w-full px-3.5 py-2.5 bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary focus:outline-none transition-all shadow-xs"
                  />
                  {collections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-m3-surface-container/30 rounded-xl border border-m3-outline-variant/10">
                      {collections.map((col) => (
                        <span
                          key={col}
                          className="bg-m3-primary-container text-m3-on-primary-container px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"
                        >
                          <Folder
                            size={10}
                            className="text-m3-primary shrink-0"
                          />
                          <span>{col}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCollection(col)}
                            className="text-m3-primary/50 hover:text-m3-tertiary font-extrabold cursor-pointer text-xs"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {allCollections.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pl-1 mt-0.5">
                      <span className="text-[10px] text-m3-outline font-bold">
                        Suggested:
                      </span>
                      {allCollections.slice(0, 5).map((col) => {
                        const exists = collections.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            disabled={exists}
                            onClick={() =>
                              setCollections([...collections, col])
                            }
                            className="text-[10px] px-2 py-0.5 border border-m3-outline-variant/20 rounded-md bg-m3-surface text-m3-on-surface-variant hover:border-m3-primary hover:text-m3-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                          >
                            {col}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-m3-on-surface-variant">
                  {t.notesLabel}
                </label>
                <textarea
                  placeholder={t.notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-16 p-3 bg-m3-surface text-m3-on-surface border border-m3-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary focus:outline-none transition-all resize-none font-sans shadow-inner"
                />
              </div>
            </form>

            {/* Footer Actions */}
            <div className="px-6 py-4.5 border-t border-m3-outline-variant/20 bg-m3-surface-low shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] text-m3-outline font-semibold">
                <Info size={12} />
                <span>Added directly to Local DB</span>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 border border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-variant/30 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-5.5 py-2.5 bg-m3-primary text-m3-on-primary hover:bg-opacity-95 rounded-full text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <Check size={14} className="stroke-[2.5]" />
                  {t.submitBtn}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
