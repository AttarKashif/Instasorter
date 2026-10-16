import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, X, Keyboard, Inbox, Sliders, LayoutGrid } from "lucide-react";
import { triggerVibration } from "../../lib/vibrate";

interface TourStep {
  title: string;
  description: string;
  targetId?: string;
  fallbackPosition?: "center" | "bottom";
  icon?: React.ReactNode;
}

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export function GuidedTour({ isOpen, onClose, onStepChange }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps: TourStep[] = [
    {
      title: "Welcome to Instasorter",
      description: "Welcome to your personal, offline-first media gallery and curator studio. Let's explore the key features in under a minute!",
      fallbackPosition: "center",
      icon: <LayoutGrid className="text-m3-primary" size={24} />,
    },
    {
      title: "Ingest Your Media",
      description: "Click the Import tab (or press 4) to load your Instagram data exports. Our engine processes ZIP or JSON files securely inside your browser.",
      targetId: "tour-import-btn",
      icon: <Inbox className="text-emerald-500" size={20} />,
    },
    {
      title: "Curate & Refine Filters",
      description: "Harness powerful real-time filters. Search, group by collections, isolate specific tags, or filter by media formats instantly.",
      targetId: "tour-filters-panel",
      icon: <Sliders className="text-blue-500" size={20} />,
    },
    {
      title: "Layout Grid Density",
      description: "Toggle layouts between full width Lists, standard responsive Grids, or visual focus grids depending on your curation context.",
      targetId: "tour-density-toggle",
      icon: <LayoutGrid className="text-purple-500" size={20} />,
    },
    {
      title: "High-Speed Key Navigation",
      description: "Instasorter is built for pure speed. Use arrow keys, J/K, or tag shortcuts to categorize items. Press '?' at any time to open the cheatsheet.",
      fallbackPosition: "center",
      icon: <Keyboard className="text-amber-500" size={24} />,
    },
  ];

  const step = steps[currentStep];

  // Recalculate target positions
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!step.targetId) {
        setCoords(null);
        return;
      }

      const element = document.getElementById(step.targetId);
      if (element) {
        // Ensure element is visible before calculating
        element.scrollIntoView({ block: "nearest", behavior: "smooth" });
        const rect = element.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        });
      } else {
        // Element not found/mounted yet, fall back gracefully
        setCoords(null);
      }
    };

    // Delay slightly to allow any view transitions/navigation to complete
    const timer = setTimeout(updatePosition, 300);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [currentStep, step.targetId, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    triggerVibration("light");
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    triggerVibration("light");
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const handleClose = () => {
    triggerVibration("medium");
    onClose();
  };

  // Determine tooltip placement styles
  const getTooltipStyles = () => {
    if (!coords) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed" as const,
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 320;
    const tooltipHeight = 180;

    let top = coords.top + coords.height + 12;
    let left = coords.left + coords.width / 2 - tooltipWidth / 2;

    // Check bottom boundary overflow, if so place above
    if (top + tooltipHeight > viewportHeight + window.scrollY) {
      top = coords.top - tooltipHeight - 12;
    }

    // Left boundary constraint
    if (left < 16) {
      left = 16;
    }
    // Right boundary constraint
    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      position: "absolute" as const,
    };
  };

  const tooltipStyles = getTooltipStyles();

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Dimmed Overlay Backdrop with cutout hole */}
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-[1px] pointer-events-auto transition-all duration-300" 
        onClick={handleClose}
      />

      {/* Target Focus Highlight Hole */}
      <AnimatePresence>
        {coords && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-[101] border-2 border-m3-primary/80 dark:border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] dark:shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none"
            style={{
              top: coords.top - 6,
              left: coords.left - 6,
              width: coords.width + 12,
              height: coords.height + 12,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip Content Card */}
      <div 
        style={tooltipStyles} 
        className="w-[320px] bg-m3-surface dark:bg-zinc-900 border border-m3-outline-variant/50 rounded-2xl shadow-2xl p-5 z-[102] pointer-events-auto select-none"
        ref={tooltipRef}
      >
        <div className="flex items-start gap-3.5">
          {step.icon && (
            <div className="p-2.5 rounded-xl bg-m3-primary/5 border border-m3-outline-variant/20 shrink-0 mt-0.5">
              {step.icon}
            </div>
          )}
          <div className="space-y-1 flex-1">
            <h4 className="font-display font-bold text-xs text-m3-on-surface uppercase tracking-wider">
              {step.title}
            </h4>
            <p className="font-sans text-[11.5px] leading-relaxed text-m3-on-surface-variant font-medium">
              {step.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full text-m3-on-surface-variant/60 hover:text-m3-on-surface hover:bg-m3-surface-container/50 transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Progress & Navigation Controls */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-m3-outline-variant/15">
          <span className="font-mono text-[10px] font-bold text-m3-outline uppercase tracking-wider">
            Step {currentStep + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg border border-m3-outline-variant/30 hover:border-m3-outline text-m3-on-surface-variant hover:text-m3-on-surface transition-all cursor-pointer active:scale-95"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary font-bold text-[10.5px] rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 font-sans flex items-center gap-1 uppercase tracking-wider"
            >
              <span>{currentStep === steps.length - 1 ? "Finish" : "Next"}</span>
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
