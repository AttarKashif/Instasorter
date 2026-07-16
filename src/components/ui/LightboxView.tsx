import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Download, Sliders } from "lucide-react";

interface LightboxViewProps {
  isOpen: boolean;
  onClose: () => void;
  slides: string[];
  activeSlide: number;
  setActiveSlide: (index: number) => void;
  creatorUsername: string;
}

export const LightboxView: React.FC<LightboxViewProps> = ({
  isOpen,
  onClose,
  slides,
  activeSlide,
  setActiveSlide,
  creatorUsername,
}) => {
  const [zoomFactor, setZoomFactor] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setZoomFactor(1);
    }
  }, [isOpen, activeSlide]);

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && slides.length > 1) {
        setActiveSlide((activeSlide - 1 + slides.length) % slides.length);
      } else if (e.key === "ArrowRight" && slides.length > 1) {
        setActiveSlide((activeSlide + 1) % slides.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeSlide, slides.length, onClose, setActiveSlide]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = slides[activeSlide];

    // Create an anchor link and force download
    const link = document.createElement("a");
    link.href = url;
    link.download = `instasorter-${creatorUsername}-slide-${activeSlide + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-4 md:p-8 outline-none select-none"
          onClick={onClose}
        >
          {/* Top Control Bar */}
          <div
            className="absolute top-4 left-4 right-4 flex justify-between items-center z-50 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold font-display">
                @{creatorUsername}
              </span>
              {slides.length > 1 && (
                <span className="text-xs text-white/50 bg-white/10 px-2.5 py-0.5 rounded-full">
                  Slide {activeSlide + 1} of {slides.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer text-white"
                title="Download current slide"
              >
                <Download size={18} />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer text-white"
                title="Close gallery (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content Box */}
          <div className="relative w-full max-w-5xl h-[80vh] flex items-center justify-center overflow-hidden">
            {/* Slide Arrow Left */}
            {slides.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide(
                    (activeSlide - 1 + slides.length) % slides.length,
                  );
                }}
                className="absolute left-2 md:left-4 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white flex items-center justify-center transition-all z-10 cursor-pointer active:scale-95"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Main Visual Display */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full flex items-center justify-center p-2"
            >
              <motion.img
                src={slides[activeSlide]}
                alt="Lightbox Media"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl origin-center"
                style={{ transform: `scale(${zoomFactor})` }}
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  // abstract fallback representation if base64/url is broken
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop";
                }}
              />
            </motion.div>

            {/* Slide Arrow Right */}
            {slides.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide((activeSlide + 1) % slides.length);
                }}
                className="absolute right-2 md:right-4 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white flex items-center justify-center transition-all z-10 cursor-pointer active:scale-95"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Zoom Controls Overlay */}
          <div
            className="absolute bottom-6 bg-black/60 border border-white/10 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-4 z-50 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <Sliders size={14} className="text-white/60" />
            <span className="text-xs font-semibold">Scale</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoomFactor}
              onChange={(e) => setZoomFactor(parseFloat(e.target.value))}
              className="w-32 h-1 accent-m3-primary bg-white/20 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono w-10 text-right">
              {Math.round(zoomFactor * 100)}%
            </span>
            <button
              onClick={() => setZoomFactor(1)}
              className="text-[10px] uppercase font-bold text-m3-primary hover:underline ml-2 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
