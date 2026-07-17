import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, Cpu, Layers, ChevronDown, ChevronUp, Eye, AlertCircle } from "lucide-react";
import { getVisiblePostCount } from "../../lib/thumbnailWorker";

export const PerformanceMonitor: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [domCount, setDomCount] = useState(0);
  const [fps, setFps] = useState(60);
  const [visibleCards, setVisibleCards] = useState(0);
  
  // Memory metrics
  const [memoryUsed, setMemoryUsed] = useState<number | null>(null);
  const [memoryLimit, setMemoryLimit] = useState<number | null>(null);
  const [memoryPercent, setMemoryPercent] = useState<number>(0);

  const fpsRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Measure FPS using requestAnimationFrame loop
    const measureFps = (time: number) => {
      fpsRef.current.frames += 1;
      if (time >= fpsRef.current.lastTime + 1000) {
        setFps(Math.round((fpsRef.current.frames * 1000) / (time - fpsRef.current.lastTime)));
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = time;
      }
      requestRef.current = requestAnimationFrame(measureFps);
    };
    
    requestRef.current = requestAnimationFrame(measureFps);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // 2. Interval-based measurements for DOM Nodes, Memory, and Active/Visible Cards
    const updateStats = () => {
      // DOM Nodes Count
      setDomCount(document.getElementsByTagName("*").length);

      // Visible cards
      setVisibleCards(getVisiblePostCount());

      // Memory usage (if Chrome/Edge/Opera API is supported)
      const performanceMemory = (performance as any).memory;
      if (performanceMemory) {
        const used = Math.round(performanceMemory.usedJSHeapSize / 1048576); // to MB
        const limit = Math.round(performanceMemory.jsHeapLimit / 1048576); // to MB
        setMemoryUsed(used);
        setMemoryLimit(limit);
        setMemoryPercent(Math.min(100, Math.round((used / limit) * 100)));
      }
    };

    // Initial update
    updateStats();
    
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine health color for FPS
  const getFpsColor = () => {
    if (fps >= 55) return "text-emerald-500";
    if (fps >= 35) return "text-amber-500";
    return "text-red-500";
  };

  // Determine node health level color
  const getDomColor = () => {
    if (domCount < 1500) return "text-emerald-500";
    if (domCount < 3000) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] font-sans pointer-events-auto">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          /* Mini badge button */
          <motion.button
            key="collapsed"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-m3-surface-low/95 border border-m3-outline-variant/40 hover:border-m3-primary/30 rounded-full shadow-lg backdrop-blur-md cursor-pointer text-xs font-semibold text-m3-on-surface"
          >
            <Activity size={14} className="text-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold">
              {fps} FPS | {domCount} DOM
            </span>
            <ChevronUp size={12} className="text-m3-outline" />
          </motion.button>
        ) : (
          /* Full monitor board */
          <motion.div
            key="expanded"
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            className="w-72 bg-m3-surface-low/95 border border-m3-outline-variant/40 rounded-[20px] p-4 shadow-2xl backdrop-blur-lg space-y-3.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-m3-outline-variant/15 pb-2">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-emerald-500" />
                <span className="text-xs font-bold font-display text-m3-on-surface tracking-tight">
                  Performance Monitor
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-mono font-bold tracking-wider uppercase">
                  Dev
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-m3-surface-container transition-colors cursor-pointer text-m3-outline hover:text-m3-on-surface"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Metrics List */}
            <div className="space-y-3">
              {/* FPS Metric */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-m3-on-surface-variant">
                  <Activity size={13} className="text-m3-outline" />
                  <span>Frame Rate (FPS)</span>
                </div>
                <span className={`font-mono font-bold ${getFpsColor()}`}>
                  {fps} <span className="text-[9px] font-normal text-m3-outline">fps</span>
                </span>
              </div>

              {/* DOM Nodes Metric */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-m3-on-surface-variant">
                    <Layers size={13} className="text-m3-outline" />
                    <span>Rendered DOM Nodes</span>
                  </div>
                  <span className={`font-mono font-bold ${getDomColor()}`}>
                    {domCount}
                  </span>
                </div>
                {/* Visual guideline feedback */}
                <p className="text-[9px] text-m3-outline leading-tight">
                  {domCount > 2500 
                    ? "⚠️ High node count. Avoid scrolling in double/single density without virtual list enabled." 
                    : "✓ Low node count. Virtualized list keeps layout rendering optimized and stable."}
                </p>
              </div>

              {/* Viewport Card Tracker */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-m3-on-surface-variant">
                  <Eye size={13} className="text-m3-outline" />
                  <span>Visible Viewport Cards</span>
                </div>
                <span className="font-mono font-bold text-m3-primary dark:text-white">
                  {visibleCards} <span className="text-[9px] font-normal text-m3-outline">active</span>
                </span>
              </div>

              {/* JS Heap Memory Metric (Conditional) */}
              {memoryUsed !== null && (
                <div className="space-y-1.5 pt-1 border-t border-m3-outline-variant/10">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-m3-on-surface-variant">
                      <Cpu size={13} className="text-m3-outline" />
                      <span>JS Heap Allocated</span>
                    </div>
                    <span className="font-mono font-bold text-m3-on-surface">
                      {memoryUsed} <span className="text-[9px] font-normal text-m3-outline">/ {memoryLimit} MB</span>
                    </span>
                  </div>
                  {/* Memory percentage slider */}
                  <div className="w-full bg-m3-outline-variant/30 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-m3-primary dark:bg-white h-full transition-all duration-500 rounded-full" 
                      style={{ width: `${memoryPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Explanatory Info footer */}
            <div className="flex items-start gap-1.5 bg-m3-surface-container/45 border border-m3-outline-variant/30 rounded-xl p-2 text-[9px] text-m3-on-surface-variant leading-relaxed">
              <AlertCircle size={11} className="text-m3-outline shrink-0 mt-0.5" />
              <span>
                To optimize rendering, switch layout to **List View** to toggle on the Virtuoso Virtual List, reducing DOM memory footprint immediately.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
