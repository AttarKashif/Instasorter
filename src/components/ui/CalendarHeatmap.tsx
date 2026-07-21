import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import { Post } from "../../types/post";
import { Calendar, HelpCircle } from "lucide-react";

interface CalendarHeatmapProps {
  posts: Post[];
  onNavigate: (view: "home" | "grouped" | "analytics" | "settings") => void;
  setInitialStartDate: (date: string) => void;
  setInitialEndDate: (date: string) => void;
  setInitialFilterArchived: (arch: "all" | "active" | "archived") => void;
  resetAllFilters: () => void;
}

interface HeatmapDay {
  date: Date;
  dateStr: string;
  count: number;
  weekIndex: number;
  dayOfWeek: number;
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = React.memo(({
  posts,
  onNavigate,
  setInitialStartDate,
  setInitialEndDate,
  setInitialFilterArchived,
  resetAllFilters,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    dateStr: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Seed highly realistic demo posts if there are 0 real posts in the database
  const demoPosts = useMemo(() => {
    const mock: { savedAt: string }[] = [];
    const now = new Date();
    // Seed ~95 posts over the past year with some nice random streaks and clusters
    for (let i = 0; i < 95; i++) {
      const randomDaysAgo = Math.floor(Math.random() * 365);
      const date = new Date();
      date.setDate(now.getDate() - randomDaysAgo);
      
      // Some days have multiple items to create level 2, 3, and 4 clusters
      const multiplier = Math.random() > 0.75 ? (Math.random() > 0.6 ? 4 : 2) : 1;
      for (let j = 0; j < multiplier; j++) {
        mock.push({
          savedAt: date.toISOString(),
        });
      }
    }
    return mock;
  }, []);

  const activePosts = posts.length > 0 ? posts : demoPosts;

  // Compute all day cells for the past 365 days
  const { days, maxCount } = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 364); // Last 365 days
    
    // Align startDate to the preceding Sunday to align week columns
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    // Group posts count by local date string YYYY-MM-DD
    const counts: Record<string, number> = {};
    activePosts.forEach((p) => {
      if (!p.savedAt) return;
      const d = new Date(p.savedAt);
      if (isNaN(d.getTime())) return;
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    const dayList: HeatmapDay[] = [];
    const curr = new Date(startDate);
    let currentMax = 0;

    while (curr <= endDate) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, "0");
      const dd = String(curr.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayOfWeek = curr.getDay();
      const diffTime = Math.abs(curr.getTime() - startDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);

      const count = counts[dateStr] || 0;
      if (count > currentMax) {
        currentMax = count;
      }

      dayList.push({
        date: new Date(curr),
        dateStr,
        count,
        weekIndex,
        dayOfWeek,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return { days: dayList, maxCount: currentMax };
  }, [activePosts]);

  // Use D3 scale for beautiful threshold level classifications
  const colorScale = useMemo(() => {
    // Generate dynamic limits based on maxCount, or use fixed GitHub-style limits
    const step = Math.max(1, Math.ceil(maxCount / 4));
    const domain = [1, 1 + step, 1 + step * 2, 1 + step * 3];

    return d3.scaleThreshold<number, string>()
      .domain(domain)
      .range([
        "color-mix(in srgb, var(--m3-surface) 95%, var(--m3-primary) 5%)", // 0 saves
        "color-mix(in srgb, var(--m3-surface) 75%, var(--m3-primary) 25%)", // Level 1
        "color-mix(in srgb, var(--m3-surface) 50%, var(--m3-primary) 50%)", // Level 2
        "color-mix(in srgb, var(--m3-surface) 22%, var(--m3-primary) 78%)", // Level 3
        "var(--m3-primary)", // Level 4
      ]);
  }, [maxCount]);

  // Compute month labels aligned with week columns
  const monthLabels = useMemo(() => {
    const labels: { text: string; weekIndex: number }[] = [];
    let lastMonthName = "";

    days.forEach((d) => {
      if (d.dayOfWeek === 0) { // Aligned to Sundays
        const monthName = d.date.toLocaleString("en-US", { month: "short" });
        if (monthName !== lastMonthName) {
          labels.push({ text: monthName, weekIndex: d.weekIndex });
          lastMonthName = monthName;
        }
      }
    });

    return labels;
  }, [days]);

  // Dimension details
  const cellSize = 10;
  const cellGap = 2;
  const topOffset = 18; // space for month labels
  const leftOffset = 26; // space for week names (Mon, Wed, Fri)

  const handleCellClick = (dateStr: string, count: number) => {
    if (posts.length === 0) return; // Ignore click if viewing seeded demo data
    if (count === 0) return; // Only filter on active days with curated bookmarks

    resetAllFilters();
    setInitialFilterArchived("all"); // Ensure we show archived items too if saved on that day
    setInitialStartDate(dateStr);
    setInitialEndDate(dateStr);
    onNavigate("home");
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="bg-m3-surface-low border border-m3-outline-variant/25 rounded-[20px] p-4.5 shadow-xs flex flex-col space-y-3">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 select-none">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold text-m3-on-surface flex items-center gap-1.5 font-display">
            <Calendar size={14} className="text-m3-primary" />
            Collection Habits Heatmap
          </h3>
          <p className="text-[10px] text-m3-on-surface-variant font-sans">
            {posts.length === 0 ? (
              <span className="text-amber-600 dark:text-amber-500 font-medium">
                Showing simulated sample data. Start importing actual Instagram posts to analyze your habits!
              </span>
            ) : (
              <span>Hover cells for intensity. Click any active cell to filter your curated stream to that day.</span>
            )}
          </p>
        </div>

        {/* Legend bar */}
        <div className="flex items-center gap-1 text-[9px] font-medium text-m3-on-surface-variant self-start sm:self-center">
          <span className="mr-0.5">Less</span>
          <div className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: "color-mix(in srgb, var(--m3-surface) 95%, var(--m3-primary) 5%)" }} />
          <div className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: "color-mix(in srgb, var(--m3-surface) 75%, var(--m3-primary) 25%)" }} />
          <div className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: "color-mix(in srgb, var(--m3-surface) 50%, var(--m3-primary) 50%)" }} />
          <div className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: "color-mix(in srgb, var(--m3-surface) 22%, var(--m3-primary) 78%)" }} />
          <div className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: "var(--m3-primary)" }} />
          <span className="ml-0.5">More</span>
        </div>
      </div>

      {/* SVG Canvas Area with scrollable responsive wrapper */}
      <div className="relative w-full overflow-x-auto scrollbar-thin pb-2">
        <div className="min-w-[660px] relative">
          <svg
            width="660"
            height="110"
            className="overflow-visible"
          >
            {/* Month text labels */}
            {monthLabels.map((lbl, idx) => (
              <text
                key={idx}
                x={leftOffset + lbl.weekIndex * (cellSize + cellGap)}
                y="12"
                className="text-[9px] font-mono font-bold fill-m3-on-surface-variant/75"
                textAnchor="start"
              >
                {lbl.text}
              </text>
            ))}

            {/* Day of the week labels (Mon, Wed, Fri) */}
            <text x="6" y={topOffset + 1 * (cellSize + cellGap) + 8} className="text-[9px] font-mono font-bold fill-m3-on-surface-variant/60">
              Mon
            </text>
            <text x="6" y={topOffset + 3 * (cellSize + cellGap) + 8} className="text-[9px] font-mono font-bold fill-m3-on-surface-variant/60">
              Wed
            </text>
            <text x="6" y={topOffset + 5 * (cellSize + cellGap) + 8} className="text-[9px] font-mono font-bold fill-m3-on-surface-variant/60">
              Fri
            </text>

            {/* Heatmap Rectangular Cells */}
            <g>
              {days.map((day) => {
                const x = leftOffset + day.weekIndex * (cellSize + cellGap);
                const y = topOffset + day.dayOfWeek * (cellSize + cellGap);
                const isHovered = hoveredCell?.dateStr === day.dateStr;
                const cellBg = colorScale(day.count);

                return (
                  <rect
                    key={day.dateStr}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    rx="1.5"
                    className="transition-all duration-150 outline-none cursor-pointer"
                    style={{
                      fill: cellBg,
                      stroke: isHovered ? "var(--m3-primary)" : "var(--m3-surface-low)",
                      strokeWidth: isHovered ? 1.5 : 0.5,
                      transformOrigin: `${x + cellSize / 2}px ${y + cellSize / 2}px`,
                      transform: isHovered ? "scale(1.25)" : "none",
                      zIndex: isHovered ? 10 : 1,
                    }}
                    onMouseEnter={(e) => {
                      const svgRect = e.currentTarget.getBoundingClientRect();
                      const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                      if (parentRect) {
                        setHoveredCell({
                          dateStr: day.dateStr,
                          count: day.count,
                          x: svgRect.left - parentRect.left + cellSize / 2,
                          y: svgRect.top - parentRect.top - 8,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => handleCellClick(day.dateStr, day.count)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Clean Floating Glass-Styled Micro Tooltip */}
          {hoveredCell && (
            <div
              className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-m3-surface/95 border border-m3-outline-variant/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-glass-md flex flex-col items-center justify-center text-center text-xs select-none"
              style={{
                left: `${hoveredCell.x}px`,
                top: `${hoveredCell.y}px`,
              }}
            >
              <span className="text-[10px] font-mono font-semibold text-m3-on-surface-variant/80 uppercase tracking-wide">
                {formatFullDate(hoveredCell.dateStr)}
              </span>
              <span className="font-bold font-display text-m3-on-surface text-[11px] mt-0.5">
                {hoveredCell.count === 0
                  ? "No saved items"
                  : `${hoveredCell.count} saved ${hoveredCell.count === 1 ? "item" : "items"}`}
              </span>
              {hoveredCell.count > 0 && posts.length > 0 && (
                <span className="text-[8.5px] text-m3-primary font-bold mt-1 font-mono uppercase tracking-wider">
                  Click to Filter Feed
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CalendarHeatmap.displayName = "CalendarHeatmap";
