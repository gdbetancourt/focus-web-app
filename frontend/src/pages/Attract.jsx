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
  TrendingUp,
  Video,
  Sparkles,
  Plus,
  RefreshCw,
  ExternalLink,
  Lightbulb,
  FileText,
  Film,
  Scissors,
  CheckCircle,
  GripVertical,
  X
} from "lucide-react";
import api from "../lib/api";

const STATUS_CONFIG = {
  idea: { label: "Ideas", icon: Lightbulb, color: "bg-blue-500/20 text-blue-400", borderColor: "border-blue-500/30" },
  scripting: { label: "Scripting", icon: FileText, color: "bg-yellow-500/20 text-yellow-400", borderColor: "border-yellow-500/30" },
  filming: { label: "Filming", icon: Film, color: "bg-purple-500/20 text-purple-400", borderColor: "border-purple-500/30" },
  editing: { label: "Editing", icon: Scissors, color: "bg-orange-500/20 text-orange-400", borderColor: "border-orange-500/30" },
  published: { label: "Published", icon: CheckCircle, color: "bg-green-500/20 text-green-400", borderColor: "border-green-500/30" }
};

export default function Attract() {
  const [videoIdeas, setVideoIdeas] = useState([]);
  const [ideaCounts, setIdeaCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [newIdea, setNewIdea] = useState({
    title: "",
    description: "",
    inspiration_url: "",
    status: "idea",
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
      const ideasRes = await api.get("/attract/ideas");
      setVideoIdeas(ideasRes.data.ideas || []);
      setIdeaCounts(ideasRes.data.counts || {});
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const createIdea = async () => {
    if (!newIdea.title) {
      toast.error("Title is required");
      return;
    }

    try {
      const res = await api.post("/attract/ideas", newIdea);
      setVideoIdeas([res.data.idea, ...videoIdeas]);
      setIdeaCounts(prev => ({ ...prev, [newIdea.status]: (prev[newIdea.status] || 0) + 1 }));
      setNewIdeaOpen(false);
      setNewIdea({ title: "", description: "", inspiration_url: "", status: "idea", tags: [], notes: "" });
      toast.success("Video idea created!");
    } catch (error) {
      toast.error("Error creating idea");
    }
  };

  const updateIdea = async (id, updates) => {
    try {
      await api.put(`/attract/ideas/${id}`, updates);
      setVideoIdeas(videoIdeas.map(idea => 
        idea.id === id ? { ...idea, ...updates } : idea
      ));
      setEditingIdea(null);
      toast.success("Idea updated!");
      loadData(); // Refresh counts
    } catch (error) {
      toast.error("Error updating idea");
    }
  };

  const deleteIdea = async (id) => {
    if (!confirm("Delete this idea?")) return;
    
    try {
      await api.delete(`/attract/ideas/${id}`);
      setVideoIdeas(videoIdeas.filter(idea => idea.id !== id));
      toast.success("Idea deleted");
      loadData(); // Refresh counts
    } catch (error) {
      toast.error("Error deleting idea");
    }
  };

  const addTag = () => {
    if (tagInput && !newIdea.tags.includes(tagInput)) {
      setNewIdea({ ...newIdea, tags: [...newIdea.tags, tagInput.toLowerCase()] });
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setNewIdea({ ...newIdea, tags: newIdea.tags.filter(t => t !== tag) });
  };

  const getIdeasByStatus = (status) => {
    return videoIdeas.filter(idea => idea.status === status);
  };

  return (
    <div className="space-y-6" data-testid="attract-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <TrendingUp className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Attract</h1>
            <p className="text-slate-500">Create viral short-form videos to attract new leads</p>
          </div>
        </div>
        <Button 
          onClick={() => setNewIdeaOpen(true)}
          className="bg-[#ff3300] hover:bg-[#ff3300]/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Video Idea
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon;
          return (
            <Card key={status} className={`bg-[#111] border-[#222] ${config.borderColor}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{ideaCounts[status] || 0}</p>
                  <p className="text-xs text-slate-500">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trending Videos - Coming Soon */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="border-b border-[#222]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" />
                Trending Videos
                <Badge className="bg-pink-500/20 text-pink-400 text-xs ml-2">Coming Soon</Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-10 h-10 text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">TikTok Trends Integration</h3>
              <p className="text-slate-400 max-w-sm mx-auto mb-6">
                Get real-time trending videos from TikTok to inspire your content strategy. 
                Requires Apify TikTok actor subscription.
              </p>
              <Button
                variant="outline"
                className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                onClick={() => window.open('https://console.apify.com/actors/zKZGQORXyyBBeJtdg', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Enable TikTok Trends
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="border-b border-[#222]">
            <CardTitle className="text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" />
              Video Ideas Kanban
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3 overflow-x-auto pb-4">
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const Icon = config.icon;
                const ideas = getIdeasByStatus(status);
                
                return (
                  <div key={status} className="min-w-[200px] flex-1">
                    <div className={`p-2 rounded-t-lg ${config.color} flex items-center gap-2`}>
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{config.label}</span>
                      <Badge className="bg-black/20 text-white text-xs ml-auto">{ideas.length}</Badge>
                    </div>
                    <div className="bg-[#0a0a0a] border border-[#222] border-t-0 rounded-b-lg p-2 min-h-[300px] max-h-[400px] overflow-y-auto space-y-2">
                      {ideas.map(idea => (
                        <div
                          key={idea.id}
                          className="p-2 bg-[#111] rounded-lg border border-[#222] hover:border-[#ff3300]/30 cursor-pointer transition-colors group"
                          onClick={() => setEditingIdea(idea)}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium line-clamp-2">{idea.title}</p>
                              {idea.tags && idea.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {idea.tags.slice(0, 2).map((tag, i) => (
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
                      
                      {ideas.length === 0 && (
                        <div className="text-center py-8 text-slate-600 text-xs">
                          No ideas
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Idea Dialog */}
      <Dialog open={newIdeaOpen} onOpenChange={setNewIdeaOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              New Video Idea
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Title *</label>
              <Input
                value={newIdea.title}
                onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                placeholder="Video title or concept"
                className="bg-[#1a1a1a] border-[#333] text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description</label>
              <Textarea
                value={newIdea.description}
                onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                placeholder="Describe the video concept..."
                className="bg-[#1a1a1a] border-[#333] text-white min-h-[100px]"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Inspiration URL</label>
              <Input
                value={newIdea.inspiration_url}
                onChange={(e) => setNewIdea({ ...newIdea, inspiration_url: e.target.value })}
                placeholder="https://tiktok.com/..."
                className="bg-[#1a1a1a] border-[#333] text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Status</label>
              <Select value={newIdea.status} onValueChange={(v) => setNewIdea({ ...newIdea, status: v })}>
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
              {newIdea.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {newIdea.tags.map((tag, i) => (
                    <Badge key={i} className="bg-[#ff3300]/20 text-[#ff3300]">
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
                value={newIdea.notes}
                onChange={(e) => setNewIdea({ ...newIdea, notes: e.target.value })}
                placeholder="Additional notes..."
                className="bg-[#1a1a1a] border-[#333] text-white"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewIdeaOpen(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={createIdea} className="bg-[#ff3300] hover:bg-[#ff3300]/90">
              Create Idea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Idea Dialog */}
      {editingIdea && (
        <Dialog open={!!editingIdea} onOpenChange={() => setEditingIdea(null)}>
          <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                Edit Video Idea
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Title</label>
                <Input
                  value={editingIdea.title}
                  onChange={(e) => setEditingIdea({ ...editingIdea, title: e.target.value })}
                  className="bg-[#1a1a1a] border-[#333] text-white"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Description</label>
                <Textarea
                  value={editingIdea.description || ""}
                  onChange={(e) => setEditingIdea({ ...editingIdea, description: e.target.value })}
                  className="bg-[#1a1a1a] border-[#333] text-white min-h-[100px]"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Status</label>
                <Select 
                  value={editingIdea.status} 
                  onValueChange={(v) => setEditingIdea({ ...editingIdea, status: v })}
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
              
              {editingIdea.inspiration_url && (
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Inspiration</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(editingIdea.inspiration_url, '_blank')}
                    className="border-[#333] text-blue-400"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Original
                  </Button>
                </div>
              )}
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Notes</label>
                <Textarea
                  value={editingIdea.notes || ""}
                  onChange={(e) => setEditingIdea({ ...editingIdea, notes: e.target.value })}
                  className="bg-[#1a1a1a] border-[#333] text-white"
                />
              </div>
            </div>
            
            <DialogFooter className="flex justify-between">
              <Button 
                variant="destructive" 
                onClick={() => deleteIdea(editingIdea.id)}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingIdea(null)} className="border-[#333]">
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateIdea(editingIdea.id, editingIdea)} 
                  className="bg-[#ff3300] hover:bg-[#ff3300]/90"
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
