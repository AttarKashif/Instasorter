import React from "react";
import { motion } from "motion/react";

export const EmptyLibraryIllustration: React.FC = () => {
  return (
    <motion.svg
      width="240"
      height="180"
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[240px] mx-auto text-m3-primary/30 dark:text-m3-primary/20"
      id="svg-empty-library"
      initial="initial"
      animate="animate"
    >
      {/* Background soft ambient circle - pulses gently */}
      <motion.circle
        cx="120"
        cy="90"
        r="75"
        fill="currentColor"
        opacity="0.15"
        animate={{
          scale: [0.95, 1.05, 0.95],
          opacity: [0.12, 0.18, 0.12]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Decorative dashed spiral orbital - rotates slowly */}
      <motion.circle
        cx="120"
        cy="90"
        r="60"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        opacity="0.4"
        animate={{
          rotate: 360
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ originX: "120px", originY: "90px" }}
      />

      {/* Modern Studio Frame 1 - scales in on load */}
      <motion.rect
        x="65"
        y="45"
        width="110"
        height="85"
        rx="16"
        fill="var(--m3-surface)"
        stroke="currentColor"
        strokeWidth="2"
        className="shadow-sm"
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ originX: "120px", originY: "90px" }}
      />
      
      {/* Frame grid dots */}
      <g>
        <circle cx="95" cy="70" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="115" cy="70" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="135" cy="70" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="155" cy="70" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="95" cy="90" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="115" cy="90" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="135" cy="90" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="155" cy="90" r="2" fill="currentColor" opacity="0.3" />
      </g>

      {/* Main overlapping Polaroid-style media card - floats up and down */}
      <motion.g
        initial={{ opacity: 0, rotate: -5, y: 15 }}
        animate={{ 
          opacity: 1, 
          rotate: [0, 2, -2, 0],
          y: [0, -6, 2, 0]
        }}
        transition={{
          y: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          },
          rotate: {
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut"
          },
          opacity: { duration: 0.8, ease: "easeOut" }
        }}
        style={{ originX: "125px", originY: "95px" }}
        whileHover={{ scale: 1.05, rotate: 3 }}
      >
        <rect
          x="85"
          y="55"
          width="80"
          height="80"
          rx="12"
          fill="var(--m3-surface)"
          stroke="var(--m3-on-surface)"
          strokeWidth="2"
          strokeOpacity="0.8"
        />
        {/* Photo outline inside the card */}
        <rect
          x="93"
          y="63"
          width="64"
          height="50"
          rx="8"
          fill="currentColor"
          opacity="0.08"
        />
        {/* Landscape mountains placeholder */}
        <path
          d="M93 113 L110 93 L125 107 L140 88 L157 113 Z"
          fill="currentColor"
          opacity="0.25"
        />
        <circle cx="140" cy="75" r="4" fill="currentColor" opacity="0.3" />
        {/* Polaroid bottom line */}
        <line
          x1="105"
          y1="123"
          x2="145"
          y2="123"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </motion.g>

      {/* Floating minimalist Sparkles - twinkle individually */}
      <g className="text-amber-500 dark:text-amber-400">
        <motion.path
          d="M190 40 L193 47 L200 50 L193 53 L190 60 L187 53 L180 50 L187 47 Z"
          fill="currentColor"
          animate={{
            scale: [0.6, 1.2, 0.6],
            opacity: [0.4, 1, 0.4]
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ originX: "190px", originY: "50px" }}
        />
        <motion.path
          d="M45 110 L47 114 L51 116 L47 118 L45 122 L43 118 L39 116 L43 114 Z"
          fill="currentColor"
          animate={{
            scale: [1, 0.5, 1],
            opacity: [0.8, 0.3, 0.8]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
          style={{ originX: "45px", originY: "116px" }}
        />
        <motion.path
          d="M205 115 L206 118 L209 119 L206 120 L205 123 L204 120 L201 119 L204 118 Z"
          fill="currentColor"
          animate={{
            scale: [0.5, 1, 0.5],
            opacity: [0.2, 0.9, 0.2]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          style={{ originX: "205px", originY: "119px" }}
        />
      </g>

      {/* Abstract camera / capture lens overlay - floats in counter-phase */}
      <motion.g
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          y: [0, 4, -4, 0]
        }}
        transition={{
          y: {
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          },
          opacity: { duration: 0.7, delay: 0.2 },
          scale: { duration: 0.7, delay: 0.2 }
        }}
        style={{ originX: "165px", originY: "115px" }}
        whileHover={{ scale: 1.1, rotate: -5 }}
      >
        <circle
          cx="165"
          cy="115"
          r="22"
          fill="var(--m3-surface)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="165"
          cy="115"
          r="16"
          fill="currentColor"
          opacity="0.1"
        />
        <circle
          cx="165"
          cy="115"
          r="11"
          fill="var(--m3-surface)"
          stroke="var(--m3-on-surface)"
          strokeWidth="2.5"
        />
        <circle
          cx="169"
          cy="111"
          r="2.5"
          fill="var(--m3-on-surface)"
        />
      </motion.g>
    </motion.svg>
  );
};

