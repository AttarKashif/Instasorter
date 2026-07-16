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
  Legend,
} from "recharts";
import {
  BarChart3,
  PieChart as PieIcon,
  Hash,
  FolderHeart,
  Image,
  Video,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
  Layers,
} from "lucide-react";
import { Post } from "../../types/post";

interface DashboardAnalyticsProps {
  posts: Post[];
  onSelectTag?: (tag: string) => void;
  onSelectCollection?: (collection: string) => void;
  isCollapsible?: boolean;
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  posts,
  onSelectTag,
  onSelectCollection,
  isCollapsible = true,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const activeIsOpen = isCollapsible ? isOpen : true;

  // 1. Calculate General Stats
  const stats = useMemo(() => {
    const total = posts.length;
    const favorites = posts.filter((p) => p.isFavorite).length;
    const archived = posts.filter((p) => p.isArchived).length;

    const uniqueTags = new Set<string>();
    const uniqueCollections = new Set<string>();

    posts.forEach((p) => {
      p.tags?.forEach((t) => uniqueTags.add(t));
      p.collections?.forEach((c) => uniqueCollections.add(c));
    });

    return {
      total,
      favorites,
      archived,
      tagsCount: uniqueTags.size,
      collectionsCount: uniqueCollections.size,
    };
  }, [posts]);

  // 2. Prepare Collections Chart Data
  const collectionsData = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      const cols = p.collections || [];
      if (cols.length === 0) {
        counts["Unassigned"] = (counts["Unassigned"] || 0) + 1;
      } else {
        cols.forEach((col) => {
          counts[col] = (counts[col] || 0) + 1;
        });
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [posts]);

