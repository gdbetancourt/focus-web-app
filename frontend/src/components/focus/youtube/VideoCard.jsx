import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getStageByKey, getStageIndex, FORMAT_BADGES, STAGES } from "./constants";

export default function VideoCard({ video, onMove, onClick }) {
  const stageIdx = getStageIndex(video.status);
  const fmt = FORMAT_BADGES[video.video_format] || FORMAT_BADGES.long;

  const canMoveRight = stageIdx < STAGES.length - 1;
  const canMoveLeft = stageIdx > 0;

  // Check if next stage requirements are met
  const nextStage = canMoveRight ? STAGES[stageIdx + 1] : null;
  const nextBlocked = nextStage?.requiredFields.some((f) => !video[f]);

  return (
    <div
      className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 cursor-pointer hover:border-[#3a3a3a] transition-colors"
      onClick={() => onClick?.(video)}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <h4 className="text-sm font-medium text-white leading-tight line-clamp-2 flex-1">
          {video.title}
        </h4>
        <Badge className={`${fmt.className} text-[10px] shrink-0`}>
          {fmt.label}
        </Badge>
      </div>

      <div className="text-xs text-slate-500 mb-2">
        {video.target_publish_date}
      </div>

      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-slate-500 hover:text-white"
          disabled={!canMoveLeft}
          onClick={() => onMove?.(video, STAGES[stageIdx - 1].key)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-slate-500 hover:text-white"
          disabled={!canMoveRight || nextBlocked}
          title={nextBlocked ? `Falta: ${nextStage?.requiredLabel}` : ""}
          onClick={() => onMove?.(video, STAGES[stageIdx + 1].key)}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
