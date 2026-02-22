import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Youtube,
  Plus,
  RefreshCw,
  ExternalLink,
  Lightbulb,
  FileText,
  Film,
  Scissors,
  CheckCircle,
  Eye,
  GripVertical,
  X,
  Clock,
  Calendar
} from "lucide-react";
import api from "../lib/api";

const STATUS_CONFIG = {
  idea: { label: "Ideas", icon: Lightbulb, color: "bg-blue-500/20 text-blue-400", borderColor: "border-blue-500/30" },
  scripting: { label: "Scripting", icon: FileText, color: "bg-yellow-500/20 text-yellow-400", borderColor: "border-yellow-500/30" },
  filming: { label: "Filming", icon: Film, color: "bg-purple-500/20 text-purple-400", borderColor: "border-purple-500/30" },
  editing: { label: "Editing", icon: Scissors, color: "bg-orange-500/20 text-orange-400", borderColor: "border-orange-500/30" },
  review: { label: "Review", icon: Eye, color: "bg-cyan-500/20 text-cyan-400", borderColor: "border-cyan-500/30" },
  published: { label: "Published", icon: CheckCircle, color: "bg-green-500/20 text-green-400", borderColor: "border-green-500/30" }
};

const DURATION_OPTIONS = [
  "5-10 min",
  "10-15 min",
  "15-20 min",
  "20-30 min",
  "30-45 min",
  "45-60 min",
  "60+ min"
];

