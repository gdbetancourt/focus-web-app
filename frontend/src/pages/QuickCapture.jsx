import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Send,
  Link,
  Type,
  Layers,
  CheckCircle2,
  RefreshCw,
  Clipboard,
  Plus,
  BookOpen,
  GraduationCap
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

export default function QuickCapture() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [competencies, setCompetencies] = useState([]);
  const [selectedCompetency, setSelectedCompetency] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCompetencies, setLoadingCompetencies] = useState(true);
  const [success, setSuccess] = useState(false);
  const [recentCaptures, setRecentCaptures] = useState([]);

  // Load competencies on mount
  useEffect(() => {
    loadCompetencies();
    loadRecentCaptures();
    
    // Check for shared content in URL params (for share target)
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text') || params.get('url') || '';
    const sharedTitle = params.get('title') || '';
    
    if (sharedText) {
      setText(sharedText);
      setTitle(sharedTitle);
    } else {
      // Try to auto-read clipboard on page load
      autoReadClipboard();
    }
  }, []);

  const autoReadClipboard = async () => {
    try {
      // Request clipboard permission and read
      const clipText = await navigator.clipboard.readText();
      if (clipText && (clipText.startsWith('http') || clipText.length > 10)) {
        setText(clipText);
        toast.success("📋 Contenido del portapapeles cargado", { duration: 2000 });
      }
    } catch (error) {
      // Silently fail - user will use paste button
      console.log("Clipboard auto-read not available, user will paste manually");
    }
  };

  const loadCompetencies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/content-flow/shortcut/competencies-flat`);
      const data = await res.json();
      if (data.success) {
        setCompetencies(data.competencies || []);
      }
    } catch (error) {
      console.error("Error loading competencies:", error);
    } finally {
      setLoadingCompetencies(false);
    }
  };

  const loadRecentCaptures = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/content-flow/shortcut/recent`);
      const data = await res.json();
      if (data.success) {
        setRecentCaptures(data.captures || []);
      }
    } catch (error) {
      console.error("Error loading recent:", error);
    }
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      setText(clipText);
      toast.success("Contenido pegado");
    } catch (error) {
      toast.error("No se pudo acceder al portapapeles");
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      toast.error("Ingresa contenido o URL");
      return;
    }
    if (!selectedCompetency) {
      toast.error("Selecciona una competencia");
      return;
    }
    if (!selectedLevel) {
      toast.error("Selecciona un nivel");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const competencyData = competencies.find(c => c.competency_name === selectedCompetency);
      
      const res = await fetch(`${API_BASE}/api/content-flow/shortcut/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          title: title.trim() || null,
          competency_name: selectedCompetency,
          level: parseInt(selectedLevel)
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        toast.success("✅ Contenido guardado en Content Matrix");
        
        // Clear form
        setText("");
        setTitle("");
        setSelectedCompetency("");
        setSelectedLevel("");
        
        // Reload recent
        loadRecentCaptures();
        
        // Reset success after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        toast.error(data.message || "Error al guardar");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const levels = [
    { value: "1", label: "1 - Básico" },
    { value: "2", label: "2 - Intermedio" },
    { value: "3", label: "3 - Avanzado" },
    { value: "4", label: "4 - Experto" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <BookOpen className="w-6 h-6 text-[#ff3300]" />
            Leaderlix Capture
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Captura ideas rápidamente al Content Matrix
          </p>
        </div>

        {/* Main Form */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 space-y-4">
            {/* URL/Text Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-400 flex items-center gap-1">
                  <Link className="w-4 h-4" />
                  URL o Contenido
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="text-slate-400 hover:text-white h-7 px-2"
                >
                  <Clipboard className="w-4 h-4 mr-1" />
                  Pegar
                </Button>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Pega el link del video o escribe tu idea..."
                className="bg-[#0a0a0a] border-[#333] text-white min-h-[80px] resize-none"
              />
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-1">
                <Type className="w-4 h-4" />
                Título (opcional)
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título descriptivo..."
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>

            {/* Competency Select */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-1">
                <GraduationCap className="w-4 h-4" />
                Curso → Competencia
              </label>
              <Select value={selectedCompetency} onValueChange={setSelectedCompetency}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue placeholder={loadingCompetencies ? "Cargando..." : "Selecciona competencia"} />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#222] max-h-60">
                  {competencies.map((comp, idx) => (
                    <SelectItem 
                      key={idx} 
                      value={comp.competency_name}
                      className="text-white"
                    >
                      {comp.display}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level Select */}
            <div className="space-y-2">
              <label className="text-sm text-slate-400 flex items-center gap-1">
                <Layers className="w-4 h-4" />
                Nivel
              </label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue placeholder="Selecciona nivel" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#222]">
                  {levels.map((level) => (
                    <SelectItem 
                      key={level.value} 
                      value={level.value}
                      className="text-white"
                    >
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={loading || !text.trim()}
              className={`w-full h-12 text-lg font-medium transition-all ${
                success 
                  ? "bg-green-600 hover:bg-green-600" 
                  : "bg-[#ff3300] hover:bg-[#e62e00]"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  ¡Guardado!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Guardar en Content Matrix
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Captures */}
        {recentCaptures.length > 0 && (
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">
                Capturas recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {recentCaptures.slice(0, 5).map((capture, idx) => (
                <div 
                  key={idx}
                  className="p-2 bg-[#0a0a0a] rounded border border-[#222] text-sm"
                >
                  <p className="text-white truncate font-medium">
                    {capture.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs border-[#333] text-slate-400">
                      Nivel {capture.level}
                    </Badge>
                    <span className="text-xs text-slate-500 truncate">
                      {capture.competency_name}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <div className="text-center text-xs text-slate-500 py-4">
          <p>💡 Tip: Añade esta página a tu pantalla de inicio</p>
          <p className="mt-1">para acceso rápido como una app</p>
        </div>
      </div>
    </div>
  );
}
