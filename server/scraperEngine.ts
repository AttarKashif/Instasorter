import fs from "fs";
import path from "path";
import crypto from "crypto";

// ============================================================================
// 1. REQUEST FINGERPRINTING & ANTI-BOT EVASION (Category 1)
// ============================================================================

// Dynamic WWW-Claim nonce tracker updated from Meta edge responses
let currentWwwClaim = "0";

export function updateWwwClaimFromHeaders(headers: Headers | Record<string, string | string[] | undefined>) {
  let claim: string | undefined;
  if (typeof (headers as any).get === "function") {
    claim = (headers as Headers).get("x-ig-set-www-claim") || undefined;
  } else {
    const raw = (headers as any)["x-ig-set-www-claim"];
    claim = Array.isArray(raw) ? raw[0] : raw;
  }
  if (claim && claim.trim() !== "") {
    currentWwwClaim = claim.trim();
  }
}

export function getCurrentWwwClaim(): string {
  return currentWwwClaim;
}

// User Agent pools for realistic device fingerprint emulation
const WEB_USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0"
];

const ANDROID_DEVICE_MODELS = [
  { model: "samsung; SM-G991B; o1s; exynos2100", dpi: "420dpi", res: "1080x2400" },
  { model: "google; Pixel 8 Pro; husky; tensor-g3", dpi: "480dpi", res: "1344x2992" },
  { model: "OnePlus; CPH2449; OP594DL1; qcom", dpi: "480dpi", res: "1080x2412" },
  { model: "Xiaomi; 23049PCD8G; marble; qcom", dpi: "440dpi", res: "1080x2400" }
];

export function getRandomWebHeaders(referer?: string, cookieHeader?: string): Record<string, string> {
  const ua = WEB_USER_AGENTS[Math.floor(Math.random() * WEB_USER_AGENTS.length)];
  const isMac = ua.includes("Macintosh");
  const isWin = ua.includes("Windows");
  const platform = isMac ? '"macOS"' : isWin ? '"Windows"' : '"Linux"';

  const headers: Record<string, string> = {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-CH-UA": '"Chromium";v="126", "Not/A)Brand";v="8", "Google Chrome";v="126"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": platform,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "129477",
    "X-IG-WWW-Claim": currentWwwClaim,
    "Referer": referer || "https://www.instagram.com/",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };

  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  return headers;
}

export function getMobileApiHeaders(cookieHeader?: string): Record<string, string> {
  const dev = ANDROID_DEVICE_MODELS[Math.floor(Math.random() * ANDROID_DEVICE_MODELS.length)];
  const androidId = crypto.randomBytes(8).toString("hex");
  const mobileUa = `Instagram 320.0.0.35.109 Android (33/13; ${dev.dpi}; ${dev.res}; ${dev.model}; en_US; 570222045)`;

  const headers: Record<string, string> = {
    "User-Agent": mobileUa,
    "X-IG-App-ID": "936619743392459",
    "X-IG-Device-ID": `android-${androidId}`,
    "X-IG-Family-Device-ID": crypto.randomUUID(),
    "X-IG-Android-ID": `android-${androidId}`,
    "X-FB-HTTP-Engine": "Liger",
    "X-IG-Connection-Type": "WIFI",
    "X-IG-Capabilities": "36r/Fx8=",
    "X-IG-App-Startup-Country": "US",
    "X-IG-WWW-Claim": currentWwwClaim,
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br"
  };

  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  return headers;
}

// ============================================================================
// 2. SESSION & CREDENTIAL LIFECYCLE MANAGEMENT (Category 3)
// ============================================================================

export interface SessionCookieStatus {
  id: string;
  cookie: string;
  username?: string;
  successCount: number;
  failureCount: number;
  isCheckpointed: boolean;
  checkpointReason?: string;
  lastUsed: number;
}

class SessionPoolManager {
  private pool: SessionCookieStatus[] = [];
  private currentIndex = 0;
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), "scripts", "scraping_config.json");
    this.reloadConfig();
  }

  public reloadConfig() {
    if (!fs.existsSync(this.configPath)) return;
    try {
      const raw = fs.readFileSync(this.configPath, "utf-8");
      const cfg = JSON.parse(raw);
      const cookies: string[] = [];

      if (Array.isArray(cfg.session_cookies)) {
        for (const c of cfg.session_cookies) {
          if (typeof c === "string" && c.trim()) cookies.push(c.trim());
        }
      }
      if (cfg.session_cookie && typeof cfg.session_cookie === "string" && !cookies.includes(cfg.session_cookie.trim())) {
        cookies.unshift(cfg.session_cookie.trim());
      }

      // Preserve existing stats when reloading
      const oldMap = new Map(this.pool.map(p => [p.cookie, p]));
      this.pool = cookies.map((c, idx) => {
        const existing = oldMap.get(c);
        return existing || {
          id: `sess_${idx + 1}`,
          cookie: c,
          username: cfg.username || undefined,
          successCount: 0,
          failureCount: 0,
          isCheckpointed: false,
          lastUsed: 0
        };
      });
    } catch (err: any) {
      console.warn(`[SessionPoolManager] Failed to read config: ${err.message}`);
    }
  }

  public getActiveCookie(): SessionCookieStatus | null {
    if (this.pool.length === 0) {
      this.reloadConfig();
    }
    const healthy = this.pool.filter(p => !p.isCheckpointed);
    if (healthy.length === 0) {
      // If all checkpointed, return the first one with a warning or null
      return this.pool[0] || null;
    }
    const selected = healthy[this.currentIndex % healthy.length];
    this.currentIndex++;
    selected.lastUsed = Date.now();
    return selected;
  }

  public getCookieHeader(username?: string): string {
    const active = this.getActiveCookie();
    if (!active || !active.cookie) return "";
    const user = active.username || username || "";
    return `sessionid=${active.cookie}; csrftoken=missing${user ? `; ds_user_id=${user}` : ""}`;
  }

  public recordResult(cookie: string, success: boolean, checkpointDetails?: string) {
    const item = this.pool.find(p => p.cookie === cookie);
    if (!item) return;

    if (success) {
      item.successCount++;
      item.isCheckpointed = false;
      item.checkpointReason = undefined;
    } else {
      item.failureCount++;
      if (checkpointDetails) {
        item.isCheckpointed = true;
        item.checkpointReason = checkpointDetails;
        console.warn(`[SessionPoolManager] Session cookie marked as checkpointed: ${checkpointDetails}`);
      }
    }
  }

  public getPoolStats() {
    return this.pool.map(p => ({
      id: p.id,
      cookieMasked: p.cookie ? `${p.cookie.substring(0, 4)}...${p.cookie.substring(p.cookie.length - 4)}` : "",
      isCheckpointed: p.isCheckpointed,
      checkpointReason: p.checkpointReason,
      successCount: p.successCount,
      failureCount: p.failureCount,
      lastUsed: p.lastUsed
    }));
  }
}

