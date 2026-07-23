/**
 * Screen WakeLock and iOS Background Extraction Helper
 */

let wakeLockSentinel: any = null;

export const isIOSDevice = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

export const requestWakeLock = async (): Promise<boolean> => {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    console.log("[WakeLock] Screen WakeLock API not supported on this browser.");
    return false;
  }

  try {
    if (wakeLockSentinel) return true;
    wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
    console.log("[WakeLock] Screen Wake Lock acquired successfully.");

    wakeLockSentinel.addEventListener("release", () => {
      console.log("[WakeLock] Screen Wake Lock released.");
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn("[WakeLock] Could not acquire WakeLock:", err);
    return false;
  }
};

export const releaseWakeLock = async (): Promise<void> => {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    } catch (err) {
      console.warn("[WakeLock] Error releasing WakeLock:", err);
    }
  }
};

/**
 * Trigger HD Video or Media download for a given post
 */
export const downloadPostMedia = async (post: {
  id: string;
  postUrl: string;
  thumbnailUrl?: string;
  mediaType?: string;
  isReel?: boolean;
  creatorUsername?: string;
}): Promise<void> => {
  const safeUsername = post.creatorUsername ? post.creatorUsername.replace(/[^a-zA-Z0-9_-]/g, "_") : "instagram";
  const filename = `instasorter_${safeUsername}_${post.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  // 1. If base64 data URI image/video in Dexie
  if (post.thumbnailUrl && post.thumbnailUrl.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = post.thumbnailUrl;
    const isVideoData = post.thumbnailUrl.startsWith("data:video");
    a.download = `${filename}.${isVideoData ? "mp4" : "jpg"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // 2. Query our server download endpoint
  const downloadUrl = `/api/download-media?id=${encodeURIComponent(post.id)}&filename=${encodeURIComponent(filename)}&mediaUrl=${encodeURIComponent(post.thumbnailUrl || post.postUrl)}`;
  
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error("Server download endpoint returned error");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = blobUrl;
    const contentType = blob.type;
    const ext = contentType.includes("video") || post.isReel || post.mediaType === "video" ? "mp4" : "jpg";
    a.download = `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    // Fallback: Open media URL directly in new window / tab for manual save
    console.warn("[Media Download] Direct download failed, falling back to window opening:", err);
    if (post.thumbnailUrl && post.thumbnailUrl.startsWith("http")) {
      window.open(post.thumbnailUrl, "_blank");
    } else {
      window.open(post.postUrl, "_blank");
    }
  }
};
