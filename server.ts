import express from "express";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import dotenv from "dotenv";
dotenv.config();
import { snapsave } from "snapsave-media-downloader";
import { ultraigdl } from "ultra-igdl";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  sessionPool,
  getMobileApiHeaders,
  getRandomWebHeaders,
  updateWwwClaimFromHeaders,
  computeDHash,
  calculateHammingDistance,
  shortcodeToMediaId,
  detectInstagramCheckpoint,
  calculateJitteredBackoff,
  getProxyConfig
} from "./server/scraperEngine";
import { generateExtensionZip } from "./server/extensionBridge";

const app = express();
const PORT = 3000;

// Instaloader Python Bridge Execution Helper
async function runInstaloaderExtraction(shortcodeOrUrl: string): Promise<any> {
  return new Promise((resolve) => {
    const pythonScript = path.join(process.cwd(), "scripts", "instaloader_bridge.py");
    
    // Load local scraping credentials/proxy config if exists
    const configPath = path.join(process.cwd(), "scripts", "scraping_config.json");
    const scrapingEnv = { ...process.env };
    
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.username) scrapingEnv.IG_USERNAME = config.username;
        if (config.password) scrapingEnv.IG_PASSWORD = config.password;
        if (config.session_cookie) scrapingEnv.IG_SESSION_COOKIE = config.session_cookie;
        if (config.proxy) scrapingEnv.IG_PROXY = config.proxy;
      } catch (err: any) {
        console.warn(`[Instaloader Config Load Error]: ${err.message}`);
      }
    }

    execFile("python3", [pythonScript, shortcodeOrUrl], { timeout: 12000, env: scrapingEnv }, (error, stdout, stderr) => {
      if (error) {
        console.log(`[Instaloader Bridge] Execution note: ${error.message}`);
        resolve({ success: false, error: error.message });
        return;
      }
      try {
        const jsonLine = stdout.trim().split("\n").filter(l => l.trim().startsWith("{")).pop();
        if (jsonLine) {
          const parsed = JSON.parse(jsonLine);
          resolve(parsed);
        } else {
          resolve({ success: false, error: "Invalid stdout output from Instaloader bridge" });
        }
      } catch (err: any) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

// Convert Instagram shortcode to numerical Media ID
// (shortcodeToMediaId is provided by ./server/scraperEngine)

// Enhanced Instagram Media Scraper Direct Mobile API & GraphQL Engine
async function runAhmedRangelScraper(shortcode: string): Promise<any> {
  const activeSession = sessionPool.getActiveCookie();
  const sessionCookie = activeSession?.cookie || "";
  const username = activeSession?.username || "";
  const cookieHeader = sessionCookie ? `sessionid=${sessionCookie}; csrftoken=missing${username ? `; ds_user_id=${username}` : ''}` : undefined;

  const mobileHeaders = getMobileApiHeaders(cookieHeader);
  const webHeaders = getRandomWebHeaders(`https://www.instagram.com/p/${shortcode}/`, cookieHeader);

  // Strategy 1: Direct Mobile API Info Query using translated Media ID
  try {
    const mediaId = shortcodeToMediaId(shortcode);
    const urlInfo = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
    console.log(`[Media Scraper Engine] Trying api/v1/media/info/ for ID: ${mediaId}`);
    const resInfo = await fetchWithTimeout(urlInfo, { headers: mobileHeaders }, 3000);
    
    updateWwwClaimFromHeaders(resInfo.headers);

    if (resInfo.ok) {
      const json = await resInfo.json();
      const cpCheck = detectInstagramCheckpoint(json, resInfo.status);
      if (cpCheck.isCheckpoint) {
        sessionPool.recordResult(sessionCookie, false, cpCheck.reason);
      } else {
        sessionPool.recordResult(sessionCookie, true);
        const items = json?.items;
        if (items && items.length > 0) {
          const item = items[0];
          const displayUrl = item.image_versions2?.candidates?.[0]?.url || item.display_url;
          const caption = item.caption?.text || "";
          const ownerUsername = item.user?.username;
          
          // Extract all carousel slides if present
          const slides: string[] = [];
          if (Array.isArray(item.carousel_media)) {
            for (const slide of item.carousel_media) {
              const sUrl = slide.image_versions2?.candidates?.[0]?.url;
              if (sUrl && !slides.includes(sUrl)) slides.push(cleanImageUrl(sUrl));
            }
          }

          if (displayUrl) {
            return {
              success: true,
              displayUrl: cleanImageUrl(displayUrl),
              caption,
              ownerUsername,
              slides: slides.length > 0 ? slides : undefined,
              mediaType: item.carousel_media ? 'carousel' : (item.media_type === 2 || item.is_video ? 'video' : 'image'),
              strategy: "Instagram Mobile api/v1/media/info"
            };
          }
        }
      }
    } else {
      if (resInfo.status === 401 || resInfo.status === 403) {
        sessionPool.recordResult(sessionCookie, false, `HTTP ${resInfo.status}`);
      }
    }
  } catch (_err) {
    // Strategy 1 bypassed
  }

  // Strategy 2: Polaris doc_id GraphQL Query (Modern Web query used by Instagram 2024-2025)
  try {
    const docIdUrl = `https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`;
    const resDoc = await fetchWithTimeout(docIdUrl, { headers: webHeaders }, 3000);
    updateWwwClaimFromHeaders(resDoc.headers);

    if (resDoc.ok) {
      const json = await resDoc.json();
      const media = json?.data?.xdt_shortcode_media || json?.data?.shortcode_media;
      if (media) {
        const displayUrl = media.display_url;
        const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
        const username = media.owner?.username;

        const slides: string[] = [];
        if (Array.isArray(media.edge_sidecar_to_children?.edges)) {
          for (const edge of media.edge_sidecar_to_children.edges) {
            const sUrl = edge?.node?.display_url;
            if (sUrl && !slides.includes(sUrl)) slides.push(cleanImageUrl(sUrl));
          }
        }

        if (displayUrl) {
          sessionPool.recordResult(sessionCookie, true);
          return {
            success: true,
            displayUrl: cleanImageUrl(displayUrl),
            caption,
            ownerUsername: username,
            slides: slides.length > 0 ? slides : undefined,
            mediaType: slides.length > 0 ? 'carousel' : (media.is_video ? 'video' : 'image'),
            strategy: "Instagram Polaris GraphQL doc_id:8845758582119845"
          };
        }
      }
    }
  } catch (_err) {
    // Strategy 2 bypassed
  }

  // Strategy 3: GraphQL Query with rotating query hashes
  const queryHashes = [
    "b301662c8009741142a760f6222b406e", // Standard shortcode media
    "9f88d4d7a74160a390fb2403614095ae", // Alternative media hash
    "003056d32c2554def87228bc3d96687a"  // Sidecar hash
  ];

  for (const qHash of queryHashes) {
    try {
      const variables = JSON.stringify({ shortcode, child_comment_count: 3, fetch_comment_count: 4, parent_comment_count: 2, has_threaded_comments: true });
      const gqlUrl = `https://www.instagram.com/graphql/query/?query_hash=${qHash}&variables=${encodeURIComponent(variables)}`;
      const resGql = await fetchWithTimeout(gqlUrl, { headers: webHeaders }, 2500);
      updateWwwClaimFromHeaders(resGql.headers);

      if (resGql.ok) {
        const json = await resGql.json();
        const media = json?.data?.shortcode_media;
        if (media) {
          const displayUrl = media.display_url;
          const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || "";
          const username = media.owner?.username;

          const slides: string[] = [];
          if (Array.isArray(media.edge_sidecar_to_children?.edges)) {
            for (const edge of media.edge_sidecar_to_children.edges) {
              const sUrl = edge?.node?.display_url;
              if (sUrl && !slides.includes(sUrl)) slides.push(cleanImageUrl(sUrl));
            }
          }

          if (displayUrl) {
            sessionPool.recordResult(sessionCookie, true);
            return {
              success: true,
              displayUrl: cleanImageUrl(displayUrl),
              caption,
              ownerUsername: username,
              slides: slides.length > 0 ? slides : undefined,
              mediaType: slides.length > 0 ? 'carousel' : (media.is_video ? 'video' : 'image'),
              strategy: `Instagram GraphQL query_hash=${qHash}`
            };
          }
        }
      }
    } catch (_err) {
      // Strategy 3 bypassed
    }
  }

  // Strategy 4: Standard ?__a=1&__d=dis query
  try {
    const urlDis = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
    const resDis = await fetchWithTimeout(urlDis, { headers: webHeaders }, 2500);
    updateWwwClaimFromHeaders(resDis.headers);

    if (resDis.ok) {
      const json = await resDis.json();
      const items = json?.items || json?.graphql?.shortcode_media;
      if (items) {
        const item = Array.isArray(items) ? items[0] : items;
        const displayUrl = item.display_url || item.image_versions2?.candidates?.[0]?.url;
        const caption = item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text || "";
        const username = item.user?.username || item.owner?.username;
        if (displayUrl) {
          sessionPool.recordResult(sessionCookie, true);
          return {
            success: true,
            displayUrl: cleanImageUrl(displayUrl),
            caption,
            ownerUsername: username,
            mediaType: item.media_type === 2 || item.is_video ? 'video' : 'image',
            strategy: "Instagram __d=dis metadata extraction"
          };
        }
      }
    }
  } catch (_err) {
    // Strategy 4 bypassed
  }

  // Strategy 5: Public captioned embed extraction
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const resEmbed = await fetchWithTimeout(embedUrl, { headers: webHeaders }, 2500);
    if (resEmbed.ok) {
      const html = await resEmbed.text();
      const ogMatch = html.match(/class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["']/i) ||
                      html.match(/<img[^>]*class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*src=["']([^"']+)["']/i);
      const capMatch = html.match(/class=["']CaptionComments["'][^>]*>([^<]+)</i) ||
                       html.match(/class=["']Caption["'][^>]*>([^<]+)</i);
      const authMatch = html.match(/class=["']Username["'][^>]*>([^<]+)</i);

      if (ogMatch && ogMatch[1]) {
        return {
          success: true,
          displayUrl: cleanImageUrl(ogMatch[1].replace(/&amp;/g, '&')),
          caption: capMatch ? capMatch[1].trim() : "",
          ownerUsername: authMatch ? authMatch[1].trim() : undefined,
          mediaType: "image",
          strategy: "Instagram Captioned Embed Page"
        };
      }
    }
  } catch (_err) {
    // Strategy 5 bypassed
  }

  return { success: false, error: "Direct scraper pipeline found no accessible media." };
}

// Lazy-loaded Gemini client with validity tracking
let aiClient: GoogleGenAI | null = null;
let isGeminiKeyValid: boolean | null = null;

function getAiClient(): GoogleGenAI | null {
  if (isGeminiKeyValid === false) return null;
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === "" || key.includes("placeholder") || !key.startsWith("AIza") || key.length < 30) {
    isGeminiKeyValid = false;
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch {
      isGeminiKeyValid = false;
      return null;
    }
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

// Helper: Parse shortcode from Instagram URL with support for reels, posts, stories, shares
function getShortcode(url: string): string | null {
  if (!url) return null;
  const cleanUrl = url.split('?')[0];
  const match = cleanUrl.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|stories|share\/p)\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];
  // Direct shortcode passed in
  if (/^[a-zA-Z0-9_-]{8,15}$/.test(url.trim())) return url.trim();
  return null;
}

// Helper: Fetch with Timeout & Retry
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

// Helper: Image Magic Bytes Buffer Integrity Validator
function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 800) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: 52 49 46 46 (RIFF)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  return false;
}

// Helper: Clean and decode escaped image URLs
function cleanImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .replace(/\\u0026/g, '&')
    .replace(/\\u002F/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/');
}

// Helper: Extract username from Instagram embed page HTML
function extractUsernameFromHtml(html: string): string | null {
  if (!html) return null;

  // Strategy 1: Link with utm_source=ig_embed
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

  // Strategy 4: Meta title containing (@username)
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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

function getRandomHeaders(referer?: string) {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const isMobile = ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android');
  const platform = ua.includes('Windows') ? '"Windows"' : ua.includes('Macintosh') || ua.includes('iPhone') ? '"macOS"' : '"Linux"';

  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-CH-UA-Mobile': isMobile ? '?1' : '?0',
    'Sec-CH-UA-Platform': platform,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': referer || 'https://www.instagram.com/',
    'Cache-Control': 'no-cache',
  };
}

// In-Memory Request Coalescing Map (Deduplication)
const inFlightScrapes = new Map<string, Promise<any>>();

// In-Memory RAM Cache for Fast Scrape Results
const memoryCache = new Map<string, { data: any, timestamp: number }>();
const RAM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Circuit Breaker for Mirror Host Cooldowns
const hostFailures = new Map<string, { count: number, cooldownUntil: number }>();

function isHostInCooldown(host: string): boolean {
  const status = hostFailures.get(host);
  if (!status) return false;
  if (Date.now() > status.cooldownUntil) {
    hostFailures.delete(host);
    return false;
  }
  return status.count >= 3;
}

function recordHostFailure(host: string) {
  const status = hostFailures.get(host) || { count: 0, cooldownUntil: 0 };
  status.count += 1;
  if (status.count >= 3) {
    status.cooldownUntil = Date.now() + 30000; // 30s cooldown
    console.warn(`[Thumbnail Scraper] Circuit Breaker: Host ${host} temporarily paused for 30s after repeated failures.`);
  }
  hostFailures.set(host, status);
}

function recordHostSuccess(host: string) {
  hostFailures.delete(host);
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

// Scrape logic with Request Coalescing (Deduplication) and RAM Caching
async function scrapeInstagramImage(postUrl: string, postId: string, force: boolean, mediaType?: string): Promise<any> {
  const cacheKey = `${postId}_${force ? 'force' : 'std'}`;
  
  // 1. Check RAM Cache if not forced
  if (!force) {
    const cached = memoryCache.get(postId);
    if (cached && Date.now() - cached.timestamp < RAM_CACHE_TTL_MS) {
      console.log(`[Thumbnail Scraper] [RAM Cache Hit] Returning 0ms cached result for post ${postId}`);
      return cached.data;
    }
  }

  // 2. Coalesce duplicate inflight requests for the same postId
  if (inFlightScrapes.has(cacheKey)) {
    console.log(`[Thumbnail Scraper] [Inflight Coalesce] Request already running for post ${postId}, reusing promise.`);
    return inFlightScrapes.get(cacheKey)!;
  }

  const scrapePromise = scrapeInstagramImageInternal(postUrl, postId, force, mediaType)
    .then(async (result) => {
      if (result.success) {
        // Intercept and auto-generate caption via Gemini if missing and API key is valid
        if (result.path && (!result.caption || result.caption.trim() === "") && isGeminiKeyValid !== false) {
          const ai = getAiClient();
          if (ai) {
            try {
              const absoluteFilePath = path.join(process.cwd(), result.path.replace(/^\//, ''));
              if (fs.existsSync(absoluteFilePath) && !absoluteFilePath.endsWith('.svg')) {
                const fileBuffer = await fs.promises.readFile(absoluteFilePath);
                if (fileBuffer && fileBuffer.length > 0) {
                  const base64Data = fileBuffer.toString('base64');
                  const genRes = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: {
                      parts: [
                        { inlineData: { mimeType: "image/jpeg", data: base64Data } },
                        { text: "This is an Instagram post. Analyze this image and generate a realistic, high-fidelity descriptive caption (written in the natural voice of an Instagram creator) along with 5-10 relevant hashtags. Do not include any conversational fluff or meta-text." }
                      ]
                    }
                  });
                  if (genRes && genRes.text) {
                    result.caption = genRes.text.trim();
                    console.log(`[Thumbnail Scraper] [Gemini Vision Success] Generated caption for post ${postId}`);
                  }
                }
              }
            } catch (aiErr: any) {
              const errMsg = aiErr?.message || "";
              if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || errMsg.includes("400")) {
                isGeminiKeyValid = false;
                console.log(`[Thumbnail Scraper] Gemini API key not valid; auto-captioning disabled.`);
              }
            }
          }
        }
        memoryCache.set(postId, { data: result, timestamp: Date.now() });
      }
      return result;
    })
    .finally(() => {
      inFlightScrapes.delete(cacheKey);
    });

  inFlightScrapes.set(cacheKey, scrapePromise);
  return scrapePromise;
}

// Helper to generate branded SVG card fallback so no post ever stays broken
function generateFallbackSvgCard(postId: string, shortcode: string, username?: string): Buffer {
  const displayUser = username ? `@${username.replace(/[^a-zA-Z0-9_\.]/g, '')}` : `Post ${shortcode}`;
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="igGrad_${postId}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fdf497" />
      <stop offset="15%" stop-color="#fdf497" />
      <stop offset="50%" stop-color="#fd5949" />
      <stop offset="75%" stop-color="#d6249f" />
      <stop offset="100%" stop-color="#285AEB" />
    </linearGradient>
    <linearGradient id="bgGrad_${postId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bgGrad_${postId})" />
  <circle cx="300" cy="240" r="140" fill="none" stroke="url(#igGrad_${postId})" stroke-width="8" opacity="0.25" />
  <rect x="230" y="170" width="140" height="140" rx="36" fill="none" stroke="url(#igGrad_${postId})" stroke-width="10" />
  <circle cx="300" cy="240" r="42" fill="none" stroke="url(#igGrad_${postId})" stroke-width="10" />
  <circle cx="342" cy="198" r="9" fill="url(#igGrad_${postId})" />
  <text x="300" y="410" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="#f4f4f5" text-anchor="middle">${displayUser}</text>
  <text x="300" y="448" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="500" fill="#a1a1aa" text-anchor="middle">Instagram Media (${shortcode})</text>
  <rect x="210" y="480" width="180" height="34" rx="17" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
  <text x="300" y="502" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="#e4e4e7" text-anchor="middle">INSTASORTER PREVIEW</text>
</svg>`;
  return Buffer.from(svgContent, 'utf-8');
}

// Internal multi-strategy Instagram Scraper
async function scrapeInstagramImageInternal(postUrl: string, postId: string, force: boolean, mediaType?: string) {
  const startTime = Date.now();
  const shortcode = getShortcode(postUrl) || postId;
  const usernameFromUrl = extractUsernameFromUrl(postUrl);
  const headers = getRandomHeaders();
  const additionalSlides: string[] = [];

  console.log(`\n========================================`);
  console.log(`[Thumbnail Scraper] START processing Post ID: ${postId} (Shortcode: ${shortcode})`);
  console.log(`[Thumbnail Scraper] Post URL: ${postUrl}`);

  // Clean base URL
  let baseUrl = postUrl.split('?')[0];
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

  // -----------------------------------------------------------------
  // STRATEGY 1: Direct Media CDN Endpoint (/media/?size=l or size=m) - FASTEST (~200ms)
  // -----------------------------------------------------------------
  try {
    const mediaRedirectUrl = `${baseUrl}/media/?size=l`;
    console.log(`[Thumbnail Scraper] [Strategy 1] Trying direct media redirect: ${mediaRedirectUrl}`);
    const mediaRes = await fetchWithTimeout(mediaRedirectUrl, { headers, redirect: 'follow' }, 2000);
    
    if (mediaRes.ok && mediaRes.headers.get('content-type')?.includes('image')) {
      const bufferArray = await mediaRes.arrayBuffer();
      const safeBuffer = Buffer.from(bufferArray);
      
      if (isValidImageBuffer(safeBuffer)) {
        const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
        const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
        
        if (fs.existsSync(absolutePathSvg)) {
          try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
        }
        
        await fs.promises.writeFile(absolutePathJpg, safeBuffer);
        const duration = Date.now() - startTime;
        const phash = computeDHash(safeBuffer);
        console.log(`[Thumbnail Scraper] [Strategy 1 SUCCESS] High-res JPG saved in ${duration}ms! (pHash: ${phash})`);
        
        return {
          success: true,
          path: `/thumbnails/${postId}.jpg`,
          dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
          strategyUsed: "Instagram Direct Media CDN Endpoint (/media/?size=l)",
          duration,
          httpStatus: 200,
          phash,
          creatorUsername: usernameFromUrl || undefined
        };
      }
    }
  } catch (_err) {
    // Continue to next strategy
  }

  // -----------------------------------------------------------------
  // STRATEGY 1.5: Snapsave Media Downloader Node Engine (High Success, Zero-Session)
  // -----------------------------------------------------------------
  try {
    const snapRes = await Promise.race([
      snapsave(postUrl),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
    ]) as any;
    if (snapRes && snapRes.success && Array.isArray(snapRes.data?.media) && snapRes.data.media.length > 0) {
      const firstMedia = snapRes.data.media[0];
      const displayUrl = firstMedia.url;
      if (displayUrl) {
        const imgRes = await fetchWithTimeout(displayUrl, { headers: getRandomHeaders(displayUrl) }, 5000);
        if (imgRes.ok) {
          const safeBuffer = Buffer.from(await imgRes.arrayBuffer());
          if (isValidImageBuffer(safeBuffer)) {
            const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
            const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
            if (fs.existsSync(absolutePathSvg)) {
              try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
            }
            await fs.promises.writeFile(absolutePathJpg, safeBuffer);
            const duration = Date.now() - startTime;
            const phash = computeDHash(safeBuffer);

            // Extract additional slides for carousel if present
            const slides = snapRes.data.media;
            if (slides.length > 1) {
              for (let i = 1; i < Math.min(slides.length, 10); i++) {
                const slideUrl = slides[i].url;
                if (!slideUrl) continue;
                const slidePath = path.join(THUMBNAILS_DIR, `${postId}_${i}.jpg`);
                const slideRelativePath = `/thumbnails/${postId}_${i}.jpg`;
                try {
                  const sRes = await fetchWithTimeout(slideUrl, { headers: getRandomHeaders(slideUrl) }, 3000);
                  if (sRes.ok) {
                    const sBuf = Buffer.from(await sRes.arrayBuffer());
                    if (isValidImageBuffer(sBuf)) {
                      await fs.promises.writeFile(slidePath, sBuf);
                      additionalSlides.push(slideRelativePath);
                    }
                  }
                } catch (e) {}
              }
            }

            return {
              success: true,
              path: `/thumbnails/${postId}.jpg`,
              dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
              strategyUsed: "Snapsave Media Downloader Node Engine",
              duration,
              httpStatus: 200,
              phash,
              creatorUsername: usernameFromUrl || undefined,
              additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
            };
          }
        }
      }
    }
  } catch (_err) {
    // Continue to next strategy
  }

  // -----------------------------------------------------------------
  // STRATEGY 1.6: Ultra-igdl Media Extractor (High Success, Zero-Session)
  // -----------------------------------------------------------------
  try {
    const ig = new ultraigdl();
    const ultraRes = await Promise.race([
      ig.download(postUrl),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
    ]) as any;
    if (ultraRes) {
      let mediaUrl = "";
      if (Array.isArray(ultraRes.results) && ultraRes.results.length > 0) {
        mediaUrl = ultraRes.results[0].url;
      } else if (Array.isArray(ultraRes) && ultraRes.length > 0) {
        mediaUrl = ultraRes[0].url || ultraRes[0];
      } else if (ultraRes.url) {
        mediaUrl = ultraRes.url;
      }

      if (mediaUrl) {
        console.log(`[Thumbnail Scraper] [Strategy 1.6 SUCCESS] ultra-igdl extracted media URL: ${mediaUrl}`);
        const imgRes = await fetchWithTimeout(mediaUrl, { headers: getRandomHeaders(mediaUrl) }, 5000);
        if (imgRes.ok) {
          const safeBuffer = Buffer.from(await imgRes.arrayBuffer());
          if (isValidImageBuffer(safeBuffer)) {
            const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
            const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
            if (fs.existsSync(absolutePathSvg)) {
              try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
            }
            await fs.promises.writeFile(absolutePathJpg, safeBuffer);
            const duration = Date.now() - startTime;
            const phash = computeDHash(safeBuffer);

            // Extract additional slides if present
            const slides = ultraRes.results || ultraRes;
            if (Array.isArray(slides) && slides.length > 1) {
              for (let i = 1; i < Math.min(slides.length, 10); i++) {
                const slideUrl = slides[i].url || slides[i];
                if (typeof slideUrl !== "string") continue;
                const slidePath = path.join(THUMBNAILS_DIR, `${postId}_${i}.jpg`);
                const slideRelativePath = `/thumbnails/${postId}_${i}.jpg`;
                try {
                  const sRes = await fetchWithTimeout(slideUrl, { headers: getRandomHeaders(slideUrl) }, 3000);
                  if (sRes.ok) {
                    const sBuf = Buffer.from(await sRes.arrayBuffer());
                    if (isValidImageBuffer(sBuf)) {
                      await fs.promises.writeFile(slidePath, sBuf);
                      additionalSlides.push(slideRelativePath);
                    }
                  }
                } catch (e) {}
              }
            }

            console.log(`[Thumbnail Scraper] [Strategy 1.6 SUCCESS] ultra-igdl thumbnail saved in ${duration}ms! (pHash: ${phash})`);
            return {
              success: true,
              path: `/thumbnails/${postId}.jpg`,
              dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
              strategyUsed: "ultra-igdl Media Extractor",
              duration,
              httpStatus: 200,
              phash,
              creatorUsername: ultraRes.username || usernameFromUrl || undefined,
              caption: ultraRes.caption || undefined,
              additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
            };
          }
        }
      }
    }
  } catch (_err) {
    // Continue to next strategy quietly
  }

  // -----------------------------------------------------------------
  // STRATEGY 1.7: Cakkatrok SnapVideo Media Extractor (Zero-Session Node Engine)
  // -----------------------------------------------------------------
  try {
    const cakkatrokMod = await import("cakkatrok-instagram-downloader");
    const SnapVideo = cakkatrokMod.default;
    if (SnapVideo && typeof SnapVideo.media === "function") {
      const snapData = await Promise.race([
        SnapVideo.media(postUrl),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500))
      ]) as any;

      if (snapData && snapData.status === "ok" && Array.isArray(snapData.media) && snapData.media.length > 0) {
        const firstMedia = snapData.media[0];
        const displayUrl = firstMedia.url || firstMedia.thumbnail;
        if (displayUrl) {
          const imgRes = await fetchWithTimeout(displayUrl, { headers: getRandomHeaders(displayUrl) }, 5000);
          if (imgRes.ok) {
            const safeBuffer = Buffer.from(await imgRes.arrayBuffer());
            if (isValidImageBuffer(safeBuffer)) {
              const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
              const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
              if (fs.existsSync(absolutePathSvg)) {
                try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
              }
              await fs.promises.writeFile(absolutePathJpg, safeBuffer);
              const duration = Date.now() - startTime;
              const phash = computeDHash(safeBuffer);

              if (snapData.media.length > 1) {
                for (let i = 1; i < Math.min(snapData.media.length, 10); i++) {
                  const sUrl = snapData.media[i].url || snapData.media[i].thumbnail;
                  if (!sUrl) continue;
                  const slidePath = path.join(THUMBNAILS_DIR, `${postId}_${i}.jpg`);
                  const slideRelativePath = `/thumbnails/${postId}_${i}.jpg`;
                  try {
                    const sRes = await fetchWithTimeout(sUrl, { headers: getRandomHeaders(sUrl) }, 3000);
                    if (sRes.ok) {
                      const sBuf = Buffer.from(await sRes.arrayBuffer());
                      if (isValidImageBuffer(sBuf)) {
                        await fs.promises.writeFile(slidePath, sBuf);
                        additionalSlides.push(slideRelativePath);
                      }
                    }
                  } catch (e) {}
                }
              }

              console.log(`[Thumbnail Scraper] [Strategy 1.7 SUCCESS] SnapVideo thumbnail saved in ${duration}ms! (pHash: ${phash})`);
              return {
                success: true,
                path: `/thumbnails/${postId}.jpg`,
                dataUrl: `data:image/jpeg;base64,${safeBuffer.toString("base64")}`,
                strategyUsed: "Cakkatrok SnapVideo Media Extractor",
                duration,
                httpStatus: 200,
                phash,
                creatorUsername: usernameFromUrl || undefined,
                additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
              };
            }
          }
        }
      }
    }
  } catch (_err) {
    // Continue to next strategy
  }

  // -----------------------------------------------------------------
  // STRATEGY 2: Instaloader Python Subprocess Engine
  // -----------------------------------------------------------------
  try {
    console.log(`[Thumbnail Scraper] [Strategy 2] Trying Instaloader Python Engine for shortcode: ${shortcode}`);
    const ilRes = await runInstaloaderExtraction(shortcode);
    if (ilRes && ilRes.success && ilRes.displayUrl) {
      console.log(`[Thumbnail Scraper] [Strategy 2 - Instaloader] Extracted media display URL: ${ilRes.displayUrl}`);
      const imgRes = await fetchWithTimeout(ilRes.displayUrl, { headers: getRandomHeaders(ilRes.displayUrl) }, 3000);
      if (imgRes.ok) {
        const safeBuffer = Buffer.from(await imgRes.arrayBuffer());
        if (isValidImageBuffer(safeBuffer)) {
          const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
          const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
          if (fs.existsSync(absolutePathSvg)) {
            try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
          }
          await fs.promises.writeFile(absolutePathJpg, safeBuffer);
          const duration = Date.now() - startTime;
          const phash = computeDHash(safeBuffer);
          console.log(`[Thumbnail Scraper] [Strategy 2 SUCCESS] Instaloader media thumbnail saved in ${duration}ms! (pHash: ${phash})`);
          return {
            success: true,
            path: `/thumbnails/${postId}.jpg`,
            dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
            strategyUsed: "Instaloader Python Extraction Engine",
            duration,
            httpStatus: 200,
            phash,
            creatorUsername: ilRes.ownerUsername || usernameFromUrl || undefined,
            caption: ilRes.caption || undefined,
            hashtags: ilRes.hashtags || undefined
          };
        }
      }
    }
  } catch (_err) {
    // Continue to next strategy
  }

  // -----------------------------------------------------------------
  // STRATEGY 3: Enhanced Media Scraper Direct GraphQL & Mobile API Engine
  // -----------------------------------------------------------------
  try {
    console.log(`[Thumbnail Scraper] [Strategy 3] Trying Enhanced Media Scraper engine for shortcode: ${shortcode}`);
    const arRes = await runAhmedRangelScraper(shortcode);
    if (arRes && arRes.success && arRes.displayUrl) {
      console.log(`[Thumbnail Scraper] [Strategy 3 - Media Scraper] Media URL: ${arRes.displayUrl}`);
      const imgRes = await fetchWithTimeout(arRes.displayUrl, { headers: getRandomHeaders(arRes.displayUrl) }, 3000);
      if (imgRes.ok) {
        const safeBuffer = Buffer.from(await imgRes.arrayBuffer());
        if (isValidImageBuffer(safeBuffer)) {
          const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
          const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
          if (fs.existsSync(absolutePathSvg)) {
            try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
          }
          await fs.promises.writeFile(absolutePathJpg, safeBuffer);
          const duration = Date.now() - startTime;
          const phash = computeDHash(safeBuffer);

          // Download additional carousel slides if present
          if (Array.isArray(arRes.slides) && arRes.slides.length > 1) {
            for (let i = 1; i < Math.min(arRes.slides.length, 10); i++) {
              const slideUrl = arRes.slides[i];
              if (!slideUrl) continue;
              const slidePath = path.join(THUMBNAILS_DIR, `${postId}_${i}.jpg`);
              const slideRelativePath = `/thumbnails/${postId}_${i}.jpg`;
              try {
                const sRes = await fetchWithTimeout(slideUrl, { headers: getRandomHeaders(slideUrl) }, 2500);
                if (sRes.ok) {
                  const sBuf = Buffer.from(await sRes.arrayBuffer());
                  if (isValidImageBuffer(sBuf)) {
                    await fs.promises.writeFile(slidePath, sBuf);
                    additionalSlides.push(slideRelativePath);
                  }
                }
              } catch (e) {}
            }
          }

          console.log(`[Thumbnail Scraper] [Strategy 3 SUCCESS] Media Scraper thumbnail saved in ${duration}ms! (pHash: ${phash})`);
          return {
            success: true,
            path: `/thumbnails/${postId}.jpg`,
            dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
            strategyUsed: arRes.strategy || "Enhanced Instagram Media Scraper Engine",
            duration,
            httpStatus: 200,
            phash,
            creatorUsername: arRes.ownerUsername || usernameFromUrl || undefined,
            caption: arRes.caption || undefined,
            additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
          };
        }
      }
    }
  } catch (_err) {
    // Proceed to embed fallback
  }

  // -----------------------------------------------------------------
  // STRATEGY 4: Public Instagram Embed HTML Page Extraction (/embed/captioned/)
  // -----------------------------------------------------------------
  try {
    const embedUrl = `${baseUrl}/embed/captioned/`;
    const embedRes = await fetchWithTimeout(embedUrl, { headers, redirect: 'follow' }, 3000);
    if (embedRes.ok) {
      const html = await embedRes.text();
      let creatorUsername = extractUsernameFromHtml(html) || usernameFromUrl;
      let imageUrl: string | null = null;

      // Extract via structured JSON or regex fallback
      const structuredData = extractStructuredPostData(html);
      if (structuredData && structuredData.slides && structuredData.slides.length > 0) {
        imageUrl = structuredData.slides[0].display_url;
        if (structuredData.username) creatorUsername = structuredData.username;

        // Save carousel additional slides if present
        if (structuredData.slides.length > 1) {
          for (let i = 1; i < Math.min(structuredData.slides.length, 10); i++) {
            const slideUrl = structuredData.slides[i].display_url;
            if (!slideUrl) continue;
            const slidePath = path.join(THUMBNAILS_DIR, `${postId}_${i}.jpg`);
            const slideRelativePath = `/thumbnails/${postId}_${i}.jpg`;
            try {
              const slideRes = await fetchWithTimeout(slideUrl, { headers: getRandomHeaders(embedUrl) }, 2500);
              if (slideRes.ok) {
                const slideBuf = Buffer.from(await slideRes.arrayBuffer());
                if (isValidImageBuffer(slideBuf)) {
                  await fs.promises.writeFile(slidePath, slideBuf);
                  additionalSlides.push(slideRelativePath);
                }
              }
            } catch (e) {}
          }
        }
      }

      if (!imageUrl) {
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (ogMatch && ogMatch[1]) imageUrl = cleanImageUrl(ogMatch[1]);
      }

      if (!imageUrl) {
        const imgTagMatch = html.match(/<img[^>]*class=["'][^"']*MediaImage[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                            html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*MediaImage[^"']*["']/i);
        if (imgTagMatch && imgTagMatch[1]) imageUrl = cleanImageUrl(imgTagMatch[1]);
      }

      if (imageUrl) {
        console.log(`[Thumbnail Scraper] [Strategy 3] Image URL extracted: ${imageUrl}`);
        const imgRes = await fetchWithTimeout(imageUrl, { headers: getRandomHeaders(embedUrl) }, 3000);
        if (imgRes.ok) {
          const bufferArray = await imgRes.arrayBuffer();
          const safeBuffer = Buffer.from(bufferArray);
          if (isValidImageBuffer(safeBuffer)) {
            const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
            const absolutePathSvg = path.join(THUMBNAILS_DIR, `${postId}.svg`);
            if (fs.existsSync(absolutePathSvg)) {
              try { await fs.promises.unlink(absolutePathSvg); } catch (e) {}
            }
            await fs.promises.writeFile(absolutePathJpg, safeBuffer);
            const duration = Date.now() - startTime;
            const phash = computeDHash(safeBuffer);
            console.log(`[Thumbnail Scraper] [Strategy 3 SUCCESS] Saved JPG in ${duration}ms! (pHash: ${phash})`);

            return {
              success: true,
              path: `/thumbnails/${postId}.jpg`,
              dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
              strategyUsed: "Public Instagram Embed Extraction",
              duration,
              httpStatus: 200,
              phash,
              creatorUsername: creatorUsername || undefined,
              additionalSlides: additionalSlides.length > 0 ? additionalSlides : undefined
            };
          }
        }
      }
    }
  } catch (_err) {
    // Proceed to oEmbed
  }

  // -----------------------------------------------------------------
  // STRATEGY 5: Instagram oEmbed API Endpoint
  // -----------------------------------------------------------------
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(baseUrl)}`;
    const oembedRes = await fetchWithTimeout(oembedUrl, { headers }, 2500);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData) {
        let imgUrl = oembedData.thumbnail_url ? cleanImageUrl(oembedData.thumbnail_url) : null;

        if (!imgUrl && oembedData.html) {
          const ogMatch = oembedData.html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                          oembedData.html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                          oembedData.html.match(/<img[^>]*src=["']([^"']+)["']/i);
          if (ogMatch && ogMatch[1]) {
            imgUrl = cleanImageUrl(ogMatch[1]);
          }
        }

        if (imgUrl) {
          const imgRes = await fetchWithTimeout(imgUrl, { headers: getRandomHeaders(oembedUrl) }, 3000);
          if (imgRes.ok) {
            const safeBuffer = Buffer.from(await imgRes.arrayBuffer());
            if (isValidImageBuffer(safeBuffer)) {
              const absolutePathJpg = path.join(THUMBNAILS_DIR, `${postId}.jpg`);
              await fs.promises.writeFile(absolutePathJpg, safeBuffer);
              const duration = Date.now() - startTime;
              const phash = computeDHash(safeBuffer);
              return {
                success: true,
                path: `/thumbnails/${postId}.jpg`,
                dataUrl: `data:image/jpeg;base64,${safeBuffer.toString('base64')}`,
                strategyUsed: "Instagram oEmbed API Endpoint",
                duration,
                httpStatus: 200,
                phash,
                creatorUsername: oembedData.author_name || usernameFromUrl || undefined
              };
            }
          }
        }
      }
    }
  } catch (_err) {
    // Proceed to guaranteed fallback
  }

  // -----------------------------------------------------------------
  // Final Scraper Fallback: Return Clean Failure Result
  // When all direct CDN, downloader, and API engines are exhausted,
  // report failure cleanly so client renders minimalist blank canvas or user retry
  // -----------------------------------------------------------------
  const duration = Date.now() - startTime;
  return {
    success: false,
    reason: "Failed to scrape preview image from Instagram.",
    strategyUsed: "Multi-Strategy Scraper Engine",
    duration,
    httpStatus: 404
  };
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
      caption: result.caption || undefined,
      hashtags: result.hashtags || undefined,
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

// API: Download HD Media / Reel / Video attachment directly
app.all("/api/download-media", async (req, res) => {
  try {
    const id = req.query.id || req.body?.id;
    const mediaUrl = req.query.mediaUrl || req.body?.mediaUrl;
    const filename = req.query.filename || req.body?.filename || `instasorter-media-${id || Date.now()}`;

    const safeId = id ? String(id).replace(/[^a-zA-Z0-9_-]/g, '_') : 'media';

    // 1. Check local thumbnail/video disk files
    const jpgPath = path.join(THUMBNAILS_DIR, `${safeId}.jpg`);
    const mp4Path = path.join(THUMBNAILS_DIR, `${safeId}.mp4`);

    if (fs.existsSync(mp4Path)) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.mp4"`);
      fs.createReadStream(mp4Path).pipe(res);
      return;
    }

    if (fs.existsSync(jpgPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.jpg"`);
      fs.createReadStream(jpgPath).pipe(res);
      return;
    }

    // 2. If a remote media URL is provided, fetch and stream it directly
    if (mediaUrl && typeof mediaUrl === 'string' && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'))) {
      const response = await fetchWithTimeout(mediaUrl, { headers: getRandomHeaders() }, 8000);
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const isVideo = contentType.includes('video') || mediaUrl.includes('.mp4');
        const ext = isVideo ? 'mp4' : 'jpg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.${ext}"`);
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
        return;
      }
    }

    res.status(404).json({ success: false, error: "Media file or video not available for offline download" });
  } catch (err: any) {
    console.error("[Download Media Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to download media" });
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

// API: Server-side Proxy Route to bypass Instagram CORS & anti-scraping for OpenGraph metadata
app.post("/api/proxy-opengraph", async (req, res) => {
  const { url } = req.body;
  const cleanUrl = typeof url === 'string' ? url.trim() : '';

  if (!cleanUrl) {
    res.json({ success: false, error: "Missing url parameter" });
    return;
  }

  try {
    console.log(`[OpenGraph Proxy] Fetching URL: ${cleanUrl}`);
    const headers = getRandomHeaders(cleanUrl);
    const response = await fetchWithTimeout(cleanUrl, { headers }, 5000);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL. HTTP status: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract OpenGraph tags
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || 
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    const ogVideoMatch = html.match(/<meta[^>]*property=["']og:video["'][^>]*content=["']([^"']+)["']/i) || 
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:video["']/i);
    const ogTypeMatch = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["']/i) || 
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:type["']/i);

    const metadata = {
      image: ogImageMatch ? cleanImageUrl(ogImageMatch[1]) : null,
      title: ogTitleMatch ? ogTitleMatch[1] : null,
      description: ogDescMatch ? ogDescMatch[1] : null,
      video: ogVideoMatch ? ogVideoMatch[1] : null,
      type: ogTypeMatch ? ogTypeMatch[1] : null,
      url: cleanUrl
    };

    console.log(`[OpenGraph Proxy SUCCESS] Metadata extracted:`, metadata);
    res.json({ success: true, metadata });
  } catch (err: any) {
    console.warn(`[OpenGraph Proxy] Direct scraping failed: ${err.message || err}. Attempting oEmbed fallback...`);
    
    // Fallback to Instagram oEmbed endpoint
    try {
      const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(cleanUrl)}`;
      const oembedRes = await fetchWithTimeout(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, 3000);

      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        let fallbackImage = oembedData.thumbnail_url ? cleanImageUrl(oembedData.thumbnail_url) : null;
        
        if (!fallbackImage && oembedData.html) {
          const ogMatch = oembedData.html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || 
                          oembedData.html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
                          oembedData.html.match(/<img[^>]*src=["']([^"']+)["']/i);
          if (ogMatch && ogMatch[1]) {
            fallbackImage = cleanImageUrl(ogMatch[1]);
          }
        }

        res.json({
          success: true,
          metadata: {
            image: fallbackImage,
            title: oembedData.title || null,
            description: null,
            video: null,
            type: "instapp:photo",
            url: cleanUrl,
            author_name: oembedData.author_name || null
          }
        });
      } else {
        res.json({ success: false, error: `Direct scraping failed: ${err.message}. oEmbed returned HTTP ${oembedRes.status}` });
      }
    } catch (fallbackErr: any) {
      res.json({ success: false, error: `Direct scraping failed: ${err.message}. oEmbed fallback failed: ${fallbackErr.message}` });
    }
  }
});

// API: Dedicated Instaloader Extract Endpoint (Un-nested)
app.post("/api/instaloader-extract", async (req, res) => {
  const { url, shortcode } = req.body;
  const target = shortcode || url;
  if (!target) {
    res.json({ success: false, error: "Missing shortcode or url parameter." });
    return;
  }
  console.log(`[Instaloader Endpoint] Extracting post info for: ${target}`);
  const result = await runInstaloaderExtraction(target);
  res.json(result);
});

// API: Dedicated ahmedrangel/instagram-media-scraper Extract Endpoint (Un-nested)
app.post("/api/media-scraper-extract", async (req, res) => {
  const { url, shortcode } = req.body;
  const code = getShortcode(url || shortcode || "") || shortcode;
  if (!code) {
    res.json({ success: false, error: "Missing shortcode or url parameter." });
    return;
  }
  console.log(`[Media Scraper Endpoint] Extracting post info for: ${code}`);
  const result = await runAhmedRangelScraper(code);
  res.json(result);
});

// API: Get scraping configuration
app.get("/api/scraping-config", (req, res) => {
  const configPath = path.join(process.cwd(), "scripts", "scraping_config.json");
  let config: any = { username: "", password: "", session_cookie: "", session_cookies: [], proxy: "", proxy_pool: [] };
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {}
  }
  res.json({
    username: config.username || "",
    hasPassword: !!config.password,
    hasSessionCookie: !!(config.session_cookie || (config.session_cookies && config.session_cookies.length > 0)),
    sessionCookieMasked: config.session_cookie ? `${config.session_cookie.substring(0, 4)}...${config.session_cookie.substring(config.session_cookie.length - 4)}` : "",
    sessionCookiesCount: (config.session_cookies || []).length,
    proxy: config.proxy || "",
    proxyPoolCount: (config.proxy_pool || []).length,
    sessionPoolStats: sessionPool.getPoolStats()
  });
});

// API: Save scraping configuration
app.post("/api/save-scraping-config", (req, res) => {
  const { username, password, session_cookie, session_cookies, proxy, proxy_pool } = req.body;
  const configPath = path.join(process.cwd(), "scripts", "scraping_config.json");
  let currentConfig: any = {};
  if (fs.existsSync(configPath)) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {}
  }

  if (username !== undefined) currentConfig.username = username;
  if (password !== undefined && password !== "") currentConfig.password = password;
  if (session_cookie !== undefined) currentConfig.session_cookie = session_cookie;
  if (session_cookies !== undefined && Array.isArray(session_cookies)) currentConfig.session_cookies = session_cookies;
  if (proxy !== undefined) currentConfig.proxy = proxy;
  if (proxy_pool !== undefined && Array.isArray(proxy_pool)) currentConfig.proxy_pool = proxy_pool;

  try {
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
    sessionPool.reloadConfig();
    console.log("[Scraper Config] Saved updated config parameters and reloaded session pool.");
    res.json({ success: true, message: "Scraper configuration updated successfully.", poolStats: sessionPool.getPoolStats() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Chrome Extension ZIP Ingestion Tool Download
app.get("/api/download-extension", async (req, res) => {
  try {
    const zipBuffer = await generateExtensionZip();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="instasorter-capture-extension.zip"');
    res.send(zipBuffer);
  } catch (err: any) {
    console.error("[Download Extension Error]:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Ingest post directly from Browser Extension / HAR Import
app.post("/api/ingest-post", async (req, res) => {
  try {
    const post = req.body;
    if (!post || !post.id) {
      res.status(400).json({ success: false, error: "Missing required post payload." });
      return;
    }
    const cleanId = post.id.replace(/^ig_/, '');
    if (!fs.existsSync(THUMBNAILS_DIR)) {
      fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    }

    let localThumbnailUrl = post.thumbnailUrl;
    let phash = post.phash || "";

    // If thumbnail is a remote HTTP URL, persist locally to prevent hotlinking expiration
    if (post.thumbnailUrl && post.thumbnailUrl.startsWith("http")) {
      try {
        const imgRes = await fetchWithTimeout(post.thumbnailUrl, { headers: getRandomWebHeaders(post.postUrl) }, 3500);
        if (imgRes.ok) {
          const safeBuf = Buffer.from(await imgRes.arrayBuffer());
          if (isValidImageBuffer(safeBuf)) {
            const filePath = path.join(THUMBNAILS_DIR, `${cleanId}.jpg`);
            await fs.promises.writeFile(filePath, safeBuf);
            localThumbnailUrl = `/thumbnails/${cleanId}.jpg`;
            phash = computeDHash(safeBuf);
          }
        }
      } catch (err: any) {
        console.warn(`[Ingest Post] Remote thumbnail cache failed: ${err.message}`);
      }
    }

    // Process carousel slides if present
    const additionalSlides: string[] = [];
    if (Array.isArray(post.additionalSlides)) {
      for (let i = 0; i < Math.min(post.additionalSlides.length, 10); i++) {
        const sUrl = post.additionalSlides[i];
        if (sUrl && sUrl.startsWith("http")) {
          try {
            const sRes = await fetchWithTimeout(sUrl, { headers: getRandomWebHeaders(post.postUrl) }, 2500);
            if (sRes.ok) {
              const sBuf = Buffer.from(await sRes.arrayBuffer());
              if (isValidImageBuffer(sBuf)) {
                const sPath = path.join(THUMBNAILS_DIR, `${cleanId}_${i + 1}.jpg`);
                await fs.promises.writeFile(sPath, sBuf);
                additionalSlides.push(`/thumbnails/${cleanId}_${i + 1}.jpg`);
              }
            }
          } catch {}
        } else if (sUrl) {
          additionalSlides.push(sUrl);
        }
      }
    }

    res.json({
      success: true,
      post: {
        ...post,
        id: `ig_${cleanId}`,
        thumbnailUrl: localThumbnailUrl,
        additionalSlides: additionalSlides.length > 0 ? additionalSlides : post.additionalSlides,
        phash: phash || undefined,
        thumbnailStatus: "success"
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Batch Find Visual Duplicates using Hamming Distance of pHash
app.post("/api/find-duplicates", (req, res) => {
  const posts = req.body?.posts;
  const threshold = typeof req.body?.threshold === "number" ? req.body.threshold : 10;
  if (!Array.isArray(posts) || posts.length === 0) {
    res.json({ success: true, duplicateGroups: [] });
    return;
  }

  const validPosts = posts.filter(p => p && p.id && p.phash);
  const visited = new Set<string>();
  const duplicateGroups: Array<{ primaryId: string; duplicates: Array<{ id: string; distance: number }> }> = [];

  for (let i = 0; i < validPosts.length; i++) {
    const p1 = validPosts[i];
    if (visited.has(p1.id)) continue;

    const group: Array<{ id: string; distance: number }> = [];
    for (let j = i + 1; j < validPosts.length; j++) {
      const p2 = validPosts[j];
      if (visited.has(p2.id)) continue;
      const dist = calculateHammingDistance(p1.phash, p2.phash);
      if (dist <= threshold) {
        visited.add(p2.id);
        group.push({ id: p2.id, distance: dist });
      }
    }

    if (group.length > 0) {
      visited.add(p1.id);
      duplicateGroups.push({
        primaryId: p1.id,
        duplicates: group
      });
    }
  }

  res.json({ success: true, duplicateGroups, totalGroups: duplicateGroups.length });
});

// API: Test/Check Instagram Session Cookie Health
app.post("/api/check-session", async (req, res) => {
  const configPath = path.join(process.cwd(), "scripts", "scraping_config.json");
  let sessionCookie = req.body?.session_cookie;
  let username = req.body?.username;

  if (!sessionCookie && fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      sessionCookie = cfg.session_cookie || "";
      if (!username) username = cfg.username || "";
    } catch (e) {}
  }

  if (!sessionCookie || sessionCookie.trim() === "" || sessionCookie === "●●●●●●●●●●●●") {
    res.json({
      success: false,
      authenticated: false,
      message: "No active session cookie configured. Instagram requests will run anonymously with standard rate limits."
    });
    return;
  }

  try {
    const testUrl = "https://i.instagram.com/api/v1/accounts/current_user/?edit=true";
    const customHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'X-IG-App-ID': '936619743392459',
      'X-ASBD-ID': '198387',
      'Cookie': `sessionid=${sessionCookie}; csrftoken=missing${username ? `; ds_user_id=${username}` : ''}`,
      'Accept': '*/*'
    };

    const response = await fetchWithTimeout(testUrl, { headers: customHeaders }, 4000);
    if (response.ok) {
      const data = await response.json();
      const user = data?.user;
      res.json({
        success: true,
        authenticated: true,
        username: user?.username || username || "Active User",
        fullName: user?.full_name || "",
        message: `Session verified active! Authenticated as @${user?.username || username || 'user'}.`
      });
      return;
    } else {
      res.json({
        success: false,
        authenticated: false,
        httpStatus: response.status,
        message: `Session cookie returned HTTP ${response.status}. It may have expired or Instagram requires re-verification.`
      });
      return;
    }
  } catch (err: any) {
    res.json({
      success: false,
      authenticated: false,
      error: err.message,
      message: "Could not reach Instagram verification servers. Check your proxy or network connection."
    });
  }
});

// API: Scrape Diagnostics Testing Endpoint
app.post("/api/scrape-diagnostics", async (req, res) => {
  const { url, shortcode, engine } = req.body;
  const target = shortcode || getShortcode(url || "") || "C_pZ86hMaVd";
  console.log(`[Scrape Diagnostics] Testing engine: ${engine} with target: ${target}`);
  try {
    let result: any = null;
    if (engine === "instaloader") {
      result = await runInstaloaderExtraction(target);
    } else {
      result = await runAhmedRangelScraper(target);
    }
    res.json({ success: true, engine, target, result });
  } catch (err: any) {
    res.json({ success: false, engine, target, error: err.message });
  }
});

// Server-Side Background Scrape Worker Engine
interface ServerQueueItem {
  id: string;
  url: string;
  mediaType?: string;
  attempts: number;
  priority?: "high" | "normal";
}
const serverScrapeQueue: ServerQueueItem[] = [];
const serverQueueStatusMap = new Map<string, { status: "pending" | "processing" | "success" | "failed"; path?: string; phash?: string; additionalSlides?: string[]; error?: string }>();
let isServerQueueProcessing = false;

async function processServerScrapeQueue() {
  if (isServerQueueProcessing) return;
  isServerQueueProcessing = true;

  console.log(`[Server Background Queue Worker] Starting execution of ${serverScrapeQueue.length} queued background scrape tasks...`);

  while (serverScrapeQueue.length > 0) {
    const item = serverScrapeQueue.shift();
    if (!item) break;

    serverQueueStatusMap.set(item.id, { status: "processing" });

    try {
      console.log(`[Server Background Queue Worker] Processing item ${item.id} (${item.url})`);
      const result = await scrapeInstagramImage(item.url, item.id, false, item.mediaType);
      
      if (result.success && result.path) {
        serverQueueStatusMap.set(item.id, {
          status: "success",
          path: result.path,
          phash: (result as any).phash,
          additionalSlides: (result as any).additionalSlides
        });
      } else {
        serverQueueStatusMap.set(item.id, { status: "failed", error: result.reason || "Extraction failed" });
      }
    } catch (err: any) {
      serverQueueStatusMap.set(item.id, { status: "failed", error: err.message });
    }

    // Polite jittered stagger delay between server background scrapes (200-400ms)
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 200) + 200));
  }

  isServerQueueProcessing = false;
  console.log(`[Server Background Queue Worker] Finished all background queue items.`);
}

// API: Queue Background Scrape Tasks (Offloaded from Client/Service Worker)
app.post("/api/queue-background-scrape", (req, res) => {
  const { posts } = req.body;
  if (!Array.isArray(posts)) {
    res.status(400).json({ success: false, error: "posts must be an array of { id, url, mediaType, priority } objects." });
    return;
  }

  let queuedCount = 0;
  for (const p of posts) {
    if (!p.id || !p.url) continue;
    
    // Skip if already completed or in queue
    const current = serverQueueStatusMap.get(p.id);
    if (current && (current.status === "success" || current.status === "processing")) continue;

    serverQueueStatusMap.set(p.id, { status: "pending" });
    const queueItem: ServerQueueItem = {
      id: p.id,
      url: p.url,
      mediaType: p.mediaType,
      attempts: 0,
      priority: p.priority || "normal"
    };

    if (p.priority === "high") {
      serverScrapeQueue.unshift(queueItem); // High-priority viewport items jump to front
    } else {
      serverScrapeQueue.push(queueItem);
    }
    queuedCount++;
  }

  // Trigger non-blocking async queue worker
  processServerScrapeQueue().catch((err) => console.error("[Server Queue Worker Error]:", err));

  res.json({
    success: true,
    queuedCount,
    totalInQueue: serverScrapeQueue.length
  });
});

// API: Pool Statistics
app.get("/api/scraper-pool-stats", (req, res) => {
  res.json({
    success: true,
    pool: sessionPool.getPoolStats(),
    queue: {
      totalInQueue: serverScrapeQueue.length,
      isProcessing: isServerQueueProcessing,
      trackedCount: serverQueueStatusMap.size
    }
  });
});

// API: Check status of background queued items
app.get("/api/background-queue-status", (req, res) => {
  const ids = typeof req.query.ids === "string" ? req.query.ids.split(",") : [];
  const results: Record<string, any> = {};

  if (ids.length > 0) {
    for (const id of ids) {
      results[id] = serverQueueStatusMap.get(id) || { status: "unknown" };
    }
  } else {
    // Return summary statistics
    let pending = 0, processing = 0, success = 0, failed = 0;
    serverQueueStatusMap.forEach((val) => {
      if (val.status === "pending") pending++;
      else if (val.status === "processing") processing++;
      else if (val.status === "success") success++;
      else if (val.status === "failed") failed++;
    });
    results["_summary"] = { pending, processing, success, failed, totalTracked: serverQueueStatusMap.size };
  }

  res.json({ success: true, queue: results });
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
      model: "gemini-2.5-flash",
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
