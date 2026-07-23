import { Post } from "../types/post";

export interface MemoryCapsuleGroup {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  posts: Post[];
  coverPost?: Post;
  periodType: "on_this_day" | "dormant" | "first_saved" | "season_capsule";
}

export interface ForgottenGemsAnalysis {
  onThisDayPosts: Post[];
  dormantGems: Post[];
  oldestPosts: Post[];
  capsuleGroups: MemoryCapsuleGroup[];
  totalBuriedCount: number;
}

/**
 * Calculates days passed since a given ISO date string.
 */
export function getDaysAgo(isoDate: string): number {
  if (!isoDate) return 0;
  const postDate = new Date(isoDate).getTime();
  const now = Date.now();
  if (isNaN(postDate)) return 0;
  return Math.max(0, Math.floor((now - postDate) / (1000 * 60 * 60 * 24)));
}

/**
 * Analyzes the post library to uncover forgotten gems, historical anniversaries, and dormant posts.
 */
export function analyzeForgottenGems(posts: Post[]): ForgottenGemsAnalysis {
  if (!posts || posts.length === 0) {
    return {
      onThisDayPosts: [],
      dormantGems: [],
      oldestPosts: [],
      capsuleGroups: [],
      totalBuriedCount: 0,
    };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  // 1. On This Day Posts (saved on same day/month in past years OR same day of month >2 months ago)
  const onThisDayPosts = posts.filter((p) => {
    if (!p.savedAt) return false;
    const d = new Date(p.savedAt);
    if (isNaN(d.getTime())) return false;

    const daysAgo = getDaysAgo(p.savedAt);
    if (daysAgo < 14) return false; // Ignore very recent

    const sameMonthDay = d.getMonth() === currentMonth && Math.abs(d.getDate() - currentDay) <= 2;
    const sameDayOfMonth = d.getDate() === currentDay && daysAgo >= 30;

    return sameMonthDay || sameDayOfMonth;
  });

  // 2. Dormant Gems: Saved > 30 days ago, no notes, not favorited, not archived
  const dormantGems = posts.filter((p) => {
    if (p.isArchived || p.isFavorite) return false;
    if (p.notes && p.notes.trim().length > 0) return false;
    const daysAgo = getDaysAgo(p.savedAt);
    return daysAgo >= 30;
  }).sort((a, b) => getDaysAgo(b.savedAt) - getDaysAgo(a.savedAt));

  // 3. Oldest Posts in collection
  const oldestPosts = [...posts]
    .filter((p) => !p.isArchived)
    .sort((a, b) => {
      const timeA = new Date(a.savedAt).getTime() || 0;
      const timeB = new Date(b.savedAt).getTime() || 0;
      return timeA - timeB;
    })
    .slice(0, 15);

  // Build Capsule Groups
  const capsuleGroups: MemoryCapsuleGroup[] = [];

  if (onThisDayPosts.length > 0) {
    capsuleGroups.push({
      id: "on_this_day_group",
      title: "On This Day Memory Reel",
      subtitle: "Saved on this time of the month in past memory logs",
      badgeText: "Nostalgia Matching",
      posts: onThisDayPosts,
      coverPost: onThisDayPosts[0],
      periodType: "on_this_day",
    });
  }

  if (dormantGems.length > 0) {
    capsuleGroups.push({
      id: "dormant_gems_group",
      title: "Dormant Vault Treasures",
      subtitle: "Saved over 30 days ago with 0 notes added — time to rediscover!",
      badgeText: `${dormantGems.length} Buried Posts`,
      posts: dormantGems.slice(0, 20),
      coverPost: dormantGems[0],
      periodType: "dormant",
    });
  }

  if (oldestPosts.length > 0) {
    capsuleGroups.push({
      id: "first_saved_group",
      title: "The Genesis Vault",
      subtitle: "The very first saved inspirations that started your collection",
      badgeText: "Time Machine",
      posts: oldestPosts,
      coverPost: oldestPosts[0],
      periodType: "first_saved",
    });
  }

  return {
    onThisDayPosts,
    dormantGems,
    oldestPosts,
    capsuleGroups,
    totalBuriedCount: dormantGems.length + onThisDayPosts.length,
  };
}

/**
 * Selects a random forgotten post from dormant gems or library.
 */
export function getRandomForgottenGem(posts: Post[]): Post | null {
  if (!posts || posts.length === 0) return null;
  const candidates = posts.filter((p) => !p.isArchived);
  if (candidates.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

/**
 * Audio Synthesizer helper for Retro Slide Clicks & Lo-fi Vinyl Hiss.
 */
class RetroAudioSynthesizer {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playSlideClick() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {
      // Audio fallback silent
    }
  }

  playShutterSound() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      // Mechanical shutter noise
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
    } catch (e) {
      // Audio fallback
    }
  }
}

export const retroAudio = new RetroAudioSynthesizer();
