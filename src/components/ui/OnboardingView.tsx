import React, { useState } from "react";
import { motion } from "motion/react";
import { User, Mail, Instagram, Shield, HelpCircle, ArrowRight, Library } from "lucide-react";

interface OnboardingViewProps {
  onComplete: (data: {
    displayName: string;
    username: string;
    email: string;
    loadSamples: boolean;
  }) => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loadSamples, setLoadSamples] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = displayName.trim();
    const cleanUser = username.trim().replace(/^@/, "");
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please provide your Display Name.");
      return;
    }

    // Basic email validation if provided
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
    }

    onComplete({
      displayName: cleanName,
      username: cleanUser,
      email: cleanEmail,
      loadSamples,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#f1f5f9]/80 dark:bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-xl bg-m3-surface border border-m3-outline-variant/30 rounded-[28px] p-6 sm:p-8 shadow-glass-lg relative overflow-hidden flex flex-col gap-6"
        id="onboarding-container"
      >
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-m3-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-m3-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-m3-primary/5 border border-m3-outline-variant/30 text-m3-primary mb-2">
            <Library size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-m3-on-surface">
            Welcome to Instasorter
          </h1>
          <p className="text-xs sm:text-sm text-m3-on-surface-variant font-medium max-w-md mx-auto leading-relaxed">
            Your private, offline-first Instagram archive and curation studio. Setup your curator credentials to begin.
          </p>
        </div>

        {/* Onboarding Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold leading-relaxed"
            >
              {error}
            </motion.div>
          )}

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider">
              Display Name / Curator Name
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-outline">
                <User size={16} />
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Alex Johnson"
                className="w-full pl-10 pr-4 py-3 text-sm bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface placeholder:text-m3-outline"
                required
              />
            </div>
          </div>

          {/* Instagram Handle */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider">
              Instagram Handle
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-outline">
                <Instagram size={16} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., alex_curates"
                className="w-full pl-10 pr-4 py-3 text-sm bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface placeholder:text-m3-outline"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-outline">
                <Mail size={16} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g., alex@johnson.com"
                className="w-full pl-10 pr-4 py-3 text-sm bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface placeholder:text-m3-outline"
              />
            </div>
          </div>

          {/* Consent / Security Notice */}
          <div className="flex items-center gap-2 text-[10px] text-m3-outline font-semibold">
            <Shield size={12} className="shrink-0" />
            <span>All credentials and post records are stored strictly offline in your browser.</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-m3-primary text-m3-on-primary rounded-xl py-3 text-sm font-bold hover:bg-m3-primary/95 transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <span>Begin Curation Studio</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  );
};
