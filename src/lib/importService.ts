import JSZip from "jszip";
import { normalizeInstagramPostAsync } from "./parser";
import { parseHarFile } from "./harParser";
import {
  ImportError,
  InvalidJSONError,
  CorruptedZipError,
  MissingCriticalFieldsError,
  UnsupportedFileFormatError,
  EmptyArchiveError,
  FailedEntryInfo,
  ImportSummaryReport,
} from "./importErrors";
import { Post } from "../types/post";

export interface ParseResult {
  report: ImportSummaryReport;
  posts: Post[];
}

/**
 * Robust, tolerant, and crash-safe extraction of posts and collections from parsed JSON objects.
 * Supports standard Meta/Instagram JSON formats, direct array exports, nested objects, and collections.
 */
export function extractRawEntriesFromJSON(obj: any, fileName: string): { raw: any; fileName: string }[] {
  const extracted: { raw: any; fileName: string }[] = [];

  if (!obj || typeof obj !== "object") {
    return extracted;
  }

  // Helper to determine if an object looks like a collection object (e.g. has a name and some media array)
  const isCollectionObj = (val: any): boolean => {
    if (!val || typeof val !== "object") return false;
    const hasName = typeof val.name === "string" && val.name.trim().length > 0;
    const hasMediaArray =
      Array.isArray(val.media) ||
      Array.isArray(val.media_list_data) ||
      Array.isArray(val.saved_saved_media) ||
      Array.isArray(val.media_list) ||
      Array.isArray(val.posts);
    return hasName && hasMediaArray;
  };

  // Helper to process a single collection object and tag its media items
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
          const currentCols = Array.isArray(subItem.collections) ? [...subItem.collections] : [];
          if (colName && !currentCols.includes(colName)) {
            currentCols.push(colName);
          }
          extracted.push({
            raw: { ...subItem, collections: currentCols },
            fileName,
          });
        }
      });
    }
  };

  // Traversal function to recursively locate potential Instagram posts
  const traverse = (current: any) => {
    if (!current) return;

    if (Array.isArray(current)) {
      current.forEach((item) => {
        if (isCollectionObj(item)) {
          processCollection(item);
        } else if (item && typeof item === "object") {
          // If the item itself looks like a post, extract it, otherwise traverse
          if (looksLikePost(item)) {
            extracted.push({ raw: item, fileName });
          } else {
            traverse(item);
          }
        }
      });
      return;
    }

    if (typeof current === "object") {
      // Check if this object contains a specific top-level container structure
      if (current.saved_saved_media && Array.isArray(current.saved_saved_media)) {
        current.saved_saved_media.forEach((el: any) => {
          extracted.push({ raw: el, fileName });
        });
      }

      if (current.saved_collections && Array.isArray(current.saved_collections)) {
        current.saved_collections.forEach((col: any) => {
          processCollection(col);
        });
      }

      // If it has both or either, we don't need generic traversal
      if (current.saved_saved_media || current.saved_collections) {
        return;
      }

      // If this object itself looks like a post
      if (looksLikePost(current)) {
        extracted.push({ raw: current, fileName });
        return;
      }

      // Generic scan of all properties to extract arrays
      Object.entries(current).forEach(([_key, val]) => {
        if (Array.isArray(val)) {
          val.forEach((item: any) => {
            if (isCollectionObj(item)) {
              processCollection(item);
            } else if (item && typeof item === "object") {
              if (looksLikePost(item)) {
                extracted.push({ raw: item, fileName });
              } else {
                traverse(item);
              }
            }
          });
        } else if (val && typeof val === "object") {
          traverse(val);
        }
      });
    }
  };

  traverse(obj);
  return extracted;
}

/**
 * Heuristic check to see if an object resembles an Instagram post or saved item structure.
 */
function looksLikePost(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;

  // Direct known keys
  const hasUrlKey = !!(
    obj.postUrl || obj.url || obj.href || obj.instagramUrl ||
    obj.post_url || obj.media_url || obj.uri || obj.link
  );
  
  const hasStringMap = !!(obj.string_map_data && typeof obj.string_map_data === "object");
  const hasMediaList = Array.isArray(obj.media_list_data) && obj.media_list_data.length > 0;
  const hasLabelValues = Array.isArray(obj.label_values) && obj.label_values.length > 0;
  const hasId = !!(obj.id || obj.fbid);

  return hasUrlKey || hasStringMap || hasMediaList || hasLabelValues || hasId;
}

/**
 * Main parser module entry point.
 * Accepts ZIP, JSON, or HAR files and processes them to extract unique Normalized Instagram posts.
 * Generates a full summary diagnostic report.
 */
