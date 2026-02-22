import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";
import { 
  FileText,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Eye,
  ChevronRight,
  ChevronLeft,
  Columns,
  List,
  Video,
  BookOpen,
  Target,
  Lightbulb,
  Send,
  CheckCircle,
  Clock,
  ArrowRight
} from "lucide-react";

export default function ContentFlow() {
  const [view, setView] = useState("kanban");
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [kanbanData, setKanbanData] = useState({});
  const [contents, setContents] = useState([]);
  const [stats, setStats] = useState(null);
  const [competences, setCompetences] = useState([]);
  const [levels, setLevels] = useState([]);
  
  // Dialogs
  const [showNewContent, setShowNewContent] = useState(false);
  const [showContentDetail, setShowContentDetail] = useState(null);
  const [showImport, setShowImport] = useState(false);
  
  // Form
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    competence: "",
    level: "",
    source_url: ""
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const sendToVideo = async (contentId) => {
    try {
      const res = await api.post(`/youtube/videos/from-content/${contentId}`);
      if (res.data.success) {
        toast.success(res.data.message || "Video created successfully");
        navigate("/nurture/long-form-videos");
      }
    } catch (error) {
      console.error("Error sending to video:", error);
      toast.error("Error creating video from content");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [stagesRes, kanbanRes, statsRes, compRes, levelsRes] = await Promise.all([
        api.get("/content-flow/stages"),
        api.get("/content-flow/contents/kanban"),
        api.get("/content-flow/stats"),
        api.get("/content-flow/competences"),
        api.get("/content-flow/levels")
      ]);
      
      setStages(stagesRes.data.stages || []);
      setKanbanData(kanbanRes.data.kanban || {});
      setContents(Object.values(kanbanRes.data.kanban || {}).flatMap(s => s.items));
      setStats(statsRes.data);
      setCompetences(compRes.data.competences || []);
      setLevels(levelsRes.data.levels || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading content flow");
    } finally {
      setLoading(false);
    }
  };

  const createContent = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    
    try {
      await api.post("/content-flow/contents", formData);
      toast.success("Content created");
      setShowNewContent(false);
      setFormData({ name: "", description: "", competence: "", level: "", source_url: "" });
      loadData();
    } catch (error) {
      toast.error("Error creating content");
    }
  };

  const moveContent = async (contentId, newStatus) => {
    try {
      await api.put(`/content-flow/contents/${contentId}/move?new_status=${newStatus}`);
      toast.success("Content moved");
      loadData();
    } catch (error) {
      toast.error("Error moving content");
    }
  };

  const updateContent = async (contentId, updates) => {
    try {
      await api.put(`/content-flow/contents/${contentId}`, updates);
      toast.success("Content updated");
      loadData();
      if (showContentDetail?.id === contentId) {
        const updated = await api.get(`/content-flow/contents/${contentId}`);
        setShowContentDetail(updated.data);
      }
    } catch (error) {
      toast.error("Error updating content");
    }
  };

  const deleteContent = async (contentId) => {
    if (!window.confirm("Delete this content?")) return;
    try {
      await api.delete(`/content-flow/contents/${contentId}`);
      toast.success("Content deleted");
      setShowContentDetail(null);
      loadData();
    } catch (error) {
      toast.error("Error deleting content");
    }
  };

  const importFromClickUp = async () => {
    try {
      // Fetch tasks from the old system
      const tasksRes = await fetch("https://persona-assets.preview.emergentagent.com/api/tasks");
      const tasks = await tasksRes.json();
      
      const res = await api.post("/content-flow/import-from-clickup", tasks);
      toast.success(`Imported ${res.data.imported} items, skipped ${res.data.skipped}`);
      setShowImport(false);
      loadData();
    } catch (error) {
      toast.error("Error importing from ClickUp");
    }
  };

  const getStageColor = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.color || "#87909e";
  };

  const getStageName = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || stageId;
  };

  const getNextStage = (currentStage) => {
    const currentIndex = stages.findIndex(s => s.id === currentStage);
    if (currentIndex < stages.length - 1) {
      return stages[currentIndex + 1];
    }
    return null;
  };

  const getPrevStage = (currentStage) => {
    const currentIndex = stages.findIndex(s => s.id === currentStage);
    if (currentIndex > 0) {
      return stages[currentIndex - 1];
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="content-flow-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-flow-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Content Flow</h1>
          <p className="text-slate-400 mt-1">Blog post and article creation pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="border-slate-700 text-slate-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(view === "kanban" ? "list" : "kanban")}
            className="border-slate-700 text-slate-300"
          >
            {view === "kanban" ? <List className="w-4 h-4" /> : <Columns className="w-4 h-4" />}
          </Button>
          <Button onClick={() => setShowNewContent(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Content
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#ff3300]/10">
                <FileText className="w-5 h-5 text-[#ff3300]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
                <p className="text-xs text-slate-400">Total Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Lightbulb className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.by_status?.new || 0}</p>
                <p className="text-xs text-slate-400">New Ideas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.by_status?.text_ok || 0}</p>
                <p className="text-xs text-slate-400">Ready to Publish</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.by_status?.completed || 0}</p>
                <p className="text-xs text-slate-400">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {stages.slice(0, 12).map((stage) => (
              <div
                key={stage.id}
                className="w-72 flex-shrink-0"
              >
                <div 
                  className="flex items-center gap-2 mb-3 px-2"
                  style={{ borderLeft: `3px solid ${stage.color}` }}
                >
                  <h3 className="font-semibold text-white text-sm">{stage.name}</h3>
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                    {kanbanData[stage.id]?.items?.length || 0}
                  </Badge>
                </div>
                <div className="space-y-2 min-h-[200px] bg-slate-900/30 rounded-lg p-2">
                  {kanbanData[stage.id]?.items?.map((content) => (
                    <div
                      key={content.id}
                      className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 hover:border-[#ff3300]/50 transition-all cursor-pointer group"
                      onClick={() => setShowContentDetail(content)}
                    >
                      <p className="text-sm text-white font-medium line-clamp-2 mb-2">
                        {content.name}
                      </p>
                      {content.competence && (
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                          {content.competence}
                        </Badge>
                      )}
                      <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[#ff3300]"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = getNextStage(stage.id);
                            if (next) moveContent(content.id, next.id);
                          }}
                        >
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!kanbanData[stage.id]?.items || kanbanData[stage.id].items.length === 0) && (
                    <div className="text-center py-8 text-slate-300 text-sm">
                      No items
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700">
              {contents.map((content) => (
                <div
                  key={content.id}
                  className="p-4 hover:bg-slate-800/30 transition-colors cursor-pointer flex items-center justify-between"
                  onClick={() => setShowContentDetail(content)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-2 h-10 rounded-full"
                      style={{ backgroundColor: getStageColor(content.status) }}
                    />
                    <div>
                      <p className="font-medium text-white">{content.name}</p>
                      <p className="text-sm text-slate-400">{content.competence || "No competence"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className="border-slate-600"
                      style={{ color: getStageColor(content.status) }}
                    >
                      {getStageName(content.status)}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              ))}
              {contents.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No content yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowNewContent(true)}>
                    Create first content
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Content Dialog */}
      <Dialog open={showNewContent} onOpenChange={setShowNewContent}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">New Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Title</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Article title or topic"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Description / Notes</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Initial notes, source links, etc."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Competence</Label>
                <Select
                  value={formData.competence}
                  onValueChange={(v) => setFormData({ ...formData, competence: v })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competences.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Level</Label>
                <Select
                  value={formData.level}
                  onValueChange={(v) => setFormData({ ...formData, level: v })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Source URL</Label>
              <Input
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                placeholder="https://..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewContent(false)} className="border-slate-700 text-slate-300">
              Cancel
            </Button>
            <Button onClick={createContent} className="btn-primary">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Detail Dialog */}
      <Dialog open={!!showContentDetail} onOpenChange={() => setShowContentDetail(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#ff3300]" />
              Content Detail
            </DialogTitle>
          </DialogHeader>
          {showContentDetail && (
            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label className="text-slate-300">Title</Label>
                <Input
                  value={showContentDetail.name || ""}
                  onChange={(e) => setShowContentDetail({ ...showContentDetail, name: e.target.value })}
                  onBlur={() => updateContent(showContentDetail.id, { name: showContentDetail.name })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-slate-300">Status</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    style={{ backgroundColor: getStageColor(showContentDetail.status), color: "white" }}
                  >
                    {getStageName(showContentDetail.status)}
                  </Badge>
                  <div className="flex gap-1 ml-auto">
                    {getPrevStage(showContentDetail.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-700 text-slate-300"
                        onClick={() => {
                          const prev = getPrevStage(showContentDetail.status);
                          moveContent(showContentDetail.id, prev.id);
                          setShowContentDetail({ ...showContentDetail, status: prev.id });
                        }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    )}
                    {getNextStage(showContentDetail.status) && (
                      <Button
                        size="sm"
                        className="btn-primary"
                        onClick={() => {
                          const next = getNextStage(showContentDetail.status);
                          moveContent(showContentDetail.id, next.id);
                          setShowContentDetail({ ...showContentDetail, status: next.id });
                        }}
                      >
                        <ChevronRight className="w-4 h-4 mr-1" />
                        {getNextStage(showContentDetail.status)?.name}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                      onClick={() => sendToVideo(showContentDetail.id)}
                      data-testid="send-to-video-btn"
                    >
                      <Video className="w-4 h-4 mr-1" />
                      Enviar a Video
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabs for different content sections */}
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="bg-slate-800">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="research">Research</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="publish">Publish</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Description</Label>
                    <Textarea
                      value={showContentDetail.description || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, description: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { description: showContentDetail.description })}
                      className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Competence</Label>
                      <Select
                        value={showContentDetail.competence || ""}
                        onValueChange={(v) => {
                          setShowContentDetail({ ...showContentDetail, competence: v });
                          updateContent(showContentDetail.id, { competence: v });
                        }}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {competences.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Level</Label>
                      <Select
                        value={showContentDetail.level || ""}
                        onValueChange={(v) => {
                          setShowContentDetail({ ...showContentDetail, level: v });
                          updateContent(showContentDetail.id, { level: v });
                        }}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {levels.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="research" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Hypothesis</Label>
                    <Textarea
                      value={showContentDetail.hypothesis || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, hypothesis: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { hypothesis: showContentDetail.hypothesis })}
                      placeholder="What's the main hypothesis for this article?"
                      className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Research Questions</Label>
                    <Textarea
                      value={showContentDetail.research_questions || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, research_questions: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { research_questions: showContentDetail.research_questions })}
                      placeholder="Questions to answer..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Bibliography</Label>
                    <Textarea
                      value={showContentDetail.bibliography || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, bibliography: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { bibliography: showContentDetail.bibliography })}
                      placeholder="Sources, papers, references..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Central Idea</Label>
                    <Textarea
                      value={showContentDetail.central_idea || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, central_idea: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { central_idea: showContentDetail.central_idea })}
                      placeholder="The main idea or thesis..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Article Text</Label>
                    <Textarea
                      value={showContentDetail.article_text || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, article_text: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { article_text: showContentDetail.article_text })}
                      placeholder="Write your article here..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[200px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="publish" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">LinkedIn Post</Label>
                    <Textarea
                      value={showContentDetail.linkedin_post || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, linkedin_post: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { linkedin_post: showContentDetail.linkedin_post })}
                      placeholder="LinkedIn post content..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Substack Draft</Label>
                    <Textarea
                      value={showContentDetail.substack_draft || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, substack_draft: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { substack_draft: showContentDetail.substack_draft })}
                      placeholder="Substack newsletter version..."
                      className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Cover URL</Label>
                    <Input
                      value={showContentDetail.cover_url || ""}
                      onChange={(e) => setShowContentDetail({ ...showContentDetail, cover_url: e.target.value })}
                      onBlur={() => updateContent(showContentDetail.id, { cover_url: showContentDetail.cover_url })}
                      placeholder="https://..."
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Delete Button */}
              <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Created: {showContentDetail.created_at ? new Date(showContentDetail.created_at).toLocaleDateString() : "Unknown"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteContent(showContentDetail.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Import from ClickUp</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400 mb-4">
              This will import all tasks from your previous Content Flow system in ClickUp.
              Duplicates will be skipped.
            </p>
            <div className="p-4 bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-300">Source:</p>
              <p className="text-xs text-slate-500 font-mono">content-flow-37.preview.emergentagent.com</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)} className="border-slate-700 text-slate-300">
              Cancel
            </Button>
            <Button onClick={importFromClickUp} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Import Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
