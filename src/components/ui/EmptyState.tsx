import React from "react";
import { motion } from "motion/react";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  illustrationSrc?: string;
  illustrationAlt?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  illustrationSrc,
  illustrationAlt = "Illustration",
  action,
  children,
  className = "",
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    className={`flex flex-col items-center justify-center py-12 md:py-16 text-center text-m3-on-surface-variant max-w-lg mx-auto px-4 ${className}`}
  >
    {illustrationSrc ? (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
        className="mb-6 relative w-full max-w-sm rounded-[24px] overflow-hidden border border-m3-outline-variant/30 bg-m3-surface-low shadow-glass-md group"
      >
        <img
          src={illustrationSrc}
          alt={illustrationAlt}
          referrerPolicy="no-referrer"
          className="w-full h-48 md:h-56 object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-m3-surface/80 via-transparent to-transparent pointer-events-none" />
      </motion.div>
    ) : icon ? (
      <motion.div
        initial={{ scale: 0.8, rotate: -5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
        className="mb-6 bg-m3-surface-low border border-m3-outline-variant/30 shadow-glass-md rounded-[32px] p-6 text-m3-primary"
      >
        {icon}
      </motion.div>
    ) : null}

    <motion.h3
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="text-xl md:text-2xl font-bold font-display text-m3-on-surface mb-2 tracking-tight"
    >
      {title}
    </motion.h3>

    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="text-xs md:text-sm text-m3-on-surface-variant/90 leading-relaxed max-w-md mx-auto mb-6"
    >
      {message}
    </motion.p>

    {action && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
      >
        {action}
      </motion.div>
    )}

    {children}
  </motion.div>
);

