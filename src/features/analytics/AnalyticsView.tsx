import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import {
  PieChart as PieIcon,
  Hash,
  Image as ImageIcon,
  Sparkles,
  Heart,
  TrendingUp,
  Calendar,
  MousePointerClick,
  ChevronRight,
  ArrowLeft,
  Users,
} from "lucide-react";
import { Post } from "../../types/post";
import { usePostStore } from "../../store/useStore";
import { VOCABULARY } from "../../constants/vocabulary";
import { CalendarHeatmap } from "../../components/ui/CalendarHeatmap";

interface AnalyticsViewProps {
  posts: Post[];
  onNavigate: (view: "home" | "grouped" | "analytics" | "settings") => void;
  setCreatorFilter: (creator: string) => void;
  setInitialSelectedCollections: (cols: string[]) => void;
  setInitialSelectedTags: (tags: string[]) => void;
  setInitialFilterMediaType: (type: string) => void;
  setInitialFilterFavoriteOnly: (fav: boolean) => void;
  setInitialFilterArchived: (arch: "all" | "active" | "archived") => void;
  setInitialStartDate: (date: string) => void;
  setInitialEndDate: (date: string) => void;
  setInitialSortBy: (sortBy: string) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-m3-surface/95 border border-m3-outline-variant/40 backdrop-blur-md p-3 rounded-2xl shadow-glass-md select-none">
        <p className="text-[10px] font-bold font-mono text-m3-on-surface-variant/75 uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-m3-primary" />
          <span className="text-xs font-bold text-m3-on-surface font-display">
            {payload[0].value} Saved
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const DonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-m3-surface/95 border border-m3-outline-variant/40 backdrop-blur-md p-3 rounded-2xl shadow-glass-md select-none">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="text-xs font-bold text-m3-on-surface font-display">
            {data.name}
          </span>
        </div>
        <p className="text-[11px] font-sans text-m3-on-surface-variant">
          <span className="font-bold text-m3-on-surface">{data.value}</span> items
        </p>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-m3-surface/95 border border-m3-outline-variant/40 backdrop-blur-md p-3 rounded-2xl shadow-glass-md select-none">
        <p className="text-[10px] font-bold font-mono text-m3-on-surface-variant/75 uppercase tracking-wider mb-1">
          {data.name}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-m3-primary" />
          <span className="text-xs font-bold text-m3-on-surface font-display">
            {data.value} items
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = React.memo(
  ({
    posts,
    onNavigate,
    setCreatorFilter,
    setInitialSelectedCollections,
    setInitialSelectedTags,
    setInitialFilterMediaType,
    setInitialFilterFavoriteOnly,
    setInitialFilterArchived,
    setInitialStartDate,
    setInitialEndDate,
    setInitialSortBy,
  }) => {
    const t = VOCABULARY.analytics;

    const [trendTab, setTrendTab] = useState<"timeline" | "monthly">("timeline");
    const [distributionTab, setDistributionTab] = useState<"formats" | "tags" | "creators">("formats");
    const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false);

    // Helper to get two initials from username
    const getInitials = (username: string) => {
      if (!username) return "??";
      const clean = username.replace(/[^a-zA-Z0-9]/g, "");
      return clean.slice(0, 2).toUpperCase();
    };

    // 1. Calculate General Stats
    const stats = useMemo(() => {
      const total = posts.length;
      const favorites = posts.filter((p) => p.isFavorite).length;
      const archived = posts.filter((p) => p.isArchived).length;

      const uniqueTags = new Set<string>();
      const uniqueCollections = new Set<string>();
      let totalComments = 0;

      posts.forEach((p) => {
        p.tags?.forEach((tag) => uniqueTags.add(tag));
        p.collections?.forEach((c) => uniqueCollections.add(c));
        totalComments += p.comments?.length || 0;
      });

      const avgComments =
        total > 0 ? Math.round((totalComments / total) * 10) / 10 : 0.0;

      return {
        total,
        favorites,
        favoritePercentage:
          total > 0 ? Math.round((favorites / total) * 100) : 0,
        archivedPercentage:
          total > 0 ? Math.round((archived / total) * 100) : 0,
        tagsCount: uniqueTags.size,
        collectionsCount: uniqueCollections.size,
        avgComments,
      };
    }, [posts]);

    // 2. Timeline Trend Data (Group posts by Month-Year)
    const timelineData = useMemo(() => {
      const counts: Record<string, number> = {};
      const sortedPosts = [...posts].sort(
        (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
      );

      sortedPosts.forEach((p) => {
        if (!p.savedAt) return;
        const d = new Date(p.savedAt);
        if (isNaN(d.getTime())) return;

        // format as "MMM YY" (e.g., "Jan 26")
        const label = d.toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
        });
        counts[label] = (counts[label] || 0) + 1;
      });

      const entries = Object.entries(counts).map(([name, value]) => ({
        name,
        value,
      }));

      if (entries.length === 0) {
        return [];
      }
      return entries;
    }, [posts]);

