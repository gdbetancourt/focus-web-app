import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
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
  DialogTrigger,
} from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import api from "../lib/api";
import {
  ClipboardList,
  Plus,
  Trash2,
  Edit,
  Eye,
  Copy,
  BarChart3,
  FileText,
  Users,
  ExternalLink,
  RefreshCw,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function QuizPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("quizzes");

  // New quiz form state
  const [newQuiz, setNewQuiz] = useState({
    title: "",
    description: "",
    type: "lead_qualification",
    is_public: false,
    questions: []
  });

  useEffect(() => {
    loadQuizzes();
    loadTemplates();
  }, []);

  const loadQuizzes = async () => {
    try {
      const response = await api.get("/quiz/quizzes");
      if (response.data.success) {
        setQuizzes(response.data.quizzes);
      }
    } catch (error) {
      console.error("Error loading quizzes:", error);
      toast.error("Error cargando quizzes");
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.get("/quiz/templates");
      if (response.data.success) {
        setTemplates(response.data.templates);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const loadResponses = async (quizId) => {
    try {
      const response = await api.get(`/quiz/quizzes/${quizId}/responses`);
      if (response.data.success) {
        setResponses(response.data.responses);
        return response.data.stats;
      }
    } catch (error) {
      console.error("Error loading responses:", error);
      toast.error("Error cargando respuestas");
    }
    return null;
  };

  const createFromTemplate = async (templateId) => {
    setLoading(true);
    try {
      const response = await api.post(`/quiz/templates/${templateId}/create`);
      if (response.data.success) {
        toast.success("Quiz creado desde plantilla");
        loadQuizzes();
        setShowCreateDialog(false);
      }
    } catch (error) {
      console.error("Error creating quiz:", error);
      toast.error("Error creando quiz");
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!confirm("¿Eliminar este quiz?")) return;
    
    try {
      await api.delete(`/quiz/quizzes/${quizId}`);
      toast.success("Quiz eliminado");
      loadQuizzes();
      if (selectedQuiz?.id === quizId) {
        setSelectedQuiz(null);
      }
    } catch (error) {
      toast.error("Error eliminando quiz");
    }
  };

  const toggleQuizPublic = async (quiz) => {
    try {
      await api.put(`/quiz/quizzes/${quiz.id}`, {
        is_public: !quiz.is_public
      });
      toast.success(quiz.is_public ? "Quiz ahora es privado" : "Quiz ahora es público");
      loadQuizzes();
    } catch (error) {
      toast.error("Error actualizando quiz");
    }
  };

  const copyPublicLink = (quiz) => {
    const url = `${window.location.origin}/quiz/${quiz.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado al portapapeles");
  };

  const viewQuiz = async (quiz) => {
    setSelectedQuiz(quiz);
    const stats = await loadResponses(quiz.id);
    if (stats) {
      setSelectedQuiz({ ...quiz, stats });
    }
    setActiveTab("details");
  };

  const getTypeLabel = (type) => {
    const labels = {
      lead_qualification: "Calificación de Lead",
      self_assessment: "Autoevaluación",
      feedback: "Feedback"
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6 p-6" data-testid="quiz-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-500" />
            Sistema de Quiz
          </h1>
          <p className="text-muted-foreground">
            Crea quizzes para calificar leads y autoevaluaciones
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="create-quiz-btn">
              <Plus className="h-4 w-4 mr-2" />
              Crear Quiz
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Quiz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <h3 className="font-medium">Usar Plantilla</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => createFromTemplate(template.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{template.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{template.questions.length} preguntas</Badge>
                        <Badge variant="secondary">{getTypeLabel(template.type)}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quizzes">Mis Quizzes</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedQuiz}>
            Detalles
          </TabsTrigger>
          <TabsTrigger value="responses" disabled={!selectedQuiz}>
            Respuestas ({responses.length})
          </TabsTrigger>
        </TabsList>

        {/* Quizzes List */}
        <TabsContent value="quizzes" className="space-y-4">
          {quizzes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No tienes quizzes aún</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear tu primer quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizzes.map((quiz) => (
                <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{quiz.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {quiz.description || "Sin descripción"}
                        </CardDescription>
                      </div>
                      <Badge variant={quiz.is_public ? "default" : "secondary"}>
                        {quiz.is_public ? "Público" : "Privado"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{quiz.questions?.length || 0} preguntas</span>
                      <span>•</span>
                      <Users className="h-4 w-4" />
                      <span>{quiz.response_count || 0} respuestas</span>
                    </div>
                    <div className="mt-2">
                      <Badge variant="outline">{getTypeLabel(quiz.type)}</Badge>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => viewQuiz(quiz)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    {quiz.is_public && (
                      <Button variant="outline" size="sm" onClick={() => copyPublicLink(quiz)}>
                        <Copy className="h-4 w-4 mr-1" />
                        Link
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleQuizPublic(quiz)}
                    >
                      {quiz.is_public ? "Hacer Privado" : "Publicar"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteQuiz(quiz.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Quiz Details */}
        <TabsContent value="details" className="space-y-4">
          {selectedQuiz && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{selectedQuiz.title}</CardTitle>
                  <CardDescription>{selectedQuiz.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <h3 className="font-medium">Preguntas</h3>
                  {selectedQuiz.questions?.map((q, i) => (
                    <div key={q.id} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="font-bold text-muted-foreground">{i + 1}.</span>
                        <div className="flex-1">
                          <p className="font-medium">{q.text}</p>
                          <Badge variant="outline" className="mt-1">{q.type}</Badge>
                          {q.options?.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {q.options.map((opt, j) => (
                                <div key={j} className="flex items-center gap-2 text-sm">
                                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                    {String.fromCharCode(65 + j)}
                                  </span>
                                  <span>{opt.label}</span>
                                  <Badge variant="secondary" className="ml-auto">
                                    {opt.score} pts
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Estadísticas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{selectedQuiz.stats?.total || 0}</p>
                      <p className="text-sm text-muted-foreground">Respuestas totales</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {selectedQuiz.stats?.average_score || 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">Puntaje promedio</p>
                    </div>
                    {selectedQuiz.stats?.by_category && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Por categoría:</p>
                        {Object.entries(selectedQuiz.stats.by_category).map(([cat, count]) => (
                          <div key={cat} className="flex justify-between text-sm">
                            <span>{cat}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedQuiz.is_public && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Link Público</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Input 
                          value={`${window.location.origin}/quiz/${selectedQuiz.slug}`}
                          readOnly
                          className="text-xs"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => copyPublicLink(selectedQuiz)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        variant="link" 
                        className="mt-2 p-0"
                        onClick={() => window.open(`/quiz/${selectedQuiz.slug}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Abrir quiz
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Responses */}
        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Respuestas</span>
                <Button variant="outline" size="sm" onClick={() => loadResponses(selectedQuiz?.id)}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Actualizar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {responses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aún no hay respuestas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {responses.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {r.respondent?.name || r.respondent?.email || "Anónimo"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(r.submitted_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">
                          {r.score?.percentage}%
                        </p>
                        {r.result_category && (
                          <Badge>{r.result_category.label}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
