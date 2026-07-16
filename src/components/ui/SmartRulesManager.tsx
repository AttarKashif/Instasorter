import React, { useState } from "react";
import { Sparkles, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePostStore } from "../../store/useStore";
import { SmartRule } from "../../types/post";

export const SmartRulesManager = () => {
  const smartRules = usePostStore((state) => state.smartRules);
  const addSmartRule = usePostStore((state) => state.addSmartRule);
  const removeSmartRule = usePostStore((state) => state.removeSmartRule);

  const [collectionName, setCollectionName] = useState("");
  const [type, setType] = useState<"username" | "keyword">("username");
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (!collectionName || !value) return;
    addSmartRule({
      id: Math.random().toString(36).substring(7),
      collectionName,
      type,
      value,
    });
    setCollectionName("");
    setValue("");
  };

  const clearAllRules = () => {
    smartRules.forEach((rule) => removeSmartRule(rule.id));
  };

  return (
    <div className="space-y-4 pt-4 border-t border-m3-outline-variant/10">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-m3-outline uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Sparkles size={13} className="text-m3-primary" /> Smart Rules
        </h3>
        {smartRules.length > 0 && (
          <button
            onClick={clearAllRules}
            className="text-[10px] text-m3-error hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-2 p-3 bg-m3-surface-container/30 rounded-xl border border-m3-outline-variant/10 shadow-sm">
        <input
          placeholder="Collection name"
          value={collectionName}
          onChange={(e) => setCollectionName(e.target.value)}
          className="w-full px-3 py-2 text-xs border border-m3-outline-variant/30 rounded-lg bg-m3-surface transition-all focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary outline-none"
        />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "username" | "keyword")}
            className="flex-1 px-2 py-2 text-xs border border-m3-outline-variant/30 rounded-lg bg-m3-surface transition-all focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary outline-none"
          >
            <option value="username">Creator Username</option>
            <option value="keyword">Keyword</option>
          </select>
          <input
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-[2] px-3 py-2 text-xs border border-m3-outline-variant/30 rounded-lg bg-m3-surface transition-all focus:ring-2 focus:ring-m3-primary/25 focus:border-m3-primary outline-none"
          />
        </div>
        <button
          onClick={handleAdd}
          className="w-full py-2 flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-lg text-xs font-bold hover:bg-m3-primary/90 active:scale-98 transition-all cursor-pointer"
        >
          <Plus size={14} /> Add Rule
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {smartRules.map((rule) => (
            <motion.div
              key={rule.id}
              layout
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="flex items-center justify-between p-3 bg-m3-surface border border-m3-outline-variant/20 rounded-lg text-xs shadow-sm hover:border-m3-primary/50 transition-colors overflow-hidden"
            >
              <div className="truncate pr-2">
                <span className="font-bold text-m3-primary">
                  {rule.collectionName}
                </span>
                <span className="text-m3-on-surface-variant ml-1.5">
                  if {rule.type} is{" "}
                  <span className="font-mono bg-m3-surface-container-high px-1 rounded">
                    {rule.value}
                  </span>
                </span>
              </div>
              <button
                onClick={() => removeSmartRule(rule.id)}
                className="text-m3-error hover:bg-m3-error-container/30 p-1.5 rounded-full transition-colors cursor-pointer shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
