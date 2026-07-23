import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import {
  normalizeInstagramPost,
  normalizeInstagramPostAsync,
} from "../../lib/parser";
import {
  ImportError,
  InvalidJSONError,
  CorruptedZipError,
  MissingCriticalFieldsError,
  UnsupportedFileFormatError,
  EmptyArchiveError,
  FailedEntryInfo,
  ImportSummaryReport,
} from "../../lib/importErrors";
import { usePostStore } from "../../store/useStore";
import { runAutoDeduplicationAndBatching } from "../../lib/autoOrganizer";
import {
  Upload,
  FileCode,
  Archive,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  Trash2,
  ShieldAlert,
  Layers,
  Copy,
  Download,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertTriangle,
  Bug,
  Info,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";

interface ImportViewProps {
  onClose?: () => void;
}

export const ImportView = React.memo(({ onClose }: ImportViewProps) => {
  const isProcessing = usePostStore((state) => state.isImporting);
  const setIsProcessing = usePostStore((state) => state.setIsImporting);
  const importMessage = usePostStore((state) => state.importMessage);
  const posts = usePostStore((state) => state.posts);
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error" | "warning";
    message: string;
    stats?: { newPosts: number; duplicates: number };
  } | null>(null);
  const [report, setReport] = useState<ImportSummaryReport | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);

  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setPosts = usePostStore((state) => state.setPosts);

  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const exportData = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(posts));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `instasorter_export_${new Date().toISOString().split("T")[0]}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleCopyErrorReport = () => {
    if (!report) return;
    navigator.clipboard
      .writeText(JSON.stringify(report, null, 2))
      .then(() => {
        toast.success("Diagnostic report copied to clipboard!");
      })
      .catch(() => {
        toast.error("Failed to copy report to clipboard.");
      });
  };

  const handleDownloadErrorReport = () => {
    if (!report) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `instasorter_import_report_${new Date().toISOString().split("T")[0]}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Downloaded error report JSON!");
  };

  const handleClearAllPosts = async () => {
    try {
      triggerVibration("warning");
      await db.posts.clear();
      setPosts([]);
      setShowConfirmClear(false);
      setImportStatus({
        type: "success",
        message:
          "Your local database has been successfully cleared of all bookmarks and collections.",
      });
      setReport(null);
    } catch (err) {
      console.error(err);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true, "Initializing archive read...");
    setImportStatus(null);
    setReport(null);
    setProgress(null);
    setShowErrorDetails(false);

    const fileErrors: FailedEntryInfo[] = [];
    const failedEntries: FailedEntryInfo[] = [];
    const rawJsonContents: { fileName: string; content: string }[] = [];
    let zip: JSZip | undefined = undefined;
    let totalFilesProcessed = 0;

    try {
      // 1. File type inspection & decompression with specific error handlers
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          zip = await JSZip.loadAsync(file);
        } catch (zipErr: any) {
          throw new CorruptedZipError(
            `Failed to decompress ZIP archive '${file.name}': ${zipErr.message || "Invalid or corrupted ZIP header."}`,
            file.name,
          );
        }

        const jsonFiles = Object.values(zip.files).filter(
          (f) => f.name.toLowerCase().endsWith(".json") && !f.dir,
        );

        if (jsonFiles.length === 0) {
          throw new EmptyArchiveError(file.name);
        }

        for (const f of jsonFiles) {
          totalFilesProcessed++;
          try {
            const strContent = await f.async("string");
            rawJsonContents.push({ fileName: f.name, content: strContent });
          } catch (readErr: any) {
            fileErrors.push({
              id: `ferr_${fileErrors.length + 1}_${Date.now()}`,
              fileName: f.name,
              errorCode: "FILE_READ_ERROR",
              errorName: "FileReadError",
              message: `Could not read contents of file '${f.name}' inside ZIP archive: ${readErr.message || "Unknown read error"}`,
              actionableFeedback:
                "The ZIP archive may contain corrupted sub-files. Ensure the file was fully downloaded.",
              timestamp: new Date().toISOString(),
            });
          }
        }
      } else if (file.name.toLowerCase().endsWith(".json")) {
        totalFilesProcessed = 1;
        try {
          const content = await file.text();
          rawJsonContents.push({ fileName: file.name, content });
        } catch (readErr: any) {
          throw new ImportError(
            `Failed to read file '${file.name}': ${readErr.message}`,
            "FILE_READ_ERROR",
            "Check device permissions and try selecting the file again.",
            file.name,
          );
        }
      } else {
        throw new UnsupportedFileFormatError(file.name);
      }

      // 2. Safely parse JSON strings and catch InvalidJSONError per file
      const allExtractedRaws: { raw: any; fileName: string }[] = [];

      for (const item of rawJsonContents) {
        let parsed: any;
        try {
          parsed = JSON.parse(item.content);
        } catch (jsonErr: any) {
          const syntaxDetails =
            jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
          const invalidErr = new InvalidJSONError(
            `Invalid JSON syntax in '${item.fileName}': ${syntaxDetails}`,
            item.fileName,
            syntaxDetails,
          );
          fileErrors.push({
            id: `ferr_${fileErrors.length + 1}_${Date.now()}`,
            fileName: item.fileName,
            errorCode: invalidErr.code,
            errorName: invalidErr.name,
            message: invalidErr.message,
            actionableFeedback: invalidErr.actionableFeedback,
            rawSample: item.content.substring(0, 150) + "...",
            timestamp: new Date().toISOString(),
          });
          continue; // Skip damaged JSON file, continue reading other files!
        }

        const extractFromObj = (obj: any, sourceFile: string) => {
          if (!obj) return;

          const processCollection = (col: any) => {
            const colName = col.name || "";
            const items =
              col.media ||
              col.media_list_data ||
              col.saved_saved_media ||
              col.media_list ||
              col.posts ||
              [];
            if (Array.isArray(items)) {
              items.forEach((subItem: any) => {
                if (subItem && typeof subItem === "object") {
                  const currentCols = subItem.collections || [];
                  if (colName && !currentCols.includes(colName)) {
                    currentCols.push(colName);
                  }
                  allExtractedRaws.push({
                    raw: { ...subItem, collections: currentCols },
                    fileName: sourceFile,
                  });
                }
              });
            }
          };

          const isCollectionObj = (val: any) => {
            if (!val || typeof val !== "object") return false;
            const hasName =
              typeof val.name === "string" && val.name.length > 0;
            const hasMediaArray =
              Array.isArray(val.media) ||
              Array.isArray(val.media_list_data) ||
              Array.isArray(val.saved_saved_media) ||
              Array.isArray(val.media_list) ||
              Array.isArray(val.posts);
            return hasName && hasMediaArray;
          };

          if (Array.isArray(obj)) {
            obj.forEach((element: any) => {
              if (isCollectionObj(element)) {
                processCollection(element);
              } else {
                allExtractedRaws.push({ raw: element, fileName: sourceFile });
              }
            });
            return;
          }

          if (obj.saved_saved_media && Array.isArray(obj.saved_saved_media)) {
            obj.saved_saved_media.forEach((element: any) => {
              allExtractedRaws.push({ raw: element, fileName: sourceFile });
            });
          }

          if (obj.saved_collections && Array.isArray(obj.saved_collections)) {
            obj.saved_collections.forEach((col: any) => {
              processCollection(col);
            });
          }

          if (!obj.saved_saved_media && !obj.saved_collections) {
            Object.entries(obj).forEach(([_k, val]) => {
              if (Array.isArray(val)) {
                val.forEach((element: any) => {
                  if (isCollectionObj(element)) {
                    processCollection(element);
                  } else {
                    allExtractedRaws.push({
                      raw: element,
                      fileName: sourceFile,
                    });
                  }
                });
              }
            });
          }
        };

        extractFromObj(parsed, item.fileName);
      }

      const totalEntriesFound = allExtractedRaws.length;

      if (totalEntriesFound === 0 && fileErrors.length > 0) {
        throw new ImportError(
          "All JSON files inside the archive contained syntax errors or invalid formatting.",
          "ALL_FILES_INVALID",
          "Ensure your Instagram export was downloaded directly from Meta Privacy Settings.",
          file.name,
        );
      } else if (totalEntriesFound === 0) {
        throw new EmptyArchiveError(file.name);
      }

      // 3. Batch Normalization with Per-Entry Error Catching
      const mergedMap = new Map<string, any>();
      const batchSize = 40;

      setProgress({ current: 0, total: totalEntriesFound });

      for (let i = 0; i < totalEntriesFound; i += batchSize) {
        const chunk = allExtractedRaws.slice(i, i + batchSize);
        const currentCount = Math.min(i + batchSize, totalEntriesFound);
        setIsProcessing(
          true,
          `Parsing & Validating: ${currentCount} / ${totalEntriesFound}`,
        );

        for (let j = 0; j < chunk.length; j++) {
          const entryIndex = i + j + 1;
          const { raw, fileName } = chunk[j];

          try {
            const normalized = await normalizeInstagramPostAsync(raw, zip);
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
                new Set([
                  ...(existing.tags || []),
                  ...(normalized.tags || []),
                ]),
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
          } catch (entryErr: any) {
            const isKnownImportErr = entryErr instanceof ImportError;
            failedEntries.push({
              id: `err_${entryIndex}_${Date.now()}`,
              fileName,
              entryIndex,
              errorCode: isKnownImportErr ? entryErr.code : "MALFORMED_ENTRY",
              errorName:
                entryErr instanceof Error
                  ? entryErr.name
                  : "NormalizationError",
              message:
                entryErr instanceof Error
                  ? entryErr.message
                  : "Failed to normalize entry",
              actionableFeedback: isKnownImportErr
                ? entryErr.actionableFeedback
                : "This item lacks required Instagram fields (post URL, media link, or ID). Verify your export dataset.",
              rawSample:
                typeof raw === "object"
                  ? JSON.stringify(raw).substring(0, 140) + "..."
                  : String(raw),
              timestamp: new Date().toISOString(),
            });
          }
        }

        setProgress({ current: currentCount, total: totalEntriesFound });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const finalNormalizedPosts = Array.from(mergedMap.values());

      if (finalNormalizedPosts.length === 0) {
        throw new ImportError(
          `No valid Instagram posts could be extracted from ${totalEntriesFound} raw entries. All entries were missing required critical fields.`,
          "NO_VALID_ENTRIES",
          "Ensure you uploaded an Instagram export containing saved posts rather than account profile settings.",
          file.name,
        );
      }

      setIsProcessing(true, "Saving valid posts to database...");

      const existingDbPosts = await db.posts.toArray();
      const existingIds = new Set(existingDbPosts.map((p) => p.id));
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

      // Automatically run deduplication and batch categorization silently on import
      const { mergedDuplicatesCount, autoCategorizedCount, freshPosts } =
        await runAutoDeduplicationAndBatching();

      setPosts(freshPosts);

      // Trigger background thumbnail worker
      const { runThumbnailWorker } = await import(
        "../../lib/thumbnailWorker"
      );
      runThumbnailWorker();

      localStorage.setItem("last_import_timestamp", Date.now().toString());

      // Queue background scrape
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

      const hasFailures = failedEntries.length > 0 || fileErrors.length > 0;
      const reportStatus = hasFailures ? "partial_success" : "success";

      const summaryReport: ImportSummaryReport = {
        status: reportStatus,
        totalFilesProcessed,
        totalEntriesFound,
        successfullyImported: finalNormalizedPosts.length,
        duplicatesMerged: duplicatesSkippedCount,
        failedEntriesCount: failedEntries.length + fileErrors.length,
        failedEntries,
        fileErrors,
        timestamp: new Date().toISOString(),
      };

      setReport(summaryReport);

      if (reportStatus === "success") {
        toast.success(
          `Imported ${finalNormalizedPosts.length} posts cleanly!`,
          { icon: "📥" },
        );
        setImportStatus({
          type: "success",
          message: `Successfully imported ${finalNormalizedPosts.length} unique posts from your Instagram export cleanly with zero errors!`,
          stats: {
            newPosts: newPostsCount,
            duplicates: duplicatesSkippedCount,
          },
        });
      } else {
        toast(
          `Imported ${finalNormalizedPosts.length} posts (${failedEntries.length + fileErrors.length} entries skipped/failed).`,
          { icon: "⚠️" },
        );
        setImportStatus({
          type: "warning",
          message: `Imported ${finalNormalizedPosts.length} posts successfully. Skipped ${failedEntries.length + fileErrors.length} malformed entries. Review actionable diagnostic feedback below.`,
          stats: {
            newPosts: newPostsCount,
            duplicates: duplicatesSkippedCount,
          },
        });
        setShowErrorDetails(true);
      }
    } catch (error: any) {
      console.error("Import processing error:", error);
      const isKnown = error instanceof ImportError;
      const errorCode = isKnown ? error.code : "IMPORT_PROCESSING_FAILED";
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during import.";
      const feedback = isKnown
        ? error.actionableFeedback
        : "Verify that your file is an uncorrupted .json or .zip archive directly exported from Instagram or Meta.";

      const failureReport: ImportSummaryReport = {
        status: "failed",
        totalFilesProcessed,
        totalEntriesFound: 0,
        successfullyImported: 0,
        duplicatesMerged: 0,
        failedEntriesCount: 1,
        failedEntries: [],
        fileErrors: [
          {
            id: `fatal_${Date.now()}`,
            fileName: file.name,
            errorCode,
            errorName: error instanceof Error ? error.name : "ImportError",
            message: errorMsg,
            actionableFeedback: feedback,
            timestamp: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
      };

      setReport(failureReport);
      setImportStatus({
        type: "error",
        message: errorMsg,
      });
      setShowErrorDetails(true);
      toast.error(errorMsg);
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

  const allReportErrors = [
    ...(report?.fileErrors || []),
    ...(report?.failedEntries || []),
  ];

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
          {isProcessing ? (
            <div className="relative border border-m3-outline-variant/60 rounded-[20px] p-6 md:p-10 flex flex-col items-center justify-center text-center bg-m3-surface-low min-h-[220px] shadow-xs">
              <div className="flex flex-col items-center gap-5 w-full max-w-md">
                <div className="w-14 h-14 rounded-full bg-m3-primary/10 text-m3-primary flex items-center justify-center animate-spin">
                  <RefreshCw size={24} className="stroke-[2.5]" />
                </div>

                <div className="space-y-1.5 w-full">
                  <h3 className="text-sm font-bold font-display text-m3-on-surface">
                    Importing Your Archive...
                  </h3>
                  <p className="text-[11px] text-m3-on-surface-variant font-medium">
                    {importMessage ||
                      "Reading and compiling Instagram dataset..."}
                  </p>
                </div>

                {/* Determinate Linear Progress Bar */}
                <div className="w-full space-y-2 mt-1">
                  <div className="w-full h-3 bg-m3-surface-variant/50 rounded-full overflow-hidden border border-m3-outline-variant/20 shadow-inner">
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
                      <div className="h-full bg-m3-primary w-1/3 rounded-full animate-pulse bg-gradient-to-r from-m3-primary/40 to-m3-primary" />
                    )}
                  </div>
                  <div className="flex justify-between text-[11px] font-mono font-bold text-m3-primary px-0.5">
                    <span>
                      {progress
                        ? `Processed: ${progress.current} of ${progress.total} posts`
                        : "Analyzing archives..."}
                    </span>
                    <span>
                      {progress
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                  <Upload size={20} />
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
                  className="mt-1 px-4 py-2 bg-m3-primary text-m3-on-primary hover:bg-opacity-95 rounded-full text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  Select File from Device
                </button>
              </div>
            </motion.div>
          )}

          {/* Clear Library option inside ImportView if there are existing posts */}
          {!isProcessing && posts.length > 0 && (
            <div className="flex justify-center items-center gap-1.5 mt-1 text-xs">
              <span className="text-m3-on-surface-variant">
                Already have {posts.length} bookmarks?
              </span>
              <button
                onClick={() => setShowConfirmClear(true)}
                className="text-red-500 hover:text-red-600 font-semibold hover:underline cursor-pointer flex items-center gap-1 transition-colors"
              >
                <Trash2 size={12} />
                <span>Clear & Start Fresh</span>
              </button>
            </div>
          )}

          {/* Status Alerts using M3 container colors */}
          <AnimatePresence mode="wait">
            {importStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-2xl border flex flex-col gap-3 ${
                  importStatus.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                    : importStatus.type === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                      : "bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-100"
                }`}
              >
                <div className="flex gap-3 items-start">
                  {importStatus.type === "success" ? (
                    <CheckCircle2
                      className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                      size={18}
                    />
                  ) : importStatus.type === "warning" ? (
                    <AlertTriangle
                      className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                      size={18}
                    />
                  ) : (
                    <AlertCircle
                      className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                      size={18}
                    />
                  )}
                  <div className="flex flex-col gap-1 flex-1">
                    <h4 className="font-bold text-xs font-display">
                      {importStatus.type === "success"
                        ? "Import completed successfully"
                        : importStatus.type === "warning"
                          ? "Import finished with warnings"
                          : "Import failed"}
                    </h4>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {importStatus.message}
                    </p>

                    {importStatus.stats && (
                      <div className="mt-2 flex items-center gap-4 bg-m3-surface p-2.5 rounded-xl border border-m3-outline-variant/30 shadow-2xs">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-m3-on-surface-variant font-bold uppercase tracking-wider">
                            New Posts
                          </span>
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                            {importStatus.stats.newPosts}
                          </span>
                        </div>
                        <div className="h-6 w-px bg-m3-outline-variant/30" />
                        <div className="flex flex-col">
                          <span className="text-[9px] text-m3-on-surface-variant font-bold uppercase tracking-wider">
                            Duplicates Merged
                          </span>
                          <span className="text-sm font-extrabold text-m3-on-surface-variant font-mono">
                            {importStatus.stats.duplicates}
                          </span>
                        </div>
                        {report && report.failedEntriesCount > 0 && (
                          <>
                            <div className="h-6 w-px bg-m3-outline-variant/30" />
                            <div className="flex flex-col">
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                                Skipped / Failed
                              </span>
                              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                                {report.failedEntriesCount}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actionable Error Diagnostics Log Panel */}
          {report && allReportErrors.length > 0 && (
            <div className="border border-m3-outline-variant/40 rounded-2xl bg-m3-surface-low overflow-hidden shadow-xs">
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="w-full px-4 py-3 bg-m3-surface-container/40 hover:bg-m3-surface-container/70 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 text-xs font-bold font-display text-m3-on-surface">
                  <Bug size={15} className="text-amber-500 shrink-0" />
                  <span>Import Diagnostics & Actionable Feedback</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold">
                    {allReportErrors.length}{" "}
                    {allReportErrors.length === 1 ? "issue" : "issues"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-m3-on-surface-variant font-medium">
                  <span>{showErrorDetails ? "Hide Log" : "Inspect Log"}</span>
                  {showErrorDetails ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {showErrorDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 border-t border-m3-outline-variant/30 space-y-3 max-h-[280px] overflow-y-auto"
                  >
                    {/* Action Toolbar */}
                    <div className="flex items-center justify-between pb-2 border-b border-m3-outline-variant/20">
                      <span className="text-[11px] text-m3-on-surface-variant font-medium">
                        Detailed feedback for failed or skipped entries:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyErrorReport}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-m3-surface-container border border-m3-outline-variant/30 text-m3-on-surface rounded-lg hover:bg-m3-surface-container-high transition-colors cursor-pointer shadow-2xs"
                        >
                          <Copy size={12} />
                          <span>Copy Log</span>
                        </button>
                        <button
                          onClick={handleDownloadErrorReport}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-m3-primary text-m3-on-primary rounded-lg hover:bg-m3-primary/90 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download size={12} />
                          <span>Download Report</span>
                        </button>
                      </div>
                    </div>

                    {/* Error Item Cards */}
                    <div className="space-y-2.5">
                      {allReportErrors.map((err, idx) => (
                        <div
                          key={err.id || idx}
                          className="p-3 bg-m3-surface border border-m3-outline-variant/25 rounded-xl text-xs space-y-2 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                                {err.errorCode}
                              </span>
                              {err.fileName && (
                                <span className="text-[11px] font-mono font-semibold text-m3-on-surface flex items-center gap-1">
                                  <FileText size={11} className="text-m3-primary" />
                                  {err.fileName}
                                </span>
                              )}
                              {err.entryIndex && (
                                <span className="text-[10px] font-mono text-m3-outline font-semibold">
                                  #Entry {err.entryIndex}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-m3-outline font-mono">
                              {new Date(err.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <p className="text-[11px] font-semibold text-m3-on-surface leading-snug">
                            {err.message}
                          </p>

                          {/* Actionable Feedback Box */}
                          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-950 dark:text-blue-100 flex items-start gap-2 text-[11px] leading-relaxed">
                            <HelpCircle
                              size={14}
                              className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
                            />
                            <div>
                              <strong className="font-bold text-blue-700 dark:text-blue-300">
                                Actionable Next Step:{" "}
                              </strong>
                              <span>{err.actionableFeedback}</span>
                            </div>
                          </div>

                          {/* Raw Sample Preview */}
                          {err.rawSample && (
                            <div>
                              <button
                                onClick={() =>
                                  setExpandedSampleId(
                                    expandedSampleId === err.id ? null : err.id,
                                  )
                                }
                                className="text-[10px] text-m3-primary font-mono hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <span>
                                  {expandedSampleId === err.id
                                    ? "Hide Raw Sample"
                                    : "View Raw Snippet"}
                                </span>
                              </button>
                              {expandedSampleId === err.id && (
                                <pre className="mt-1 p-2 bg-m3-surface-container text-[10px] font-mono rounded-lg overflow-x-auto text-m3-on-surface-variant border border-m3-outline-variant/30">
                                  {err.rawSample}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Confirmation Modal for Clearing Database inside ImportView */}
      <AnimatePresence>
        {showConfirmClear && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmClear(false)}
              className="fixed inset-0"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-md w-full p-6 shadow-2xl relative z-10 space-y-5"
            >
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold font-display text-m3-on-surface">
                    Backup Recommended Before Clear
                  </h3>
                  <p className="text-xs text-m3-on-surface-variant leading-relaxed">
                    We strongly recommend creating a backup of your local
                    database before clearing. Once cleared, all saved posts,
                    collections, and custom curation notes will be permanently
                    deleted and **cannot be undone**.
                  </p>
                </div>
              </div>

              {/* Backup Call to Action Box */}
              <div className="bg-m3-surface-container/50 border border-m3-outline-variant/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-m3-on-surface">
                    <Layers size={14} className="text-m3-primary" />
                    <span>Download Archive</span>
                  </div>
                  <span className="text-[10px] font-mono text-m3-outline font-semibold">
                    {posts.length} records
                  </span>
                </div>
                <p className="text-[11px] text-m3-on-surface-variant leading-normal">
                  Export your curated library into a JSON file so you can restore
                  or migrate it at any time.
                </p>
                <button
                  onClick={() => {
                    exportData();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-xl py-2 text-xs font-bold hover:bg-m3-primary/90 transition-all cursor-pointer shadow-xs"
                >
                  <Layers size={14} />
                  <span>Download JSON Backup</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-full border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container cursor-pointer transition-colors text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllPosts}
                  className="px-4 py-2 text-xs font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 cursor-pointer transition-colors shadow-sm text-center"
                >
                  Skip Backup & Clear All Posts
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

