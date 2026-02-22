import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Wand2,
  FileText,
  Presentation,
  Linkedin,
  BookOpen,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Download,
  ClipboardList,
  Video,
  Lightbulb,
  Plus,
  Trash2,
  Send,
  Eye,
  Calendar,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function ContentPipeline() {
  const [activeTab, setActiveTab] = useState("ideas");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Global language setting
  const [language, setLanguage] = useState("es");

  // Ideas/Captures state
  const [ideas, setIdeas] = useState([]);
  const [newIdeaText, setNewIdeaText] = useState("");
  const [newIdeaTitle, setNewIdeaTitle] = useState("");
  const [selectedIdea, setSelectedIdea] = useState(null);

  // Dictation cleanup state
  const [dictationInput, setDictationInput] = useState("");
  const [dictationStyle, setDictationStyle] = useState("professional");
  const [cleanedText, setCleanedText] = useState("");

  // Slides state
  const [slidesInput, setSlidesInput] = useState("");
  const [slidesStyle, setSlidesStyle] = useState("executive");
  const [numSlides, setNumSlides] = useState(5);
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(true);
  const [generatedSlides, setGeneratedSlides] = useState([]);

  // LinkedIn state
  const [linkedinInput, setLinkedinInput] = useState("");
  const [linkedinTone, setLinkedinTone] = useState("thought_leader");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [linkedinPost, setLinkedinPost] = useState("");

  // Blog outline state
  const [blogTopic, setBlogTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("professionals");
  const [wordCountTarget, setWordCountTarget] = useState(1500);
  const [blogOutline, setBlogOutline] = useState(null);

  // Blog publish state
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [blogPostForm, setBlogPostForm] = useState({
    title: "",
    content: "",
    excerpt: "",
    is_published: false,
  });

  // Load ideas on mount
  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      const response = await api.get("/content-flow/contents?limit=50");
      setIdeas(response.data.contents || []);
    } catch (error) {
      console.error("Error loading ideas:", error);
    }
  };

  const createIdea = async () => {
    if (!newIdeaText.trim()) {
      toast.error("Escribe una idea primero");
      return;
    }
    setLoading(true);
    try {
      await api.post("/content-flow/contents", {
        name: newIdeaTitle || newIdeaText.substring(0, 50),
        description: newIdeaText,
      });
      toast.success("Idea guardada");
      setNewIdeaText("");
      setNewIdeaTitle("");
      loadIdeas();
    } catch (error) {
      toast.error("Error saving idea");
    } finally {
      setLoading(false);
    }
  };

  const deleteIdea = async (id) => {
    if (!confirm("Delete this idea?")) return;
    try {
      await api.delete(`/content-flow/contents/${id}`);
      toast.success("Idea deleted");
      loadIdeas();
      if (selectedIdea?.id === id) setSelectedIdea(null);
    } catch (error) {
      toast.error("Error deleting idea");
    }
  };

  const loadIdeaForContent = (idea) => {
    setSelectedIdea(idea);
    setBlogTopic(idea.name);
    setDictationInput(idea.description || "");
    setSlidesInput(idea.description || "");
    setLinkedinInput(idea.description || "");
    toast.success(`Idea "${idea.name}" cargada para trabajar`);
  };

  const moveIdeaToStage = async (id, newStatus) => {
    try {
      await api.put(`/content-flow/contents/${id}/move?new_status=${newStatus}`);
      toast.success("Estado actualizado");
      loadIdeas();
    } catch (error) {
      toast.error("Error actualizando estado");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCleanDictation = async () => {
    if (!dictationInput.trim()) {
      toast.error("Ingresa el texto a limpiar");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/content-flow/ai/clean-dictation", null, {
        params: { text: dictationInput, style: dictationStyle, language },
      });
      setCleanedText(res.data.cleaned_text);
      toast.success("Texto limpiado exitosamente");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error procesando texto");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSlides = async () => {
    if (!slidesInput.trim()) {
      toast.error("Ingresa el contenido para las slides");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/content-flow/ai/generate-slides", null, {
        params: {
          content: slidesInput,
          num_slides: numSlides,
          style: slidesStyle,
          include_speaker_notes: includeSpeakerNotes,
          language,
        },
      });
      setGeneratedSlides(res.data.slides);
      toast.success(`${res.data.num_slides} slides generadas`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error generando slides");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLinkedin = async () => {
    if (!linkedinInput.trim()) {
      toast.error("Ingresa el contenido para el post");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/content-flow/ai/generate-linkedin-post", null, {
        params: {
          content: linkedinInput,
          tone: linkedinTone,
          include_hashtags: includeHashtags,
          language,
        },
      });
      setLinkedinPost(res.data.post);
      toast.success("Post de LinkedIn generado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error generando post");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBlogOutline = async () => {
    if (!blogTopic.trim()) {
      toast.error("Ingresa el tema del blog");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/content-flow/ai/generate-blog-outline", null, {
        params: {
          topic: blogTopic,
          target_audience: targetAudience,
          word_count_target: wordCountTarget,
          language,
        },
      });
      setBlogOutline(res.data.outline);
      toast.success("Outline generado");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error generando outline");
    } finally {
      setLoading(false);
    }
  };

  const openPublishDialog = () => {
    if (!blogOutline) {
      toast.error("Primero genera un outline");
      return;
    }
    setBlogPostForm({
      title: blogOutline.title || blogTopic,
      content: generateBlogContent(),
      excerpt: blogOutline.meta_description || "",
      is_published: false,
    });
    setPublishDialogOpen(true);
  };

  const generateBlogContent = () => {
    if (!blogOutline) return "";
    
    let content = "";
    
    // Introduction
    if (blogOutline.introduction) {
      content += `${blogOutline.introduction.hook}\n\n`;
      content += `${blogOutline.introduction.context}\n\n`;
      content += `${blogOutline.introduction.thesis}\n\n`;
    }
    
    // Sections
    blogOutline.sections?.forEach((section) => {
      content += `## ${section.heading}\n\n`;
      section.subheadings?.forEach((sub) => {
        content += `### ${sub}\n\n`;
      });
      section.key_points?.forEach((point) => {
        content += `- ${point}\n`;
      });
      content += "\n";
    });
    
    // Conclusion
    if (blogOutline.conclusion) {
      content += `## Conclusión\n\n`;
      content += `${blogOutline.conclusion.summary}\n\n`;
      content += `**${blogOutline.conclusion.cta}**\n`;
    }
    
    return content;
  };

  const publishToBlog = async () => {
    if (!blogPostForm.title || !blogPostForm.content) {
      toast.error("Título y contenido son requeridos");
      return;
    }
    
    setLoading(true);
    try {
      await api.post("/blog/posts", {
        title: blogPostForm.title,
        content: blogPostForm.content,
        excerpt: blogPostForm.excerpt,
        is_published: blogPostForm.is_published,
        tags: blogOutline?.target_keywords || [],
      });
      toast.success(blogPostForm.is_published ? "Article published" : "Draft saved");
      setPublishDialogOpen(false);
      
      // Update idea status if we have one selected
      if (selectedIdea) {
        await moveIdeaToStage(selectedIdea.id, "website_published");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error publishing");
    } finally {
      setLoading(false);
    }
  };

  const exportSlidesToText = () => {
    if (generatedSlides.length === 0) return;

    let text = "# Presentación\n\n";
    generatedSlides.forEach((slide, idx) => {
      text += `## Slide ${idx + 1}: ${slide.title}\n`;
      if (slide.subtitle) text += `*${slide.subtitle}*\n`;
      text += "\n";
      slide.bullets?.forEach((bullet) => {
        text += `- ${bullet}\n`;
      });
      if (slide.speaker_notes) {
        text += `\n**Notas:** ${slide.speaker_notes}\n`;
      }
      text += "\n---\n\n";
    });

    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "presentation.md";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Slides exported as Markdown");
  };

  return (
    <div className="space-y-6" data-testid="content-pipeline-page">
      {/* Header */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/20">
            <Wand2 className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Content Pipeline</h1>
            <p className="text-slate-500">
              AI tools to create professional content
            </p>
          </div>
        </div>
        
        {/* Content Language Selector (for AI generation, not UI) */}
        <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-lg p-1">
          <span className="text-xs text-slate-500 px-2">Content:</span>
          <Button
            variant={language === "es" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLanguage("es")}
            className={language === "es" ? "bg-purple-500 text-white" : "text-slate-400"}
          >
            🇪🇸 ES
          </Button>
          <Button
            variant={language === "en" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLanguage("en")}
            className={language === "en" ? "bg-purple-500 text-white" : "text-slate-400"}
          >
            🇺🇸 EN
          </Button>
        </div>
      </div>

      {/* Tools Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222] grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger
            value="ideas"
            className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Ideas
          </TabsTrigger>
          <TabsTrigger
            value="dictation"
            className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
          >
            <FileText className="w-4 h-4 mr-2" />
            Dictation
          </TabsTrigger>
          <TabsTrigger
            value="slides"
            className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
          >
            <Presentation className="w-4 h-4 mr-2" />
            Slides
          </TabsTrigger>
          <TabsTrigger
            value="linkedin"
            className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400"
          >
            <Linkedin className="w-4 h-4 mr-2" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger
            value="blog"
            className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Blog
          </TabsTrigger>
          <TabsTrigger
            value="video"
            className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400"
          >
            <Video className="w-4 h-4 mr-2" />
            Video
          </TabsTrigger>
        </TabsList>

        {/* Ideas Tab */}
        <TabsContent value="ideas" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-3 gap-6">
            {/* New Idea Form */}
            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-yellow-500" />
                  New Idea
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Capture ideas quickly or receive them from iOS Shortcut
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Title (optional)"
                  className="bg-[#0a0a0a] border-[#333] text-white"
                  value={newIdeaTitle}
                  onChange={(e) => setNewIdeaTitle(e.target.value)}
                  data-testid="new-idea-title"
                />
                <Textarea
                  placeholder="Describe your idea, insight, or quote to develop..."
                  className="min-h-[120px] bg-[#0a0a0a] border-[#333] text-white"
                  value={newIdeaText}
                  onChange={(e) => setNewIdeaText(e.target.value)}
                  data-testid="new-idea-text"
                />
                <Button
                  onClick={createIdea}
                  disabled={loading || !newIdeaText.trim()}
                  className="w-full bg-yellow-600 hover:bg-yellow-700"
                  data-testid="save-idea-btn"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Save Idea
                </Button>
              </CardContent>
            </Card>

            {/* Ideas List */}
            <Card className="md:col-span-2 bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    Pending Ideas ({ideas.filter(i => i.status === "new").length})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadIdeas}
                    className="text-slate-400"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {ideas.filter(i => i.status === "new").length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay ideas pendientes</p>
                      <p className="text-xs mt-1">Crea una nueva o usa el iOS Shortcut</p>
                    </div>
                  ) : (
                    ideas.filter(i => i.status === "new").map((idea) => (
                      <div
                        key={idea.id}
                        className={`bg-[#0a0a0a] border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedIdea?.id === idea.id
                            ? "border-yellow-500"
                            : "border-[#333] hover:border-yellow-500/50"
                        }`}
                        onClick={() => setSelectedIdea(idea)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{idea.name}</h4>
                            <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                              {idea.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {idea.source === "ios_shortcut" && (
                                <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                                  iOS
                                </Badge>
                              )}
                              <span className="text-xs text-slate-500">
                                {new Date(idea.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadIdeaForContent(idea);
                              }}
                              className="text-green-400 hover:text-green-300 h-8 w-8 p-0"
                              title="Usar para contenido"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteIdea(idea.id);
                              }}
                              className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Idea Actions */}
          {selectedIdea && (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-400">Idea seleccionada:</p>
                    <p className="font-medium text-white">{selectedIdea.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-500/50 text-yellow-400"
                      onClick={() => {
                        loadIdeaForContent(selectedIdea);
                        setActiveTab("dictation");
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Clean Text
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-500/50 text-yellow-400"
                      onClick={() => {
                        loadIdeaForContent(selectedIdea);
                        setActiveTab("blog");
                      }}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Create Blog
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-500/50 text-yellow-400"
                      onClick={() => {
                        loadIdeaForContent(selectedIdea);
                        setActiveTab("linkedin");
                      }}
                    >
                      <Linkedin className="w-4 h-4 mr-2" />
                      LinkedIn Post
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Dictation Cleanup Tab */}
        <TabsContent value="dictation" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-500" />
                  Original Text (Dictation/Transcription)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste your dictated or transcribed text here. AI will clean it up, removing filler words, fixing grammar and improving structure..."
                  className="min-h-[250px] bg-[#0a0a0a] border-[#333] text-white"
                  value={dictationInput}
                  onChange={(e) => setDictationInput(e.target.value)}
                  data-testid="dictation-input"
                />
                <div className="flex items-center gap-4">
                  <Select value={dictationStyle} onValueChange={setDictationStyle}>
                    <SelectTrigger className="w-48 bg-[#0a0a0a] border-[#333]">
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCleanDictation}
                    disabled={loading || !dictationInput.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="clean-dictation-btn"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Clean with AI
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    Cleaned Text
                  </span>
                  {cleanedText && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(cleanedText)}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cleanedText ? (
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 min-h-[250px] text-slate-300 whitespace-pre-wrap">
                    {cleanedText}
                  </div>
                ) : (
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 min-h-[250px] flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <ArrowRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>El texto limpio aparecerá aquí</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Slides Tab */}
        <TabsContent value="slides" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Presentation className="w-5 h-5 text-blue-500" />
                  Contenido para Presentación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Pega aquí el contenido que quieres convertir en una presentación. Puede ser un artículo, notas, o texto limpio..."
                  className="min-h-[200px] bg-[#0a0a0a] border-[#333] text-white"
                  value={slidesInput}
                  onChange={(e) => setSlidesInput(e.target.value)}
                  data-testid="slides-input"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={slidesStyle} onValueChange={setSlidesStyle}>
                    <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                      <SelectValue placeholder="Estilo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Ejecutivo</SelectItem>
                      <SelectItem value="educational">Educativo</SelectItem>
                      <SelectItem value="sales">Ventas</SelectItem>
                      <SelectItem value="creative">Creativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(numSlides)}
                    onValueChange={(v) => setNumSlides(Number(v))}
                  >
                    <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                      <SelectValue placeholder="# Slides" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 slides</SelectItem>
                      <SelectItem value="5">5 slides</SelectItem>
                      <SelectItem value="7">7 slides</SelectItem>
                      <SelectItem value="10">10 slides</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={includeSpeakerNotes}
                      onCheckedChange={setIncludeSpeakerNotes}
                    />
                    <span className="text-sm text-slate-400">Incluir notas del presentador</span>
                  </div>
                  <Button
                    onClick={handleGenerateSlides}
                    disabled={loading || !slidesInput.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="generate-slides-btn"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Slides
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-blue-500" />
                    Generated Slides ({generatedSlides.length})
                  </span>
                  {generatedSlides.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={exportSlidesToText}>
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedSlides.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {generatedSlides.map((slide, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-500/20 text-blue-400">
                            {slide.slide_number || idx + 1}
                          </Badge>
                          <h4 className="font-medium text-white">{slide.title}</h4>
                        </div>
                        {slide.subtitle && (
                          <p className="text-sm text-slate-400 mb-2">{slide.subtitle}</p>
                        )}
                        <ul className="space-y-1 text-sm text-slate-300">
                          {slide.bullets?.map((bullet, bidx) => (
                            <li key={bidx} className="flex items-start gap-2">
                              <span className="text-blue-400 mt-1">•</span>
                              {bullet}
                            </li>
                          ))}
                        </ul>
                        {slide.speaker_notes && (
                          <div className="mt-3 pt-3 border-t border-[#333]">
                            <p className="text-xs text-slate-500">
                              <strong>Notas:</strong> {slide.speaker_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 min-h-[300px] flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <Presentation className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Las slides aparecerán aquí</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Blog Outline Tab */}
        <TabsContent value="blog" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-500" />
                  Configuración del Blog
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Tema del artículo</label>
                  <Input
                    placeholder="Ej: Cómo mejorar tus habilidades de presentación..."
                    className="bg-[#0a0a0a] border-[#333] text-white"
                    value={blogTopic}
                    onChange={(e) => setBlogTopic(e.target.value)}
                    data-testid="blog-topic-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Audiencia</label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professionals">Profesionales</SelectItem>
                        <SelectItem value="executives">Ejecutivos</SelectItem>
                        <SelectItem value="entrepreneurs">Emprendedores</SelectItem>
                        <SelectItem value="students">Estudiantes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Palabras objetivo</label>
                    <Select
                      value={String(wordCountTarget)}
                      onValueChange={(v) => setWordCountTarget(Number(v))}
                    >
                      <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="800">800 palabras</SelectItem>
                        <SelectItem value="1500">1500 palabras</SelectItem>
                        <SelectItem value="2500">2500 palabras</SelectItem>
                        <SelectItem value="3500">3500 palabras</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleGenerateBlogOutline}
                  disabled={loading || !blogTopic.trim()}
                  className="w-full bg-green-600 hover:bg-green-700"
                  data-testid="generate-outline-btn"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Generate Outline
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-green-500" />
                  Blog Outline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {blogOutline ? (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                      <h3 className="font-bold text-white text-lg">{blogOutline.title}</h3>
                      <p className="text-sm text-slate-400 mt-1">{blogOutline.meta_description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {blogOutline.target_keywords?.map((kw, idx) => (
                          <Badge key={idx} className="bg-green-500/20 text-green-400 text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {blogOutline.introduction && (
                      <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-3">
                        <h4 className="font-medium text-slate-300 mb-2">Introduction</h4>
                        <ul className="text-sm text-slate-400 space-y-1">
                          <li><strong>Hook:</strong> {blogOutline.introduction.hook}</li>
                          <li><strong>Context:</strong> {blogOutline.introduction.context}</li>
                          <li><strong>Thesis:</strong> {blogOutline.introduction.thesis}</li>
                        </ul>
                      </div>
                    )}

                    {blogOutline.sections?.map((section, idx) => (
                      <div key={idx} className="bg-[#0a0a0a] border border-[#333] rounded-lg p-3">
                        <h4 className="font-medium text-white mb-2">
                          {idx + 1}. {section.heading}
                        </h4>
                        {section.subheadings && (
                          <ul className="text-sm text-slate-400 ml-4 mb-2">
                            {section.subheadings.map((sub, sidx) => (
                              <li key={sidx}>• {sub}</li>
                            ))}
                          </ul>
                        )}
                        {section.key_points && (
                          <div className="text-xs text-slate-500 mt-2">
                            <strong>Puntos clave:</strong> {section.key_points.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}

                    {blogOutline.conclusion && (
                      <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-3">
                        <h4 className="font-medium text-slate-300 mb-2">Conclusión</h4>
                        <ul className="text-sm text-slate-400 space-y-1">
                          <li><strong>Resumen:</strong> {blogOutline.conclusion.summary}</li>
                          <li><strong>CTA:</strong> {blogOutline.conclusion.cta}</li>
                        </ul>
                      </div>
                    )}

                    {/* Publish Button */}
                    <Button
                      onClick={openPublishDialog}
                      className="w-full bg-green-600 hover:bg-green-700 mt-4"
                      data-testid="publish-blog-btn"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Publish to Blog
                    </Button>
                  </div>
                ) : (
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-4 min-h-[300px] flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Outline will appear here</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video" className="space-y-4 mt-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-red-500" />
                Video Processing
              </CardTitle>
              <CardDescription className="text-slate-400">
                Transcribe videos, generate scripts and upload to YouTube
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-purple-500" />
                  <h3 className="font-medium text-white mb-2">Transcribir</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Convierte audio/video a texto con Whisper AI
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-purple-500/50 text-purple-400"
                    onClick={() => window.location.href = '/nurture/video-processing'}
                  >
                    Ir a Transcribir
                  </Button>
                </div>
                <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 text-center">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-blue-500" />
                  <h3 className="font-medium text-white mb-2">Analizar</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Extrae insights y clips sugeridos con IA
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-blue-500/50 text-blue-400"
                    onClick={() => window.location.href = '/nurture/video-processing'}
                  >
                    Ir a Analizar
                  </Button>
                </div>
                <div className="bg-[#0a0a0a] border border-[#333] rounded-lg p-6 text-center">
                  <ExternalLink className="w-10 h-10 mx-auto mb-3 text-red-500" />
                  <h3 className="font-medium text-white mb-2">YouTube</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Conecta tu canal y gestiona tus videos
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400"
                    onClick={() => window.location.href = '/nurture/video-processing'}
                  >
                    Ir a YouTube
                  </Button>
                </div>
              </div>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                <div className="flex items-center gap-3">
                  <Video className="w-6 h-6 text-blue-400" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium">Flujo completo de video</p>
                    <p className="text-xs text-slate-400 mt-1">
                      1. Sube video → 2. Transcribe → 3. Genera guión limpio → 4. Crea clips → 5. Sube a YouTube
                    </p>
                  </div>
                  <Button
                    className="ml-auto bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.location.href = '/nurture/video-processing'}
                    data-testid="go-video-processing-btn"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Abrir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Publish Blog Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish to Blog</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Title</label>
              <Input
                value={blogPostForm.title}
                onChange={(e) => setBlogPostForm(prev => ({ ...prev, title: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Article title"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Excerpt</label>
              <Textarea
                value={blogPostForm.excerpt}
                onChange={(e) => setBlogPostForm(prev => ({ ...prev, excerpt: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Brief description..."
                rows={2}
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Content</label>
              <Textarea
                value={blogPostForm.content}
                onChange={(e) => setBlogPostForm(prev => ({ ...prev, content: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white min-h-[300px]"
                placeholder="Article content..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={blogPostForm.is_published}
                onCheckedChange={(checked) => setBlogPostForm(prev => ({ ...prev, is_published: checked }))}
              />
              <span className="text-sm text-slate-400">
                {blogPostForm.is_published ? "Publish immediately" : "Save as draft"}
              </span>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishDialogOpen(false)}
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button
              onClick={publishToBlog}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {blogPostForm.is_published ? "Publish" : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
