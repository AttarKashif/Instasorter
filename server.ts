import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Lazy-loaded Gemini client
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please add it via the Settings > Secrets menu.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Auto-create local thumbnails cache directory
const THUMBNAILS_DIR = path.join(process.cwd(), 'thumbnails');
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
} else {
  // Remove any previously prepared placeholder SVG previews to force loading original previews!
  try {
    const files = fs.readdirSync(THUMBNAILS_DIR);
    for (const file of files) {
      if (file.endsWith('.svg')) {
        fs.unlinkSync(path.join(THUMBNAILS_DIR, file));
      }
    }
    console.log("[Server Startup] Cleared prepared placeholder SVG previews from disk.");
  } catch (err) {
    console.warn("[Server Startup] Failed to clear SVG previews:", err);
  }
}

// Auto-create local oembed cache directory
const OEMBED_CACHE_DIR = path.join(process.cwd(), 'oembed_cache');
if (!fs.existsSync(OEMBED_CACHE_DIR)) {
  fs.mkdirSync(OEMBED_CACHE_DIR, { recursive: true });
}

app.use(express.json({ limit: '10mb' }));

// Serve thumbnails locally cached
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});


// Helper: Extract username from Instagram URL if explicitly present in the path
function extractUsernameFromUrl(url: string): string | null {
  const match = url.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9_\.]+)\/(?:p|reel|reels|tv)\//i);
  if (match && match[1]) {
    const parsed = match[1].trim();
    // Ignore common non-username path segments
    if (!['p', 'reel', 'reels', 'tv', 'stories', 'explore'].includes(parsed.toLowerCase())) {
      return parsed;
    }
  }
  return null;
}

