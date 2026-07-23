import React, { useState } from "react";
import {
  Sparkles,
  Tag,
  Utensils,
  Shirt,
  Compass,
  Dumbbell,
  Cpu,
  Palette,
  Camera,
  Music,
  Home,
  PawPrint,
  Briefcase,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ExpandedSearchQuery } from "../../../lib/searchSynonyms";

interface SmartSearchIndicatorProps {
  expandedQuery: ExpandedSearchQuery;
  resultsCount: number;
  onApplySynonymTerm: (term: string) => void;
  onClearSearch: () => void;
}

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  food: Utensils,
  fashion: Shirt,
  travel: Compass,
  fitness: Dumbbell,
  tech: Cpu,
  art: Palette,
  photography: Camera,
  music: Music,
  home: Home,
  pets: PawPrint,
  business: Briefcase,
};

export const SmartSearchIndicator: React.FC<SmartSearchIndicatorProps> = ({
  expandedQuery,
  resultsCount,
  onApplySynonymTerm,
  onClearSearch,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedTerm, setCopiedTerm] = useState<string | null>(null);

  if (
    !expandedQuery.originalQuery.trim() ||
    expandedQuery.matchedCategories.length === 0
  ) {
    return null;
  }

  const { matchedCategories, originalQuery } = expandedQuery;

  const handleCopyOrApply = (term: string) => {
    onApplySynonymTerm(term);
    setCopiedTerm(term);
    setTimeout(() => setCopiedTerm(null), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mb-4 mx-4 md:mx-6 p-3 bg-m3-surface border border-indigo-500/20 rounded-2xl shadow-sm text-m3-on-surface font-sans"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Sparkles size={14} className="animate-pulse" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold font-display text-m3-on-surface">
                Smart Synonym Search Active
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold">
                "{originalQuery}"
              </span>
              <span className="text-[11px] text-m3-outline">
                • {resultsCount} post{resultsCount !== 1 ? "s" : ""} found
              </span>
            </div>

            {/* Matched Categories Badges */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {matchedCategories.map(({ category, matchedTerm }) => {
                const IconComp = CATEGORY_ICON_MAP[category.id] || Tag;
                return (
                  <span
                    key={category.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-m3-surface-low border border-m3-outline-variant/30 text-[10px] font-bold text-m3-on-surface-variant"
                  >
                    <IconComp size={10} className="text-indigo-500" />
                    <span>{category.label}</span>
                    <span className="text-[9px] font-mono text-m3-outline font-normal">
                      (via "{matchedTerm}")
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-m3-outline-variant/30 text-[10px] font-bold text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
          >
            <span>{isExpanded ? "Hide Synonyms" : "View Synonyms"}</span>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <button
            onClick={onClearSearch}
            className="p-1 rounded-lg text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
            title="Clear search"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Synonyms Drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pt-3 mt-3 border-t border-m3-outline-variant/15"
          >
            <div className="text-[10px] font-bold text-m3-outline uppercase tracking-wider mb-2 font-display">
              Matching posts tagged with any of these category keywords:
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {matchedCategories.flatMap((mc) =>
                mc.synonyms.map((syn) => {
                  const isCopied = copiedTerm === syn;
                  return (
                    <button
                      key={`${mc.category.id}_${syn}`}
                      onClick={() => handleCopyOrApply(syn)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${
                        isCopied
                          ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                          : "bg-m3-surface-low border-m3-outline-variant/25 text-m3-on-surface hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-600"
                      }`}
                      title={`Click to filter specifically by '${syn}'`}
                    >
                      {isCopied ? <Check size={10} /> : <Search size={9} />}
                      <span>{syn}</span>
                    </button>
                  );
                }),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
