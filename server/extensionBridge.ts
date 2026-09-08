import JSZip from "jszip";

/**
 * Generates an unpacked WebExtension (Manifest V3) ZIP buffer.
 * Users can unpack this folder and load it into Chrome/Edge/Brave/Firefox (via chrome://extensions Developer mode)
 * to capture high-resolution Instagram posts, carousels, and reels directly with 0 rate limits.
 */
export async function generateExtensionZip(): Promise<Buffer> {
  const zip = new JSZip();

  const manifest = {
    manifest_version: 3,
    name: "Instasorter Post Capture Bridge",
    version: "1.0.0",
    description: "1-Click Instagram Post and Carousel Ingestion for Instasorter with 0 rate limits.",
    permissions: ["activeTab", "clipboardWrite", "storage"],
    host_permissions: [
      "https://*.instagram.com/*",
      "http://localhost:3000/*",
      "http://127.0.0.1:3000/*"
    ],
    action: {
      default_popup: "popup.html",
      default_title: "Save to Instasorter"
    },
    content_scripts: [
      {
        matches: ["https://*.instagram.com/*"],
        js: ["content.js"],
        run_at: "document_idle"
      }
    ]
  };

  const contentJs = `// Instasorter Content Script
console.log("[Instasorter Extension] Active on Instagram.");

function extractPostMetadata() {
  const url = window.location.href;
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let shortcode = '';
  if (pathParts.includes('p') || pathParts.includes('reel') || pathParts.includes('reels')) {
    const idx = pathParts.findIndex(p => ['p', 'reel', 'reels'].includes(p));
    if (idx !== -1 && pathParts[idx + 1]) shortcode = pathParts[idx + 1];
  }

  const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const authorEl = document.querySelector('header a[role="link"], article header a');
  const author = authorEl ? authorEl.textContent.trim() : '';
  const timeEl = document.querySelector('time');
  const savedAt = timeEl ? timeEl.getAttribute('datetime') : new Date().toISOString();
  const capEl = document.querySelector('h1, span._aacl, article div[data-testid="post-comment-root"] span');
  const caption = capEl ? capEl.textContent : '';

  // Extract all high-res carousel slides if visible in DOM
  const slides = [];
  document.querySelectorAll('article ul li img[src], article img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && src.includes('cdninstagram') && !slides.includes(src)) {
      slides.push(src);
    }
  });

  return {
    id: shortcode || ('ig_' + Date.now()),
    postUrl: url,
    creatorUsername: author || 'instagram_creator',
    caption: caption || '',
    thumbnailUrl: slides[0] || ogImg || '',
    additionalSlides: slides.length > 1 ? slides.slice(1) : undefined,
    savedAt,
    mediaType: url.includes('/reel/') ? 'video' : (slides.length > 1 ? 'carousel' : 'image')
  };
}

// Listen for message from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPost') {
    const data = extractPostMetadata();
    sendResponse({ success: true, data });
  }
  return true;
});
`;

  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Instasorter Ingestion</title>
  <style>
    body { width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 14px; margin: 0; background: #09090b; color: #fafafa; }
    h2 { font-size: 14px; margin: 0 0 4px 0; color: #f4f4f5; display: flex; align-items: center; gap: 6px; }
    p { font-size: 11px; color: #a1a1aa; margin: 0 0 12px 0; line-height: 1.4; }
    button { width: 100%; padding: 10px; background: #3b82f6; border: none; border-radius: 8px; color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #2563eb; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    #status { margin-top: 10px; font-size: 11px; padding: 8px; border-radius: 6px; display: none; word-break: break-all; }
    .success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); display: block !important; }
    .error { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); display: block !important; }
  </style>
</head>
<body>
  <h2>📥 Instasorter Capture</h2>
  <p>Ingest the current Instagram post or reel directly into your Instasorter library without rate limits.</p>
  <button id="saveBtn">Ingest Current Post</button>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `document.getElementById('saveBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Extracting...';
  statusEl.className = '';
  statusEl.style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('instagram.com')) {
      throw new Error('Please navigate to an Instagram post or reel first.');
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPost' });
    if (!response || !response.data) {
      throw new Error('Failed to extract metadata from page.');
    }

    btn.textContent = 'Sending to Instasorter...';

    const ingestRes = await fetch('http://localhost:3000/api/ingest-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.data)
    });

    const result = await ingestRes.json();
    if (result.success) {
      statusEl.className = 'success';
      statusEl.textContent = '✅ Post ingested successfully into Instasorter!';
    } else {
      throw new Error(result.error || 'Server rejected post ingestion');
    }
  } catch (err) {
    statusEl.className = 'error';
    statusEl.textContent = '❌ ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingest Current Post';
  }
});
`;

  const readmeTxt = `Instasorter Chrome / Edge / Brave Extension
==========================================

Installation Instructions:
1. Extract this ZIP archive into a folder on your computer.
2. Open Chrome (or Edge/Brave) and navigate to: chrome://extensions/
3. Turn ON "Developer mode" in the top right corner.
4. Click the "Load unpacked" button in the top left.
5. Select this unzipped folder.
6. Done! Navigate to any Instagram post and click the Instasorter extension icon to ingest it with 0 rate limits!
`;

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("content.js", contentJs);
  zip.file("popup.html", popupHtml);
  zip.file("popup.js", popupJs);
  zip.file("README.txt", readmeTxt);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer;
}
