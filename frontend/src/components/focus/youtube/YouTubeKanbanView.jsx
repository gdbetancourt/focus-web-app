import { STAGES } from "./constants";
import VideoCard from "./VideoCard";

export default function YouTubeKanbanView({ videos, onMove, onClickVideo }) {
  // Group videos by stage
  const grouped = {};
  for (const s of STAGES) grouped[s.key] = [];
  for (const v of videos) {
    if (grouped[v.status]) grouped[v.status].push(v);
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid grid-cols-7 gap-3 min-w-[1100px]">
        {STAGES.map((stage) => (
          <div key={stage.key} className="flex flex-col">
            {/* Column header */}
            <div
              className={`${stage.color} rounded-t-lg px-2 py-1.5 flex items-center justify-between`}
            >
              <span className="text-xs font-semibold text-white truncate">
                {stage.label}
              </span>
              <span className="text-[10px] bg-white/20 rounded-full px-1.5 py-0.5 text-white font-bold">
                {grouped[stage.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="bg-[#0d0d0d] border border-[#222] border-t-0 rounded-b-lg p-2 space-y-2 min-h-[120px] flex-1">
              {grouped[stage.key].length === 0 ? (
                <div className="text-xs text-slate-600 text-center py-4">
                  Sin videos
                </div>
              ) : (
                grouped[stage.key].map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onMove={onMove}
                    onClick={onClickVideo}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
