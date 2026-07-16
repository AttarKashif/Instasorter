import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { db } from "../../lib/db";
import {
  normalizeInstagramPost,
  normalizeInstagramPostAsync,
} from "../../lib/parser";
import { usePostStore } from "../../store/useStore";
import {
  Upload,
  FileCode,
  Archive,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ImportViewProps {
  onClose?: () => void;
}

export const ImportView = React.memo(({ onClose }: ImportViewProps) => {
  const { isImporting: isProcessing, setIsImporting: setIsProcessing } =
    usePostStore();
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error";
    message: string;
    stats?: { newPosts: number; duplicates: number };
  } | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setPosts = usePostStore((state) => state.setPosts);

  const processFile = async (file: File) => {
    setIsProcessing(true, "Initializing archive read...");
    setImportStatus(null);
    setProgress(null);
    try {
      const rawJsonContents: string[] = [];
      let zip: JSZip | undefined = undefined;

      if (file.name.endsWith(".zip")) {
        zip = await JSZip.loadAsync(file);

        // Check for JSON files inside the ZIP
        const jsonFiles = Object.values(zip.files).filter(
          (f) => f.name.endsWith(".json") && !f.dir,
        );
        if (jsonFiles.length > 0) {
          for (const f of jsonFiles) {
            try {
              const strContent = await f.async("string");
              rawJsonContents.push(strContent);
            } catch (err) {
              console.warn(`Failed to read JSON file from zip: ${f.name}`, err);
            }
          }
        }

        if (rawJsonContents.length === 0) {
          throw new Error(
            "No JSON files found inside the ZIP archive. Make sure it contains your Instagram media data files like saved_posts.json or saved_collections.json.",
          );
        }
      } else if (file.name.endsWith(".json")) {
        const content = await file.text();
        rawJsonContents.push(content);
      } else {
        throw new Error(
          "Unsupported file type. Please upload an Instagram export as a .json or .zip archive.",
        );
      }

      // Collect raw objects from all parsed files
      const allExtractedRaws: any[] = [];

      for (const content of rawJsonContents) {
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          console.warn("Failed to parse JSON content, skipping file.", e);
          continue;
        }

        const extractFromObj = (obj: any) => {
          if (Array.isArray(obj)) {
            allExtractedRaws.push(...obj);
            return;
          }

          // Case A: saved_saved_media array (standard saved posts)
          if (obj.saved_saved_media && Array.isArray(obj.saved_saved_media)) {
            allExtractedRaws.push(...obj.saved_saved_media);
          }

          // Case B: saved_collections array (saved collections)
          if (obj.saved_collections && Array.isArray(obj.saved_collections)) {
            obj.saved_collections.forEach((col: any) => {
              const colName = col.name || "";
              const items = col.media_list_data || col.saved_saved_media || [];
              if (Array.isArray(items)) {
                items.forEach((item: any) => {
                  // Tag with collection name
                  const currentCols = item.collections || [];
                  if (colName && !currentCols.includes(colName)) {
                    currentCols.push(colName);
                  }
                  allExtractedRaws.push({
                    ...item,
                    collections: currentCols,
                  });
                });
              }
            });
          }

          // Case C: General fallback - find any nested array that doesn't match keys above
          if (!obj.saved_saved_media && !obj.saved_collections) {
            const possibleArray = Object.entries(obj).find(([k, v]) =>
              Array.isArray(v),
            );
            if (possibleArray) {
              allExtractedRaws.push(...(possibleArray[1] as any[]));
            }
          }
        };

        extractFromObj(parsed);
      }

      if (allExtractedRaws.length === 0) {
        throw new Error(
          "Could not find any valid Instagram posts or collections inside the files. Please make sure they are standard JSON files exported from Instagram.",
        );
      }

      // Normalize and merge duplicates based on postUrl in chunks/batches
      const mergedMap = new Map<string, any>();
      const batchSize = 40;
      const rawCount = allExtractedRaws.length;

      setProgress({ current: 0, total: rawCount });

      for (let i = 0; i < rawCount; i += batchSize) {
        const chunk = allExtractedRaws.slice(i, i + batchSize);

        // Update store status message for Shell sidebar indicator
        const currentCount = Math.min(i + batchSize, rawCount);
        setIsProcessing(true, `Parsing: ${currentCount} / ${rawCount}`);

        // Process chunk elements in parallel for optimal speed
        const chunkNormalized = await Promise.all(
          chunk.map((raw) => normalizeInstagramPostAsync(raw, zip)),
        );

        // Merge chunk items into the Map
        for (const normalized of chunkNormalized) {
          const key = normalized.id;
          const existing = mergedMap.get(key);

          if (existing) {
            const mergedCollections = Array.from(
              new Set([
                ...(existing.collections || []),
                ...(normalized.collections || []),
              ]),
            );
            const mergedTags = Array.from(
              new Set([...(existing.tags || []), ...(normalized.tags || [])]),
            );

            const mergedMediaType =
              existing.mediaType === "carousel" ||
              existing.mediaType === "video"
                ? existing.mediaType
                : normalized.mediaType === "carousel" ||
                    normalized.mediaType === "video"
                  ? normalized.mediaType
                  : "image";

            const mergedAdditionalSlides = Array.from(
              new Set([
                ...(existing.additionalSlides || []),
                ...(normalized.additionalSlides || []),
              ]),
            ).filter(Boolean);

            let mergedThumbnail = existing.thumbnailUrl;
            if (
              normalized.thumbnailUrl &&
              (normalized.thumbnailUrl.startsWith("data:") ||
                !existing.thumbnailUrl ||
                existing.thumbnailUrl.includes("unsplash.com"))
            ) {
              mergedThumbnail = normalized.thumbnailUrl;
            }

            mergedMap.set(key, {
              ...existing,
              ...normalized,
              id: existing.id,
              mediaType: mergedMediaType,
              additionalSlides:
                mergedAdditionalSlides.length > 0
                  ? mergedAdditionalSlides
                  : undefined,
              collections: mergedCollections,
              tags: mergedTags,
              isFavorite: existing.isFavorite || normalized.isFavorite,
              isArchived: existing.isArchived || normalized.isArchived,
              notes: existing.notes || normalized.notes,
              thumbnailUrl: mergedThumbnail,
            });
          } else {
            mergedMap.set(key, normalized);
          }
        }

        // Set state for local determinate progress bar
        setProgress({ current: currentCount, total: rawCount });

        // Yield to the browser main execution thread so UI frames render smoothly without lagging
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const finalNormalizedPosts = Array.from(mergedMap.values());

      if (finalNormalizedPosts.length === 0) {
        throw new Error("No posts could be parsed from the uploaded dataset.");
      }

      setIsProcessing(true, "Saving posts...");
      
      const existingDbPosts = await db.posts.toArray();
      const existingIds = new Set(existingDbPosts.map(p => p.id));
      let newPostsCount = 0;
      let duplicatesSkippedCount = 0;
      
      for (const p of finalNormalizedPosts) {
        if (existingIds.has(p.id)) {
          duplicatesSkippedCount++;
        } else {
          newPostsCount++;
        }
      }

      await db.posts.bulkPut(finalNormalizedPosts);
      setPosts(await db.posts.toArray());

      // Start background thumbnail worker
      const { runThumbnailWorker } = await import("../../lib/thumbnailWorker");
      runThumbnailWorker();

      localStorage.setItem("last_import_timestamp", Date.now().toString());

      // Send to server queue for background scraping in case the user leaves the tab
      const queuePayload = finalNormalizedPosts.map((p) => ({
        url: p.postUrl,
        id: p.id,
        mediaType: p.mediaType,
      }));
      fetch("/api/queue-background-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: queuePayload }),
      }).catch((err) => console.warn("Failed to queue background scrape", err));

      setImportStatus({
        type: "success",
        message: `Successfully imported ${finalNormalizedPosts.length} unique posts from your Instagram export! We successfully mapped your usernames, saved dates, and extracted the original high-resolution post images directly from the archive!`,
        stats: { newPosts: newPostsCount, duplicates: duplicatesSkippedCount },
      });
    } catch (error) {
      console.error(error);
      setImportStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "An unknown error occurred during import.",
      });
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-m3-surface rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="flex flex-col gap-4 p-4 md:p-6 overflow-y-auto">
          {/* Header Block with M3 typography */}
          <div className="flex items-center justify-between pb-2 border-b border-m3-outline-variant/15 w-full">
            <div>
              <h1 className="text-base font-bold font-display tracking-tight text-m3-on-surface">
                Import Instagram Archive
              </h1>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer shadow-2xs shrink-0"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Drag and Drop Zone - styled as M3 Outlined Card with interaction */}
          <motion.div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative border border-dashed rounded-[20px] p-6 md:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[200px] ${
              isDragging
                ? "border-m3-primary bg-m3-primary-container/20 shadow-inner"
                : "border-m3-outline-variant hover:border-m3-outline hover:bg-m3-surface-container/30 bg-m3-surface-low"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.zip"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isDragging
                    ? "bg-m3-primary-container text-m3-on-primary-container"
                    : "bg-m3-surface-variant text-m3-on-surface-variant"
                }`}
              >
                <Upload
                  size={20}
                  className={isProcessing ? "animate-bounce" : ""}
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold font-display text-m3-on-surface">
                  {isDragging
                    ? "Drop your archive here!"
                    : "Drag & drop your file"}
                </h3>
                <p className="text-[11px] text-m3-on-surface-variant max-w-sm">
                  Supports Instagram{" "}
                  <span className="font-semibold font-mono text-m3-primary">
                    .json
                  </span>{" "}
                  files, or{" "}
                  <span className="font-semibold font-mono text-m3-primary">
                    .zip
                  </span>{" "}
                  archives exported directly from Meta.
                </p>
              </div>

              <button
                type="button"
                disabled={isProcessing}
                className="mt-1 px-4 py-2 bg-m3-primary text-m3-on-primary hover:bg-opacity-95 rounded-full text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95 disabled:bg-m3-outline-variant disabled:text-m3-on-surface-variant"
              >
                Select File from Device
              </button>
            </div>

            {/* Linear Progress Bar for Processing State */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-6 bottom-6 flex flex-col items-center gap-1.5"
                >
                  <div className="w-full h-1.5 bg-m3-surface-variant rounded-full overflow-hidden">
                    {progress ? (
                      <motion.div
                        className="h-full bg-m3-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                        transition={{ duration: 0.15 }}
                      />
                    ) : (
                      <div
                        className="h-full bg-m3-primary w-1/3 rounded-full animate-infinite-slide"
                        style={{
                          animationName: "shimmer",
                          animationDuration: "1.5s",
                          animationIterationCount: "infinite",
                          animationTimingFunction: "ease-in-out",
                        }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-m3-primary flex items-center gap-1.5">
                    <RefreshCw size={10} className="animate-spin" />
                    {progress
                      ? `Processing posts: ${progress.current} of ${progress.total} (${Math.round((progress.current / progress.total) * 100)}%)`
                      : "Reading and compiling Instagram dataset..."}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Status Alerts using M3 container colors */}
          <AnimatePresence mode="wait">
            {importStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3 rounded-xl border flex gap-3 items-start ${
                  importStatus.type === "success"
                    ? "bg-m3-secondary-container/30 border-m3-secondary-container text-m3-on-secondary-container"
                    : "bg-m3-tertiary-container/30 border-m3-tertiary-container text-m3-on-tertiary-container"
                }`}
              >
                {importStatus.type === "success" ? (
                  <CheckCircle2
                    className="text-m3-primary shrink-0 mt-0.5"
                    size={16}
                  />
                ) : (
                  <AlertCircle
                    className="text-m3-tertiary shrink-0 mt-0.5"
                    size={16}
                  />
                )}
                <div className="flex flex-col gap-0.5">
                  <h4 className="font-bold text-xs">
                    {importStatus.type === "success"
                      ? "Import completed successfully"
                      : "Import failed"}
                  </h4>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {importStatus.message}
                  </p>
                  
                  {importStatus.type === "success" && importStatus.stats && (
                    <div className="mt-2 flex items-center gap-3 bg-m3-surface p-2 rounded-lg border border-m3-outline-variant/30">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-m3-on-surface-variant font-bold uppercase tracking-wider">New</span>
                        <span className="text-sm font-extrabold text-m3-primary">{importStatus.stats.newPosts}</span>
                      </div>
                      <div className="h-6 w-px bg-m3-outline-variant/30" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-m3-on-surface-variant font-bold uppercase tracking-wider">Merged</span>
                        <span className="text-sm font-extrabold text-m3-on-surface-variant">{importStatus.stats.duplicates}</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
});
