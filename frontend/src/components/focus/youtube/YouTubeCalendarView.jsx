import { useState, useMemo } from "react";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { getStageByKey, FORMAT_BADGES } from "./constants";

function MonthGrid({ videos, year, month, onClickVideo }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  // Group videos by day
  const videosByDay = {};
  for (const v of videos) {
    if (!v.target_publish_date) continue;
    const d = new Date(v.target_publish_date + "T12:00:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!videosByDay[day]) videosByDay[day] = [];
      videosByDay[day].push(v);
    }
  }

  const today = new Date();
  const isToday = (day) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  // Build grid cells
  const cells = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] text-slate-500 font-medium py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-[80px] rounded border ${
              day
                ? isToday(day)
                  ? "border-[#ff3300]/50 bg-[#ff3300]/5"
                  : "border-[#222] bg-[#0d0d0d]"
                : "border-transparent"
            } p-1`}
          >
            {day && (
              <>
                <div
                  className={`text-xs font-medium mb-1 ${
                    isToday(day) ? "text-[#ff3300]" : "text-slate-500"
                  }`}
                >
                  {day}
                </div>
                <div className="space-y-0.5">
                  {(videosByDay[day] || []).map((v) => {
                    const fmt = FORMAT_BADGES[v.video_format];
                    const stage = getStageByKey(v.status);
                    return (
                      <div
                        key={v.id}
                        className={`text-[10px] px-1 py-0.5 rounded cursor-pointer truncate ${stage?.badgeColor || "bg-slate-700 text-slate-300"}`}
                        title={`${v.title} (${stage?.label})`}
                        onClick={() => onClickVideo?.(v)}
                      >
                        {v.video_format === "short" ? "S" : "L"} {v.title}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineList({ videos, onClickVideo }) {
  const sorted = [...videos].sort(
    (a, b) =>
      (a.target_publish_date || "").localeCompare(b.target_publish_date || "")
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No hay videos programados este mes.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((v) => {
        const stage = getStageByKey(v.status);
        const fmt = FORMAT_BADGES[v.video_format];
        return (
          <div
            key={v.id}
            className="flex items-center gap-3 bg-[#111] border border-[#222] rounded-lg px-3 py-2 cursor-pointer hover:border-[#333] transition-colors"
            onClick={() => onClickVideo?.(v)}
          >
            <div className="text-sm text-slate-400 font-mono w-24 shrink-0">
              {v.target_publish_date}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-white truncate block">
                {v.title}
              </span>
            </div>
            <Badge className={`${fmt?.className} text-[10px] shrink-0`}>
              {fmt?.label}
            </Badge>
            <Badge className={`${stage?.badgeColor} text-[10px] shrink-0`}>
              {stage?.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export default function YouTubeCalendarView({ videos, onClickVideo }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [subView, setSubView] = useState("month"); // "month" | "timeline"

  const monthLabel = new Date(year, month).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  const monthVideos = useMemo(() => {
    return videos.filter((v) => {
      if (!v.target_publish_date) return false;
      const d = new Date(v.target_publish_date + "T12:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [videos, year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={prevMonth}
            className="text-slate-400 hover:text-white h-7 w-7 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-white capitalize w-40 text-center">
            {monthLabel}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={nextMonth}
            className="text-slate-400 hover:text-white h-7 w-7 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-0.5">
          <Button
            size="sm"
            variant={subView === "month" ? "default" : "ghost"}
            className={`h-7 px-2 text-xs ${subView === "month" ? "bg-[#ff3300]" : "text-slate-400"}`}
            onClick={() => setSubView("month")}
          >
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Mes
          </Button>
          <Button
            size="sm"
            variant={subView === "timeline" ? "default" : "ghost"}
            className={`h-7 px-2 text-xs ${subView === "timeline" ? "bg-[#ff3300]" : "text-slate-400"}`}
            onClick={() => setSubView("timeline")}
          >
            <List className="w-3.5 h-3.5 mr-1" />
            Timeline
          </Button>
        </div>
      </div>

      {/* Content */}
      {subView === "month" ? (
        <MonthGrid
          videos={videos}
          year={year}
          month={month}
          onClickVideo={onClickVideo}
        />
      ) : (
        <TimelineList videos={monthVideos} onClickVideo={onClickVideo} />
      )}
    </div>
  );
}
