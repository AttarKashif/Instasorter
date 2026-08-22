import React from "react";
import { Sun, Moon, Sparkles, LayoutGrid } from "lucide-react";
import { triggerVibration } from "../../../lib/vibrate";

interface PreferencesTabProps {
  theme: "light" | "dark";
  onThemeToggle?: () => void;
  animationsEnabled: boolean;
  onSetAnimationsEnabled: (val: boolean) => void;
  compactMode: boolean;
  onSetCompactMode: (val: boolean) => void;
}

const UnifiedSwitch: React.FC<{ checked: boolean; onChange: (val: boolean) => void; ariaLabel?: string }> = ({
  checked,
  onChange,
  ariaLabel,
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? "bg-m3-primary" : "bg-m3-outline-variant"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-m3-surface shadow-xs ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

export const PreferencesTab: React.FC<PreferencesTabProps> = React.memo(({
  theme,
  onThemeToggle,
  animationsEnabled,
  onSetAnimationsEnabled,
  compactMode,
  onSetCompactMode,
}) => {
  return (
    <div className="space-y-6">
      {/* Theme & Display Options */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
          <Sparkles size={14} className="text-m3-primary" />
          <span>Visual Identity & Interface Density</span>
        </h3>

        <div className="space-y-4 divide-y divide-m3-outline-variant/15">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface flex items-center gap-2">
                <span>Color Atmosphere</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-m3-primary/10 text-m3-primary border border-m3-primary/20">
                  {theme === "dark" ? "Dark Room Mode" : "Crisp Studio Light"}
                </span>
              </h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                Toggle between light and low-eye-strain dark room themes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerVibration("light");
                if (onThemeToggle) onThemeToggle();
              }}
              className="px-3.5 py-2 rounded-xl bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary transition-all text-xs font-bold text-m3-on-surface flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95"
            >
              {theme === "dark" ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-indigo-500" />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between pt-4">
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface flex items-center gap-2">
                <LayoutGrid size={14} className="text-m3-primary" />
                <span>Compact Grid Layout</span>
              </h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                Increase thumbnail density and reduce spacing for high-volume browsing.
              </p>
            </div>
            <UnifiedSwitch
              checked={compactMode}
              onChange={onSetCompactMode}
              ariaLabel="Toggle Compact Grid Density"
            />
          </div>

          {/* Motion Animations */}
          <div className="flex items-center justify-between pt-4">
            <div>
              <h4 className="text-xs font-bold text-m3-on-surface flex items-center gap-2">
                <Sparkles size={14} className="text-m3-primary" />
                <span>Animations</span>
              </h4>
              <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
                Enable smooth interface transitions and animations.
              </p>
            </div>
            <UnifiedSwitch
              checked={animationsEnabled}
              onChange={onSetAnimationsEnabled}
              ariaLabel="Toggle Animations"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