    // 2b. Last 6 Months Frequency Data
    const lastSixMonthsData = useMemo(() => {
      const result = [];
      
      // Determine the anchor date (default to today, or latest post date if latest post is older than today)
      let anchorDate = new Date();
      if (posts.length > 0) {
        const validDates = posts
          .map((p) => p.savedAt ? new Date(p.savedAt) : null)
          .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
        
        if (validDates.length > 0) {
          const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          if (maxDate < sixMonthsAgo) {
            anchorDate = maxDate;
          }
        }
      }

      // Calculate the last 6 calendar months chronologically leading to anchorDate
      for (let i = 5; i >= 0; i--) {
        const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
        const monthLabel = d.toLocaleString("en-US", { month: "short" });
        const yearLabel = d.toLocaleString("en-US", { year: "2-digit" });
        const label = `${monthLabel} ${yearLabel}`;
        
        // Count posts saved in this specific month/year
        const count = posts.filter((p) => {
          if (!p.savedAt) return false;
          const savedDate = new Date(p.savedAt);
          if (isNaN(savedDate.getTime())) return false;
          return (
            savedDate.getFullYear() === d.getFullYear() &&
            savedDate.getMonth() === d.getMonth()
          );
        }).length;
        
        result.push({
          name: label,
          value: count,
          monthIndex: d.getMonth(),
          year: d.getFullYear(),
        });
      }
      
      return result;
    }, [posts]);

    // 3. Media Mix Distribution Pie Chart
    const mediaTypeData = useMemo(() => {
      const counts = { image: 0, video: 0, carousel: 0 };
      posts.forEach((p) => {
        const type = p.mediaType || "image";
        if (type in counts) {
          counts[type as keyof typeof counts]++;
        } else {
          counts.image++;
        }
      });

      return [
        { name: "Images", value: counts.image || 0, color: "#4f46e5" }, // Indigo
        { name: "Videos", value: counts.video || 0, color: "#0d9488" }, // Teal
        { name: "Carousels", value: counts.carousel || 0, color: "#db2777" }, // Pink
      ].filter((item) => item.value > 0);
    }, [posts]);

    // 4. Popular Taxonomies
    const tagsData = useMemo(() => {
      const counts: Record<string, number> = {};
      posts.forEach((p) => {
        p.tags?.forEach((tag) => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      });

      const entries = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 7);

      if (entries.length === 0) {
        return [];
      }
      return entries;
    }, [posts]);

    // 5. Top Creators Ranking Data
    const topCreatorsData = useMemo(() => {
      const counts: Record<string, number> = {};
      posts.forEach((p) => {
        if (p.creatorUsername) {
          counts[p.creatorUsername] = (counts[p.creatorUsername] || 0) + 1;
        }
      });

      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }, [posts]);

    // Colors for Pie/Cell Charts
    const COLORS = [
      "#4f46e5", // Indigo
      "#0d9488", // Teal
      "#db2777", // Pink
      "#059669", // Emerald
      "#d97706", // Amber
      "#2563eb", // Blue
      "#7c3aed", // Violet
    ];

