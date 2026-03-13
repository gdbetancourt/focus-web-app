import { useState, useEffect, useCallback } from "react";
import { Button } from "../../ui/button";
import { Plus, RefreshCw, LayoutGrid, CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../../../lib/api";
import YouTubeKanbanView from "./YouTubeKanbanView";
import YouTubeCalendarView from "./YouTubeCalendarView";
import VideoDialog from "./VideoDialog";

export default function YouTubeContent() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("kanban"); // "kanban" | "calendar"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const loadVideos = useCallback(async () => {
    try {
      const res = await api.get("/youtube-ideas/videos");
      setVideos(res.data || []);
    } catch (error) {
      console.error("Error loading videos:", error);
      toast.error("Error al cargar videos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleMove = async (video, newStage) => {
    try {
      await api.post(`/youtube-ideas/videos/${video.id}/move`, {
        new_stage: newStage,
      });
      loadVideos();
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo mover el video");
    }
  };

  const handleClickVideo = (video) => {
    setSelectedVideo(video);
    setDialogOpen(true);
  };

  const handleNewVideo = () => {
    setSelectedVideo(null);
    setDialogOpen(true);
  };

  const handleDelete = async (video) => {
    if (!window.confirm(`¿Eliminar "${video.title}"?`)) return;
    try {
      await api.delete(`/youtube-ideas/videos/${video.id}`);
      toast.success("Video eliminado");
      loadVideos();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div>
      {/* Header with view toggle + actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-0.5">
          <Button
            size="sm"
            variant={view === "kanban" ? "default" : "ghost"}
            className={`h-8 px-3 text-xs ${view === "kanban" ? "bg-[#ff3300]" : "text-slate-400"}`}
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            Kanban
          </Button>
          <Button
            size="sm"
            variant={view === "calendar" ? "default" : "ghost"}
            className={`h-8 px-3 text-xs ${view === "calendar" ? "bg-[#ff3300]" : "text-slate-400"}`}
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Calendario
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLoading(true);
              loadVideos();
            }}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={handleNewVideo}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Video
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Cargando videos...
        </div>
      ) : view === "kanban" ? (
        <YouTubeKanbanView
          videos={videos}
          onMove={handleMove}
          onClickVideo={handleClickVideo}
        />
      ) : (
        <YouTubeCalendarView
          videos={videos}
          onClickVideo={handleClickVideo}
        />
      )}

      {/* Video Dialog */}
      <VideoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        video={selectedVideo}
        onSaved={loadVideos}
      />
    </div>
  );
}