export const EmptyFilterIllustration: React.FC = () => {
  return (
    <motion.svg
      width="240"
      height="180"
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[240px] mx-auto text-m3-primary/30 dark:text-m3-primary/20"
      id="svg-empty-filter"
      initial="initial"
      animate="animate"
    >
      {/* Background soft ambient circle */}
      <motion.circle
        cx="120"
        cy="90"
        r="75"
        fill="currentColor"
        opacity="0.15"
        animate={{
          scale: [0.98, 1.04, 0.98],
          opacity: [0.13, 0.18, 0.13]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Decorative concentric dashed ring */}
      <motion.circle
        cx="120"
        cy="90"
        r="55"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        opacity="0.4"
        animate={{
          rotate: -360
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ originX: "120px", originY: "90px" }}
      />

      {/* Background empty card stack */}
      <motion.rect
        x="60"
        y="65"
        width="100"
        height="50"
        rx="10"
        fill="var(--m3-surface)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.5"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 0.5, x: 0 }}
        transition={{ duration: 0.5 }}
      />
      <motion.rect
        x="70"
        y="55"
        width="100"
        height="50"
        rx="10"
        fill="var(--m3-surface)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
        opacity="0.7"
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 0.7, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      />

      {/* Main Front Empty Card */}
      <motion.rect
        x="80"
        y="45"
        width="100"
        height="50"
        rx="10"
        fill="var(--m3-surface)"
        stroke="currentColor"
        strokeWidth="2"
        className="shadow-sm"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ originX: "130px", originY: "70px" }}
      />

      {/* Empty Card Content Lines (Dashed/Empty) */}
      <g>
        <line
          x1="95"
          y1="58"
          x2="135"
          y2="58"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
        <line
          x1="95"
          y1="68"
          x2="155"
          y2="68"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.25"
        />
        <line
          x1="95"
          y1="78"
          x2="120"
          y2="78"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.15"
        />
      </g>

      {/* Beautiful Magnifying Glass */}
      <motion.g
        initial={{ opacity: 0, rotate: -10, scale: 0.8, x: 10, y: 10 }}
        animate={{ 
          opacity: 1, 
          rotate: [0, -3, 3, 0],
          x: [0, 4, -2, 0],
          y: [0, -4, 2, 0]
        }}
        transition={{
          x: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          },
          y: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut"
          },
          rotate: {
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          },
          opacity: { duration: 0.7, delay: 0.3, ease: "easeOut" },
          scale: { duration: 0.7, delay: 0.3, ease: "easeOut" }
        }}
        style={{ originX: "128px", originY: "98px" }}
        whileHover={{ scale: 1.08, rotate: 5 }}
      >
        {/* Handle */}
        <path
          d="M152 122 L178 148"
          stroke="var(--m3-on-surface)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Handle metal cap */}
        <line
          x1="151"
          y1="121"
          x2="155"
          y2="125"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Glass lens rim */}
        <circle
          cx="128"
          cy="98"
          r="26"
          fill="var(--m3-surface)"
          stroke="var(--m3-on-surface)"
          strokeWidth="3.5"
        />
        {/* Inner lens reflection shine */}
        <circle
          cx="128"
          cy="98"
          r="21"
          fill="currentColor"
          opacity="0.08"
        />
        {/* Beautiful high-end lens shine path */}
        <path
          d="M116 88 A18 18 0 0 1 140 88"
          stroke="var(--m3-on-surface)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
        {/* Center tiny empty cross / "X" to symbolize "no results" - pulses gently */}
        <motion.path
          d="M123 93 L133 103"
          stroke="var(--m3-on-surface)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M133 93 L123 103"
          stroke="var(--m3-on-surface)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.g>

      {/* Extra floating sparkles */}
      <g className="text-emerald-500 dark:text-emerald-400">
        <motion.path
          d="M40 50 L42 53 L45 54 L42 55 L40 58 L38 55 L35 54 L38 53 Z"
          fill="currentColor"
          animate={{
            scale: [0.7, 1.3, 0.7],
            opacity: [0.3, 0.9, 0.3]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ originX: "40px", originY: "54px" }}
        />
        <motion.path
          d="M185 75 L186 77 L188 78 L186 79 L185 81 L184 79 L182 78 L184 77 Z"
          fill="currentColor"
          animate={{
            scale: [1, 0.6, 1],
            opacity: [0.6, 0.2, 0.6]
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.4
          }}
          style={{ originX: "185px", originY: "78px" }}
        />
      </g>
    </motion.svg>
  );
};
