import React, { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Sparkles,
  BookmarkPlus,
  StickyNote,
  Clock,
  Volume2,
  VolumeX,
  Share2,
  Calendar,
  FolderPlus,
  Zap,
  Tag,
  Heart,
  Check,
  Disc,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { Post } from "../../../types/post";
import { db } from "../../../lib/db";
import { usePostStore } from "../../../store/useStore";
import {
  MemoryCapsuleGroup,
  getDaysAgo,
  retroAudio,
  getRandomForgottenGem,
} from "../../../lib/memoryCapsule";

interface RetroMemoryCapsuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: MemoryCapsuleGroup | null;
  allPosts: Post[];
}

export const RetroMemoryCapsuleModal: React.FC<RetroMemoryCapsuleModalProps> = ({
  isOpen,
  onClose,
  group,
  allPosts,
}) => {
  const setPosts = usePostStore((state) => state.setPosts);
  const [activePosts, setActivePosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isReviving, setIsReviving] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  useEffect(() => {
    if (group && group.posts.length > 0) {
      setActivePosts(group.posts);
      setCurrentIndex(0);
      setIsFlipped(false);
      setNoteText(group.posts[0]?.notes || "");
    }
  }, [group]);

  if (!isOpen || !group || activePosts.length === 0) return null;

  const currentPost = activePosts[currentIndex] || activePosts[0];
  const daysAgo = getDaysAgo(currentPost?.savedAt);

  const handleNext = () => {
    if (soundEnabled) retroAudio.playSlideClick();
    setIsFlipped(false);
    setIsEditingNote(false);
    const nextIdx = (currentIndex + 1) % activePosts.length;
    setCurrentIndex(nextIdx);
    setNoteText(activePosts[nextIdx]?.notes || "");
  };

  const handlePrev = () => {
    if (soundEnabled) retroAudio.playSlideClick();
    setIsFlipped(false);
    setIsEditingNote(false);
    const prevIdx = (currentIndex - 1 + activePosts.length) % activePosts.length;
    setCurrentIndex(prevIdx);
    setNoteText(activePosts[prevIdx]?.notes || "");
  };

  const handleFlip = () => {
    if (soundEnabled) retroAudio.playShutterSound();
    setIsFlipped(!isFlipped);
  };

  const handleSurpriseShuffle = () => {
    const randomGem = getRandomForgottenGem(allPosts);
    if (randomGem) {
      if (soundEnabled) retroAudio.playShutterSound();
      setActivePosts((prev) => [randomGem, ...prev]);
      setCurrentIndex(0);
      setIsFlipped(false);
      setNoteText(randomGem.notes || "");
      toast.success("Surprise Gem Pulled from the Vault!", { icon: "🎰" });
    }
  };

  const handleRevivePost = async () => {
    if (!currentPost) return;
    setIsReviving(true);
    try {
      const nowIso = new Date().toISOString();
      await db.posts.update(currentPost.id, {
        savedAt: nowIso,
      });

      const updatedPosts = await db.posts.toArray();
      setPosts(updatedPosts);

      if (soundEnabled) retroAudio.playShutterSound();
      toast.success("Post revived! Moved to top of recent posts.", { icon: "⚡" });
    } catch (err: any) {
      console.error("Failed to revive post:", err);
      toast.error("Failed to revive post.");
    } finally {
      setIsReviving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!currentPost) return;
    try {
      await db.posts.update(currentPost.id, {
        notes: noteText,
      });

      const updatedPosts = await db.posts.toArray();
      setPosts(updatedPosts);

      // Update current post in activePosts
      setActivePosts((prev) =>
        prev.map((p) => (p.id === currentPost.id ? { ...p, notes: noteText } : p))
      );

      setIsEditingNote(false);
      toast.success("Memory note updated!");
    } catch (err) {
      toast.error("Failed to save note");
    }
  };

  const handleCreateCapsuleCollection = async () => {
    setIsCreatingCollection(true);
    try {
      const collectionName = `Capsule - ${group.title.slice(0, 20)}`;
      const existing = await db.collections.where("name").equals(collectionName).first();

      if (!existing) {
        await db.collections.add({
          id: `coll_capsule_${Date.now()}`,
          name: collectionName,
          createdAt: new Date().toISOString(),
        });
      }

      // Add collection to all posts in this group
      for (const p of activePosts) {
        const currentColls = p.collections || [];
        if (!currentColls.includes(collectionName)) {
          await db.posts.update(p.id, {
            collections: [...currentColls, collectionName],
          });
        }
      }

      const updatedPosts = await db.posts.toArray();
      setPosts(updatedPosts);

      toast.success(`Saved capsule posts into '${collectionName}' collection!`, {
        icon: "📦",
      });
    } catch (err: any) {
      toast.error("Failed to create capsule collection");
    } finally {
      setIsCreatingCollection(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          className="relative w-full max-w-4xl bg-stone-900 border border-amber-500/20 rounded-3xl shadow-2xl overflow-hidden font-sans text-amber-50"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-stone-950/60 border-b border-amber-500/15">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-mono">
                <Disc size={18} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
                    RETRO MEMORY CAPSULE
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-mono text-[9px]">
                    {currentIndex + 1} of {activePosts.length}
                  </span>
                </div>
                <h3 className="text-sm font-bold font-display text-stone-100">
                  {group.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSurpriseShuffle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold transition-all cursor-pointer active:scale-95"
                title="Pull random surprise post from past vault"
              >
                <span>🎰 Surprise Gem</span>
              </button>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-xl bg-stone-800/80 text-stone-300 hover:text-amber-300 transition-all cursor-pointer"
                title={soundEnabled ? "Mute slide click audio" : "Enable retro audio"}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-stone-800/80 text-stone-300 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Slide Workspace */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-center gap-8 min-h-[460px]">
            {/* Polaroid Container with 3D Flip effect */}
            <div className="perspective-1000 w-full max-w-sm shrink-0">
              <motion.div
                className="relative w-full aspect-[4/5] rounded-xl bg-stone-100 text-stone-900 p-4 pb-12 shadow-2xl transition-all duration-500 transform-gpu cursor-pointer group border border-stone-300/40 select-none"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
                onClick={handleFlip}
              >
                {/* Washi Tape Accent */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-amber-200/60 backdrop-blur-sm border border-amber-300/40 rotate-1 shadow-sm z-20 pointer-events-none rounded-sm" />

                {/* FRONT FACE (Photo + Vintage Stamps) */}
                <div
                  className="absolute inset-0 p-4 pb-12 flex flex-col justify-between backface-hidden"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  {/* Photo Canvas */}
                  <div className="relative w-full flex-1 bg-stone-950 rounded-md overflow-hidden border border-stone-300/60 shadow-inner group-hover:scale-[1.01] transition-transform">
                    {currentPost.thumbnailUrl ? (
                      <img
                        src={currentPost.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover filter contrast-[1.05] sepia-[0.12]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-500 font-mono text-xs">
                        No Media Preview
                      </div>
                    )}

                    {/* Camera Timestamp Stamp */}
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-amber-400 font-mono text-[10px] tracking-widest uppercase border border-amber-500/30">
                      {currentPost.savedAt
                        ? new Date(currentPost.savedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "REC 1999"}
                    </div>
                  </div>

                  {/* Polaroid Bottom Margin Info */}
                  <div className="mt-3 flex items-center justify-between px-1">
                    <div>
                      <span className="font-display font-bold text-xs text-stone-900 block truncate">
                        @{currentPost.creatorUsername || "creator"}
                      </span>
                      <span className="font-mono text-[10px] text-amber-700 block">
                        Saved {daysAgo} days ago ({daysAgo > 365 ? "Over 1 year!" : "Dormant"})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-stone-500 bg-stone-200/80 px-2 py-1 rounded-md">
                      <RotateCw size={11} />
                      <span>Flip</span>
                    </div>
                  </div>
                </div>

                {/* BACK FACE (Handwritten Notes & Details) */}
                <div
                  className="absolute inset-0 p-5 bg-amber-50 rounded-xl text-stone-800 flex flex-col justify-between overflow-y-auto backface-hidden"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                      <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-amber-800">
                        Memory Note & Details
                      </span>
                      <button
                        onClick={handleFlip}
                        className="text-stone-500 hover:text-stone-900 text-[10px] font-mono flex items-center gap-1"
                      >
                        <RotateCw size={10} /> Front
                      </button>
                    </div>

                    <p className="font-sans text-xs text-stone-800 line-clamp-4 italic bg-white/60 p-2.5 rounded-lg border border-amber-200/60 leading-relaxed">
                      "{currentPost.caption || "No original caption saved."}"
                    </p>

                    {/* Note section */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-amber-900 flex items-center gap-1">
                        <StickyNote size={11} /> Your Memory Note:
                      </label>

                      {isEditingNote ? (
                        <div className="space-y-2">
                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Write why this post inspires you or what you remembered..."
                            className="w-full h-20 p-2 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                          />
                          <button
                            onClick={handleSaveNote}
                            className="w-full py-1 bg-amber-600 hover:bg-amber-700 text-white font-mono text-[10px] font-bold rounded-md shadow-sm"
                          >
                            Save Memory Note
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => setIsEditingNote(true)}
                          className="p-2.5 bg-amber-100/60 hover:bg-amber-100 border border-amber-300/60 rounded-lg text-xs font-mono text-stone-700 min-h-[50px] cursor-pointer transition-all"
                        >
                          {currentPost.notes ? (
                            noteText
                          ) : (
                            <span className="text-amber-700/60 italic">
                              Click to write a memory note...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hashtags/Tags */}
                  <div className="pt-2 border-t border-amber-200/80 flex flex-wrap gap-1">
                    {(currentPost.tags || []).concat(currentPost.hashtags || []).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-900 text-[9px] font-mono"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Side Capsule Controls & Inspector */}
            <div className="flex-1 space-y-5 min-w-0">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                    {group.badgeText}
                  </span>
                  <span className="text-xs font-mono text-stone-400">
                    ID: {currentPost.id.slice(0, 10)}
                  </span>
                </div>

                <h2 className="text-xl font-bold font-display text-amber-100 leading-snug">
                  {currentPost.caption ? currentPost.caption.slice(0, 90) : "Untitled Saved Post"}
                  {currentPost.caption && currentPost.caption.length > 90 ? "..." : ""}
                </h2>

                <p className="text-xs text-stone-400 leading-relaxed">
                  Creator: <span className="text-stone-200 font-bold">@{currentPost.creatorUsername}</span> • Saved on{" "}
                  {currentPost.savedAt ? new Date(currentPost.savedAt).toLocaleDateString() : "Unknown"}
                </p>
              </div>

              {/* Memory Action Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={handleRevivePost}
                  disabled={isReviving}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <Zap size={14} />
                  <span>{isReviving ? "Reviving..." : "Revive to Recent Posts"}</span>
                </button>

                <button
                  onClick={handleCreateCapsuleCollection}
                  disabled={isCreatingCollection}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/20 font-bold text-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <FolderPlus size={14} />
                  <span>Save Capsule Collection</span>
                </button>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-amber-500/15">
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-mono font-bold transition-all cursor-pointer active:scale-95"
                >
                  <ChevronLeft size={16} />
                  <span>Previous Slide</span>
                </button>

                <div className="flex items-center gap-1 font-mono text-xs text-amber-400">
                  <span>{currentIndex + 1}</span>
                  <span className="text-stone-600">/</span>
                  <span className="text-stone-400">{activePosts.length}</span>
                </div>

                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800/80 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-mono font-bold transition-all cursor-pointer active:scale-95"
                >
                  <span>Next Slide</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