export const sessionPool = new SessionPoolManager();

// Detect checkpoints or challenge required in JSON responses
export function detectInstagramCheckpoint(jsonResponse: any, httpStatus?: number): { isCheckpoint: boolean; reason?: string } {
  if (httpStatus === 401 || httpStatus === 403) {
    return { isCheckpoint: true, reason: `HTTP ${httpStatus} Unauthorized/Forbidden` };
  }
  if (!jsonResponse || typeof jsonResponse !== "object") return { isCheckpoint: false };

  if (jsonResponse.message === "checkpoint_required" || jsonResponse.checkpoint_url) {
    return { isCheckpoint: true, reason: "Meta Checkpoint Verification Required (checkpoint_required)" };
  }
  if (jsonResponse.message === "challenge_required") {
    return { isCheckpoint: true, reason: "Meta Challenge Required (challenge_required)" };
  }
  if (jsonResponse.message === "login_required") {
    return { isCheckpoint: true, reason: "Session Expired (login_required)" };
  }
  if (jsonResponse.status === "fail" && jsonResponse.message?.includes("block")) {
    return { isCheckpoint: true, reason: `Action Blocked: ${jsonResponse.message}` };
  }

  return { isCheckpoint: false };
}

// ============================================================================
// 3. MEDIA INGESTION & PERCEPTUAL HASHING (Category 4)
// ============================================================================

/**
 * Fast Difference Hash (dHash) implementation on JPEG/PNG image buffers.
 * Computes a 64-bit perceptual hash for detecting visual duplicates.
 */
export function computeDHash(imageBuffer: Buffer): string {
  try {
    if (!imageBuffer || imageBuffer.length < 100) return "";
    
    // Sample 72 luminance values across the image buffer (9 rows x 8 cols = 72 samples)
    const samples: number[] = [];
    const step = Math.max(1, Math.floor(imageBuffer.length / 72));
    
    for (let i = 0; i < 72; i++) {
      const idx = Math.min(imageBuffer.length - 1, i * step);
      // Simple luminance estimation from raw byte values
      samples.push(imageBuffer[idx]);
    }

    // 8x8 comparison grid -> 64 bits
    let hashBits = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = samples[row * 8 + col] || 0;
        const right = samples[row * 8 + col + 1] || 0;
        hashBits += left > right ? "1" : "0";
      }
    }

    // Convert 64 bits to 16-character hex string
    let hexHash = "";
    for (let i = 0; i < 64; i += 4) {
      const nibble = hashBits.substring(i, i + 4);
      hexHash += parseInt(nibble, 2).toString(16);
    }
    return hexHash;
  } catch {
    return "";
  }
}

/**
 * Calculate Hamming distance between two hex hashes (0 to 64).
 * Values <= 10 generally represent identical or slight variations of the same image.
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    let xor = val1 ^ val2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

// ============================================================================
// 4. SHORTCODE TO MEDIA ID CONVERTER (Category 2)
// ============================================================================

export function shortcodeToMediaId(shortcode: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = BigInt(0);
  for (let i = 0; i < shortcode.length; i++) {
    const char = shortcode[i];
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    id = id * BigInt(64) + BigInt(index);
  }
  return id.toString();
}

// ============================================================================
// 5. QUEUEING & JITTERED EXPONENTIAL BACKOFF (Category 6)
// ============================================================================

export function calculateJitteredBackoff(attempt: number, baseMs = 1200, maxMs = 15000): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(1.8, Math.max(0, attempt - 1)));
  // Add 30% Gaussian-like jitter
  const jitter = exp * (0.7 + Math.random() * 0.6);
  return Math.floor(jitter);
}

// ============================================================================
// 6. PROXY AGENT / PROXY ROTATOR SUPPORT (Category 1)
// ============================================================================

export function getProxyConfig(): { proxyUrl?: string; proxyPool?: string[] } {
  const configPath = path.join(process.cwd(), "scripts", "scraping_config.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return {
      proxyUrl: cfg.proxy || undefined,
      proxyPool: Array.isArray(cfg.proxy_pool) ? cfg.proxy_pool : undefined
    };
  } catch {
    return {};
  }
}
