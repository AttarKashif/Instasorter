import React, { useState, useEffect, useRef } from "react";

interface VirtualPostWrapperProps {
  id: string;
  gridDensity: "single" | "double" | "list";
  children: React.ReactNode;
}

const observers = new Map<string, IntersectionObserver>();
const callbacks = new WeakMap<Element, (isVisible: boolean) => void>();

function getObserver(rootMargin: string) {
  if (!observers.has(rootMargin)) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = callbacks.get(entry.target);
          if (callback) {
            callback(entry.isIntersecting);
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );
    observers.set(rootMargin, observer);
  }
  return observers.get(rootMargin)!;
}

export const VirtualPostWrapper: React.FC<VirtualPostWrapperProps> = React.memo(
  ({ id, gridDensity, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      callbacks.set(el, setIsVisible);
      // Increased preload rootMargin for smoother scrolling
      const observer = getObserver("1500px 0px 1500px 0px"); 
      observer.observe(el);

      return () => {
        observer.unobserve(el);
        callbacks.delete(el);
      };
    }, []);

    const getMinHeight = () => {
      if (gridDensity === "list") return "120px";
      if (gridDensity === "single") return "520px";
      return "340px"; // double
    };

    return (
      <div
        ref={containerRef}
        id={id}
        style={{ minHeight: getMinHeight() }}
        className="w-full"
      >
        {isVisible ? (
          children
        ) : (
          <div
            style={{ height: getMinHeight() }}
            className="w-full bg-m3-surface-low/5 border border-m3-outline-variant/5 rounded-[20px] animate-pulse"
          />
        )}
      </div>
    );
  },
);
