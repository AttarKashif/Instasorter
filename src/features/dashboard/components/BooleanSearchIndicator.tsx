import React, { useState } from "react";
import {
  Code,
  Sparkles,
  X,
  Plus,
  HelpCircle,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ASTNode,
  Token,
  formatASTToString,
} from "../../../lib/booleanSearch";

interface BooleanSearchIndicatorProps {
  query: string;
  tokens: Token[];
  ast: ASTNode | null;
  resultsCount: number;
  onClearSearch: () => void;
  onAppendOperator: (op: string) => void;
  onSetPresetQuery: (q: string) => void;
}

const SAMPLE_BOOLEAN_PRESETS = [
  { label: "Food or Coffee (No Recipes)", query: "(food OR coffee) AND NOT recipe" },
  { label: "Fashion or Style", query: "fashion OR style" },
  { label: "Starred & Unarchived", query: "is:favorite AND NOT is:archived" },
  { label: "Reels with Notes", query: "is:reel AND is:notes" },
  { label: "Tech or AI (No Python)", query: "(tech OR ai) AND NOT python" },
];

export const BooleanSearchIndicator: React.FC<BooleanSearchIndicatorProps> = ({
  query,
  tokens,
  ast,
  resultsCount,
  onClearSearch,
  onAppendOperator,
  onSetPresetQuery,
}) => {
  const [showOperatorHelp, setShowOperatorHelp] = useState(false);

  if (!query || !ast) return null;

  const formattedAST = formatASTToString(ast);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mb-4 mx-4 md:mx-6 p-3 bg-m3-surface border border-indigo-500/30 rounded-2xl shadow-sm text-m3-on-surface font-sans"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left Side Header */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
            <Code size={14} />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold font-display text-m3-on-surface flex items-center gap-1">
                Boolean Search Filter Active
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                {resultsCount} match{resultsCount !== 1 ? "es" : ""}
              </span>
            </div>

            {/* Parsed Structure String */}
            <div className="text-[11px] font-mono text-m3-outline mt-0.5 truncate">
              Condition: <span className="text-indigo-500 font-semibold">{formattedAST || query}</span>
            </div>
          </div>
        </div>

        {/* Quick Operator Insertion Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
          <div className="flex items-center gap-1 bg-m3-surface-low border border-m3-outline-variant/20 p-0.5 rounded-lg">
            <button
              onClick={() => onAppendOperator(" AND ")}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
              title="Add AND operator"
            >
              + AND
            </button>
            <button
              onClick={() => onAppendOperator(" OR ")}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
              title="Add OR operator"
            >
              + OR
            </button>
            <button
              onClick={() => onAppendOperator(" NOT ")}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
              title="Add NOT operator"
            >
              + NOT
            </button>
            <button
              onClick={() => onAppendOperator(" ( ) ")}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-m3-outline hover:bg-m3-surface-variant/30 cursor-pointer"
              title="Add parentheses"
            >
              ( )
            </button>
          </div>

          <button
            onClick={() => setShowOperatorHelp(!showOperatorHelp)}
            className="p-1.5 rounded-lg border border-m3-outline-variant/30 text-[10px] font-bold text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
            title="Toggle Boolean search guide & presets"
          >
            <HelpCircle size={13} />
          </button>

          <button
            onClick={onClearSearch}
            className="p-1 rounded-lg text-m3-outline hover:text-m3-on-surface hover:bg-m3-surface-variant/30 transition-all cursor-pointer"
            title="Clear boolean query"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Boolean Syntax Guide & Presets Drawer */}
      <AnimatePresence>
        {showOperatorHelp && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pt-3 mt-3 border-t border-m3-outline-variant/15 space-y-3"
          >
            {/* Operator explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono text-m3-outline">
              <div className="p-2 rounded-lg bg-m3-surface-low border border-m3-outline-variant/20">
                <strong className="text-indigo-500 block mb-0.5">AND (&&, +)</strong>
                Must match both terms e.g. <code className="text-m3-on-surface">food AND coffee</code>
              </div>
              <div className="p-2 rounded-lg bg-m3-surface-low border border-m3-outline-variant/20">
                <strong className="text-indigo-500 block mb-0.5">OR (||, ,)</strong>
                Matches either term e.g. <code className="text-m3-on-surface">fashion OR style</code>
              </div>
              <div className="p-2 rounded-lg bg-m3-surface-low border border-m3-outline-variant/20">
                <strong className="text-amber-500 block mb-0.5">NOT (!, -)</strong>
                Excludes matching posts e.g. <code className="text-m3-on-surface">NOT recipe</code>
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold font-display uppercase tracking-wider text-m3-outline block">
                Sample Boolean Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_BOOLEAN_PRESETS.map((preset) => (
                  <button
                    key={preset.query}
                    onClick={() => onSetPresetQuery(preset.query)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-mono transition-all cursor-pointer"
                  >
                    {preset.label}: <span className="font-bold">{preset.query}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
