import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  User,
  Database,
  Trash2,
  Layers,
  ShieldAlert,
  Sliders,
  Sparkles,
  HardDrive,
  Compass,
  Cpu,
  Keyboard,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";
import { usePostStore } from "../../store/useStore";
import { db } from "../../lib/db";
import { triggerVibration } from "../../lib/vibrate";
import { VOCABULARY } from "../../constants/vocabulary";
import { ProfileTab } from "./components/ProfileTab";
import { AppearanceTab } from "./components/AppearanceTab";
import { KeyboardShortcutsTab } from "./components/KeyboardShortcutsTab";
import { StorageIndicator } from "./components/StorageIndicator";

interface SettingsViewProps {
  onNavigate?: (view: "home" | "grouped" | "analytics" | "settings") => void;
  onSelectCollection?: (collection: string) => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
}

interface SettingSectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

const SettingSectionHeader: React.FC<SettingSectionHeaderProps> = ({
  icon,
  title,
  subtitle,
  action,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/30">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold font-display text-m3-on-surface uppercase tracking-wider">
          {title}
        </h2>
        <p className="text-[11px] text-m3-on-surface-variant mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

interface UnifiedSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
}

const UnifiedSwitch: React.FC<UnifiedSwitchProps> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? "bg-m3-primary" : "bg-m3-outline-variant"
    }`}
  >
    <motion.span
      className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-m3-surface shadow-xs ring-0"
      animate={{ x: checked ? 20 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  </button>
);

export const SettingsView = React.memo(
  ({
    onNavigate,
    theme = "light",
    onThemeToggle,
  }: SettingsViewProps) => {
    const t = VOCABULARY.settings;
    const posts = usePostStore((state) => state.posts);
    const setPosts = usePostStore((state) => state.setPosts);
    const isBackgroundOrganizerEnabled = usePostStore((state) => state.isBackgroundOrganizerEnabled);
    const setIsBackgroundOrganizerEnabled = usePostStore((state) => state.setIsBackgroundOrganizerEnabled);

    type SettingsTab = "general" | "appearance" | "data";
    const [activeTab, setActiveTab] = useState<SettingsTab>("general");

    // Profile Details
    const [displayName, setDisplayName] = useState(
      () => localStorage.getItem("instasorter_displayName") || "Curator",
    );
    const [username, setUsername] = useState(
      () => localStorage.getItem("instasorter_username") || "",
    );
    const [email, setEmail] = useState(
      () => localStorage.getItem("instasorter_email") || "",
    );
    const [avatarUrl, setAvatarUrl] = useState<string>(
      () => localStorage.getItem("instasorter_avatarUrl") || "",
    );
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Appearance Preferences
    const [animationsEnabled, setAnimationsEnabled] = useState(
      () => localStorage.getItem("instasorter_animations") !== "false",
    );
    const [compactMode, setCompactMode] = useState(
      () => localStorage.getItem("instasorter_compact") === "true",
    );

    // Collapsible Keyboard Guide
    const [isKeyboardGuideExpanded, setIsKeyboardGuideExpanded] = useState(false);

    // Danger Zone States
    const [dangerCheck1, setDangerCheck1] = useState(false);
    const [dangerCheck2, setDangerCheck2] = useState(false);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [showConfirmClearAll, setShowConfirmClearAll] = useState(false);

    // Reset checkboxes when tab changes
    useEffect(() => {
      setDangerCheck1(false);
      setDangerCheck2(false);
    }, [activeTab]);

    const handleSetAnimationsEnabled = useCallback((val: boolean) => {
      triggerVibration("light");
      setAnimationsEnabled(val);
      localStorage.setItem("instasorter_animations", val.toString());
      toast.success(val ? "Motion animations enabled." : "Motion animations disabled.");
    }, []);

    const handleSetCompactMode = useCallback((val: boolean) => {
      triggerVibration("light");
      setCompactMode(val);
      localStorage.setItem("instasorter_compact", val.toString());
      toast.success(val ? "Compact grid density enabled." : "Standard grid density restored.");
    }, []);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          toast.error("Avatar image size must be under 2MB");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = event.target?.result as string;
          if (res) {
            setAvatarUrl(res);
            localStorage.setItem("instasorter_avatarUrl", res);
            toast.success("Profile avatar updated successfully!");
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const handleRemoveAvatar = () => {
      setAvatarUrl("");
      localStorage.removeItem("instasorter_avatarUrl");
      toast.success("Profile avatar reset to initials.");
    };

    const handleSaveProfile = useCallback(() => {
      localStorage.setItem("instasorter_displayName", displayName);
      localStorage.setItem("instasorter_username", username);
      localStorage.setItem("instasorter_email", email);
      setIsEditing(false);
      toast.success("Profile details updated successfully!");
    }, [displayName, username, email]);

    // Data Exports
    const exportData = () => {
      if (posts.length === 0) {
        toast.error("No posts to export!");
        return;
      }
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(posts, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute(
        "download",
        `instasorter_backup_${new Date().toISOString().split("T")[0]}.json`,
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      toast.success("JSON backup downloaded successfully!");
    };

    const exportCSVData = () => {
      if (posts.length === 0) {
        toast.error("No posts to export as CSV!");
        return;
      }

      const escapeCSV = (val: any): string => {
        if (val === undefined || val === null) return "";
        let str = "";
        if (Array.isArray(val)) {
          str = val.join(";");
        } else {
          str = String(val);
        }
        const needsQuotes =
          str.includes(",") ||
          str.includes('"') ||
          str.includes("\n") ||
          str.includes("\r");
        if (needsQuotes) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const headers = [
        "ID",
        "Post URL",
        "Creator Username",
        "Creator Name",
        "Caption",
        "Media Type",
        "Saved At",
        "Hashtags",
        "Tags",
        "Collections",
        "Is Favorite",
        "Is Archived",
        "Read Later",
        "Is Reel",
        "Notes",
        "Location",
        "Instagram Likes",
      ];

      const csvRows = [headers.join(",")];

      posts.forEach((post) => {
        const row = [
          escapeCSV(post.id),
          escapeCSV(post.postUrl),
          escapeCSV(post.creatorUsername),
          escapeCSV(post.creatorName),
          escapeCSV(post.caption),
          escapeCSV(post.mediaType),
          escapeCSV(post.savedAt),
          escapeCSV(post.hashtags),
          escapeCSV(post.tags),
          escapeCSV(post.collections),
          escapeCSV(post.isFavorite),
          escapeCSV(post.isArchived),
          escapeCSV(post.readLater),
          escapeCSV(post.isReel),
          escapeCSV(post.notes),
          escapeCSV(post.location),
          escapeCSV(post.instagramLikes),
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = "\ufeff" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute(
        "download",
        `instasorter_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV spreadsheet exported successfully!");
    };

    // Danger Zone Handlers
    const handleClearAllPosts = useCallback(async () => {
      try {
        triggerVibration("warning");
        await Promise.all([db.posts.clear(), db.collections.clear()]);
        setPosts([]);
        setShowConfirmClear(false);
        toast.success("All saved posts and collections cleared.");
      } catch (err) {
        console.error(err);
        toast.error("Failed to clear library. Please try again.");
      }
    }, [setPosts]);

    const handleClearAllData = useCallback(async () => {
      try {
        triggerVibration("warning");
        await Promise.all([db.posts.clear(), db.collections.clear()]);
        setPosts([]);
        localStorage.clear();
        setShowConfirmClearAll(false);
        toast.success("All local data reset. Reloading application...");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error(err);
        toast.error("Failed to reset application data.");
      }
    }, [setPosts]);

    const tabsList: {
      id: SettingsTab;
      label: string;
      icon: React.ReactNode;
    }[] = [
      { id: "general", label: "General", icon: <User size={16} /> },
      { id: "appearance", label: "Appearance", icon: <Sliders size={16} /> },
      { id: "data", label: "Data", icon: <Database size={16} /> },
    ];

    return (
      <div className="flex-1 bg-m3-surface select-none flex flex-col min-h-0 h-full overflow-hidden">
        {/* Streamlined Settings Header */}
        <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-xs z-10 shrink-0 flex flex-col">
          <div className="px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
                <Sliders size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold font-display tracking-tight text-m3-on-surface leading-none truncate">
                  Settings
                </h1>
                <p className="text-[11px] text-m3-on-surface-variant font-sans mt-0.5 truncate">
                  Manage curator identity, visual theme, and offline data backups.
                </p>
              </div>
            </div>

            {/* Quick Export Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerVibration("light");
                  exportData();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-m3-primary text-m3-on-primary text-xs font-bold hover:bg-m3-primary/95 transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                title="Download JSON backup file"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Backup</span>
              </button>
            </div>
          </div>

          {/* Mobile Tab Navigation Pill Bar */}
          <nav
            aria-label="Settings categories"
            className="md:hidden px-4 flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-t border-m3-outline-variant/20 bg-m3-surface-low/50"
          >
            {tabsList.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    triggerVibration("light");
                    setActiveTab(tab.id);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[44px] ${
                    isActive
                      ? "text-m3-primary bg-m3-surface border border-m3-primary/30 shadow-xs font-extrabold"
                      : "text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container/60 border border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* Settings Body: 3-Tab Split Layout */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 h-full overflow-hidden">
          {/* Desktop Left Sidebar */}
          <aside className="hidden md:flex flex-col w-[240px] border-r border-m3-outline-variant/40 bg-m3-surface-low/30 p-5 space-y-4 shrink-0 overflow-y-auto select-none">
            <h2 className="px-2 text-[10px] uppercase tracking-wider font-extrabold text-m3-outline font-mono">
              Categories
            </h2>
            <div className="flex flex-col gap-1.5">
              {tabsList.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      triggerVibration("light");
                      setActiveTab(tab.id);
                    }}
                    className={`group flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border ${
                      isActive
                        ? "bg-m3-primary-container border-m3-primary/25 text-m3-on-primary-container shadow-xs font-extrabold"
                        : "bg-transparent border-transparent text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`transition-transform duration-200 group-hover:scale-110 ${
                          isActive
                            ? "text-m3-on-primary-container"
                            : "text-m3-on-surface-variant"
                        }`}
                      >
                        {tab.icon}
                      </span>
                      <span className="font-sans text-xs">{tab.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Content Pane */}
          <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-8 max-w-4xl w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* 1. GENERAL TAB */}
                {activeTab === "general" && (
                  <div className="space-y-6">
                    {/* Status Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="p-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-2xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                          <HardDrive size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono font-bold text-m3-outline uppercase leading-none">
                            Saved Items
                          </p>
                          <h4 className="text-sm font-extrabold font-display text-m3-on-surface mt-1.5 leading-none">
                            {posts.length} bookmarks
                          </h4>
                        </div>
                      </div>

                      <div className="p-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-2xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono font-bold text-m3-outline uppercase leading-none">
                            Curator Handle
                          </p>
                          <h4 className="text-sm font-extrabold font-display text-m3-on-surface mt-1.5 leading-none truncate max-w-[140px]">
                            {username ? `@${username}` : "Not Set"}
                          </h4>
                        </div>
                      </div>

                      <div className="p-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-2xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                          <Layers size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-mono font-bold text-m3-outline uppercase leading-none">
                            Database Status
                          </p>
                          <h4 className="text-sm font-extrabold font-display text-emerald-600 dark:text-emerald-400 mt-1.5 leading-none">
                            Offline Ready
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* Guided Tour Banner */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15 shrink-0">
                            <Compass size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface font-display">
                              Guided User Tour
                            </h4>
                            <p className="text-[11px] text-m3-on-surface-variant font-sans mt-0.5">
                              Learn how to navigate your curator workspace, import data, and use filters.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerVibration("light");
                            usePostStore.getState().setIsTourOpen(true);
                            if (onNavigate) onNavigate("home");
                          }}
                          className="px-5 py-2.5 bg-m3-primary hover:bg-m3-primary/90 text-m3-on-primary font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 font-sans whitespace-nowrap self-stretch sm:self-auto text-center"
                        >
                          Start Guided Tour
                        </button>
                      </div>
                    </div>

                    {/* Curator Identity Section (Single Source of Truth) */}
                    <section className="space-y-4">
                      <SettingSectionHeader
                        icon={<User size={18} />}
                        title="Curator Profile"
                        subtitle="Manage display name, Instagram username handle, and avatar."
                      />
                      <ProfileTab
                        displayName={displayName}
                        setDisplayName={setDisplayName}
                        username={username}
                        setUsername={setUsername}
                        email={email}
                        setEmail={setEmail}
                        avatarUrl={avatarUrl}
                        onAvatarUpload={handleAvatarUpload}
                        onRemoveAvatar={handleRemoveAvatar}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        avatarInputRef={avatarInputRef}
                        postsCount={posts.length}
                        onSaveProfile={handleSaveProfile}
                      />
                    </section>

                    {/* Smart Auto-Organizer Card */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 shadow-xs">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="p-2.5 rounded-xl bg-m3-primary/10 text-m3-primary border border-m3-primary/20 shrink-0">
                            <Cpu size={18} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2 font-display">
                              <span>Smart Auto-Organizer</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                Auto-categorize
                              </span>
                            </h3>
                            <p className="text-[11px] text-m3-on-surface-variant mt-0.5 font-sans">
                              Automatically categorize unorganized saved posts into smart collections using client-side heuristics.
                            </p>
                          </div>
                        </div>
                        <UnifiedSwitch
                          checked={isBackgroundOrganizerEnabled}
                          onChange={setIsBackgroundOrganizerEnabled}
                          ariaLabel="Toggle smart background auto-organizer"
                        />
                      </div>
                    </div>

                    {/* Keyboard Shortcuts Reference (Collapsible) */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] overflow-hidden shadow-xs">
                      <button
                        type="button"
                        onClick={() => setIsKeyboardGuideExpanded(!isKeyboardGuideExpanded)}
                        className="w-full p-5 sm:p-6 flex items-center justify-between hover:bg-m3-surface-container/30 transition-all cursor-pointer text-left select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-m3-primary/5 text-m3-primary border border-m3-outline-variant/15">
                            <Keyboard size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface font-display">
                              Keyboard Shortcuts Guide
                            </h4>
                            <p className="text-[10px] text-m3-on-surface-variant font-sans">
                              Review quick navigation hotkeys and post selection actions
                            </p>
                          </div>
                        </div>
                        {isKeyboardGuideExpanded ? (
                          <ChevronUp size={16} className="text-m3-outline" />
                        ) : (
                          <ChevronDown size={16} className="text-m3-outline" />
                        )}
                      </button>

                      <AnimatePresence>
                        {isKeyboardGuideExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-m3-outline-variant/20 p-5 sm:p-6 bg-m3-surface/30"
                          >
                            <KeyboardShortcutsTab />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* 2. APPEARANCE TAB */}
                {activeTab === "appearance" && (
                  <section className="space-y-4">
                    <SettingSectionHeader
                      icon={<Sliders size={18} />}
                      title="Appearance Preferences"
                      subtitle="Customize interface theme look-and-feel, layout density, and animations."
                    />
                    <AppearanceTab
                      theme={theme}
                      onThemeToggle={onThemeToggle}
                      animationsEnabled={animationsEnabled}
                      setAnimationsEnabled={handleSetAnimationsEnabled}
                      compactMode={compactMode}
                      setCompactMode={handleSetCompactMode}
                    />
                  </section>
                )}

                {/* 3. DATA TAB */}
                {activeTab === "data" && (
                  <div className="space-y-6">
                    <SettingSectionHeader
                      icon={<Database size={18} />}
                      title="Data & Storage"
                      subtitle="Manage offline browser database storage, backup exports, and reset options."
                    />

                    {/* Storage Indicator & Quota Bar */}
                    <StorageIndicator />

                    {/* Backup & Export Options */}
                    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-m3-outline-variant/15">
                        <div className="p-2 bg-m3-primary/10 text-m3-primary rounded-xl">
                          <Layers size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-m3-on-surface">
                            Export Curation Library
                          </h4>
                          <p className="text-[10px] text-m3-on-surface-variant font-sans">
                            Download your saved items as offline files for external backup or analysis
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-m3-on-surface-variant leading-relaxed font-sans">
                        Export your complete Instagram collection into a standard JSON file or CSV spreadsheet format for spreadsheet software.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerVibration("light");
                            exportData();
                          }}
                          className="py-3 px-4 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary rounded-xl text-xs font-bold text-m3-on-surface transition-all cursor-pointer flex items-center justify-center gap-2 font-sans active:scale-95 shadow-2xs"
                        >
                          <Download size={14} className="text-m3-primary" />
                          <span>Export JSON Backup ({posts.length} items)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerVibration("light");
                            exportCSVData();
                          }}
                          className="py-3 px-4 bg-m3-surface border border-m3-outline-variant/40 hover:border-m3-primary rounded-xl text-xs font-bold text-m3-on-surface transition-all cursor-pointer flex items-center justify-center gap-2 font-sans active:scale-95 shadow-2xs"
                        >
                          <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
                          <span>Export CSV Spreadsheet</span>
                        </button>
                      </div>
                    </div>

                    {/* Danger Zone: Contained at Bottom of Data Tab */}
                    <div className="bg-red-500/[0.02] border-2 border-red-500/15 rounded-[24px] p-6 space-y-6">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold font-display text-red-600 uppercase tracking-wide">
                            Reset & Data Clear
                          </h3>
                          <p className="text-xs text-m3-on-surface-variant mt-1 leading-relaxed font-sans">
                            These operations are permanent. Clearing your library removes all saved bookmarks, collections, notes, and thumbnails stored in your browser.
                          </p>
                        </div>
                      </div>

                      {/* Required confirmation checkboxes */}
                      <div className="p-4 bg-red-500/[0.04] border border-red-500/10 rounded-2xl space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={dangerCheck1}
                            onChange={(e) => setDangerCheck1(e.target.checked)}
                            className="mt-0.5 rounded border-red-500/30 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-m3-on-surface-variant leading-relaxed font-sans">
                            I understand that resetting will permanently delete all saved bookmarks and custom collections.
                          </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={dangerCheck2}
                            onChange={(e) => setDangerCheck2(e.target.checked)}
                            className="mt-0.5 rounded border-red-500/30 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-m3-on-surface-variant leading-relaxed font-sans">
                            I have downloaded an export backup if needed and want to proceed with clearing.
                          </span>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <button
                          type="button"
                          disabled={!dangerCheck1 || !dangerCheck2}
                          onClick={() => {
                            triggerVibration("warning");
                            setShowConfirmClear(true);
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center transition-all cursor-pointer select-none flex items-center justify-center gap-2 font-sans ${
                            dangerCheck1 && dangerCheck2
                              ? "bg-red-600 hover:bg-red-700 text-white shadow-xs active:scale-95"
                              : "bg-m3-outline-variant/30 text-m3-on-surface-variant opacity-60 cursor-not-allowed"
                          }`}
                        >
                          <Trash2 size={14} />
                          <span>Clear Saved Posts</span>
                        </button>

                        <button
                          type="button"
                          disabled={!dangerCheck1 || !dangerCheck2}
                          onClick={() => {
                            triggerVibration("warning");
                            setShowConfirmClearAll(true);
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold text-center transition-all cursor-pointer select-none flex items-center justify-center gap-2 font-sans ${
                            dangerCheck1 && dangerCheck2
                              ? "bg-red-700 hover:bg-red-800 text-white shadow-xs active:scale-95"
                              : "bg-m3-outline-variant/30 text-m3-on-surface-variant opacity-60 cursor-not-allowed"
                          }`}
                        >
                          <ShieldAlert size={14} />
                          <span>Factory Reset & Wipe</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Confirmation Modal for Clearing Database */}
        <AnimatePresence>
          {showConfirmClear && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmClear(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-md w-full p-6 shadow-2xl relative z-10 space-y-5"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-lg font-bold font-display text-m3-on-surface">
                      Clear Saved Posts?
                    </h3>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed font-sans">
                      All saved bookmarks and collections in your browser database will be permanently deleted. This action cannot be reversed.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                  <button
                    onClick={() => setShowConfirmClear(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container cursor-pointer transition-colors text-center font-sans active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllPosts}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xs text-center font-sans cursor-pointer active:scale-95"
                  >
                    Clear All Posts
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Confirmation Modal for Hard Reset */}
        <AnimatePresence>
          {showConfirmClearAll && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmClearAll(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-m3-surface rounded-3xl border border-m3-outline-variant max-w-md w-full p-6 shadow-2xl relative z-10 space-y-5"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-lg font-bold font-display text-m3-on-surface">
                      Factory Reset & Wipe All?
                    </h3>
                    <p className="text-xs text-m3-on-surface-variant leading-relaxed font-sans">
                      This will wipe all bookmark records from IndexedDB and reset all user preferences and local storage settings. The application will restart from clean defaults.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
                  <button
                    onClick={() => setShowConfirmClearAll(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container cursor-pointer transition-colors text-center font-sans active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllData}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-xs text-center font-sans cursor-pointer active:scale-95"
                  >
                    Wipe Everything & Reload
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
