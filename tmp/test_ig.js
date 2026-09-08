const fs = require('fs');

async function test() {
  const shortcode = "DFd_bN_yG4j";
  const url = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  console.log("Fetching:", url);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "navigate"
    }
  });
  console.log("Status:", res.status);
  const html = await res.text();
  console.log("HTML length:", html.length);
  fs.writeFileSync("/tmp/embed.html", html);
  
  // Search for images
  const regex = /https:[\\\/]+[^"'\s]*\.(?:jpg|jpeg|png|webp)[^"'\s]*/gi;
  const matches = html.match(regex) || [];
  console.log("Found image matches:", matches.length);
  for (const m of matches.slice(0, 5)) {
    const clean = m.replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/\\/g, '');
    console.log("->", clean.substring(0, 100));
  }
}
test();
