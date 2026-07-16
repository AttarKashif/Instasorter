import React, { useState } from "react";
import {
  Sparkles,
  Sliders,
  Check,
  Download,
  Eye,
  Layers,
  Copy,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import { Post } from "../../types/post";

interface SocialCardCreatorProps {
  post: Post;
  activeSlideImage: string;
}

export const SocialCardCreator: React.FC<SocialCardCreatorProps> = ({
  post,
  activeSlideImage,
}) => {
  const [bgStyle, setBgStyle] = useState<
    "sunset" | "cosmic" | "emerald" | "minimal-dark" | "clean-light"
  >("sunset");
  const [padding, setPadding] = useState<number>(32);
  const [cardTheme, setCardTheme] = useState<"light" | "dark">("dark");
  const [showCaption, setShowCaption] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [copiedHtml, setCopiedHtml] = useState(false);

  // Background configurations
  const getBgClass = () => {
    switch (bgStyle) {
      case "sunset":
        return "bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600";
      case "cosmic":
        return "bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-900";
      case "emerald":
        return "bg-gradient-to-tr from-teal-950 via-emerald-900 to-zinc-950";
      case "minimal-dark":
        return "bg-zinc-950";
      case "clean-light":
        return "bg-m3-surface border border-m3-outline-variant bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]";
    }
  };

  const handlePrint = () => {
    const cardEl = document.getElementById("share-card-container");
    if (!cardEl) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Instasorter Card Snapshot - @${post.creatorUsername}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #0c0a09; }
              @media print {
                body { background: none; padding: 0; }
              }
            </style>
          </head>
          <body>
            <div class="scale-100 flex items-center justify-center">
              ${cardEl.outerHTML}
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(() => { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleCopyHTML = () => {
    const cardEl = document.getElementById("share-card-container");
    if (!cardEl) return;

    // Standard inlined styles for sharing
    const rawHTML = cardEl.outerHTML;
    navigator.clipboard.writeText(rawHTML);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden min-h-0 bg-m3-surface">
      {/* LEFT COLUMN: Graphic Canvas Workspace */}
      <div className="flex-1 p-6 md:p-8 bg-m3-surface-low border-b md:border-b-0 md:border-r border-m3-outline-variant/15 flex items-center justify-center overflow-y-auto max-h-[60vh] md:max-h-none shrink-0 select-none">
        {/* Poster Wrapper with chosen background styling */}
        <div
          id="share-card-container"
          className={`w-full max-w-[420px] rounded-[36px] shadow-2xl transition-all duration-300 overflow-hidden flex flex-col justify-center items-center ${getBgClass()}`}
          style={{ padding: `${padding}px` }}
        >
          {/* Inner Polaroid Card Component */}
          <div
            className={`w-full rounded-2xl shadow-xl p-5 border flex flex-col gap-4.5 ${
              cardTheme === "dark"
                ? "bg-m3-surface-variant/90 backdrop-blur-md text-white border-zinc-800"
                : "bg-white/95 backdrop-blur-md text-m3-on-surface border-neutral-100"
            }`}
          >
            {/* Header (User Profile badge) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-m3-primary/15 text-m3-primary font-extrabold text-[10px] flex items-center justify-center uppercase select-none">
                  {post.creatorUsername.substring(0, 2)}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11.5px] font-bold">
                    @{post.creatorUsername}
                  </span>
                  {post.location && (
                    <span className="text-[8.5px] opacity-60 leading-none">
                      {post.location}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[8.5px] font-bold opacity-45 uppercase font-mono tracking-wider">
                Saved{" "}
                {new Date(post.savedAt).toLocaleDateString(undefined, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Media Image Showcase */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/10 border border-black/5">
              <img
                src={activeSlideImage}
                alt="Card Show"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop";
                }}
              />
            </div>

            {/* Editable elements block */}
            <div className="flex flex-col gap-3">
              {/* Caption Section */}
              {showCaption && post.caption && (
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-bold uppercase opacity-50 tracking-wider">
                    Caption content
                  </span>
                  <p className="text-[10.5px] leading-relaxed break-words font-sans italic opacity-90 line-clamp-3">
                    "{post.caption.replace(/#\w+/g, "").trim()}"
                  </p>
                </div>
              )}

              {/* Personal Annotations Memo Block */}
              {showNotes && post.notes && (
                <div
                  className={`p-3 rounded-xl border flex flex-col gap-1 ${
                    cardTheme === "dark"
                      ? "bg-m3-surface-variant/60 border-zinc-700/55"
                      : "bg-m3-surface border-neutral-100"
                  }`}
                >
                  <span className="text-[7.5px] font-extrabold uppercase opacity-55 tracking-wider flex items-center gap-1">
                    <Bookmark size={8} /> Personal Annotations
                  </span>
                  <p className="text-[10px] leading-relaxed break-words opacity-85">
                    {post.notes}
                  </p>
                </div>
              )}

              {/* Metadata Badge Row */}
              {showMetadata &&
                (post.tags?.length > 0 || post.collections?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {post.collections?.slice(0, 1).map((col) => (
                      <span
                        key={col}
                        className="text-[8px] font-bold px-2 py-0.5 rounded bg-m3-primary/50/10 text-m3-primary border border-m3-primary/100/20 uppercase tracking-tight"
                      >
                        Folder: {col}
                      </span>
                    ))}
                    {post.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[8px] font-bold px-2 py-0.5 rounded bg-m3-primary/50/10 text-m3-primary border border-m3-primary/100/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
            </div>

            {/* Footer Watermark */}
            <div className="border-t border-black/5 pt-2 flex items-center justify-between opacity-40">
              <span className="text-[7.5px] font-mono uppercase tracking-wider">
                Instasorter Catalog Card
              </span>
              <ExternalLink size={8} />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Customizer Settings Panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-m3-surface-container/20 p-6 md:p-8 overflow-y-auto">
        <div className="mb-6">
          <h4 className="text-sm font-bold text-m3-on-surface flex items-center gap-1.5">
            <Sparkles size={16} className="text-m3-primary" /> Card Customizer
          </h4>
          <p className="text-[11px] text-m3-outline mt-0.5">
            Style your visual bookmark as an elegant poster suitable for
            printing, presentations, or sharing.
          </p>
        </div>

        <div className="space-y-6">
          {/* Background styles select */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-m3-outline block">
              1. Canvas Backplate Background
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "sunset", label: "Sunset Gradient" },
                  { id: "cosmic", label: "Cosmic Slate" },
                  { id: "emerald", label: "Dark Emerald" },
                  { id: "minimal-dark", label: "Minimal Dark" },
                  { id: "clean-light", label: "Clean grid" },
                ] as const
              ).map((style) => (
                <button
                  key={style.id}
                  onClick={() => setBgStyle(style.id)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    bgStyle === style.id
                      ? "bg-m3-primary/10 border-m3-primary text-m3-primary shadow-xs"
                      : "bg-m3-surface border-m3-outline-variant/35 text-m3-on-surface hover:border-m3-outline"
                  }`}
                >
                  <span>{style.label}</span>
                  {bgStyle === style.id && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          {/* Theme select */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-m3-outline block">
              2. Polaroid Card Theme
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setCardTheme("dark")}
                className={`flex-1 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  cardTheme === "dark"
                    ? "bg-m3-surface-variant border-zinc-700 text-white shadow-xs"
                    : "bg-m3-surface border-m3-outline-variant/40 text-m3-on-surface"
                }`}
              >
                Dark Theme Card
              </button>
              <button
                onClick={() => setCardTheme("light")}
                className={`flex-1 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  cardTheme === "light"
                    ? "bg-white border-m3-outline-variant text-m3-on-surface shadow-xs"
                    : "bg-m3-surface border-m3-outline-variant/40 text-m3-on-surface"
                }`}
              >
                Light Theme Card
              </button>
            </div>
          </div>

          {/* Spacing / Padding slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase tracking-wider text-m3-outline block">
                3. Margin Spacing
              </label>
              <span className="text-xs font-mono font-bold text-m3-primary">
                {padding}px
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Sliders size={14} className="text-m3-outline" />
              <input
                type="range"
                min="16"
                max="64"
                step="4"
                value={padding}
                onChange={(e) => setPadding(parseInt(e.target.value))}
                className="flex-1 h-1.5 accent-m3-primary bg-m3-surface-variant/40 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Display toggles */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-m3-outline block">
              4. Included Elements
            </label>
            <div className="space-y-2 bg-m3-surface p-3.5 rounded-2xl border border-m3-outline-variant/30">
              <label className="flex items-center gap-3 text-xs font-semibold text-m3-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCaption}
                  onChange={(e) => setShowCaption(e.target.checked)}
                  className="rounded border-m3-outline-variant text-m3-primary focus:ring-m3-primary"
                />
                Show Caption Text
              </label>
              <label className="flex items-center gap-3 text-xs font-semibold text-m3-on-surface cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={showNotes}
                  onChange={(e) => setShowNotes(e.target.checked)}
                  className="rounded border-m3-outline-variant text-m3-primary focus:ring-m3-primary"
                />
                Show Personal Annotations
              </label>
              <label className="flex items-center gap-3 text-xs font-semibold text-m3-on-surface cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="rounded border-m3-outline-variant text-m3-primary focus:ring-m3-primary"
                />
                Show Tag & Folder Badges
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-4 border-t border-m3-outline-variant/15">
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 py-3 bg-m3-primary text-m3-on-primary font-bold text-xs rounded-xl shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Download size={14} />
              Print Card or Save PDF Snapshot
            </button>
            <button
              onClick={handleCopyHTML}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-m3-outline-variant text-m3-primary hover:bg-m3-primary/5 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              {copiedHtml ? (
                <>
                  <Check size={14} className="stroke-[3]" />
                  HTML Markup Copied!
                </>
              ) : (
                <>
                  <Copy size={13} />
                  Copy Card HTML to Clipboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