export default function LongFormVideos() {
  const [videos, setVideos] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [newVideoOpen, setNewVideoOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [newVideo, setNewVideo] = useState({
    title: "",
    description: "",
    status: "idea",
    script: "",
    thumbnail_notes: "",
    target_duration: "",
    target_publish_date: "",
    tags: [],
    notes: ""
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/youtube/videos");
      setVideos(res.data.videos || []);
      setStatusCounts(res.data.counts || {});
    } catch (error) {
      console.error("Error loading videos:", error);
      toast.error("Error loading videos");
    } finally {
      setLoading(false);
    }
  };

  const createVideo = async () => {
    if (!newVideo.title) {
      toast.error("Title is required");
      return;
    }

    try {
      const res = await api.post("/youtube/videos", newVideo);
      setVideos([res.data.video, ...videos]);
      setStatusCounts(prev => ({ ...prev, [newVideo.status]: (prev[newVideo.status] || 0) + 1 }));
      setNewVideoOpen(false);
      resetNewVideo();
      toast.success("Video project created!");
    } catch (error) {
      toast.error("Error creating video project");
    }
  };

  const updateVideo = async (id, updates) => {
    try {
      await api.put(`/youtube/videos/${id}`, updates);
      setVideos(videos.map(v => v.id === id ? { ...v, ...updates } : v));
      setEditingVideo(null);
      toast.success("Video updated!");
      loadData();
    } catch (error) {
      toast.error("Error updating video");
    }
  };

  const deleteVideo = async (id) => {
    if (!confirm("Delete this video project?")) return;
    
    try {
      await api.delete(`/youtube/videos/${id}`);
      setVideos(videos.filter(v => v.id !== id));
      toast.success("Video deleted");
      loadData();
    } catch (error) {
      toast.error("Error deleting video");
    }
  };

  const resetNewVideo = () => {
    setNewVideo({
      title: "",
      description: "",
      status: "idea",
      script: "",
      thumbnail_notes: "",
      target_duration: "",
      target_publish_date: "",
      tags: [],
      notes: ""
    });
    setTagInput("");
  };

  const addTag = () => {
    if (tagInput && !newVideo.tags.includes(tagInput)) {
      setNewVideo({ ...newVideo, tags: [...newVideo.tags, tagInput.toLowerCase()] });
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setNewVideo({ ...newVideo, tags: newVideo.tags.filter(t => t !== tag) });
  };

  const getVideosByStatus = (status) => {
    return videos.filter(v => v.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="long-form-videos-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/20 to-pink-500/20">
            <Youtube className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Long-form Videos</h1>
            <p className="text-slate-500">Plan and track your YouTube video production</p>
          </div>
        </div>
        <Button 
          onClick={() => setNewVideoOpen(true)}
          className="bg-red-600 hover:bg-red-700"
          data-testid="new-video-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Video Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <Card key={status} className={`bg-[#111] border-[#222] ${config.borderColor}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{statusCounts[status] || 0}</p>
                  <p className="text-xs text-slate-500">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Kanban Board */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="border-b border-[#222]">
          <CardTitle className="text-white flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-400" />
            Video Production Kanban
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon;
              const statusVideos = getVideosByStatus(status);
              
              return (
                <div key={status} className="min-w-[220px] flex-1">
                  <div className={`p-2 rounded-t-lg ${config.color} flex items-center gap-2`}>
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{config.label}</span>
                    <Badge className="bg-black/20 text-white text-xs ml-auto">{statusVideos.length}</Badge>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#222] border-t-0 rounded-b-lg p-2 min-h-[350px] max-h-[450px] overflow-y-auto space-y-2">
                    {statusVideos.map(video => (
                      <div
                        key={video.id}
                        className="p-3 bg-[#111] rounded-lg border border-[#222] hover:border-red-500/30 cursor-pointer transition-colors group"
                        onClick={() => setEditingVideo(video)}
                        data-testid={`video-card-${video.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium line-clamp-2">{video.title}</p>
                            {video.target_duration && (
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {video.target_duration}
                              </p>
                            )}
                            {video.target_publish_date && (
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {video.target_publish_date}
                              </p>
                            )}
                            {video.tags && video.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {video.tags.slice(0, 2).map((tag, i) => (
                                  <Badge key={i} className="bg-[#222] text-slate-400 text-[9px]">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {statusVideos.length === 0 && (
                      <div className="text-center py-8 text-slate-600 text-xs">
                        No videos
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* New Video Dialog */}
      <Dialog open={newVideoOpen} onOpenChange={setNewVideoOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-400" />
              New Video Project
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Title *</label>
              <Input
                value={newVideo.title}
                onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                placeholder="Video title"
                className="bg-[#1a1a1a] border-[#333] text-white"
                data-testid="new-video-title"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description</label>
              <Textarea
                value={newVideo.description}
                onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
                placeholder="Brief description of the video..."
                className="bg-[#1a1a1a] border-[#333] text-white min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Status</label>
                <Select value={newVideo.status} onValueChange={(v) => setNewVideo({ ...newVideo, status: v })}>
                  <SelectTrigger className="bg-[#1a1a1a] border-[#333] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                      <SelectItem key={status} value={status}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Target Duration</label>
                <Select value={newVideo.target_duration} onValueChange={(v) => setNewVideo({ ...newVideo, target_duration: v })}>
                  <SelectTrigger className="bg-[#1a1a1a] border-[#333] text-white">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Target Publish Date</label>
              <Input
                type="date"
                value={newVideo.target_publish_date}
                onChange={(e) => setNewVideo({ ...newVideo, target_publish_date: e.target.value })}
                className="bg-[#1a1a1a] border-[#333] text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Tags</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add tag..."
                  className="bg-[#1a1a1a] border-[#333] text-white flex-1"
                />
                <Button onClick={addTag} variant="outline" className="border-[#333]">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newVideo.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {newVideo.tags.map((tag, i) => (
                    <Badge key={i} className="bg-red-500/20 text-red-400">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Notes</label>
              <Textarea
                value={newVideo.notes}
                onChange={(e) => setNewVideo({ ...newVideo, notes: e.target.value })}
                placeholder="Additional notes, ideas, research links..."
                className="bg-[#1a1a1a] border-[#333] text-white"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewVideoOpen(false); resetNewVideo(); }} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={createVideo} className="bg-red-600 hover:bg-red-700" data-testid="create-video-btn">
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Video Dialog */}
      {editingVideo && (
        <Dialog open={!!editingVideo} onOpenChange={() => setEditingVideo(null)}>
          <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-400" />
                Edit Video Project
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Title</label>
                <Input
                  value={editingVideo.title}
                  onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                  className="bg-[#1a1a1a] border-[#333] text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description</label>
                <Textarea
                  value={editingVideo.description || ""}
                  onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                  className="bg-[#1a1a1a] border-[#333] text-white min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Status</label>
                  <Select 
                    value={editingVideo.status} 
                    onValueChange={(v) => setEditingVideo({ ...editingVideo, status: v })}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-[#333] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <SelectItem key={status} value={status}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Target Duration</label>
                  <Select 
                    value={editingVideo.target_duration || ""} 
                    onValueChange={(v) => setEditingVideo({ ...editingVideo, target_duration: v })}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] border-[#333] text-white">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Target Publish Date</label>
                  <Input
                    type="date"
                    value={editingVideo.target_publish_date || ""}
                    onChange={(e) => setEditingVideo({ ...editingVideo, target_publish_date: e.target.value })}
                    className="bg-[#1a1a1a] border-[#333] text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">YouTube URL</label>
                  <Input
                    value={editingVideo.youtube_url || ""}
                    onChange={(e) => setEditingVideo({ ...editingVideo, youtube_url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="bg-[#1a1a1a] border-[#333] text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Script / Outline</label>
                <Textarea
                  value={editingVideo.script || ""}
                  onChange={(e) => setEditingVideo({ ...editingVideo, script: e.target.value })}
                  placeholder="Write your video script or outline here..."
                  className="bg-[#1a1a1a] border-[#333] text-white min-h-[150px] font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Thumbnail Notes</label>
                <Textarea
                  value={editingVideo.thumbnail_notes || ""}
                  onChange={(e) => setEditingVideo({ ...editingVideo, thumbnail_notes: e.target.value })}
                  placeholder="Ideas for thumbnail: text, image concepts, colors..."
                  className="bg-[#1a1a1a] border-[#333] text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Notes</label>
                <Textarea
                  value={editingVideo.notes || ""}
                  onChange={(e) => setEditingVideo({ ...editingVideo, notes: e.target.value })}
                  className="bg-[#1a1a1a] border-[#333] text-white"
                />
              </div>

              {editingVideo.youtube_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(editingVideo.youtube_url, '_blank')}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Watch on YouTube
                </Button>
              )}
            </div>
            
            <DialogFooter className="flex justify-between">
              <Button 
                variant="destructive" 
                onClick={() => deleteVideo(editingVideo.id)}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingVideo(null)} className="border-[#333]">
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateVideo(editingVideo.id, editingVideo)} 
                  className="bg-red-600 hover:bg-red-700"
                >
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
