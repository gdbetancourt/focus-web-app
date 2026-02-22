import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import {
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Send,
  CheckCircle2,
  Target,
  Award,
  Loader2,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

// Use localhost for local development to avoid CORS issues
const getApiUrl = () => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8001';
  }
  return API_URL;
};

export default function PublicQuiz() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1-n = questions, last = contact
  const [answers, setAnswers] = useState({});
  const [respondent, setRespondent] = useState({ name: "", email: "", company: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, [slug]);

  const loadQuiz = async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/quiz/public/${slug}`);
      const data = await response.json();
      
      if (data.success && data.quiz) {
        setQuiz(data.quiz);
      } else {
        setError("Quiz no encontrado");
      }
    } catch (err) {
      console.error("Error loading quiz:", err);
      setError("Error cargando el quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleMultipleAnswer = (questionId, value, checked) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, value] };
      } else {
        return { ...prev, [questionId]: current.filter(v => v !== value) };
      }
    });
  };

  const handleSubmit = async () => {
    if (!respondent.email) {
      toast.error("Por favor ingresa tu email");
      return;
    }

    setSubmitting(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/quiz/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quiz.id,
          answers,
          respondent
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        setCurrentStep(totalSteps + 1); // Go to results
      } else {
        toast.error("Error enviando respuestas");
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Error enviando respuestas");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = quiz ? quiz.questions.length + 1 : 0; // questions + contact form
  const progress = quiz ? ((currentStep) / (totalSteps + 1)) * 100 : 0;

  const currentQuestion = quiz?.questions?.[currentStep - 1];

  const canProceed = () => {
    if (currentStep === 0) return true;
    if (currentStep > quiz.questions.length) return true;
    
    const question = quiz.questions[currentStep - 1];
    if (!question.required) return true;
    
    const answer = answers[question.id];
    if (question.type === "multiple") {
      return answer && answer.length > 0;
    }
    return answer !== undefined && answer !== "";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Quiz no disponible</h2>
            <p className="text-muted-foreground">{error || "El quiz que buscas no existe o no está activo."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Results screen
  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl">¡Gracias por completar el quiz!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score */}
            <div className="text-center p-6 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">Tu puntaje</p>
              <p className="text-5xl font-bold text-primary">{result.score?.percentage}%</p>
            </div>

            {/* Result Category */}
            {result.result && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5 text-primary" />
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {result.result.label}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{result.result.description}</p>
                {result.result.recommendation && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium text-primary">
                      💡 {result.result.recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-xs text-center text-muted-foreground w-full">
              Nos pondremos en contacto contigo pronto.
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-slate-400 mt-2 text-center">
            {currentStep === 0 
              ? "Inicio" 
              : currentStep <= quiz.questions.length 
                ? `Pregunta ${currentStep} de ${quiz.questions.length}`
                : "Último paso"}
          </p>
        </div>

        <Card className="shadow-2xl">
          {/* Intro Step */}
          {currentStep === 0 && (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Target className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">{quiz.title}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {quiz.description || "Responde las siguientes preguntas para conocer tu resultado."}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="h-4 w-4" />
                    {quiz.questions.length} preguntas
                  </span>
                  <span>•</span>
                  <span>~{Math.ceil(quiz.questions.length * 0.5)} min</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => setCurrentStep(1)} 
                  className="w-full"
                  size="lg"
                >
                  Comenzar
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Question Steps */}
          {currentStep > 0 && currentStep <= quiz.questions.length && currentQuestion && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">{currentQuestion.text}</CardTitle>
                {currentQuestion.required && (
                  <Badge variant="outline" className="w-fit">Requerida</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Single Choice */}
                {currentQuestion.type === "single" && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(v) => handleAnswer(currentQuestion.id, v)}
                    className="space-y-3"
                  >
                    {currentQuestion.options.map((opt, i) => (
                      <label
                        key={i}
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all hover:border-primary ${
                          answers[currentQuestion.id] === opt.value 
                            ? "border-primary bg-primary/5" 
                            : "border-border"
                        }`}
                      >
                        <RadioGroupItem value={opt.value} />
                        <span className="flex-1">{opt.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                )}

                {/* Multiple Choice */}
                {currentQuestion.type === "multiple" && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, i) => (
                      <label
                        key={i}
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all hover:border-primary ${
                          (answers[currentQuestion.id] || []).includes(opt.value)
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={(answers[currentQuestion.id] || []).includes(opt.value)}
                          onCheckedChange={(checked) => 
                            handleMultipleAnswer(currentQuestion.id, opt.value, checked)
                          }
                        />
                        <span className="flex-1">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Scale */}
                {currentQuestion.type === "scale" && (
                  <div className="space-y-6 py-4">
                    <Slider
                      value={[answers[currentQuestion.id] || 5]}
                      onValueChange={([v]) => handleAnswer(currentQuestion.id, v)}
                      max={currentQuestion.max_scale || 10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>1 - Bajo</span>
                      <span className="text-2xl font-bold text-primary">
                        {answers[currentQuestion.id] || 5}
                      </span>
                      <span>{currentQuestion.max_scale || 10} - Alto</span>
                    </div>
                  </div>
                )}

                {/* Text */}
                {currentQuestion.type === "text" && (
                  <Textarea
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    rows={4}
                  />
                )}
              </CardContent>
              <CardFooter className="flex justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <Button
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={!canProceed()}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* Contact Form Step */}
          {currentStep === quiz.questions.length + 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Último paso</CardTitle>
                <CardDescription>
                  Ingresa tus datos para ver tu resultado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={respondent.name}
                    onChange={(e) => setRespondent(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={respondent.email}
                    onChange={(e) => setRespondent(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input
                    value={respondent.company}
                    onChange={(e) => setRespondent(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Tu empresa (opcional)"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Anterior
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !respondent.email}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Ver mi resultado
                </Button>
              </CardFooter>
            </>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Powered by Leaderlix
        </p>
      </div>
    </div>
  );
}
