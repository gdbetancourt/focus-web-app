import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Video,
  Upload,
  FileAudio,
  Wand2,
  Clock,
  Scissors,
  Play,
  Youtube,
  LinkIcon,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  FileText,
  Sparkles,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

export default function VideoProcessing() {
  const [activeTab, setActiveTab] = useState("transcribe");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Transcription state
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("es");
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [currentTranscription, setCurrentTranscription] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [generatedScript, setGeneratedScript] = useState("");
  const [scriptStyle, setScriptStyle] = useState("professional");
  
  // YouTube state
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeChannel, setYoutubeChannel] = useState(null);
  const [channelVideos, setChannelVideos] = useState([]);

  // Load transcriptions on mount
  useEffect(() => {
    loadTranscriptions();
    checkYouTubeConnection();
  }, []);

  const loadTranscriptions = async () => {
    try {
      const response = await api.get("/video-processing/transcriptions");
      if (response.data.success) {
        setTranscriptions(response.data.transcriptions);
      }
    } catch (error) {
      console.error("Error loading transcriptions:", error);
    }
  };

  const checkYouTubeConnection = async () => {
    try {
      const response = await api.get("/youtube/api/auth/status");
      setYoutubeConnected(response.data.connected);
      setYoutubeChannel(response.data.channel);
      
      if (response.data.connected) {
        loadChannelVideos();
      }
    } catch (error) {
      console.error("Error checking YouTube status:", error);
    }
  };

  const loadChannelVideos = async () => {
    try {
      const response = await api.get("/youtube/api/channel/videos");
      setChannelVideos(response.data.videos || []);
    } catch (error) {
      console.error("Error loading channel videos:", error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check size (25MB limit)
      if (file.size > 25 * 1024 * 1024) {
        toast.error("El archivo es muy grande. Máximo 25MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) {
      toast.error("Selecciona un archivo primero");
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("language", transcriptionLanguage);
      formData.append("include_timestamps", includeTimestamps);

      const response = await api.post("/video-processing/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (response.data.success) {
        setCurrentTranscription(response.data.transcription);
        toast.success("Transcripción completada");
        loadTranscriptions();
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error(error.response?.data?.detail || "Error en la transcripción");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleAnalyze = async () => {
    if (!currentTranscription) {
      toast.error("Primero necesitas una transcripción");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("transcription_id", currentTranscription.id);
      formData.append("generate_clips", "true");

      const response = await api.post("/video-processing/analyze", formData);

      if (response.data.success) {
        setAnalysis(response.data.analysis);
        toast.success("Análisis completado");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error.response?.data?.detail || "Error en el análisis");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!currentTranscription) {
      toast.error("Primero necesitas una transcripción");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("transcription_id", currentTranscription.id);
      formData.append("style", scriptStyle);
      formData.append("target_duration", "same");

      const response = await api.post("/video-processing/generate-script", formData);

      if (response.data.success) {
        setGeneratedScript(response.data.script);
        toast.success("Guión generado");
      }
    } catch (error) {
      console.error("Script generation error:", error);
      toast.error(error.response?.data?.detail || "Error generando guión");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectYouTube = async () => {
    try {
      const response = await api.get("/youtube/api/auth/url");
      if (response.data.auth_url) {
        window.open(response.data.auth_url, "_blank");
        toast.info("Completa la autenticación en la nueva ventana");
      }
    } catch (error) {
      console.error("YouTube auth error:", error);
      toast.error("Error conectando con YouTube");
    }
  };

  const loadTranscriptionDetails = async (id) => {
    try {
      const response = await api.get(`/video-processing/transcriptions/${id}`);
      if (response.data.success) {
        setCurrentTranscription(response.data.transcription);
        setAnalysis(response.data.analysis);
        setActiveTab("transcribe");
      }
    } catch (error) {
      console.error("Error loading transcription:", error);
      toast.error("Error cargando transcripción");
    }
  };

  const deleteTranscription = async (id) => {
    if (!confirm("¿Eliminar esta transcripción?")) return;
    
    try {
      await api.delete(`/video-processing/transcriptions/${id}`);
      toast.success("Transcripción eliminada");
      loadTranscriptions();
      if (currentTranscription?.id === id) {
        setCurrentTranscription(null);
        setAnalysis(null);
      }
    } catch (error) {
      toast.error("Error eliminando transcripción");
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Error al copiar");
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 p-6" data-testid="video-processing-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6 text-purple-500" />
            Procesamiento de Video
          </h1>
          <p className="text-muted-foreground">
            Transcribe, analiza y optimiza tus videos con IA
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transcribe" className="flex items-center gap-2">
            <FileAudio className="h-4 w-4" />
            Transcribir
          </TabsTrigger>
          <TabsTrigger value="analyze" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Analizar
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="youtube" className="flex items-center gap-2">
            <Youtube className="h-4 w-4" />
            YouTube
          </TabsTrigger>
        </TabsList>

        {/* Transcribe Tab */}
        <TabsContent value="transcribe" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Subir Video/Audio
                </CardTitle>
                <CardDescription>
                  Formatos: MP3, MP4, WAV, WEBM, MOV (máx. 25MB)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    accept=".mp3,.mp4,.wav,.webm,.mov,.m4a,.mpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="video-upload"
                    data-testid="video-upload-input"
                  />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <FileAudio className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    {selectedFile ? (
                      <div>
                        <p className="font-medium text-primary">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Arrastra o haz clic para seleccionar
                      </p>
                    )}
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Idioma</label>
                    <Select value={transcriptionLanguage} onValueChange={setTranscriptionLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timestamps</label>
                    <Select 
                      value={includeTimestamps ? "yes" : "no"} 
                      onValueChange={(v) => setIncludeTimestamps(v === "yes")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Con timestamps</SelectItem>
                        <SelectItem value="no">Sin timestamps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      Subiendo... {uploadProgress}%
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleTranscribe}
                  disabled={!selectedFile || loading}
                  className="w-full"
                  data-testid="transcribe-button"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Transcribir con Whisper
                </Button>
              </CardContent>
            </Card>

            {/* Transcription Result */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Transcripción
                  </span>
                  {currentTranscription && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {formatDuration(currentTranscription.duration)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(currentTranscription.text)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentTranscription ? (
                  <div className="space-y-4">
                    <Textarea
                      value={currentTranscription.text}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                    />
                    {currentTranscription.segments && (
                      <div className="max-h-[200px] overflow-y-auto space-y-2">
                        <h4 className="font-medium text-sm">Segmentos con timestamps:</h4>
                        {currentTranscription.segments.slice(0, 10).map((seg, i) => (
                          <div key={i} className="flex gap-2 text-sm">
                            <Badge variant="secondary" className="shrink-0">
                              {formatDuration(seg.start)}
                            </Badge>
                            <span className="text-muted-foreground">{seg.text}</span>
                          </div>
                        ))}
                        {currentTranscription.segments.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            +{currentTranscription.segments.length - 10} segmentos más...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileAudio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sube un video o audio para transcribir</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analyze Tab */}
        <TabsContent value="analyze" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analysis Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Herramientas de Análisis
                </CardTitle>
                <CardDescription>
                  Analiza tu transcripción para obtener insights y sugerencias
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!currentTranscription ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Primero necesitas una transcripción</p>
                    <Button
                      variant="link"
                      onClick={() => setActiveTab("transcribe")}
                    >
                      Ir a Transcribir
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Transcripción activa:</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentTranscription.filename || currentTranscription.id}
                      </p>
                    </div>

                    <Button
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="w-full"
                      data-testid="analyze-button"
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Scissors className="h-4 w-4 mr-2" />
                      )}
                      Analizar Video
                    </Button>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Generar Guión Limpio</h4>
                      <Select value={scriptStyle} onValueChange={setScriptStyle}>
                        <SelectTrigger>
                          <SelectValue placeholder="Estilo del guión" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profesional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="educational">Educativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleGenerateScript}
                        disabled={loading}
                        variant="outline"
                        className="w-full mt-3"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generar Guión
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Analysis Results */}
            <Card>
              <CardHeader>
                <CardTitle>Resultados del Análisis</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Resumen</h4>
                      <p className="text-sm">{analysis.summary}</p>
                    </div>

                    {/* Key Moments */}
                    {analysis.key_moments?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Momentos Clave</h4>
                        <div className="space-y-2">
                          {analysis.key_moments.map((moment, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <Badge variant="outline">{moment.time}</Badge>
                              <span>{moment.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested Clips */}
                    {analysis.suggested_clips?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Clips Sugeridos</h4>
                        <div className="space-y-2">
                          {analysis.suggested_clips.map((clip, i) => (
                            <div key={i} className="p-3 border rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge>{clip.platform}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {clip.start} - {clip.end}
                                </span>
                              </div>
                              <p className="font-medium text-sm">{clip.title}</p>
                              {clip.hook && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Hook: {clip.hook}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : generatedScript ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Guión Generado</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(generatedScript)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={generatedScript}
                      readOnly
                      className="min-h-[300px]"
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Analiza tu video para ver resultados aquí</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historial de Transcripciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transcriptions.length > 0 ? (
                <div className="space-y-3">
                  {transcriptions.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => loadTranscriptionDetails(t.id)}
                      >
                        <p className="font-medium">{t.filename || "Sin nombre"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{t.language?.toUpperCase()}</Badge>
                          <span>{formatDuration(t.duration)}</span>
                          <span>•</span>
                          <span>{new Date(t.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTranscription(t.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay transcripciones aún</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* YouTube Tab */}
        <TabsContent value="youtube" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Youtube className="h-5 w-5 text-red-500" />
                  YouTube
                </CardTitle>
                <CardDescription>
                  Conecta tu canal para subir y gestionar videos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {youtubeConnected && youtubeChannel ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={youtubeChannel.thumbnail}
                        alt={youtubeChannel.title}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <p className="font-medium">{youtubeChannel.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {parseInt(youtubeChannel.subscribers).toLocaleString()} suscriptores
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      Conectado
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadChannelVideos}
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Actualizar Videos
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Youtube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Conecta tu cuenta de YouTube para subir videos directamente
                    </p>
                    <Button onClick={handleConnectYouTube} data-testid="connect-youtube-btn">
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Conectar YouTube
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Channel Videos */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Videos del Canal</CardTitle>
              </CardHeader>
              <CardContent>
                {channelVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {channelVideos.slice(0, 6).map((video) => (
                      <div
                        key={video.id}
                        className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-32 h-18 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{video.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{parseInt(video.views).toLocaleString()} vistas</span>
                            <Badge variant="outline" className="text-xs">
                              {video.privacyStatus}
                            </Badge>
                          </div>
                          <a
                            href={`https://youtube.com/watch?v=${video.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                          >
                            Ver en YouTube
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {youtubeConnected ? (
                      <>
                        <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No se encontraron videos</p>
                      </>
                    ) : (
                      <>
                        <Youtube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Conecta tu YouTube para ver tus videos</p>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