    // CLICK ACTION HANDLERS FOR INTERACTIVITY

    // Helper to reset helper parameters before applying specific filters
    const resetAllFilters = () => {
      setCreatorFilter("");
      setInitialSelectedCollections([]);
      setInitialSelectedTags([]);
      setInitialFilterMediaType("all");
      setInitialFilterFavoriteOnly(false);
      setInitialFilterArchived("active");
      setInitialStartDate("");
      setInitialEndDate("");
      setInitialSortBy("savedAt");
    };

    // Metric Clickers
    const handleMetricTotalClick = () => {
      resetAllFilters();
      onNavigate("home");
    };

    const handleMetricFavoriteClick = () => {
      resetAllFilters();
      setInitialFilterFavoriteOnly(true);
      onNavigate("home");
    };

    const handleMetricCollectionsClick = () => {
      onNavigate("grouped");
    };

    const handleCreatorClick = (creatorName: string) => {
      resetAllFilters();
      setCreatorFilter(creatorName);
      onNavigate("home");
    };

    // Chart Clickers
    const handleTimelineClick = (data: any) => {
      if (data && data.activePayload && data.activePayload[0]) {
        const clickedData = data.activePayload[0].payload;
        if (!clickedData || !clickedData.name) return;

        const [monthName, yearTwoDigit] = clickedData.name.split(" ");
        const monthMap: Record<string, number> = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        };

        const monthIdx = monthMap[monthName];
        if (monthIdx === undefined) return;
        const year = 2000 + parseInt(yearTwoDigit, 10);

        // Calculate start & end of that month in Local Timezone
        const startDay = new Date(year, monthIdx, 1, 0, 0, 0);
        const endDay = new Date(year, monthIdx + 1, 0, 23, 59, 59);

        const formatISODate = (d: Date) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        resetAllFilters();
        setInitialFilterArchived("all"); // Show everything from that month
        setInitialStartDate(formatISODate(startDay));
        setInitialEndDate(formatISODate(endDay));
        onNavigate("home");
      }
    };

    const handleLastSixMonthsClick = (entry: any) => {
      if (!entry || !entry.name) return;

      const { monthIndex, year } = entry;
      if (monthIndex === undefined || year === undefined) return;

      // Calculate start & end of that month in Local Timezone
      const startDay = new Date(year, monthIndex, 1, 0, 0, 0);
      const endDay = new Date(year, monthIndex + 1, 0, 23, 59, 59);

      const formatISODate = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      };

      resetAllFilters();
      setInitialFilterArchived("all"); // Show everything from that month
      setInitialStartDate(formatISODate(startDay));
      setInitialEndDate(formatISODate(endDay));
      onNavigate("home");
    };

    const handleMediaMixClick = (entry: any) => {
      if (!entry) return;
      const typeMap: Record<string, string> = {
        Images: "image",
        Videos: "video",
        Carousels: "carousel",
      };
      const mediaType = typeMap[entry.name] || "all";

      resetAllFilters();
      setInitialFilterMediaType(mediaType);
      onNavigate("home");
    };

    const handleTagClick = (entry: any) => {
      if (!entry || !entry.name) return;
      resetAllFilters();
      setInitialSelectedTags([entry.name]);
      onNavigate("home");
    };

    if (posts.length === 0) {
      return (
        <div className="flex-1 bg-m3-surface overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col items-center justify-center min-h-[400px] text-center select-none">
          <div className="max-w-md p-8 bg-m3-surface-low border border-m3-outline-variant/25 rounded-[32px] flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-m3-primary/10 flex items-center justify-center text-m3-primary">
              <TrendingUp size={32} className="stroke-[1.5]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display text-m3-on-surface">
                No Analytics Data
              </h2>
              <p className="text-sm text-m3-on-surface-variant/90 leading-relaxed font-sans">
                To visualize your saving trends, media mix distribution, popular tags, and active creator statistics, please import your Instagram bookmark export file first.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                usePostStore.getState().setIsImportModalOpen(true);
              }}
              className="px-6 py-3 rounded-2xl bg-m3-primary text-m3-on-primary font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer hover:bg-opacity-90 active:scale-95 transition-all"
            >
              <span>Import Data</span>
            </motion.button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-m3-surface select-none flex flex-col">
        {/* OPTIMIZED HEADER: Replicates the single-row Material 3 Top App Bar */}
        <header className="border-b border-m3-outline-variant/40 bg-m3-surface shadow-sm z-10 shrink-0 flex flex-col">
          <div className="px-4 md:px-6 py-2.5 flex items-center justify-between">
            <h1 className="text-base sm:text-lg md:text-xl font-bold font-display tracking-tight text-m3-on-surface leading-none">
              Analytics
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch] p-4 pb-28 md:p-6 max-w-7xl mx-auto w-full space-y-4">

        {/* Bento Grid Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
          {/* Metric 1 - Total */}
          <div
            onClick={handleMetricTotalClick}
            className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-3.5 flex flex-col justify-between shadow-xs transition-all duration-300 cursor-pointer hover:border-m3-primary/40 hover:bg-m3-primary-container hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-on-surface-variant">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                {t.totalPosts}
              </span>
              <ChevronRight size={11} className="opacity-40" />
            </div>
            <div className="mt-2">
              <p className="text-xl font-bold font-display text-m3-primary leading-none">
                {stats.total}
              </p>
              <p className="text-[9px] text-m3-on-surface-variant/80 mt-1 font-sans">
                Bookmarks saved
              </p>
            </div>
          </div>

          {/* Metric 2 - Favorites */}
          <div
            onClick={handleMetricFavoriteClick}
            className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-3.5 flex flex-col justify-between shadow-xs transition-all duration-300 cursor-pointer hover:border-m3-primary/40 hover:bg-m3-primary-container hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-on-surface-variant">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                {t.favoriteRatio}
              </span>
              <Heart
                size={11}
                className="text-twitter-pink fill-twitter-pink/10"
              />
            </div>
            <div className="mt-2">
              <p className="text-xl font-bold font-display text-m3-primary flex items-center gap-1 leading-none">
                {stats.favoritePercentage}%
              </p>
              <p className="text-[9px] text-m3-on-surface-variant/80 mt-1 font-sans">
                {stats.favorites} starred items
              </p>
            </div>
          </div>

          {/* Metric 3 - Collections */}
          <div
            onClick={handleMetricCollectionsClick}
            className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-3.5 flex flex-col justify-between shadow-xs transition-all duration-300 cursor-pointer hover:border-m3-primary/40 hover:bg-m3-primary-container hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-on-surface-variant">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                {t.uniqueCollections}
              </span>
              <ChevronRight size={11} className="opacity-40" />
            </div>
            <div className="mt-2">
              <p className="text-xl font-bold font-display text-m3-primary leading-none">
                {stats.collectionsCount}
              </p>
              <p className="text-[9px] text-m3-on-surface-variant/80 mt-1 font-sans">
                Active collections
              </p>
            </div>
          </div>

          {/* Metric 4 - Curated Tags */}
          <div
            onClick={handleMetricTotalClick}
            className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-3.5 flex flex-col justify-between shadow-xs transition-all duration-300 cursor-pointer hover:border-m3-primary/40 hover:bg-m3-primary-container hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-on-surface-variant">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                Curated Taxonomies
              </span>
              <Hash size={11} className="opacity-40" />
            </div>
            <div className="mt-2">
              <p className="text-xl font-bold font-display text-m3-primary leading-none">
                {stats.tagsCount}
              </p>
              <p className="text-[9px] text-m3-on-surface-variant/80 mt-1 font-sans">
                Unique tag markers
              </p>
            </div>
          </div>
        </div>

        {/* Unified Interactive Dashboard Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Card 1: Chronological Save Trends */}
          <div className="lg:col-span-8 bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-4 shadow-xs flex flex-col h-[340px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5 font-display">
                  <TrendingUp size={14} className="text-m3-primary" />
                  Chronological Trends
                </h3>
                <p className="text-[10px] text-m3-on-surface-variant font-sans">
                  {trendTab === "timeline" 
                    ? "Interactive chronological volume tracker over the complete timeline." 
                    : "Activity volume distribution over the trailing six months."}
                </p>
              </div>

              {/* Pill Tabs Selector */}
              <div className="flex items-center gap-1 bg-m3-surface-container/50 p-1 rounded-full border border-m3-outline-variant/15 text-[11px] self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setTrendTab("timeline")}
                  className={`px-3 py-1 rounded-full font-bold font-display transition-all cursor-pointer relative ${
                    trendTab === "timeline"
                      ? "text-m3-primary bg-m3-surface shadow-2xs border border-m3-outline-variant/10"
                      : "text-m3-on-surface-variant/80 hover:text-m3-on-surface"
                  }`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setTrendTab("monthly")}
                  className={`px-3 py-1 rounded-full font-bold font-display transition-all cursor-pointer relative ${
                    trendTab === "monthly"
                      ? "text-m3-primary bg-m3-surface shadow-2xs border border-m3-outline-variant/10"
                      : "text-m3-on-surface-variant/80 hover:text-m3-on-surface"
                  }`}
                >
                  Monthly Frequency
                </button>
              </div>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
              <AnimatePresence mode="wait">
                {trendTab === "timeline" ? (
                  <motion.div
                    key="timeline"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={timelineData}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        onClick={handleTimelineClick}
                        style={{ cursor: "pointer" }}
                      >
                        <defs>
                          <linearGradient
                            id="trendGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--m3-primary)"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--m3-primary)"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--color-m3-outline-variant)"
                          opacity={0.12}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: "var(--color-m3-on-surface-variant)",
                            fontSize: 9,
                            fontWeight: 500,
                          }}
                          axisLine={{
                            stroke: "var(--color-m3-outline-variant)",
                            strokeWidth: 0.5,
                          }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fill: "var(--color-m3-on-surface-variant)",
                            fontSize: 9,
                            fontWeight: 500,
                          }}
                          axisLine={{
                            stroke: "var(--color-m3-outline-variant)",
                            strokeWidth: 0.5,
                          }}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="var(--m3-primary)"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#trendGradient)"
                          activeDot={{
                            r: 6,
                            stroke: "var(--m3-surface-low)",
                            strokeWidth: 2,
                            style: { cursor: "pointer" },
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                ) : (
                  <motion.div
                    key="monthly"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={lastSixMonthsData}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        style={{ cursor: "pointer" }}
                      >
                        <defs>
                          <linearGradient
                            id="lastSixMonthsGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="var(--m3-primary)"
                              stopOpacity={0.95}
                            />
                            <stop
                              offset="100%"
                              stopColor="var(--m3-primary)"
                              stopOpacity={0.55}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--color-m3-outline-variant)"
                          opacity={0.12}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: "var(--color-m3-on-surface-variant)",
                            fontSize: 9,
                            fontWeight: 500,
                          }}
                          axisLine={{
                            stroke: "var(--color-m3-outline-variant)",
                            strokeWidth: 0.5,
                          }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fill: "var(--color-m3-on-surface-variant)",
                            fontSize: 9,
                            fontWeight: 500,
                          }}
                          axisLine={{
                            stroke: "var(--color-m3-outline-variant)",
                            strokeWidth: 0.5,
                          }}
                          tickLine={false}
                        />
                        <Tooltip content={<BarTooltip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {lastSixMonthsData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill="url(#lastSixMonthsGradient)"
                              onClick={() => handleLastSixMonthsClick(entry)}
                              className="hover:opacity-85 hover:brightness-110 transition-all duration-200"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Card 2: Distributions & Rankings */}
          <div className="lg:col-span-4 bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-4 shadow-xs flex flex-col h-[340px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5 font-display">
                  {distributionTab === "formats" ? (
                    <>
                      <PieIcon size={14} className="text-m3-primary" />
                      Media Mix
                    </>
                  ) : distributionTab === "tags" ? (
                    <>
                      <Hash size={14} className="text-m3-primary" />
                      Popular Tags
                    </>
                  ) : (
                    <>
                      <Users size={14} className="text-m3-primary" />
                      Top Creators
                    </>
                  )}
                </h3>
              </div>

              {/* Tab selector */}
              <div className="flex items-center gap-0.5 bg-m3-surface-container/50 p-0.5 rounded-full border border-m3-outline-variant/15 text-[10px] self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setDistributionTab("formats")}
                  className={`px-2.5 py-1 rounded-full font-bold font-display transition-all cursor-pointer ${
                    distributionTab === "formats"
                      ? "text-m3-primary bg-m3-surface shadow-2xs border border-m3-outline-variant/10"
                      : "text-m3-on-surface-variant/80 hover:text-m3-on-surface"
                  }`}
                >
                  Formats
                </button>
                <button
                  onClick={() => setDistributionTab("tags")}
                  className={`px-2.5 py-1 rounded-full font-bold font-display transition-all cursor-pointer ${
                    distributionTab === "tags"
                      ? "text-m3-primary bg-m3-surface shadow-2xs border border-m3-outline-variant/10"
                      : "text-m3-on-surface-variant/80 hover:text-m3-on-surface"
                  }`}
                >
                  Tags
                </button>
                <button
                  onClick={() => setDistributionTab("creators")}
                  className={`px-2.5 py-1 rounded-full font-bold font-display transition-all cursor-pointer ${
                    distributionTab === "creators"
                      ? "text-m3-primary bg-m3-surface shadow-2xs border border-m3-outline-variant/10"
                      : "text-m3-on-surface-variant/80 hover:text-m3-on-surface"
                  }`}
                >
                  Creators
                </button>
              </div>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
              <AnimatePresence mode="wait">
                {distributionTab === "formats" ? (
                  <motion.div
                    key="formats"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="w-full h-full flex flex-col justify-center"
                  >
                    <div className="flex flex-row items-center justify-center gap-4 h-full min-h-0">
                      {mediaTypeData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center p-3 w-full">
                          <ImageIcon size={24} className="text-m3-outline/40 mb-1" />
                          <p className="text-[10px] font-bold text-m3-on-surface-variant font-display">
                            No Media Records
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="w-[110px] h-[110px] shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={mediaTypeData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={30}
                                  outerRadius={48}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  {mediaTypeData.map((entry, index) => (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={entry.color}
                                      onClick={() => handleMediaMixClick(entry)}
                                      style={{ cursor: "pointer" }}
                                      className="hover:opacity-80 transition-all duration-200"
                                    />
                                  ))}
                                </Pie>
                                <Tooltip content={<DonutTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="flex flex-col justify-center space-y-1.5 w-full">
                            {mediaTypeData.map((m, idx) => {
                              const pct =
                                stats.total > 0
                                  ? Math.round((m.value / stats.total) * 100)
                                  : 0;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => handleMediaMixClick(m)}
                                  className="flex items-center justify-between border-b border-m3-outline-variant/10 pb-1 last:border-0 last:pb-0 cursor-pointer group hover:bg-m3-primary/5 px-1 rounded transition-all duration-200"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: m.color }}
                                    />
                                    <span className="text-[11px] font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors font-display truncate">
                                      {m.name}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[11px] font-bold text-m3-on-surface group-hover:text-m3-primary transition-colors">
                                      {m.value}
                                    </span>
                                    <span className="text-[9px] text-m3-on-surface-variant/60 ml-1 font-mono">
                                      ({pct}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                ) : distributionTab === "tags" ? (
                  <motion.div
                    key="tags"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="w-full h-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={tagsData}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        style={{ cursor: "pointer" }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--color-m3-outline-variant)"
                          opacity={0.12}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: "var(--color-m3-on-surface-variant)",
                            fontSize: 9,
                            fontWeight: 500,
                          }}
                          axisLine={{
                            stroke: "var(--color-m3-outline-variant)",
                            strokeWidth: 0.5,
                          }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fill: "var(--color-m3-on-surface-variant)",
                            fontSize: 9,
                            fontWeight: 500,
                          }}
                          axisLine={{
                            stroke: "var(--color-m3-outline-variant)",
                            strokeWidth: 0.5,
                          }}
                          tickLine={false}
                        />
                        <Tooltip content={<BarTooltip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {tagsData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              onClick={() => handleTagClick(entry)}
                              className="hover:opacity-80 hover:brightness-110 transition-all duration-200"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                ) : (
                  <motion.div
                    key="creators"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="w-full h-full flex flex-col justify-start overflow-y-auto pr-1 scrollbar-thin max-h-[260px]"
                  >
                    {topCreatorsData.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                        <Users size={24} className="text-m3-outline/40 mb-1" />
                        <p className="text-[10px] font-bold text-m3-on-surface-variant font-display">
                          No Creators Curated
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {topCreatorsData.map((creator) => (
                          <div
                            key={creator.name}
                            onClick={() => handleCreatorClick(creator.name)}
                            className="flex items-center justify-between p-1.5 rounded-xl border border-m3-outline-variant/10 hover:border-m3-primary/20 hover:bg-m3-primary/5 cursor-pointer transition-all duration-200 group/row"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6.5 h-6.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 flex items-center justify-center text-white font-bold text-[9px] shadow-inner ring-2 ring-m3-surface-low shrink-0 select-none font-display truncate">
                                {getInitials(creator.name)}
                              </div>
                              <span className="text-[11px] font-bold text-m3-on-surface truncate group-hover/row:text-m3-primary transition-colors font-display">
                                @{creator.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[9px] font-bold font-mono text-m3-on-surface-variant/80 bg-m3-surface-container border border-m3-outline-variant/20 px-1.5 py-0.5 rounded-full">
                                {creator.count} {creator.count === 1 ? "post" : "posts"}
                              </span>
                              <ChevronRight size={11} className="text-m3-outline opacity-0 group-hover/row:opacity-100 transition-opacity duration-200" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Collapsible Deep-Dive: Calendar Activity Heatmap */}
        <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] shadow-xs overflow-hidden transition-all duration-300">
          <button
            onClick={() => setIsHeatmapExpanded(!isHeatmapExpanded)}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer hover:bg-m3-surface-container/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-m3-primary/10 flex items-center justify-center text-m3-primary shrink-0">
                <Calendar size={16} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-display text-m3-on-surface">
                  Daily Activity Heatmap & Temporal Patterns
                </h3>
                <p className="text-[10px] text-m3-on-surface-variant mt-0.5">
                  Expand to inspect year-round contribution frequency and daily bookmark habits.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold font-mono text-m3-primary bg-m3-primary/10 px-2.5 py-1 rounded-full hidden sm:inline-block">
                {isHeatmapExpanded ? "Collapse View" : "Expand Heatmap"}
              </span>
              <ChevronRight
                size={16}
                className={`text-m3-on-surface-variant transition-transform duration-300 ${
                  isHeatmapExpanded ? "rotate-90 text-m3-primary" : ""
                }`}
              />
            </div>
          </button>

          <AnimatePresence>
            {isHeatmapExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden border-t border-m3-outline-variant/15"
              >
                <div className="p-4 sm:p-5 bg-m3-surface">
                  <CalendarHeatmap
                    posts={posts}
                    onNavigate={onNavigate}
                    setInitialStartDate={setInitialStartDate}
                    setInitialEndDate={setInitialEndDate}
                    setInitialFilterArchived={setInitialFilterArchived}
                    resetAllFilters={resetAllFilters}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    );
  },
);
