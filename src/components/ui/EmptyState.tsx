import React from "react";
import { motion } from "motion/react";

interface EmptyStateProps {
  title: string;
  message: string;
  icon: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    className="flex flex-col items-center justify-center py-24 text-center text-m3-on-surface-variant max-w-md mx-auto"
  >
    <motion.div 
      initial={{ scale: 0.8, rotate: -5 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
      className="mb-6 bg-m3-surface-low border border-m3-outline-variant/30 shadow-glass-md rounded-[32px] p-8 text-m3-primary"
    >
      {icon}
    </motion.div>
    <motion.h3 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="text-2xl font-bold font-display text-m3-on-surface mb-3"
    >
      {title}
    </motion.h3>
    <motion.p 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="text-sm leading-relaxed max-w-sm"
    >
      {message}
    </motion.p>
  </motion.div>
);
