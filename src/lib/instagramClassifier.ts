export interface ClassificationResult {
  type: "reel" | "single_image" | "carousel" | "video" | "unknown";
  confidence?: number;
  reason?: string;
}

/**
 * Classifies an Instagram post JSON object based on specific metadata rules.
 * 
 * Rules:
 * 1. If the URL contains "/reel/", return: reel (confidence 100)
 * 2. If the URL contains "/p/", inspect all available metadata.
 * 3. Prioritize: GraphSidecar > Carousel metadata > GraphImage > GraphVideo.
 * 
 * @param post The raw or processed Instagram post JSON object.
 * @returns ClassificationResult containing the type, confidence, and optional reason.
 */
export function classifyInstagramPost(post: any): ClassificationResult {
  if (!post || typeof post !== "object") {
    return {
      type: "unknown",
      reason: "Invalid input. Post must be a JSON object."
    };
  }

  // Helper to extract any potential URL from the object
  const getPostUrl = (obj: any): string => {
    const keys = [
      "postUrl", "url", "href", "instagramUrl", "post_url", 
      "media_url", "uri", "link", "instagram_url"
    ];
    for (const key of keys) {
      if (typeof obj[key] === "string" && obj[key]) {
        return obj[key];
      }
    }
    if (obj.label_values && Array.isArray(obj.label_values)) {
      const urlItem = obj.label_values.find(
        (item: any) => item && (item.label === "URL" || item.title === "URL")
      );
      if (urlItem && (urlItem.href || urlItem.value)) {
        return urlItem.href || urlItem.value;
      }
    }
    // Recursive fallback to find any URL in the object structure
    const recurseFindUrl = (nested: any): string => {
      if (!nested) return "";
      if (typeof nested === "string") {
        if (nested.startsWith("http://") || nested.startsWith("https://")) {
          return nested;
        }
        return "";
      }
      if (typeof nested === "object") {
        for (const k of Object.keys(nested)) {
          const val = nested[k];
          if (typeof val === "string") {
            if (val.startsWith("http") && (val.includes("instagram.com") || val.includes("instagr.am") || val.includes("/p/") || val.includes("/reel/"))) {
              return val;
            }
          } else if (typeof val === "object" && val !== null) {
            const found = recurseFindUrl(val);
            if (found) return found;
          }
        }
      }
      return "";
    };
    return recurseFindUrl(obj);
  };

  const url = getPostUrl(post);
  const urlLower = url.toLowerCase();

  // Rule 1: If the URL contains "/reel/", return reel
  if (urlLower.includes("/reel/") || urlLower.includes("/reels/")) {
    return {
      type: "reel",
      confidence: 100
    };
  }

  // Rule 2: If the URL contains "/p/", inspect all available metadata.
  // Note: We'll inspect metadata regardless of the URL form (as long as it doesn't match Rule 1),
  // but if URL contains "/p/", we strictly enforce the structural rules.

  // Rule 3: Conflict priority: GraphSidecar > Carousel metadata > GraphImage > GraphVideo

  // --- 1. GraphSidecar ---
  // __typename == "GraphSidecar"
  if (post.__typename === "GraphSidecar") {
    return {
      type: "carousel",
      confidence: 100
    };
  }

  // --- 2. Carousel metadata ---
  // - "media_type": "CAROUSEL_ALBUM"
  // - "edge_sidecar_to_children" exists and contains more than one item
  // - "carousel_media" exists and contains more than one item
  // - "resources" contains multiple media items
  // - "media" contains more than one media object
  const hasCarouselMetadata = 
    (post.media_type === "CAROUSEL_ALBUM" || post.mediaType === "CAROUSEL_ALBUM" || post.media_type === "carousel" || post.mediaType === "carousel") ||
    (post.edge_sidecar_to_children && (
      (Array.isArray(post.edge_sidecar_to_children) && post.edge_sidecar_to_children.length > 1) ||
      (Array.isArray(post.edge_sidecar_to_children?.edges) && post.edge_sidecar_to_children.edges.length > 1) ||
      (typeof post.edge_sidecar_to_children?.count === "number" && post.edge_sidecar_to_children.count > 1)
    )) ||
    (Array.isArray(post.carousel_media) && post.carousel_media.length > 1) ||
    (Array.isArray(post.resources) && post.resources.length > 1) ||
    (Array.isArray(post.media) && post.media.length > 1) ||
    (Array.isArray(post.media_list_data) && post.media_list_data.length > 1) ||
    (Array.isArray(post.additionalSlides) && post.additionalSlides.length > 0);

  if (hasCarouselMetadata) {
    return {
      type: "carousel",
      confidence: 100
    };
  }

  // --- 3. GraphImage / Single Image Metadata ---
  // - "__typename": "GraphImage"
  // - "media_type": "IMAGE"
  // - exactly one media object exists
  // - exactly one image URL exists
  
  // Let's count media objects
  let mediaObjectsCount = 0;
  if (post.carousel_media && Array.isArray(post.carousel_media)) {
    mediaObjectsCount = post.carousel_media.length;
  } else if (post.resources && Array.isArray(post.resources)) {
    mediaObjectsCount = post.resources.length;
  } else if (post.media && Array.isArray(post.media)) {
    mediaObjectsCount = post.media.length;
  } else if (post.media_list_data && Array.isArray(post.media_list_data)) {
    mediaObjectsCount = post.media_list_data.length;
  } else if (post.edge_sidecar_to_children) {
    if (Array.isArray(post.edge_sidecar_to_children)) {
      mediaObjectsCount = post.edge_sidecar_to_children.length;
    } else if (Array.isArray(post.edge_sidecar_to_children?.edges)) {
      mediaObjectsCount = post.edge_sidecar_to_children.edges.length;
    } else if (typeof post.edge_sidecar_to_children?.count === "number") {
      mediaObjectsCount = post.edge_sidecar_to_children.count;
    }
  }

  // Check if exactly one image URL exists
  // We can scan the object to find any unique image URL strings
  const imageRegex = /\.(jpg|jpeg|png|webp|gif)/i;
  const foundImageUrls = new Set<string>();
  const scanForImageUrls = (obj: any) => {
    if (!obj) return;
    if (typeof obj === "string") {
      if ((obj.startsWith("http") || obj.startsWith("data:")) && imageRegex.test(obj)) {
        foundImageUrls.add(obj);
      }
    } else if (typeof obj === "object") {
      for (const k of Object.keys(obj)) {
        scanForImageUrls(obj[k]);
      }
    }
  };
  scanForImageUrls(post);

  const hasExactlyOneMediaObject = mediaObjectsCount === 1;
  const hasExactlyOneImageUrl = foundImageUrls.size === 1;

  const isSingleImage = 
    post.__typename === "GraphImage" ||
    post.media_type === "IMAGE" || post.mediaType === "IMAGE" || post.media_type === "image" || post.mediaType === "image" ||
    hasExactlyOneMediaObject ||
    hasExactlyOneImageUrl;

  if (isSingleImage) {
    return {
      type: "single_image",
      confidence: 100
    };
  }

  // --- 4. GraphVideo / Video Metadata ---
  // - "__typename": "GraphVideo"
  // - media_type == "VIDEO"
  const isVideo = 
    post.__typename === "GraphVideo" ||
    post.media_type === "VIDEO" || post.mediaType === "VIDEO" || post.media_type === "video" || post.mediaType === "video";

  if (isVideo) {
    return {
      type: "video",
      confidence: 100
    };
  }

  // Rule 6: If none of the above metadata exists, DO NOT guess.
  return {
    type: "unknown",
    reason: "Insufficient metadata. A /p/ URL alone cannot distinguish a single-image post from a carousel."
  };
}
