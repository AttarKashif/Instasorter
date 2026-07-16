import React, { useMemo } from "react";
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
  BarChart3,
  PieChart as PieIcon,
  Hash,
  Image as ImageIcon,
  Sparkles,
  Heart,
  Layers,
  TrendingUp,
  Calendar,
  MousePointerClick,
  ChevronRight,
  Info,
  ArrowLeft,
} from "lucide-react";
import { Post } from "../../types/post";
import { VOCABULARY } from "../../constants/vocabulary";

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
        (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime(),
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
        return [
          { name: "Apr 26", value: 4 },
          { name: "May 26", value: 8 },
          { name: "Jun 26", value: 12 },
          { name: "Jul 26", value: 19 },
        ];
      }
      return entries;
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
        { name: "Images", value: counts.image || 0, color: "#818CF8" },
        { name: "Videos", value: counts.video || 0, color: "#A78BFA" },
        { name: "Carousels", value: counts.carousel || 0, color: "#F472B6" },
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
        return [
          { name: "design", value: 5 },
          { name: "inspiration", value: 4 },
          { name: "dev", value: 3 },
          { name: "travel", value: 2 },
          { name: "aesthetic", value: 2 },
        ];
      }
      return entries;
    }, [posts]);

    // 5. Engagement by Media Type
    const engagementData = useMemo(() => {
      const sumComments: Record<string, number> = {
        image: 0,
        video: 0,
        carousel: 0,
      };
      const countType: Record<string, number> = {
        image: 0,
        video: 0,
        carousel: 0,
      };

      posts.forEach((p) => {
        const type = p.mediaType || "image";
        const commentsCount = p.comments?.length || 0;
        sumComments[type] += commentsCount;
        countType[type]++;
      });

      return [
        {
          name: "Images",
          avgComments:
            countType.image > 0
              ? Math.round((sumComments.image / countType.image) * 10) / 10
              : 1.5,
          color: "#65558F",
        },
        {
          name: "Videos",
          avgComments:
            countType.video > 0
              ? Math.round((sumComments.video / countType.video) * 10) / 10
              : 3.2,
          color: "#7D5260",
        },
        {
          name: "Carousels",
          avgComments:
            countType.carousel > 0
              ? Math.round((sumComments.carousel / countType.carousel) * 10) /
                10
              : 2.0,
          color: "#625B71",
        },
      ];
    }, [posts]);

    // Colors for Pie/Cell Charts
    const COLORS = [
      "#818CF8",
      "#A78BFA",
      "#F472B6",
      "#34D399",
      "#FBBF24",
      "#60A5FA",
      "#C084FC",
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

    const handleMetricArchivedClick = () => {
      resetAllFilters();
      setInitialFilterArchived("archived");
      onNavigate("home");
    };

    const handleMetricCollectionsClick = () => {
      onNavigate("grouped");
    };

    const handleMetricEngagementClick = () => {
      resetAllFilters();
      setInitialSortBy("commentsCount");
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

    const handleEngagementClick = (entry: any) => {
      if (!entry) return;
      const typeMap: Record<string, string> = {
        Images: "image",
        Videos: "video",
        Carousels: "carousel",
      };
      const mediaType = typeMap[entry.name] || "all";

      resetAllFilters();
      setInitialFilterMediaType(mediaType);
      setInitialSortBy("commentsCount");
      onNavigate("home");
    };

    return (
      <div className="flex-1 bg-m3-surface overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 select-none">
        {/* Header with Title and Metadata */}
        <div className="pb-3 border-b border-m3-outline-variant/15 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate("home")}
              className="flex items-center justify-center p-1.5 rounded-lg bg-m3-surface-container-low hover:bg-m3-surface-container border border-m3-outline-variant/20 transition-all text-m3-on-surface cursor-pointer hover:scale-105 active:scale-95 shadow-2xs shrink-0"
              title="Back to Home"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="space-y-0.5">
              <h2 className="text-base font-bold font-display tracking-tight text-m3-on-surface flex items-center gap-2">
                {t.title}
                <Sparkles className="text-m3-primary animate-pulse" size={16} />
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-m3-primary/5 text-m3-primary border border-m3-primary/10 rounded-full px-3 py-1 text-xs font-semibold">
            <MousePointerClick size={12} className="stroke-[2.5]" />
            <span>Interactive Charts Enabled</span>
          </div>
        </div>

        {/* High-Fidelity Bento Grid Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
          {/* Metric 1 - Total */}
          <div
            onClick={handleMetricTotalClick}
            className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer hover:border-m3-primary/40 hover:bg-m3-primary/5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-outline">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                {t.totalPosts}
              </span>
              <ChevronRight size={11} className="opacity-40" />
            </div>
            <div className="mt-2">
              <p className="text-xl font-black font-display text-m3-primary leading-none">
                {stats.total}
              </p>
              <p className="text-[9px] text-m3-outline mt-0.5 font-medium">
                Bookmarks saved
              </p>
            </div>
          </div>

          {/* Metric 2 - Favorites */}
          <div
            onClick={handleMetricFavoriteClick}
            className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer hover:border-m3-primary/100/40 hover:bg-m3-primary/50/5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-outline">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                {t.favoriteRatio}
              </span>
              <Heart
                size={11}
                className="text-twitter-pink fill-twitter-pink/10"
              />
            </div>
            <div className="mt-2">
              <p className="text-xl font-black font-display text-m3-primary flex items-center gap-1 leading-none">
                {stats.favoritePercentage}%
              </p>
              <p className="text-[9px] text-m3-outline mt-0.5 font-medium">
                {stats.favorites} starred items
              </p>
            </div>
          </div>

          {/* Metric 3 - Collections */}
          <div
            onClick={handleMetricCollectionsClick}
            className="bg-m3-surface-low border border-m3-outline-variant/15 rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer hover:border-[#7D5260]/40 hover:bg-[#7D5260]/5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-m3-outline">
              <span className="text-[9px] font-bold uppercase tracking-wider font-mono">
                {t.uniqueCollections}
              </span>
              <ChevronRight size={11} className="opacity-40" />
            </div>
            <div className="mt-2">
              <p className="text-xl font-black font-display text-[#7D5260] leading-none">
                {stats.collectionsCount}
              </p>
              <p className="text-[9px] text-m3-outline mt-0.5 font-medium">
                Active Collections
              </p>
            </div>
          </div>
        </div>

        {/* Main Charts Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Row 1, Col 1-7: Interactive Save Trend Area Chart */}
          <div className="lg:col-span-7 bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 shadow-xs flex flex-col h-[280px]">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-m3-primary" />
                  {t.timeTrendTitle}
                </h3>
                <p className="text-[10px] text-m3-on-surface-variant">
                  Click any timeline point below to filter posts saved in that
                  specific month.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-m3-primary/10 text-m3-primary text-[9px] font-bold px-2 py-0.5 rounded-md border border-m3-primary/20">
                <Calendar size={10} />
                <span>Timeline filter</span>
              </div>
            </div>

            <div className="flex-1 w-full min-h-0">
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
                        stopColor={COLORS[0]}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS[0]}
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
                  <Tooltip
                    cursor={{
                      stroke: COLORS[0],
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                    contentStyle={{
                      backgroundColor: "var(--color-m3-surface-container)",
                      borderColor: "var(--color-m3-outline-variant)",
                      borderRadius: "8px",
                      fontSize: "10px",
                      color: "var(--color-m3-on-surface)",
                      backdropFilter: "blur(8px)",
                    }}
                    formatter={(value: any) => [`${value} bookmarks`, "Saved"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={COLORS[0]}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#trendGradient)"
                    activeDot={{
                      r: 7,
                      stroke: "#fff",
                      strokeWidth: 2,
                      style: { cursor: "pointer" },
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 1, Col 8-12: Media Mix Composition Donut Chart */}
          <div className="lg:col-span-5 bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 shadow-xs flex flex-col h-[280px]">
            <div className="space-y-0.5 mb-3">
              <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5">
                <PieIcon size={14} className="text-[#7D5260]" />
                {t.mediaMixTitle}
              </h3>
              <p className="text-[10px] text-m3-on-surface-variant">
                Click any pie segment or details row to filter by media format.
              </p>
            </div>

            <div className="flex-1 flex flex-row items-center justify-center gap-4 min-h-0">
              {mediaTypeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-3 w-full">
                  <ImageIcon size={24} className="text-m3-outline/40 mb-1" />
                  <p className="text-[10px] font-bold text-m3-on-surface-variant">
                    No Media Records
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-[120px] h-[120px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={mediaTypeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={56}
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
                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              "var(--color-m3-surface-container)",
                            borderColor: "var(--color-m3-outline-variant)",
                            borderRadius: "8px",
                            fontSize: "10px",
                            color: "var(--color-m3-on-surface)",
                            backdropFilter: "blur(8px)",
                          }}
                        />
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
                          className="flex items-center justify-between border-b border-m3-outline-variant/10 pb-1 last:border-0 last:pb-0 cursor-pointer group hover:bg-m3-primary/5 px-1 rounded transition-all"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: m.color }}
                            />
                            <span className="text-[11px] font-semibold text-m3-on-surface group-hover:text-m3-primary">
                              {m.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-m3-on-surface group-hover:text-m3-primary">
                              {m.value}
                            </span>
                            <span className="text-[9px] text-m3-outline ml-1 font-mono">
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
          </div>

          {/* Row 2, Col 1-12: Popular Tag Taxonomies */}
          <div className="lg:col-span-12 bg-m3-surface-low border border-m3-outline-variant/15 rounded-2xl p-4 shadow-xs flex flex-col h-[255px]">
            <div className="space-y-0.5 mb-3">
              <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5">
                <Hash size={14} className="text-m3-primary" />
                {t.topTagsTitle}
              </h3>
              <p className="text-[10px] text-m3-on-surface-variant">
                Click any column below to filter dashboard bookmarks by that
                tag.
              </p>
            </div>

            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tagsData}
                  margin={{ top: 5, right: 5, left: -30, bottom: 0 }}
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
                  <Tooltip
                    cursor={{ fill: "rgba(128,128,128,0.1)" }}
                    contentStyle={{
                      backgroundColor: "var(--color-m3-surface-container)",
                      borderColor: "var(--color-m3-outline-variant)",
                      borderRadius: "8px",
                      fontSize: "10px",
                      color: "var(--color-m3-on-surface)",
                      backdropFilter: "blur(8px)",
                    }}
                    formatter={(value: any) => [
                      `${value} bookmarks`,
                      "Tag Usage",
                    ]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
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
            </div>
          </div>
        </div>
      </div>
    );
  },
);
