import { Post } from "../types/post";

export interface HarParseResult {
  posts: Partial<Post>[];
  totalEntriesExamined: number;
  matchingEndpointsFound: number;
}

/**
 * Parses an HTTP Archive (.har) export from browser Developer Tools
 * and extracts all saved Instagram posts, carousels, and reels with full metadata.
 */
export function parseInstagramHar(harContent: string): HarParseResult {
  const result: HarParseResult = {
    posts: [],
    totalEntriesExamined: 0,
    matchingEndpointsFound: 0
  };

  let harObj: any;
  try {
    harObj = JSON.parse(harContent);
  } catch (err: any) {
    throw new Error(`Failed to parse HAR JSON: ${err.message}`);
  }

  const entries = harObj?.log?.entries;
  if (!Array.isArray(entries)) {
    throw new Error("Invalid HAR structure: Missing 'log.entries' array.");
  }

  result.totalEntriesExamined = entries.length;
  const seenIds = new Set<string>();

  for (const entry of entries) {
    const url = entry?.request?.url || "";
    const responseText = entry?.response?.content?.text;
    if (!responseText) continue;

    const isIgApi = url.includes("instagram.com") || url.includes("/graphql/query") || url.includes("/api/v1/");
    if (!isIgApi) continue;

    let resJson: any;
    try {
      resJson = JSON.parse(responseText);
    } catch {
      continue;
    }

    result.matchingEndpointsFound++;

    // 1. Check for standard feed/saved items array
    if (Array.isArray(resJson?.items)) {
      for (const item of resJson.items) {
        const media = item?.media || item;
        const post = extractPostFromInstagramItem(media);
        if (post && post.id && !seenIds.has(post.id)) {
          seenIds.add(post.id);
          result.posts.push(post);
        }
      }
    }

    // 2. Check for GraphQL saved media edges: data.user.edge_saved_media.edges
    const edges = resJson?.data?.user?.edge_saved_media?.edges ||
                  resJson?.data?.xdt_viewer?.edge_saved_media?.edges ||
                  resJson?.data?.shortcode_media ? [{ node: resJson.data.shortcode_media }] : null;

    if (Array.isArray(edges)) {
      for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;
        const post = extractPostFromGraphqlNode(node);
        if (post && post.id && !seenIds.has(post.id)) {
          seenIds.add(post.id);
          result.posts.push(post);
        }
      }
    }
  }

  return result;
}

function extractPostFromInstagramItem(item: any): Partial<Post> | null {
  if (!item || (!item.code && !item.pk && !item.id)) return null;

  const shortcode = item.code || item.pk;
  const id = shortcode ? `ig_${shortcode}` : `ig_${item.id}`;
  const displayUrl = item.image_versions2?.candidates?.[0]?.url || item.display_url;
  const caption = item.caption?.text || "";
  const username = item.user?.username || item.owner?.username || "instagram_creator";
  const takenAt = item.taken_at ? new Date(item.taken_at * 1000).toISOString() : new Date().toISOString();

  // Handle carousel slides
  const slides: string[] = [];
  if (Array.isArray(item.carousel_media)) {
    for (const slide of item.carousel_media) {
      const sUrl = slide.image_versions2?.candidates?.[0]?.url;
      if (sUrl && !slides.includes(sUrl)) slides.push(sUrl);
    }
  }

  const isVideo = item.media_type === 2 || !!item.is_video;
  const isCarousel = Array.isArray(item.carousel_media) && item.carousel_media.length > 1;

  return {
    id,
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    creatorUsername: username,
    creatorName: item.user?.full_name || undefined,
    caption,
    hashtags: extractHashtags(caption),
    thumbnailUrl: displayUrl || slides[0] || "",
    additionalSlides: slides.length > 1 ? slides.slice(1) : undefined,
    savedAt: takenAt,
    mediaType: isCarousel ? "carousel" : isVideo ? "video" : "image",
    collections: ["HAR Network Import"],
    isFavorite: false,
    isArchived: false,
    readLater: false,
    isReel: isVideo && !!item.code && !isCarousel,
    tags: []
  };
}

function extractPostFromGraphqlNode(node: any): Partial<Post> | null {
  if (!node || (!node.shortcode && !node.id)) return null;

  const shortcode = node.shortcode || node.id;
  const id = `ig_${shortcode}`;
  const displayUrl = node.display_url;
  const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || "";
  const username = node.owner?.username || "instagram_creator";
  const takenAt = node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000).toISOString() : new Date().toISOString();

  const slides: string[] = [];
  if (Array.isArray(node.edge_sidecar_to_children?.edges)) {
    for (const edge of node.edge_sidecar_to_children.edges) {
      const sUrl = edge?.node?.display_url;
      if (sUrl && !slides.includes(sUrl)) slides.push(sUrl);
    }
  }

  const isVideo = !!node.is_video;
  const isCarousel = slides.length > 1;

  return {
    id,
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    creatorUsername: username,
    caption,
    hashtags: extractHashtags(caption),
    thumbnailUrl: displayUrl || slides[0] || "",
    additionalSlides: slides.length > 1 ? slides.slice(1) : undefined,
    savedAt: takenAt,
    mediaType: isCarousel ? "carousel" : isVideo ? "video" : "image",
    collections: ["HAR Network Import"],
    isFavorite: false,
    isArchived: false,
    readLater: false,
    isReel: isVideo && !isCarousel,
    tags: []
  };
}

function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_\u0080-\uFFFF]+)/g);
  return matches ? Array.from(new Set(matches.map((tag) => tag.substring(1).toLowerCase()))) : [];
}

export const parseHarFile = parseInstagramHar;
