/**
 * Persistent Thumbnail Caching Strategy using the browser Cache API
 * Ensures faster image loading and reduced network consumption for repeat visits.
 */

const CACHE_NAME = "instasorter-thumbnails-v1";

export async function getCachedThumbnailUrl(url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return url;

  try {
    if (typeof caches === "undefined") return url;
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn("Failed to retrieve thumbnail from Cache API:", err);
  }

  return url;
}

export async function storeThumbnailInCache(url: string, responseOrBlob: Response | Blob): Promise<void> {
  if (!url || !url.startsWith("http")) return;

  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(CACHE_NAME);
    let response: Response;
    
    if (responseOrBlob instanceof Blob) {
      response = new Response(responseOrBlob);
    } else {
      response = responseOrBlob.clone();
    }

    await cache.put(url, response);
  } catch (err) {
    console.warn("Failed to store thumbnail in Cache API:", err);
  }
}

export async function prefetchAndCacheThumbnail(url: string): Promise<string> {
  if (!url || !url.startsWith("http")) return url;

  try {
    const cached = await getCachedThumbnailUrl(url);
    if (cached && cached !== url) {
      return cached; // Already cached and converted to object URL
    }

    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const blob = await res.blob();
      await storeThumbnailInCache(url, blob);
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    // Fallback to original URL if network or CORS prevents caching
  }

  return url;
}
