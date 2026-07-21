import React from "react";
import { User, Database, Heart, Hash, Edit2, Save } from "lucide-react";

interface ProfileTabProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  username: string;
  setUsername: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  handleSaveProfile: () => void;
  totalPosts: number;
  activeCount: number;
  archivedCount: number;
  favoritesCount: number;
  uniqueTags: number;
  storageInfo: { usage: number; quota: number; percentage: number } | null;
}

export const ProfileTab: React.FC<ProfileTabProps> = React.memo(({
  displayName,
  setDisplayName,
  username,
  setUsername,
  email,
  setEmail,
  isEditing,
  setIsEditing,
  handleSaveProfile,
  totalPosts,
  activeCount,
  archivedCount,
  favoritesCount,
  uniqueTags,
  storageInfo,
}) => {
  return (
    <div className="space-y-6">
      {/* Curator Profile Card */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 sm:p-6 transition-all duration-300 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          {/* Avatar Display */}
          <div className="w-20 h-20 rounded-full bg-m3-primary/5 border border-m3-outline-variant/30 text-m3-primary flex items-center justify-center font-display font-bold text-2xl shadow-xs shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-m3-primary-container/20" />
            <span className="relative z-10">
              {(displayName || "Curator")
                .split(" ")
                .map((n) => n ? n[0] : "")
                .join("")
                .toUpperCase()
                .substring(0, 2)}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center text-center sm:text-left w-full">
            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                    placeholder="Enter Instagram username"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono font-bold text-m3-outline uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-m3-surface rounded-xl border border-m3-outline-variant focus:outline-none focus:ring-1 focus:ring-m3-primary transition-all font-sans text-m3-on-surface"
                    placeholder="Enter email address"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <h3 className="text-xl font-bold font-display text-m3-on-surface">
                  {displayName || "Curator"}
                </h3>
                {username && (
                  <p className="text-sm font-semibold text-m3-primary">
                    @{username}
                  </p>
                )}
                {email && (
                  <p className="text-xs text-m3-on-surface-variant font-medium mt-1">
                    {email}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-center sm:justify-start">
              {isEditing ? (
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 bg-m3-primary text-m3-on-primary rounded-xl px-5 py-2 text-xs font-bold cursor-pointer hover:bg-m3-primary/95 transition-all shadow-xs active:scale-95"
                >
                  <Save size={12} />
                  <span>Save Changes</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 border border-m3-outline-variant/60 hover:border-m3-primary hover:text-m3-primary bg-m3-surface rounded-xl px-5 py-2 text-xs font-bold cursor-pointer transition-all shadow-2xs active:scale-95"
                >
                  <Edit2 size={11} />
                  <span>Edit Curator Credentials</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics & Quotas Bento Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Posts */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01]">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-m3-outline block">
              Curated Bookmarks
            </span>
            <p className="text-3xl font-extrabold font-display text-m3-on-surface">
              {totalPosts}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-m3-outline-variant/10">
            <div className="flex justify-between text-[11px] text-m3-on-surface-variant font-semibold">
              <span>{activeCount} active items</span>
              <span>{archivedCount} archived</span>
            </div>
            <div className="h-1.5 w-full bg-m3-surface-container rounded-full mt-2 overflow-hidden flex">
              <div
                className="bg-m3-primary h-full"
                style={{ width: `${totalPosts > 0 ? (activeCount / totalPosts) * 100 : 0}%` }}
              />
              <div
                className="bg-m3-outline h-full"
                style={{ width: `${totalPosts > 0 ? (archivedCount / totalPosts) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Starred Favorites */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01]">
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-m3-outline">
                Starred Favorites
              </span>
              <Heart size={16} className="text-rose-500 fill-rose-500/20" />
            </div>
            <p className="text-3xl font-extrabold font-display text-m3-on-surface">
              {favoritesCount}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-m3-outline-variant/10 text-xs text-m3-on-surface-variant font-medium">
            Starred items occupy <span className="font-bold text-m3-primary">{totalPosts > 0 ? Math.round((favoritesCount / totalPosts) * 100) : 0}%</span> of your entire saved library.
          </div>
        </div>

        {/* Tag Taxonomy */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01]">
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-m3-outline">
                Tag Taxonomy
              </span>
              <Hash size={16} className="text-m3-outline" />
            </div>
            <p className="text-3xl font-extrabold font-display text-m3-on-surface">
              {uniqueTags}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-m3-outline-variant/10 text-xs text-m3-on-surface-variant font-medium">
            Categorized index categories mapped dynamically to bookmarks.
          </div>
        </div>

        {/* Local Storage Quota */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-5 flex flex-col justify-between shadow-xs transition-all duration-300 hover:scale-[1.01]">
          <div className="space-y-1">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-m3-outline">
                Local Storage Limit
              </span>
              <Database size={16} className="text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold font-display text-m3-on-surface">
              {storageInfo ? (storageInfo.usage / (1024 * 1024)).toFixed(1) : "0.0"}{" "}
              <span className="text-base font-bold font-sans text-m3-on-surface-variant">MB</span>
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-m3-outline-variant/10">
            <div className="flex justify-between text-[11px] text-m3-on-surface-variant font-semibold">
              <span>Used of {storageInfo ? (storageInfo.quota / (1024 * 1024 * 1024)).toFixed(1) : "10.0"} GB Quota</span>
              <span>{storageInfo ? storageInfo.percentage.toFixed(2) : "0.00"}%</span>
            </div>
            <div className="h-1.5 w-full bg-m3-surface-container rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${storageInfo ? storageInfo.percentage : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