export async function parseImportFileAsync(
  file: File,
  onProgress?: (current: number, total: number, statusMessage: string) => void
): Promise<ParseResult> {
  const fileErrors: FailedEntryInfo[] = [];
  const failedEntries: FailedEntryInfo[] = [];
  const rawJsonContents: { fileName: string; content: string }[] = [];
  let harExtractedPosts: any[] = [];
  let zip: JSZip | undefined = undefined;
  let totalFilesProcessed = 0;

  onProgress?.(0, 100, "Inspecting archive format...");

  // 1. Detect extension & load files gracefully
  const ext = file.name.split(".").pop()?.toLowerCase();

  try {
    if (ext === "zip") {
      try {
        zip = await JSZip.loadAsync(file);
      } catch (zipErr: any) {
        throw new CorruptedZipError(
          `Failed to decompress ZIP archive '${file.name}': ${zipErr.message || "Invalid or corrupted ZIP header."}`,
          file.name
        );
      }

      // Automatic JSON detection: Search all .json files nested inside the zip archive
      const jsonFiles = Object.values(zip.files).filter(
        (f) => f.name.toLowerCase().endsWith(".json") && !f.dir
      );

      if (jsonFiles.length === 0) {
        throw new EmptyArchiveError(file.name);
      }

      for (let i = 0; i < jsonFiles.length; i++) {
        const f = jsonFiles[i];
        totalFilesProcessed++;
        
        onProgress?.(
          Math.floor((i / jsonFiles.length) * 30),
          100,
          `Reading JSON files: ${i + 1} / ${jsonFiles.length}`
        );

        try {
          const strContent = await f.async("string");
          rawJsonContents.push({ fileName: f.name, content: strContent });
        } catch (readErr: any) {
          fileErrors.push({
            id: `ferr_${fileErrors.length + 1}_${Date.now()}`,
            fileName: f.name,
            errorCode: "FILE_READ_ERROR",
            errorName: "FileReadError",
            message: `Could not read contents of file '${f.name}' inside ZIP: ${readErr.message || "Unknown read error"}`,
            actionableFeedback: "The sub-file might be corrupted. Check your local disk space or re-download.",
            timestamp: new Date().toISOString(),
          });
        }
      }
    } else if (ext === "json") {
      totalFilesProcessed = 1;
      try {
        const content = await file.text();
        rawJsonContents.push({ fileName: file.name, content });
      } catch (readErr: any) {
        throw new ImportError(
          `Failed to read file '${file.name}': ${readErr.message}`,
          "FILE_READ_ERROR",
          "Ensure the file is accessible and has proper permissions.",
          file.name
        );
      }
    } else if (ext === "har") {
      totalFilesProcessed = 1;
      try {
        const content = await file.text();
        const harResult = parseHarFile(content);
        if (harResult.posts.length === 0) {
          throw new Error("No Instagram posts or media items found inside this HAR network archive.");
        }
        harExtractedPosts = harResult.posts;
      } catch (harErr: any) {
        throw new ImportError(
          `Failed to parse HAR network archive '${file.name}': ${harErr.message}`,
          "HAR_PARSE_ERROR",
          "Export the HAR file from your browser DevTools while actively scrolling Instagram.",
          file.name
        );
      }
    } else {
      throw new UnsupportedFileFormatError(file.name);
    }

    // 2. Safely parse JSON strings with automatic error shielding
    const allExtractedRaws: { raw: any; fileName: string }[] = [];

    if (harExtractedPosts.length > 0) {
      harExtractedPosts.forEach((p) => {
        allExtractedRaws.push({ raw: p, fileName: file.name });
      });
    }

    onProgress?.(30, 100, "Extracting post objects...");

    for (const item of rawJsonContents) {
      let parsed: any;
      try {
        parsed = JSON.parse(item.content);
      } catch (jsonErr: any) {
        const syntaxDetails = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
        const invalidErr = new InvalidJSONError(
          `Invalid JSON syntax in '${item.fileName}': ${syntaxDetails}`,
          item.fileName,
          syntaxDetails
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
        continue; // Skip the malformed JSON file, but proceed with any others!
      }

      // Gracefully extract raw entries using our robust extractor
      try {
        const extracted = extractRawEntriesFromJSON(parsed, item.fileName);
        allExtractedRaws.push(...extracted);
      } catch (extractErr: any) {
        fileErrors.push({
          id: `ferr_${fileErrors.length + 1}_${Date.now()}`,
          fileName: item.fileName,
          errorCode: "SCHEMA_EXTRACTION_FAILED",
          errorName: "SchemaExtractionError",
          message: `Failed to extract structures from '${item.fileName}': ${extractErr.message || extractErr}`,
          actionableFeedback: "The file schema is unknown or heavily modified. Ensure it is a direct Instagram export.",
          timestamp: new Date().toISOString(),
        });
      }
    }

    const totalEntriesFound = allExtractedRaws.length;

    if (totalEntriesFound === 0 && fileErrors.length > 0) {
      throw new ImportError(
        "All parsed JSON files inside the archive were invalid or had missing post data structures.",
        "ALL_FILES_INVALID",
        "Ensure your Instagram export was downloaded directly from Meta Privacy Settings and is unzipped properly if needed.",
        file.name
      );
    } else if (totalEntriesFound === 0) {
      throw new EmptyArchiveError(file.name);
    }

    // 3. Batch Normalization & Resolving Media Attachments
    const mergedMap = new Map<string, Post>();
    const batchSize = 40;

    for (let i = 0; i < totalEntriesFound; i += batchSize) {
      const chunk = allExtractedRaws.slice(i, i + batchSize);
      const currentCount = Math.min(i + batchSize, totalEntriesFound);
      const progressPercent = Math.floor(30 + (currentCount / totalEntriesFound) * 60);
      
      onProgress?.(
        progressPercent,
        100,
        `Normalizing posts: ${currentCount} / ${totalEntriesFound}`
      );

      for (let j = 0; j < chunk.length; j++) {
        const entryIndex = i + j + 1;
        const { raw, fileName } = chunk[j];

        try {
          const normalized = await normalizeInstagramPostAsync(raw, zip);
          const key = normalized.id;
          const existing = mergedMap.get(key);

          if (existing) {
            // Merge metadata if the post was already extracted in this batch (e.g., from multiple folders/collections)
            const mergedCollections = Array.from(
              new Set([
                ...(existing.collections || []),
                ...(normalized.collections || []),
              ])
            );
            const mergedTags = Array.from(
              new Set([...(existing.tags || []), ...(normalized.tags || [])])
            );

            const mergedMediaType =
              existing.mediaType === "carousel" || existing.mediaType === "video"
                ? existing.mediaType
                : normalized.mediaType === "carousel" || normalized.mediaType === "video"
                ? normalized.mediaType
                : "image";

            const mergedAdditionalSlides = Array.from(
              new Set([
                ...(existing.additionalSlides || []),
                ...(normalized.additionalSlides || []),
              ])
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
              additionalSlides: mergedAdditionalSlides.length > 0 ? mergedAdditionalSlides : undefined,
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
            errorName: entryErr instanceof Error ? entryErr.name : "NormalizationError",
            message: entryErr instanceof Error ? entryErr.message : "Failed to normalize entry",
            actionableFeedback: isKnownImportErr
              ? entryErr.actionableFeedback
              : "This item lacks critical Instagram fields like a valid Post URL or ID. This entry will be skipped.",
            rawSample:
              typeof raw === "object"
                ? JSON.stringify(raw).substring(0, 140) + "..."
                : String(raw),
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Small tick release for responsive browser UI thread
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const finalNormalizedPosts = Array.from(mergedMap.values());

    if (finalNormalizedPosts.length === 0) {
      throw new ImportError(
        `Failed to parse any valid Instagram posts from the archive. Checked ${totalEntriesFound} objects but all were malformed or missing required identifiers.`,
        "NO_VALID_ENTRIES",
        "Make sure your files contain actual saved post data or collections.",
        file.name
      );
    }

    onProgress?.(95, 100, "Building diagnostic summary...");

    const hasFailures = failedEntries.length > 0 || fileErrors.length > 0;
    const reportStatus = hasFailures ? "partial_success" : "success";

    const summaryReport: ImportSummaryReport = {
      status: reportStatus,
      totalFilesProcessed,
      totalEntriesFound,
      successfullyImported: finalNormalizedPosts.length,
      duplicatesMerged: 0, // Filled in by caller after DB comparison
      failedEntriesCount: failedEntries.length + fileErrors.length,
      failedEntries,
      fileErrors,
      timestamp: new Date().toISOString(),
    };

    onProgress?.(100, 100, "Import completed!");

    return {
      report: summaryReport,
      posts: finalNormalizedPosts,
    };

  } catch (error: any) {
    // Top-level fatal error shield
    const isKnown = error instanceof ImportError;
    const errorCode = isKnown ? error.code : "IMPORT_PROCESSING_FAILED";
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred during import.";
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

    return {
      report: failureReport,
      posts: [],
    };
  }
}