// Helper: Generate a beautiful custom high-contrast SVG thumbnail fallback when scraping fails
function generateSvgFallback(postId: string, postUrl: string, username: string | null): string {
  const shortcode = getShortcode(postUrl) || postId;
  const displayUsername = username ? `@${username}` : 'Instagram Post';
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="ig-grad-${postId}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f09433" />
      <stop offset="25%" stop-color="#e6683c" />
      <stop offset="50%" stop-color="#dc2743" />
      <stop offset="75%" stop-color="#cc2366" />
      <stop offset="100%" stop-color="#bc1888" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#ig-grad-${postId})" />
  
  <!-- Subtle dark overlay for premium high contrast readability -->
  <rect width="400" height="400" fill="black" opacity="0.12" />
  
  <!-- Outer nested border -->
  <rect x="15" y="15" width="370" height="370" rx="20" fill="none" stroke="white" stroke-width="4" opacity="0.35" />
  
  <!-- Stylized Vector Camera/Post Icon -->
  <g transform="translate(140, 110)" stroke="white" fill="none" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <rect x="0" y="0" width="120" height="120" rx="30" stroke-width="10" />
    <circle cx="60" cy="60" r="30" stroke-width="10" />
    <circle cx="92" cy="28" r="4" fill="white" stroke="none" />
  </g>
  
  <!-- Text layout with elegant typography pairings -->
  <g font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" text-anchor="middle" fill="white">
    <!-- User/Creator Tag -->
    <text x="200" y="295" font-size="22" font-weight="800" letter-spacing="-0.5px">${displayUsername}</text>
    
    <!-- Shortcode Indicator Box -->
    <rect x="110" y="318" width="180" height="24" rx="12" fill="white" opacity="0.22" />
    <text x="200" y="334" font-size="11" font-weight="700" opacity="0.9" letter-spacing="0.5px">${shortcode}</text>
  </g>
</svg>`;
}

// Helper: Parse shortcode from Instagram URL
function getShortcode(url: string): string | null {
  const match = url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

// Helper: Fetch with Timeout to prevent blocking/hanging connection proxy gateway errors
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Helper: Extract username from Instagram embed page HTML
function extractUsernameFromHtml(html: string): string | null {
  if (!html) return null;

  // Strategy 1: Link with utm_source=ig_embed (Most reliable on embed pages)
  const utmMatch = html.match(/instagram\.com\/([a-zA-Z0-9_\.]+)\/\?utm_source=ig_embed/i);
  if (utmMatch && utmMatch[1]) {
    const username = utmMatch[1].trim();
    if (username && username !== 'explore' && username !== 'p' && username !== 'reel') {
      return username;
    }
  }

  // Strategy 2: Owner username in JSON script block
  const ownerJsonMatch = html.match(/"owner"\s*:\s*\{\s*"username"\s*:\s*"([a-zA-Z0-9_\.-]+)"/i);
  if (ownerJsonMatch && ownerJsonMatch[1]) {
    return ownerJsonMatch[1].trim();
  }

  // Strategy 3: Standard username field in JSON block
  const usernameJsonMatch = html.match(/"username"\s*:\s*"([a-zA-Z0-9_\.-]+)"/i);
  if (usernameJsonMatch && usernameJsonMatch[1]) {
    const username = usernameJsonMatch[1].trim();
    if (username && username !== 'explore' && username !== 'p' && username !== 'reel') {
      return username;
    }
  }

  // Strategy 4: Profile link in anchor tag
  const anchorProfileMatches = html.matchAll(/href=["']https?:\/\/(?:www\.)?instagram\.com\/(?!p|reel|reels|tv|stories|explore|developer|legal|about|jobs|privacy|terms|directory|static|accounts|emails|web|graphql|api|oauth|embed|static)([a-zA-Z0-9_\.]+)\/?["']/gi);
  for (const match of anchorProfileMatches) {
    if (match[1]) {
      const username = match[1].trim();
      if (username) return username;
    }
  }

  // Strategy 5: Meta title containing (@username)
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    const titleText = ogTitleMatch[1];
    const atMatch = titleText.match(/@([a-zA-Z0-9_\.]+)/);
    if (atMatch && atMatch[1]) {
      return atMatch[1].trim();
    }
    const cleanTitleMatch = titleText.match(/^([a-zA-Z0-9_\.]+)\s+on\s+Instagram/i);
    if (cleanTitleMatch && cleanTitleMatch[1]) {
      return cleanTitleMatch[1].trim();
    }
  }

  return null;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/605.1.15',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
];

function getRandomHeaders() {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const acceptLanguages = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.8,en;q=0.7',
    'en-CA,en;q=0.9,en-US;q=0.8',
    'en-US,en;q=0.9,es;q=0.8',
  ];
  const lang = acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];
  
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  };
}

// Balance brace-counting JSON string extractor to extract complex, nested JSON payloads safely
function findBalancedJsonObject(text: string, startIndex: number): string | null {
  let braceCount = 0;
  let inString = false;
  let escape = false;
  
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return text.substring(startIndex, i + 1);
        }
      }
    }
  }
  return null;
}

// Deep search object structure to find any nested shortcode_media block
function findShortcodeMediaDeep(obj: any): any {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.shortcode_media) return obj.shortcode_media;
  if (obj.graphql?.shortcode_media) return obj.graphql.shortcode_media;
  
  for (const key of Object.keys(obj)) {
    try {
      const found = findShortcodeMediaDeep(obj[key]);
      if (found) return found;
    } catch (_) {}
  }
  return null;
}

// Primary scraper function to extract fully structured post representations from HTML
function extractStructuredPostData(htmlContent: string) {
  const markers = [
    'window.__additionalDataLoaded(\'extra\',',
    'window.__additionalDataLoaded(\'feed\',',
    'window._sharedData =',
    '{"graphql"',
    '{"shortcode_media"'
  ];

  for (const marker of markers) {
    const index = htmlContent.indexOf(marker);
    if (index !== -1) {
      // Find starting brace of JSON structure
      const startBraceIndex = htmlContent.indexOf('{', index);
      if (startBraceIndex !== -1) {
        const jsonString = findBalancedJsonObject(htmlContent, startBraceIndex);
        if (jsonString) {
          try {
            const parsed = JSON.parse(jsonString);
            const shortcodeMedia = findShortcodeMediaDeep(parsed);
            if (shortcodeMedia) {
              // Extract slide details cleanly
              const ownerUsername = shortcodeMedia.owner?.username || null;
              const caption = shortcodeMedia.edge_media_to_caption?.edges?.[0]?.node?.text || null;
              
              if (shortcodeMedia.edge_sidecar_to_children?.edges) {
                const slides = shortcodeMedia.edge_sidecar_to_children.edges.map((edge: any) => {
                  const node = edge.node;
                  const display_url = node.display_url ? node.display_url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&') : null;
                  const video_url = node.video_url ? node.video_url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&') : null;
                  return {
                    display_url,
                    is_video: !!node.is_video,
                    video_url
                  };
                }).filter((s: any) => !!s.display_url);

                return {
                  type: 'carousel',
                  slides,
                  username: ownerUsername,
                  caption
                };
              }

              const mainDisplayUrl = shortcodeMedia.display_url ? shortcodeMedia.display_url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&') : null;
              const mainVideoUrl = shortcodeMedia.video_url ? shortcodeMedia.video_url.replace(/\\u0026/g, '&').replace(/&amp;/g, '&') : null;
              return {
                type: shortcodeMedia.is_video ? 'video' : 'image',
                slides: mainDisplayUrl ? [{
                  display_url: mainDisplayUrl,
                  is_video: !!shortcodeMedia.is_video,
                  video_url: mainVideoUrl
                }] : [],
                username: ownerUsername,
                caption
              };
            }
          } catch (e) {
            // parsing failed, continue
          }
        }
      }
    }
  }
  return null;
}

// Scrape logic
async function scrapeInstagramImage(postUrl: string, postId: string, force: boolean, mediaType?: string) {
  const startTime = Date.now();
  let strategyUsed = "none";
  let httpStatus = 0;
  let imageUrl: string | null = null;
  let reason = "";
  let html = "";
  const isCarousel = mediaType === 'carousel';
  const additionalSlides: string[] = [];

  const headers = getRandomHeaders();

  // Helper to dynamically add the scraped username to a successful response object
  const addUsername = async (res: any) => {
    if (!res.success) return res;
    try {
      let creatorUsername: string | null = null;
      if (html) {
        creatorUsername = extractUsernameFromHtml(html);
      } else {
        let cleanEmbedUrl = postUrl;
        if (cleanEmbedUrl.endsWith('/')) {
          cleanEmbedUrl = cleanEmbedUrl.slice(0, -1);
        }
        const embedUrl = `${cleanEmbedUrl}/embed/`;
        console.log(`[Thumbnail Scraper] Fetching embed page specifically for username extraction: ${embedUrl}`);
        const embedRes = await fetchWithTimeout(embedUrl, { headers }, 3000);
        if (embedRes.ok) {
          const embedHtml = await embedRes.text();
          creatorUsername = extractUsernameFromHtml(embedHtml);
        }
      }
      if (creatorUsername) {
        console.log(`[Thumbnail Scraper] Successfully extracted creator username: ${creatorUsername}`);
        res.creatorUsername = creatorUsername;
      }
    } catch (err: any) {
      console.log(`[Thumbnail Scraper] Issue adding username: ${err.message || err}`);
    }
    return res;
  };

  // Helper to try direct media redirect URL (/media/?size=l)
  const tryMediaRedirectFallback = async (): Promise<any | null> => {
    const shortcode = getShortcode(postUrl);
    if (!shortcode) return null;
    console.log(`[Thumbnail Scraper] [Media Redirect Fallback] Trying direct media redirect for shortcode: ${shortcode}`);
    try {
      let baseUrl = postUrl.split('?')[0];
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      const mediaRedirectUrl = `${baseUrl}/media/?size=l`;
      console.log(`[Thumbnail Scraper] Fetching media redirect URL: ${mediaRedirectUrl}`);
      
      const mediaRes = await fetchWithTimeout(mediaRedirectUrl, { headers, redirect: 'follow' }, 6000);
      if (mediaRes.ok && mediaRes.headers.get('content-type')?.includes('image')) {
        const bufferArray = await mediaRes.arrayBuffer();
        const safeBuffer = Buffer.from(bufferArray);
        if (safeBuffer.length > 1000) {
          const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
          const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
          
          if (fs.existsSync(absolutePathSvg)) {
            try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
          }
          
          await fs.promises.writeFile(absolutePathJpg, safeBuffer);
          console.log(`[Thumbnail Scraper] [Media Redirect Fallback SUCCESS] Saved high-res JPG directly from /media/?size=l!`);
          
          const resObj = {
            success: true,
            path: `/thumbnails/${postId}.jpg`,
            strategyUsed: "Media Redirect Fallback (/media/?size=l)",
            duration: Date.now() - startTime,
            httpStatus: 200
          };
          return await addUsername(resObj);
        }
      } else {
        console.log(`[Thumbnail Scraper] [Media Redirect Fallback] Non-ok status or non-image type: ${mediaRes.status}, ${mediaRes.headers.get('content-type')}`);
      }
    } catch (mediaErr: any) {
      console.log(`[Thumbnail Scraper] [Media Redirect Fallback Error]: ${mediaErr.message || mediaErr}`);
    }
    return null;
  };

  console.log(`\n========================================`);
  console.log(`[Thumbnail Scraper] START processing Post ID: ${postId} (Force: ${force})`);
  console.log(`[Thumbnail Scraper] Post URL: ${postUrl}`);

  try {

    // 1. Fetch public Instagram Embed page HTML (this is the single source of truth that contains both live media and metadata)
    let cleanEmbedUrl = postUrl;
    if (cleanEmbedUrl.endsWith('/')) {
      cleanEmbedUrl = cleanEmbedUrl.slice(0, -1);
    }
    const embedUrl = `${cleanEmbedUrl}/embed/`;

    try {
      console.log(`[Thumbnail Scraper] Executing fetch of public Instagram Embed page: ${embedUrl}`);
      const response = await fetchWithTimeout(embedUrl, { headers, redirect: 'follow' }, 5000);
      httpStatus = response.status;
      console.log(`[Thumbnail Scraper] Embed page fetch returned HTTP status: ${response.status}`);
      
      if (response.status === 429) {
        console.log(`[Thumbnail Scraper] DETECTED RATE LIMIT (429) - Proceeding to fallback strategies.`);
      } else if (response.url && (response.url.includes('/login/') || response.url.includes('accounts/login'))) {
        console.log(`[Thumbnail Scraper] DETECTED LOGIN WALL REDIRECT (throttled) - Proceeding to fallback strategies.`);
      } else if (response.ok) {
        html = await response.text();
        console.log(`[Thumbnail Scraper] Successfully retrieved Embed HTML payload (${html.length} bytes).`);
        
        // Check for broken posts or private accounts
        const brokenMarkers = ["Sorry, this page isn't available", "not available", "is private"];
        if (brokenMarkers.some(marker => html.includes(marker))) {
          console.log(`[Thumbnail Scraper] DETECTED BROKEN POST VIA MARKER`);
          return {
            success: false,
            reason: 'Post not available',
            strategyUsed: 'HTML Marker Detection',
            duration: Date.now() - startTime,
            httpStatus
          };
        }
      } else {
        console.log(`[Thumbnail Scraper] Embed page fetch returned non-200: ${response.status}`);
      }
    } catch (embedErr: any) {
      console.log(`[Thumbnail Scraper] Embed page fetch completed with: ${embedErr.message || embedErr}`);
    }

    if (html) {
      // Primary parsing strategy: Extract fully structured structured JSON post details
      console.log(`[Thumbnail Scraper] [Strategy 1 - Primary] Attempting structured JSON data extraction...`);
      const structuredData = extractStructuredPostData(html);
      
      if (structuredData && structuredData.slides && structuredData.slides.length > 0) {
        console.log(`[Thumbnail Scraper] Structured JSON parser success. Type: ${structuredData.type}, Detected Slides: ${structuredData.slides.length}`);
        imageUrl = structuredData.slides[0].display_url;
        strategyUsed = `Structured JSON Parser (${structuredData.type})`;

        // If multiple slides are found, download additional slides to local storage
        if (structuredData.slides.length > 1) {
          console.log(`[Thumbnail Scraper] Carousel slide assets download initialized for ${structuredData.slides.length} slides.`);
          for (let i = 1; i < structuredData.slides.length; i++) {
            const slideUrl = structuredData.slides[i].display_url;
            if (!slideUrl) continue;
            const slidePath = path.join(THUMBNAILS_DIR, `${postId}_${i}.jpg`);
            const slideRelativePath = `/thumbnails/${postId}_${i}.jpg`;

            try {
              console.log(`[Thumbnail Scraper] Downloading slide #${i}: ${slideUrl}`);
              const slideRes = await fetchWithTimeout(slideUrl, { headers: { 'User-Agent': headers['User-Agent'] } }, 4000);
              if (slideRes.ok) {
                const slideArrayBuffer = await slideRes.arrayBuffer();
                await fs.promises.writeFile(slidePath, Buffer.from(slideArrayBuffer));
                additionalSlides.push(slideRelativePath);
                console.log(`[Thumbnail Scraper] Slide #${i} saved successfully at ${slideRelativePath}`);
              } else {
                console.warn(`[Thumbnail Scraper] Slide #${i} download returned status ${slideRes.status}`);
              }
            } catch (slideErr: any) {
              console.warn(`[Thumbnail Scraper] Slide #${i} download failed: ${slideErr.message}`);
            }
          }
        }
      } else {
        console.log(`[Thumbnail Scraper] Structured JSON parser could not extract slides. Invoking secondary matchers...`);
      }

      // Secondary parsing strategy: Fallback Regex Matchers
      if (!imageUrl) {
        // Fallback 1: Open Graph og:image
        console.log(`[Thumbnail Scraper] [Fallback 1] Checking Open Graph (og:image) meta tag...`);
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (ogMatch && ogMatch[1]) {
          imageUrl = ogMatch[1].replace(/&amp;/g, '&');
          strategyUsed = "Open Graph";
          console.log(`[Thumbnail Scraper] og:image URL extracted: ${imageUrl}`);
        }

        // Fallback 2: Twitter Card twitter:image
        if (!imageUrl) {
          console.log(`[Thumbnail Scraper] [Fallback 2] Checking Twitter Card (twitter:image) meta tag...`);
          const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                               html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
          if (twitterMatch && twitterMatch[1]) {
            imageUrl = twitterMatch[1].replace(/&amp;/g, '&');
            strategyUsed = "Twitter Card";
            console.log(`[Thumbnail Scraper] twitter:image URL extracted: ${imageUrl}`);
          }
        }

        // Fallback 3: HTML Image Elements (EmbeddedMediaImage)
        if (!imageUrl) {
          console.log(`[Thumbnail Scraper] [Fallback 3] Checking for display image element markup (EmbeddedMediaImage)...`);
          const imgTagMatch = html.match(/<img[^>]*class=["'][^"']*MediaImage[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                              html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*MediaImage[^"']*["']/i) ||
                              html.match(/<img[^>]*class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["']/i) ||
                              html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["']EmbeddedMediaImage["']/i);
          if (imgTagMatch && imgTagMatch[1]) {
            imageUrl = imgTagMatch[1].replace(/&amp;/g, '&');
            strategyUsed = "Embed Image Element Markup";
            console.log(`[Thumbnail Scraper] Embed Image Element extracted: ${imageUrl}`);
          }
        }

        // Fallback 4: Raw script/scontent scanner
        if (!imageUrl) {
          console.log(`[Thumbnail Scraper] [Fallback 4] Scanning HTML for raw scontent image links...`);
          const scriptMatches = html.match(/"(https:\/\/scontent\.[^"]+)"/g) || html.match(/'(https:\/\/scontent\.[^']+)'/g);
          if (scriptMatches && scriptMatches.length > 0) {
            const cleanUrls = scriptMatches.map(m => m.slice(1, -1).replace(/\\u0026/g, '&').replace(/&amp;/g, '&'));
            const imgUrls = cleanUrls.filter(url => url.includes('instagram') || url.includes('scontent'));
            if (imgUrls.length > 0) {
              imageUrl = imgUrls[0];
              strategyUsed = "Embedded JSON (scontent list)";
              console.log(`[Thumbnail Scraper] Found candidate scontent URL: ${imageUrl}`);
            }
          }
        }

        // Fallback 5: Generic Display URL inside JSON
        if (!imageUrl) {
          console.log(`[Thumbnail Scraper] [Fallback 5] Checking for "display_url" field inside script blocks...`);
          const displayUrlMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/i) || html.match(/'display_url'\s*:\s*'([^']+)'/i);
          if (displayUrlMatch && displayUrlMatch[1]) {
            imageUrl = displayUrlMatch[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
            strategyUsed = "Embedded JSON (display_url)";
            console.log(`[Thumbnail Scraper] Found display_url: ${imageUrl}`);
          }
        }
      }
    } else {
      console.log(`[Thumbnail Scraper] HTML scraping bypassed because page content was already resolved.`);
    }

    // Strategy 6: OEmbed API Fallback Service (Bypassed because it requires Meta Developer credentials)
    if (false && !imageUrl) {
      console.log(`[Thumbnail Scraper] [Strategy 6] Standard scraping yielded no image. Querying Instagram OEmbed API...`);
      try {
        const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`;
        const oembedResponse = await fetchWithTimeout(oembedUrl, { headers }, 2000);
        console.log(`[Thumbnail Scraper] OEmbed API response status: ${oembedResponse.status}`);
        
        if (oembedResponse.ok) {
          const contentType = oembedResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json') || contentType.includes('text/javascript')) {
            const oembedData: any = await oembedResponse.json();
            if (oembedData && oembedData.thumbnail_url) {
              imageUrl = oembedData.thumbnail_url;
              strategyUsed = "Instagram OEmbed API";
              console.log(`[Thumbnail Scraper] [Strategy 6 SUCCESS] Extracted OEmbed thumbnail URL: ${imageUrl}`);
              
              // Write OEmbed cache file
              const oembedCachePath = path.join(OEMBED_CACHE_DIR, `${postId}.json`);
              await fs.promises.writeFile(oembedCachePath, JSON.stringify(oembedData, null, 2));
              console.log(`[Thumbnail Scraper] Saved OEmbed metadata to disk: ${oembedCachePath}`);
            } else {
              console.log(`[Thumbnail Scraper] OEmbed succeeded but no thumbnail field:`, oembedData);
            }
          } else {
            const errorText = await oembedResponse.text();
            console.log(`[Thumbnail Scraper] OEmbed content-type non-JSON (${contentType}). Body: ${errorText.substring(0, 100)}`);
          }
        } else {
          const errorText = await oembedResponse.text();
          console.log(`[Thumbnail Scraper] OEmbed status was non-200: ${oembedResponse.status}. Body: ${errorText.substring(0, 100)}`);
        }
      } catch (oembedErr: any) {
        console.log(`[Thumbnail Scraper] OEmbed network request bypassed: ${oembedErr.message || oembedErr}`);
      }
    }

    // 1.5 Fallback: Try direct media redirect if scraper didn't find any image URL in html
    if (!imageUrl) {
      const mediaResult = await tryMediaRedirectFallback();
      if (mediaResult) {
        return mediaResult;
      }
    }

    if (!imageUrl) {
      const duration = Date.now() - startTime;
      console.log(`[Thumbnail Scraper] Original preview scraping was not successful for post ${postId}. Generating SVG Fallback...`);
      try {
        const username = extractUsernameFromUrl(postUrl);
        const svgContent = generateSvgFallback(postId, postUrl, username);
        const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
        const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
        
        // Remove old JPG if it exists to avoid caching conflicts
        if (fs.existsSync(absolutePathJpg)) {
          try {
            await fs.promises.unlink(absolutePathJpg);
          } catch (e) {}
        }
        
        await fs.promises.writeFile(absolutePathSvg, svgContent);
        return {
          success: true,
          path: `/thumbnails/${postId}.svg`,
          dataUrl: `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`,
          strategyUsed: "SVG Fallback Generator (No image URL found)",
          duration,
          httpStatus: 200,
          creatorUsername: username || undefined
        };
      } catch (fallbackErr: any) {
        console.error(`[Thumbnail Scraper] SVG Fallback generation failed:`, fallbackErr.message);
        return {
          success: false,
          reason: "Original preview image URL not found & fallback failed.",
          strategyUsed,
          duration,
          httpStatus: 404
        };
      }
    }

    // Download the image if found via scraping
    let imgResponse;
    try {
      imgResponse = await fetchWithTimeout(imageUrl, { headers: { 'User-Agent': headers['User-Agent'] } }, 4000);
    } catch (fetchErr: any) {
      console.log(`[Thumbnail Scraper] Image download request failed: ${fetchErr.message}. Trying direct media redirect fallback...`);
      const mediaResult = await tryMediaRedirectFallback();
      if (mediaResult) {
        return mediaResult;
      }

      const duration = Date.now() - startTime;
      console.log(`[Thumbnail Scraper] Media redirect fallback failed too. Generating SVG Fallback...`);
      try {
        const username = extractUsernameFromUrl(postUrl) || (html ? extractUsernameFromHtml(html) : null);
        const svgContent = generateSvgFallback(postId, postUrl, username);
        const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
        const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
        
        if (fs.existsSync(absolutePathJpg)) {
          try {
            await fs.promises.unlink(absolutePathJpg);
          } catch (e) {}
        }
        
        await fs.promises.writeFile(absolutePathSvg, svgContent);
        return {
          success: true,
          path: `/thumbnails/${postId}.svg`,
          dataUrl: `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`,
          strategyUsed: "SVG Fallback Generator (Download error)",
          duration,
          httpStatus: 200,
          creatorUsername: username || undefined
        };
      } catch (fallbackErr: any) {
        return {
          success: false,
          reason: `Image download request failed: ${fetchErr.message}`,
          strategyUsed,
          duration,
          httpStatus: 500
        };
      }
    }

    if (!imgResponse.ok) {
      console.log(`[Thumbnail Scraper] Image download returned status ${imgResponse.status}. Trying direct media redirect fallback...`);
      const mediaResult = await tryMediaRedirectFallback();
      if (mediaResult) {
        return mediaResult;
      }

      const duration = Date.now() - startTime;
      console.log(`[Thumbnail Scraper] Media redirect fallback failed too. Generating SVG Fallback...`);
      try {
        const username = extractUsernameFromUrl(postUrl) || (html ? extractUsernameFromHtml(html) : null);
        const svgContent = generateSvgFallback(postId, postUrl, username);
        const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
        const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
        
        if (fs.existsSync(absolutePathJpg)) {
          try {
            await fs.promises.unlink(absolutePathJpg);
          } catch (e) {}
        }
        
        await fs.promises.writeFile(absolutePathSvg, svgContent);
        return {
          success: true,
          path: `/thumbnails/${postId}.svg`,
          dataUrl: `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`,
          strategyUsed: `SVG Fallback Generator (HTTP ${imgResponse.status})`,
          duration,
          httpStatus: 200,
          creatorUsername: username || undefined
        };
      } catch (fallbackErr: any) {
        return {
          success: false,
          reason: `Image download returned non-ok status: ${imgResponse.status}`,
          strategyUsed,
          duration,
          httpStatus: imgResponse.status
        };
      }
    }

    let buffer;
    try {
      const arrayBuffer = await imgResponse.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (bufferErr: any) {
      const duration = Date.now() - startTime;
      console.log(`[Thumbnail Scraper] Buffer conversion failed: ${bufferErr.message}. Generating SVG Fallback...`);
      try {
        const username = extractUsernameFromUrl(postUrl) || (html ? extractUsernameFromHtml(html) : null);
        const svgContent = generateSvgFallback(postId, postUrl, username);
        const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
        const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
        
        if (fs.existsSync(absolutePathJpg)) {
          try {
            await fs.promises.unlink(absolutePathJpg);
          } catch (e) {}
        }
        
        await fs.promises.writeFile(absolutePathSvg, svgContent);
        return {
          success: true,
          path: `/thumbnails/${postId}.svg`,
          dataUrl: `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`,
          strategyUsed: "SVG Fallback Generator (Buffer convert error)",
          duration,
          httpStatus: 200,
          creatorUsername: username || undefined
        };
      } catch (fallbackErr: any) {
        return {
          success: false,
          reason: `Buffer conversion was not successful: ${bufferErr.message}`,
          strategyUsed,
          duration,
          httpStatus: 500
        };
      }
    }

    // Save locally
    const relativePath = `/thumbnails/${postId}.jpg`;
    const absolutePath = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
    const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
    
    // Clear any existing SVG fallback if a real JPG is successfully retrieved
    if (fs.existsSync(absolutePathSvg)) {
      try {
        await fs.promises.unlink(absolutePathSvg);
      } catch (unlinkErr) {}
    }

    await fs.promises.writeFile(absolutePath, buffer);

    const duration = Date.now() - startTime;
    console.log(`\n--- [THUMBNAIL WORKER FETCH LOG] ---\nURL: ${postUrl}\nSuccess/Failure: Success\nStatus: Thumbnail fetched successfully\nDuration: ${duration}ms\nHTTP Status: ${httpStatus || 200}\nStrategy used: ${strategyUsed}\n--------------------------------------\n`);

    return await addUsername({
      success: true,
      path: relativePath,
      dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
      strategyUsed,
      duration,
      httpStatus: httpStatus || 200,
      additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
    });

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.log(`[Thumbnail Scraper] Unexpected issue: ${err.message}. Generating SVG Fallback...`);
    try {
      const username = extractUsernameFromUrl(postUrl) || (html ? extractUsernameFromHtml(html) : null);
      const svgContent = generateSvgFallback(postId, postUrl, username);
      const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
      const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
      
      if (fs.existsSync(absolutePathJpg)) {
        try {
          await fs.promises.unlink(absolutePathJpg);
        } catch (e) {}
      }
      
      await fs.promises.writeFile(absolutePathSvg, svgContent);
      return {
        success: true,
        path: `/thumbnails/${postId}.svg`,
        dataUrl: `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`,
        strategyUsed: "SVG Fallback Generator (Catch block fallback)",
        duration,
        httpStatus: 200,
        creatorUsername: username || undefined
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        reason: `Unexpected issue: ${err.message}`,
        strategyUsed,
        duration,
        httpStatus: httpStatus || 500
      };
    }
  }
}

// API: Fetch and Download Thumbnail
app.post("/api/fetch-thumbnail", async (req, res) => {
  const { url, id, force, mediaType } = req.body;
  const cleanUrl = typeof url === 'string' ? url.trim() : '';

  if (!cleanUrl || !id || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
    res.json({
      success: false,
      error: "Invalid or missing url or id. URL must start with http:// or https://",
      strategyUsed: "Server-side Validation"
    });
    return;
  }

  // Sanitise file ID to prevent path traversal
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cachePathJpg = path.join(THUMBNAILS_DIR, `${safeId}.jpg`);
  const cachePathSvg = path.join(THUMBNAILS_DIR, `${safeId}.svg`);

  // Check if we already have it downloaded (unless force is requested)
  if (!force) {
    if (fs.existsSync(cachePathJpg)) {
      // Find all additional slides saved on disk
      const additionalSlides: string[] = [];
      let idx = 1;
      while (fs.existsSync(path.join(THUMBNAILS_DIR, `${safeId}_${idx}.jpg`))) {
        additionalSlides.push(`/thumbnails/${safeId}_${idx}.jpg`);
        idx++;
      }

      // If it's a carousel but we don't have any additional slides found, let it proceed to scrape so we can populate them!
      if (mediaType !== 'carousel' || additionalSlides.length > 0) {
        let dataUrl: string | undefined;
        try {
          const fileBuf = await fs.promises.readFile(cachePathJpg);
          dataUrl = `data:image/jpeg;base64,${fileBuf.toString('base64')}`;
        } catch (err) {}

        res.json({
          success: true,
          path: `/thumbnails/${safeId}.jpg`,
          dataUrl,
          cached: true,
          strategyUsed: "Local Cache Disk Lookup",
          additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
        });
        return;
      }
    } else if (fs.existsSync(cachePathSvg)) {
      let dataUrl: string | undefined;
      try {
        const fileBuf = await fs.promises.readFile(cachePathSvg);
        dataUrl = `data:image/svg+xml;base64,${fileBuf.toString('base64')}`;
      } catch (err) {}

      res.json({
        success: true,
        path: `/thumbnails/${safeId}.svg`,
        dataUrl,
        cached: true,
        strategyUsed: "Local Cache Disk Lookup"
      });
      return;
    }
  }

  const result = await scrapeInstagramImage(url, safeId, force, mediaType);
  if (result.success) {
    res.json({
      success: true,
      path: result.path,
      strategyUsed: result.strategyUsed,
      duration: result.duration,
      creatorUsername: result.creatorUsername || undefined,
      additionalSlides: result.additionalSlides
    });
  } else {
    res.status(result.httpStatus || 500).json({
      success: false,
      error: result.reason,
      strategyUsed: result.strategyUsed,
      duration: result.duration
    });
  }
});

// Background Scraping Queue
const backgroundQueue: { url: string, id: string, mediaType?: string }[] = [];
let isBackgroundQueueRunning = false;

async function processBackgroundQueue() {
  if (isBackgroundQueueRunning) return;
  isBackgroundQueueRunning = true;

  while (backgroundQueue.length > 0) {
    const item = backgroundQueue.shift();
    if (!item) continue;

    const { url, id, mediaType } = item;
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cachePathJpg = path.join(THUMBNAILS_DIR, `${safeId}.jpg`);
    const cachePathSvg = path.join(THUMBNAILS_DIR, `${safeId}.svg`);

    // Check if it already exists, to avoid unnecessary work
    if (!fs.existsSync(cachePathJpg) && !fs.existsSync(cachePathSvg)) {
      try {
        console.log(`[Background Scraper] Processing post ${safeId}`);
        await scrapeInstagramImage(url, safeId, false, mediaType);
      } catch (err) {
        console.error(`[Background Scraper] Error scraping ${safeId}:`, err);
      }
    }

    // Add a delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  isBackgroundQueueRunning = false;
}

// API: Queue posts for background scraping
app.post("/api/queue-background-scrape", (req, res) => {
  const { posts } = req.body;
  if (!Array.isArray(posts)) {
    res.status(400).json({ success: false, error: "Posts must be an array" });
    return;
  }

  let queuedCount = 0;
  for (const post of posts) {
    if (post.url && post.id) {
      backgroundQueue.push({
        url: post.url,
        id: post.id,
        mediaType: post.mediaType
      });
      queuedCount++;
    }
  }

  console.log(`[Background Scraper] Added ${queuedCount} posts to background queue. Total in queue: ${backgroundQueue.length}`);
  
  // Start the background process without awaiting
  processBackgroundQueue().catch(err => console.error("[Background Scraper] Queue error:", err));

  res.json({ success: true, queuedCount });
});

// API: OEmbed Fetch and Cache metadata & embed codes
app.post("/api/oembed", async (req, res) => {
  const { url, id } = req.body;
  const cleanUrl = typeof url === 'string' ? url.trim() : '';

  if (!cleanUrl || !id) {
    res.json({
      success: false,
      error: "Invalid or missing URL or ID."
    });
    return;
  }

  // Sanitise file ID to prevent path traversal
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cachePath = path.join(OEMBED_CACHE_DIR, `${safeId}.json`);

  // Check cache first
  if (fs.existsSync(cachePath)) {
    try {
      console.log(`[OEmbed Endpoint] Cache Hit for ID: ${safeId}`);
      const cachedContent = await fs.promises.readFile(cachePath, 'utf-8');
      const cachedData = JSON.parse(cachedContent);
      res.json({
        success: true,
        cached: true,
        data: cachedData
      });
      return;
    } catch (err: any) {
      console.error(`[OEmbed Endpoint] Error reading cache file for ${safeId}:`, err.message);
    }
  }

  // Fetch from official Instagram OEmbed API
  try {
    console.log(`[OEmbed Endpoint] Cache Miss. Querying Instagram OEmbed API for URL: ${cleanUrl}`);
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(cleanUrl)}`;
    const response = await fetchWithTimeout(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, 2500);

    console.log(`[OEmbed Endpoint] Instagram OEmbed API HTTP Status: ${response.status}`);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('text/javascript')) {
        const data = await response.json();
        // Cache it
        await fs.promises.writeFile(cachePath, JSON.stringify(data, null, 2));
        console.log(`[OEmbed Endpoint] Saved OEmbed metadata and embed html code to disk cache at: ${cachePath}`);
        res.json({
          success: true,
          cached: false,
          data
        });
      } else {
        const textBody = await response.text();
        console.warn(`[OEmbed Endpoint] Instagram OEmbed API returned non-JSON response (${contentType}):`, textBody.substring(0, 200));
        res.json({
          success: false,
          error: `Instagram OEmbed returned status 200 but Content-Type was non-JSON (${contentType})`,
          details: textBody.substring(0, 200)
        });
      }
    } else {
      const errorText = await response.text();
      console.warn(`[OEmbed Endpoint] Failed to fetch OEmbed. Status: ${response.status}. Body: ${errorText.substring(0, 200)}`);
      res.json({
        success: false,
        error: `Instagram OEmbed returned status ${response.status}`,
        details: errorText.substring(0, 200)
      });
    }
  } catch (err: any) {
    console.error(`[OEmbed Endpoint] Network/Connection error during OEmbed request:`, err.message);
    res.json({
      success: false,
      error: err.message || "Failed to fetch OEmbed metadata"
    });
  }
});

