export class ImportError extends Error {
  public readonly code: string;
  public readonly actionableFeedback: string;
  public readonly fileName?: string;
  public readonly entryIndex?: number;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    actionableFeedback: string,
    fileName?: string,
    entryIndex?: number,
  ) {
    super(message);
    this.name = "ImportError";
    this.code = code;
    this.actionableFeedback = actionableFeedback;
    this.fileName = fileName;
    this.entryIndex = entryIndex;
    this.timestamp = new Date().toISOString();
  }
}

export class InvalidJSONError extends ImportError {
  constructor(message: string, fileName?: string, details?: string) {
    const feedback = details
      ? `JSON Syntax Error (${details}). Ensure the file wasn't truncated during download. Re-download your archive from Meta Privacy Settings.`
      : "The JSON file contains invalid syntax. Ensure it was not manually modified or truncated.";
    super(message, "INVALID_JSON", feedback, fileName);
    this.name = "InvalidJSONError";
  }
}

export class CorruptedZipError extends ImportError {
  constructor(message: string, fileName?: string) {
    const feedback =
      "The ZIP archive is damaged, incomplete, or password-protected. Try re-downloading the ZIP file from Meta or unzip it on your computer and upload the .json files directly.";
    super(message, "CORRUPTED_ZIP", feedback, fileName);
    this.name = "CorruptedZipError";
  }
}

export class MissingCriticalFieldsError extends ImportError {
  constructor(message: string, entryIndex?: number, fileName?: string) {
    const feedback =
      "This entry lacks essential Instagram post fields (such as post URL, media URI, or post ID). Verify if this item in your Meta export contains valid saved media data.";
    super(message, "MISSING_CRITICAL_FIELDS", feedback, fileName, entryIndex);
    this.name = "MissingCriticalFieldsError";
  }
}

export class UnsupportedFileFormatError extends ImportError {
  constructor(fileName: string) {
    const feedback =
      "Instasorter accepts .json files or .zip archives exported directly from Instagram or Meta Privacy Center.";
    super(
      `Unsupported file extension for '${fileName}'`,
      "UNSUPPORTED_FILE",
      feedback,
      fileName,
    );
    this.name = "UnsupportedFileFormatError";
  }
}

export class EmptyArchiveError extends ImportError {
  constructor(fileName?: string) {
    const feedback =
      "No valid Instagram posts or collections were found in this file. Make sure you selected an export containing 'saved_posts.json' or 'saved_collections.json'.";
    super(
      "No valid Instagram posts found in archive",
      "EMPTY_ARCHIVE",
      feedback,
      fileName,
    );
    this.name = "EmptyArchiveError";
  }
}

export interface FailedEntryInfo {
  id: string;
  fileName?: string;
  entryIndex?: number;
  errorCode: string;
  errorName: string;
  message: string;
  actionableFeedback: string;
  rawSample?: string;
  timestamp: string;
}

export interface ImportSummaryReport {
  status: "success" | "partial_success" | "failed";
  totalFilesProcessed: number;
  totalEntriesFound: number;
  successfullyImported: number;
  duplicatesMerged: number;
  failedEntriesCount: number;
  failedEntries: FailedEntryInfo[];
  fileErrors: FailedEntryInfo[];
  timestamp: string;
}
