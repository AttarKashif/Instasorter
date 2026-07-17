import React from "react";
import { Sun, Moon, ToggleLeft, ToggleRight } from "lucide-react";
import { motion } from "motion/react";

interface AppearanceTabProps {
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  compactMode: boolean;
  setCompactMode: (val: boolean) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = React.memo(({
  theme = "light",
  onThemeToggle,
  animationsEnabled,
  setAnimationsEnabled,
  compactMode,
  setCompactMode,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-m3-outline-variant/10">
          <h3 className="text-sm font-bold font-display text-m3-on-surface">Custom Appearance</h3>
          <p className="text-xs text-m3-on-surface-variant mt-0.5">Control the design theme and responsive features of your feed catalog.</p>
        </div>
        
        <div className="divide-y divide-m3-outline-variant/10">
          {/* Theme Toggle */}
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-m3-surface-variant/5 transition-colors">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-m3-on-surface">Color Palette &amp; Mode</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-normal max-w-md">Toggle between a crisp studio white gallery look or a dimmed dark room layout.</p>
            </div>
            <div className="shrink-0 flex items-center bg-m3-surface-container rounded-xl p-1 border border-m3-outline-variant/20 shadow-xs relative overflow-hidden min-w-[170px] sm:min-w-[190px]">
              {/* Sliding active pill indicator */}
              <div className="absolute inset-y-1 left-1 right-1 pointer-events-none select-none">
                <motion.div
                  className="h-full bg-m3-surface rounded-lg border border-m3-outline-variant/30 shadow-xs"
                  layout
                  animate={{
                    x: theme === "light" ? "0%" : "100%",
                    width: "calc(50% - 4px)",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 28,
                  }}
                />
              </div>

              <button
                onClick={() => onThemeToggle && theme === "dark" && onThemeToggle()}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 cursor-pointer ${
                  theme === "light"
                    ? "text-m3-primary font-extrabold"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                <motion.div
                  animate={{ rotate: theme === "light" ? 0 : -45 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Sun size={14} className={theme === "light" ? "text-m3-primary" : ""} />
                </motion.div>
                <span>Light</span>
              </button>
              
              <button
                onClick={() => onThemeToggle && theme === "light" && onThemeToggle()}
                className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-300 cursor-pointer ${
                  theme === "dark"
                    ? "text-m3-primary font-extrabold"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface"
                }`}
              >
                <motion.div
                  animate={{ rotate: theme === "dark" ? 0 : 45 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Moon size={14} className={theme === "dark" ? "text-m3-primary" : ""} />
                </motion.div>
                <span>Dark</span>
              </button>
            </div>
          </div>

          {/* Interface Animations */}
          <div className="p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-m3-surface-variant/5 transition-colors">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-m3-on-surface">Fluid Interface Animations</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-normal max-w-md">Enable hardware-accelerated motion sweeps and fade-ins for cards and navigations.</p>
            </div>
            <button
              onClick={() => setAnimationsEnabled(!animationsEnabled)}
              className={`shrink-0 transition-colors cursor-pointer ${animationsEnabled ? "text-m3-primary" : "text-m3-outline"} active:scale-95`}
            >
              {animationsEnabled ? (
                <ToggleRight size={36} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>

          {/* Compact List View */}
          <div className="p-5 sm:p-6 flex items-center justify-between gap-4 hover:bg-m3-surface-variant/5 transition-colors">
            <div className="flex-1">
              <h4 className="text-xs font-bold text-m3-on-surface">Compact Catalog Layout</h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-1 leading-normal max-w-md">Optimize space in search tables by packing row items and details into dense lists.</p>
            </div>
            <button
              onClick={() => setCompactMode(!compactMode)}
              className={`shrink-0 transition-colors cursor-pointer ${compactMode ? "text-m3-primary" : "text-m3-outline"} active:scale-95`}
            >
              {compactMode ? (
                <ToggleRight size={36} />
              ) : (
                <ToggleLeft size={36} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

