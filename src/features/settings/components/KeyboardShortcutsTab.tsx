import React, { useState } from "react";
import {
  Keyboard,
  Search,
  CheckCircle2,
  Shield,
  Navigation,
  Bookmark,
  ExternalLink,
  Sparkles,
  Command,
} from "lucide-react";
import { motion } from "motion/react";

interface ShortcutGroup {
  category: string;
  icon: React.ReactNode;
  items: {
    key: string;
    description: string;
    context: string;
  }[];
}

export const KeyboardShortcutsTab: React.FC = React.memo(() => {
  const [filter, setFilter] = useState("");

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: "Global Navigation",
      icon: <Navigation size={16} className="text-m3-primary" />,
      items: [
        { key: "1", description: "Navigate to Dashboard Home", context: "Global" },
        { key: "2", description: "Navigate to Analytics & Stats", context: "Global" },
        { key: "3", description: "Navigate to Collections / Folders", context: "Global" },
        { key: "4", description: "Open Import Data Dialog", context: "Global" },
        { key: "5", description: "Navigate to Curator Profile / Settings", context: "Global" },
        { key: "?", description: "Toggle Keyboard Shortcuts Modal Guide", context: "Global" },
      ],
    },
    {
      category: "Post Focus & Curation",
      icon: <Bookmark size={16} className="text-m3-primary" />,
      items: [
        { key: "→ / J", description: "Move focus highlight to next post card", context: "Grid & List Views" },
        { key: "← / K", description: "Move focus highlight to previous post card", context: "Grid & List Views" },
        { key: "Enter / Space", description: "Open selected post modal preview", context: "Focused Post" },
        { key: "F", description: "Toggle Star / Favorite status", context: "Focused Post" },
        { key: "A", description: "Toggle Archive / Hide status", context: "Focused Post" },
        { key: "R", description: "Toggle Read Later status", context: "Focused Post" },
        { key: "C", description: "Copy original Instagram link to clipboard", context: "Focused Post" },
      ],
    },
    {
      category: "Post Detail Overlay",
      icon: <ExternalLink size={16} className="text-m3-primary" />,
      items: [
        { key: "→", description: "Move detail view to next saved post", context: "Modal Overlay" },
        { key: "←", description: "Move detail view to previous saved post", context: "Modal Overlay" },
        { key: "Esc", description: "Close detail preview modal", context: "Modal Overlay" },
      ],
    },
  ];

  const filteredGroups = shortcutGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.key.toLowerCase().includes(filter.toLowerCase()) ||
          item.description.toLowerCase().includes(filter.toLowerCase()) ||
          item.context.toLowerCase().includes(filter.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
            <Command size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider flex items-center gap-2">
              <span>Shortcuts Architecture</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active & Guarded
              </span>
            </h3>
            <p className="text-xs text-m3-on-surface-variant mt-0.5">
              Instasorter supports high-efficiency single-key navigation. Shortcuts are automatically bypassed when typing in text fields.
            </p>
          </div>
        </div>

        {/* Filter Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant" />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-m3-surface rounded-xl border border-m3-outline-variant/30 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans"
          />
        </div>
      </div>

      {/* Safety Guard Indicator */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-sans">
        <div className="flex items-center gap-2.5">
          <Shield size={16} className="shrink-0 text-emerald-600" />
          <span>
            <strong>Input Safety Guard Active:</strong> All keydown handlers automatically suspend when an input, textarea, or editable element is focused.
          </span>
        </div>
        <span className="hidden md:inline font-mono text-[10px] uppercase font-bold text-emerald-600">
          Zero Collisions
        </span>
      </div>

      {/* Shortcuts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGroups.map((group) => (
          <div
            key={group.category}
            className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-m3-outline-variant/15">
              {group.icon}
              <h4 className="text-xs font-bold font-display uppercase tracking-wider text-m3-on-surface">
                {group.category}
              </h4>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.key + item.description}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-m3-surface/60 border border-m3-outline-variant/20 hover:border-m3-primary/30 transition-all text-xs font-sans"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-m3-on-surface block text-xs">
                      {item.description}
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant/80 font-mono">
                      {item.context}
                    </span>
                  </div>
                  <kbd className="px-2.5 py-1 rounded-lg bg-m3-surface border border-m3-outline-variant/40 shadow-xs font-mono font-bold text-xs text-m3-primary shrink-0">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