// API: Vacuum orphan/deleted thumbnails
app.post("/api/vacuum-thumbnails", async (req, res) => {
  const { activeIds } = req.body;
  if (!Array.isArray(activeIds)) {
    res.status(400).json({ success: false, error: "activeIds must be an array of string keys." });
    return;
  }

  try {
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      res.json({ success: true, deletedCount: 0 });
      return;
    }

    const files = await fs.promises.readdir(THUMBNAILS_DIR);
    let deletedCount = 0;
    const activeIdSet = new Set(activeIds.map((id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_')));

    for (const file of files) {
      const ext = path.extname(file);
      if (ext === '.jpg' || ext === '.svg') {
        const nameWithoutExt = path.basename(file, ext);
        if (!activeIdSet.has(nameWithoutExt)) {
          const filePath = path.join(THUMBNAILS_DIR, file);
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }
    }

    console.log(`[Vacuum Cleaner] Removed ${deletedCount} orphan thumbnail images.`);
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error(`[Vacuum Cleaner] Error cleaning orphan thumbnails:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Research creators, hashtags, or trends using Google Search Grounding
app.post("/api/research", async (req, res) => {
  const { query, creatorUsername, hashtags } = req.body;
  
  if (!query && !creatorUsername && (!hashtags || hashtags.length === 0)) {
    res.status(400).json({ success: false, error: "Missing required parameters: query, creatorUsername, or hashtags." });
    return;
  }

  try {
    const ai = getAiClient();
    
    let prompt = "";
    if (query) {
      prompt = query;
    } else if (creatorUsername) {
      prompt = `Tell me more about the Instagram creator @${creatorUsername}. Please do a Google Search to find:
1. What niche or topics do they typically focus on?
2. What are some of their most popular types of content or trends they participate in?
3. Are they active on other major platforms (e.g., YouTube, TikTok, Twitter, personal website)?
Provide a concise, engaging summary and format it cleanly with markdown. Highlight key terms or links if available.`;
    } else if (hashtags && hashtags.length > 0) {
      const hashtagsStr = hashtags.map((h: string) => `#${h}`).join(", ");
      prompt = `Analyze and research the following Instagram hashtags/trends: ${hashtagsStr}. Please do a Google Search to determine:
1. What general context, community, or niche are these hashtags most commonly used in?
2. Are there any current trends, recent events, or popular topics associated with these hashtags?
3. What are some tips for using these hashtags effectively for discovery or community building?
Provide a concise, informative summary in clean markdown format.`;
    }

    // Call Gemini with Google Search grounding
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    
    // Extract grounding URLs and metadata
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: Array<{ title: string; url: string }> = [];
    if (chunks) {
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || "Web Source",
            url: chunk.web.uri,
          });
        }
      }
    }

    res.json({
      success: true,
      text,
      sources,
    });
  } catch (err: any) {
    console.error("[Research API Error]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