  // 3. Prepare Tags Chart Data (Top 8 tags to avoid clutter)
  const tagsData = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      p.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 tags
  }, [posts]);

  // 4. Prepare Media Type Chart Data
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
      { name: "Images", value: counts.image, color: "#65558F", icon: Image },
      { name: "Videos", value: counts.video, color: "#7D5260", icon: Video },
      {
        name: "Carousels",
        value: counts.carousel,
        color: "#625B71",
        icon: Layers,
      },
    ].filter((item) => item.value > 0);
  }, [posts]);

  // Material 3 Color Palette for Charts
  const COLORS = [
    "#65558F",
    "#625B71",
    "#7D5260",
    "#9F8CB6",
    "#A18A92",
    "#8F7EA3",
    "#D6C6E1",
    "#E8DEF8",
  ];

  // Custom tooltips to fit Material 3 style
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-m3-surface-container border border-m3-outline-variant p-2.5 rounded-lg shadow-md text-xs">
          <p className="font-bold text-m3-on-surface">{payload[0].name}</p>
          <p className="text-m3-primary font-medium mt-0.5">
            {payload[0].value}{" "}
            {payload[0].value === 1 ? "bookmark" : "bookmarks"}
          </p>
        </div>
      );
    }
    return null;
  };

  if (posts.length === 0) return null;

  return (
    <div
      className={`mb-6 bg-m3-surface-low/80 border border-m3-outline-variant/60 rounded-[24px] overflow-hidden shadow-sm transition-all ${!isCollapsible ? "mb-0 border-0 bg-transparent shadow-none" : ""}`}
    >
      {/* Header section */}
      <div
        onClick={isCollapsible ? () => setIsOpen(!isOpen) : undefined}
        className={`px-6 py-4 flex items-center justify-between select-none transition-colors ${isCollapsible ? "cursor-pointer hover:bg-m3-surface-high/30" : ""}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold font-display text-m3-on-surface flex items-center gap-1.5">
              Analytics & Saved Insights
              <Sparkles size={14} className="text-m3-primary animate-pulse" />
            </h2>
            <p className="text-xs text-m3-on-surface-variant">
              Distribution and metrics of your {stats.total} saved Instagram
              bookmarks
            </p>
          </div>
        </div>

        {isCollapsible && (
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-m3-surface-container/60 text-m3-on-surface-variant transition-colors"
          >
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {activeIsOpen && (
          <motion.div
            initial={isCollapsible ? { height: 0, opacity: 0 } : undefined}
            animate={isCollapsible ? { height: "auto", opacity: 1 } : undefined}
            exit={isCollapsible ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className={`px-6 pb-6 pt-2 flex flex-col gap-6 ${isCollapsible ? "border-t border-m3-outline-variant/30" : "px-0"}`}
            >
              {/* Bento Grid Metrics Header */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Stat 1 */}
                <div className="p-4 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-m3-on-surface-variant/70">
                    Total Saved
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-display text-m3-primary">
                      {stats.total}
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant">
                      posts
                    </span>
                  </div>
                </div>
                {/* Stat 2 */}
                <div className="p-4 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-m3-on-surface-variant/70">
                    Collections
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-display text-m3-secondary">
                      {stats.collectionsCount}
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant">
                      folders
                    </span>
                  </div>
                </div>
                {/* Stat 3 */}
                <div className="p-4 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-m3-on-surface-variant/70">
                    Unique Tags
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-display text-[#7D5260]">
                      {stats.tagsCount}
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant">
                      labels
                    </span>
                  </div>
                </div>
                {/* Stat 4 */}
                <div className="p-4 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-m3-on-surface-variant/70">
                    Favorites
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black font-display text-m3-primary flex items-center gap-1">
                      {stats.favorites}
                      <Heart
                        size={14}
                        className="fill-m3-primary text-m3-primary"
                      />
                    </span>
                    <span className="text-[10px] text-m3-on-surface-variant">
                      starred
                    </span>
                  </div>
                </div>
                {/* Stat 5 - Media breakdown */}
                <div className="p-4 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-2xl col-span-2 md:col-span-1 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-m3-on-surface-variant/70">
                    Media Mix
                  </span>
                  <div className="flex gap-2 items-center mt-2">
                    {mediaTypeData.map((m, idx) => {
                      const Icon = m.icon;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center flex-1 bg-m3-surface-low/50 py-1 rounded"
                          title={`${m.name}: ${m.value}`}
                        >
                          <Icon size={12} style={{ color: m.color }} />
                          <span className="text-[10px] font-bold text-m3-on-surface mt-0.5">
                            {m.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Chart 1: Collections Distribution (Colspan 7) */}
                <div className="p-5 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-[20px] lg:col-span-7 flex flex-col h-[280px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5">
                      <FolderHeart size={14} className="text-twitter-pink" />
                      Saved Posts per Collection
                    </h3>
                    <span className="text-[10px] text-m3-on-surface-variant font-mono">
                      {collectionsData.length} active folders
                    </span>
                  </div>

                  <div className="flex-1 w-full min-h-0">
                    {collectionsData.length === 0 ||
                    (collectionsData.length === 1 &&
                      collectionsData[0].name === "Unassigned" &&
                      collectionsData[0].value === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <FolderHeart
                          size={24}
                          className="text-m3-outline/40 mb-1"
                        />
                        <p className="text-xs font-bold text-m3-on-surface-variant">
                          No Collections Assigned
                        </p>
                        <p className="text-[10px] text-m3-outline mt-0.5 max-w-[220px]">
                          Add posts to custom collections to see their volume
                          breakdown.
                        </p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={collectionsData}
                          margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                        >
                          <XAxis
                            dataKey="name"
                            tick={{
                              fill: "var(--color-m3-on-surface-variant)",
                              fontSize: 10,
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
                              fontSize: 10,
                            }}
                            axisLine={{
                              stroke: "var(--color-m3-outline-variant)",
                              strokeWidth: 0.5,
                            }}
                            tickLine={false}
                          />
                          <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: "rgba(98, 91, 113, 0.05)" }}
                          />
                          <Bar
                            dataKey="value"
                            radius={[6, 6, 0, 0]}
                            onClick={(data) => {
                              if (
                                onSelectCollection &&
                                data &&
                                data.name &&
                                data.name !== "Unassigned"
                              ) {
                                onSelectCollection(data.name);
                              }
                            }}
                          >
                            {collectionsData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                className="cursor-pointer hover:opacity-85 transition-opacity"
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Chart 2: Top Tags Frequency (Colspan 5) */}
                <div className="p-5 bg-m3-surface-lowest border border-m3-outline-variant/40 rounded-[20px] lg:col-span-5 flex flex-col h-[280px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5">
                      <Hash size={14} className="text-m3-secondary" />
                      Popular Tags Frequency
                    </h3>
                    <span className="text-[10px] text-m3-on-surface-variant font-mono">
                      Top {tagsData.length} labels
                    </span>
                  </div>

                  <div className="flex-1 w-full min-h-0">
                    {tagsData.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <Hash size={24} className="text-m3-outline/40 mb-1" />
                        <p className="text-xs font-bold text-m3-on-surface-variant">
                          No Tags Found
                        </p>
                        <p className="text-[10px] text-m3-outline mt-0.5 max-w-[200px]">
                          Assign custom tags to your posts to visualize your
                          taxonomy here.
                        </p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={tagsData}
                          margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                        >
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{
                              fill: "var(--color-m3-on-surface-variant)",
                              fontSize: 10,
                            }}
                            axisLine={{
                              stroke: "var(--color-m3-outline-variant)",
                              strokeWidth: 0.5,
                            }}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{
                              fill: "var(--color-m3-on-surface-variant)",
                              fontSize: 10,
                              width: 75,
                            }}
                            axisLine={{
                              stroke: "var(--color-m3-outline-variant)",
                              strokeWidth: 0.5,
                            }}
                            tickLine={false}
                            width={75}
                          />
                          <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: "rgba(98, 91, 113, 0.05)" }}
                          />
                          <Bar
                            dataKey="value"
                            radius={[0, 6, 6, 0]}
                            onClick={(data) => {
                              if (onSelectTag && data && data.name) {
                                onSelectTag(data.name);
                              }
                            }}
                          >
                            {tagsData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[(index + 3) % COLORS.length]}
                                className="cursor-pointer hover:opacity-85 transition-opacity"
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
