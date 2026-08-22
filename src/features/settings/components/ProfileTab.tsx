import React from "react";
import { User, Camera, Trash2, Mail, CheckCircle2, Shield, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { triggerVibration } from "../../../lib/vibrate";

interface ProfileTabProps {
  displayName: string;
  setDisplayName: (val: string) => void;
  username: string;
  setUsername: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  avatarUrl: string;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  avatarInputRef: React.RefObject<HTMLInputElement>;
  postsCount: number;
  onSaveProfile: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = React.memo(({
  displayName,
  setDisplayName,
  username,
  setUsername,
  email,
  setEmail,
  avatarUrl,
  onAvatarUpload,
  onRemoveAvatar,
  isEditing,
  setIsEditing,
  avatarInputRef,
  postsCount,
  onSaveProfile,
}) => {
  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[24px] p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 text-m3-primary/5 pointer-events-none">
          <User size={120} />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar Area */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-full border-2 border-m3-primary/20 overflow-hidden bg-m3-surface flex items-center justify-center text-m3-primary text-2xl font-bold font-display shadow-sm">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{(displayName || "C").charAt(0).toUpperCase()}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                triggerVibration("light");
                avatarInputRef.current?.click();
              }}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-m3-primary text-m3-on-primary shadow-md hover:scale-105 transition-transform cursor-pointer"
              title="Upload new avatar"
            >
              <Camera size={14} />
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={onAvatarUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Details & Actions */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold font-display text-m3-on-surface flex items-center justify-center sm:justify-start gap-2">
                  <span>{displayName || "Curator"}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-m3-primary/10 text-m3-primary border border-m3-primary/20">
                    Verified Curator
                  </span>
                </h2>
                <p className="text-xs text-m3-on-surface-variant font-mono mt-0.5">
                  @{username || "instasorter_curator"}
                </p>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerVibration("medium");
                      onRemoveAvatar();
                    }}
                    className="p-2 rounded-xl border border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                    title="Remove custom avatar"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Reset Avatar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    triggerVibration("light");
                    if (isEditing) {
                      onSaveProfile();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${
                    isEditing
                      ? "bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90"
                      : "bg-m3-surface border border-m3-outline-variant/40 text-m3-on-surface hover:border-m3-primary"
                  }`}
                >
                  {isEditing ? "Save Changes" : "Edit Details"}
                </button>
              </div>
            </div>

            {/* Stats Row */}
            <div className="pt-3 flex items-center justify-center sm:justify-start gap-6 border-t border-m3-outline-variant/15 text-xs text-m3-on-surface-variant font-mono">
              <div>
                <span className="font-bold text-m3-on-surface font-display text-sm">{postsCount}</span>
                <span className="ml-1 text-[11px]">Saved Items</span>
              </div>
              <div className="h-3 w-[1px] bg-m3-outline-variant/30" />
              <div>
                <span className="font-bold text-m3-on-surface font-display text-sm">IndexedDB</span>
                <span className="ml-1 text-[11px]">Storage Engine</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface flex items-center gap-2">
          <Shield size={14} className="text-m3-primary" />
          <span>Curator Identity Settings</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Display Name
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary disabled:opacity-75 font-sans"
              placeholder="e.g. Alex Morgan"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Instagram Handle
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-outline text-xs font-mono">
                @
              </span>
              <input
                type="text"
                disabled={!isEditing}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary disabled:opacity-75 font-mono"
                placeholder="username"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-m3-on-surface-variant mb-1">
              Notification Email
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-outline" />
              <input
                type="email"
                disabled={!isEditing}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-m3-surface border border-m3-outline-variant/30 text-xs text-m3-on-surface focus:outline-none focus:ring-1 focus:ring-m3-primary disabled:opacity-75 font-sans"
                placeholder="curator@instasorter.app"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
