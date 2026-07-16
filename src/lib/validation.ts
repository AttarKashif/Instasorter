/**
 * Validates that no URLs containing 'unsplash.com' or 'sample-' are allowed to be saved
 * as the 'thumbnailUrl' in the database. If invalid, returns an empty string
 * to force a re-fetch.
 */
export function validateThumbnailUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.includes("unsplash.com") || url.includes("sample-")) {
    return "";
  }
  return url;
}
