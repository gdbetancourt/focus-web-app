/**
 * ImportNewConnectionsPage - LinkedIn Connections Import Section
 * 
 * V3: Includes integrated reporting with:
 * - Immediate report after import completion (per profile)
 * - Historical weekly view with charts and drill-down
 * - Job detail modal
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById, LINKEDIN_PROFILES } from "./focusSections";
import { 
  Download, Upload, ExternalLink, RefreshCw, Check, X, 
  AlertTriangle, FileText, Eye, Play, Loader2, Lock,
  BarChart3, Clock, Users, Building, ChevronDown, ChevronRight,
  TrendingUp, AlertCircle, Calendar
} from "lucide-react";

// Get section configuration
const SECTION = getSectionById("import-new-connections");

// Field mapping options
const FIELD_OPTIONS = [
  { value: "first_name", label: "Nombre" },
  { value: "last_name", label: "Apellido" },
  { value: "email", label: "Email" },
  { value: "company", label: "Empresa" },
  { value: "job_title", label: "Cargo" },
  { value: "linkedin_url", label: "URL LinkedIn" },
  { value: "connected_on", label: "Fecha Conexión" },
  { value: "_ignore", label: "-- Ignorar --" },
];

// Error messages by status code
const getErrorMessage = (error) => {
  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  
  switch (status) {
    case 401:
    case 403:
      return "No autorizado";
    case 400:
    case 422:
      return detail || "Datos inválidos";
    case 409:
      return detail || "Ya existe solicitud esta semana";
    case 500:
      return "Error de servidor";
    default:
      return detail || "Error desconocido";
  }
};

// Format duration
const formatDuration = (seconds) => {
  if (!seconds) return "-";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
};

// Format number with K suffix
const formatNumber = (num) => {
  if (!num) return "0";
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Format date for display
const formatDate = (isoString) => {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("es-ES", { 
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
    });
  } catch {
    return isoString;
  }
};

// ============ IMPORT RESULT PANEL ============
function ImportResultPanel({ job, onDownloadConflicts, onDownloadInvalidRows, onDownloadParseFailures }) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [showAttemptHistory, setShowAttemptHistory] = useState(false);
  
  if (!job || job.status === "uploaded" || job.status === "processing") return null;
  
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  
  // Error categories
  const errorCategories = [
    {
      key: "conflicts",
      label: "Conflictos email/URL",
      count: job.conflicts_count || 0,
      reason: "Email coincide con un contacto y LinkedIn URL con otro distinto",
      hasDownload: (job.conflicts_count || 0) > 0,
      onDownload: () => onDownloadConflicts(job.job_id),
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10"
    },
    {
      key: "invalid_rows",
      label: "Filas inválidas",
      count: job.invalid_rows_count || 0,
      reason: "Sin nombre (first_name/last_name) ni LinkedIn URL válida",
      hasDownload: (job.invalid_rows_count || 0) > 0,
      onDownload: () => onDownloadInvalidRows(job.job_id),
      color: "text-red-400",
      bgColor: "bg-red-500/10"
    },
    {
      key: "connected_on_parse_failed",
      label: "Fechas no parseadas",
      count: job.connected_on_parse_failed || 0,
      reason: "Formato de fecha no reconocido o fecha inválida",
      hasDownload: (job.connected_on_parse_failed || 0) > 0,
      onDownload: () => onDownloadParseFailures(job.job_id),
      color: "text-orange-400",
      bgColor: "bg-orange-500/10"
    },
    {
      key: "email_invalid",
      label: "Emails inválidos",
      count: job.email_invalid_format || 0,
      reason: "Formato de email no válido",
      hasDownload: false,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10"
    },
    {
      key: "linkedin_invalid",
      label: "URLs LinkedIn inválidas",
      count: job.linkedin_url_invalid_format || 0,
      reason: "URL de LinkedIn no pudo ser normalizada",
      hasDownload: false,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10"
    }
  ];
  
  const totalErrors = errorCategories.reduce((sum, cat) => sum + cat.count, 0);
  
  // Sort buyer personas
  const buyerPersonas = job.buyer_persona_counts 
    ? Object.entries(job.buyer_persona_counts).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className={`p-4 rounded-lg border mt-4 ${
      isCompleted ? "bg-green-500/5 border-green-500/30" : 
      isFailed ? "bg-red-500/5 border-red-500/30" : 
      "bg-slate-500/5 border-slate-500/30"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : isFailed ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-slate-400" />
          )}
          <span className={`font-semibold ${
            isCompleted ? "text-green-400" : isFailed ? "text-red-400" : "text-slate-400"
          }`}>
            {isCompleted ? "Importación completada" : isFailed ? "Importación fallida" : job.status}
          </span>
        </div>
        <Badge variant="outline" className="text-xs border-slate-600 max-w-[200px] truncate">
          {job.file_name}
        </Badge>
      </div>

      {/* Summary headline */}
      <div className="text-sm text-white mb-4 bg-black/20 p-3 rounded">
        <strong>Resultado:</strong> {formatNumber(job.total_rows || job.processed_rows)} filas · 
        <span className="text-green-400"> {formatNumber(job.contacts_created)} creados</span> · 
        <span className="text-blue-400"> {formatNumber(job.contacts_updated)} actualizados</span> · 
        <span className={totalErrors > 0 ? "text-yellow-400" : "text-slate-400"}> {totalErrors} errores</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-black/20 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">Duración</div>
          <div className="text-lg font-bold text-white">{formatDuration(job.duration_sec)}</div>
        </div>
        <div className="bg-black/20 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">Throughput</div>
          <div className="text-lg font-bold text-white">
            {job.throughput_rows_per_sec ? `${job.throughput_rows_per_sec} filas/s` : "-"}
          </div>
        </div>
        <div className="bg-black/20 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">Worker</div>
          <div className="text-sm text-slate-300 truncate">{job.worker_id || "-"}</div>
        </div>
        <div className="bg-black/20 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">Intentos</div>
          <div className="text-lg font-bold text-white">{job.attempts || 1} / {job.max_attempts || 3}</div>
        </div>
      </div>

      {/* ===== ERRORS AND DATA QUALITY SECTION ===== */}
      <div className="mb-4">
        <button 
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-3"
          onClick={() => setShowErrorDetails(!showErrorDetails)}
        >
          {showErrorDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold">Errores y calidad de datos</span>
          {totalErrors > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs ml-2">
              {totalErrors} errores
            </Badge>
          )}
        </button>

        {showErrorDetails && (
          <div className="space-y-2 pl-6">
            {errorCategories.map(cat => (
              <div key={cat.key} className={`p-3 rounded border border-[#333] ${cat.count > 0 ? cat.bgColor : 'bg-black/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${cat.count > 0 ? cat.color : 'text-slate-500'}`}>
                      {cat.label}
                    </span>
                    <Badge className={`text-xs ${cat.count > 0 ? cat.bgColor + ' ' + cat.color : 'bg-slate-500/20 text-slate-500'}`}>
                      {cat.count}
                    </Badge>
                  </div>
                  {cat.hasDownload && cat.count > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={cat.onDownload}
                      className="h-7 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      CSV
                    </Button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">{cat.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== JOB ERROR (if failed) ===== */}
      {isFailed && (job.error_summary || job.last_error) && (
        <div className="bg-red-500/10 p-3 rounded mb-4 border border-red-500/30">
          <div className="text-xs text-red-400 font-semibold mb-1">Error del Job</div>
          <div className="text-sm text-red-300 font-mono whitespace-pre-wrap">
            {job.last_error || job.error_summary}
          </div>
        </div>
      )}

      {/* ===== ATTEMPT HISTORY (if retried) ===== */}
      {job.attempt_history && job.attempt_history.length > 0 && (
        <div className="mb-4">
          <button 
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-3"
            onClick={() => setShowAttemptHistory(!showAttemptHistory)}
          >
            {showAttemptHistory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <RefreshCw className="w-4 h-4" />
            <span className="font-semibold">Historial de reintentos</span>
            <Badge className="bg-slate-500/20 text-slate-400 text-xs">
              {job.attempt_history.length} intentos
            </Badge>
          </button>

          {showAttemptHistory && (
            <div className="space-y-2 pl-6">
              {job.attempt_history.map((attempt, idx) => (
                <div key={idx} className="p-3 rounded bg-black/20 border border-[#333]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white font-medium">Intento {attempt.attempt}</span>
                    <span className="text-xs text-slate-500">{formatDate(attempt.failed_at)}</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">Worker: {attempt.worker_id}</div>
                  <div className="text-xs text-red-400 font-mono">{attempt.error}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buyer Personas */}
      {buyerPersonas.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">Distribución por Buyer Persona</div>
          <div className="flex flex-wrap gap-2">
            {buyerPersonas.slice(0, 6).map(([persona, count]) => (
              <Badge key={persona} variant="outline" className="border-slate-600">
                {persona}: {count}
              </Badge>
            ))}
            {buyerPersonas.length > 6 && (
              <Badge variant="outline" className="border-slate-600">
                +{buyerPersonas.length - 6} más
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {job.conflicts_count > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDownloadConflicts(job.job_id)}
            className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
          >
            <FileText className="w-4 h-4 mr-2" />
            Descargar {job.conflicts_count} Conflictos
          </Button>
        )}
      </div>
    </div>
  );
}

// ============ HISTORICAL CHART ============
function SimpleBarChart({ data, dataKey, color, label }) {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d[dataKey] || 0), 1);
  
  return (
    <div className="bg-black/20 p-3 rounded">
      <div className="text-xs text-slate-500 mb-3">{label}</div>
      <div className="flex items-end gap-1 h-20">
        {data.slice().reverse().map((item, idx) => {
          const value = item[dataKey] || 0;
          const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div 
              key={idx} 
              className="flex-1 flex flex-col items-center"
              title={`${item.week_start}: ${formatNumber(value)}`}
            >
              <div 
                className={`w-full rounded-t transition-all hover:opacity-80`}
                style={{ 
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: color 
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>{data[data.length - 1]?.week_start?.slice(5) || ""}</span>
        <span>{data[0]?.week_start?.slice(5) || ""}</span>
      </div>
    </div>
  );
}

// ============ HISTORICAL SECTION ============
function HistoricalSection() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weeks, setWeeks] = useState("12");
  const [profile, setProfile] = useState("all");
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [weekJobs, setWeekJobs] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ weeks });
      if (profile !== "all") params.append("profile", profile);
      
      const res = await api.get(`/linkedin-import/history?${params}`);
      setHistory(res.data.data || []);
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Error al cargar histórico");
    } finally {
      setLoading(false);
    }
  }, [weeks, profile]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadWeekJobs = async (weekStart) => {
    if (weekJobs[weekStart]) return;
    
    try {
      const params = new URLSearchParams({ week_start: weekStart, limit: "50" });
      if (profile !== "all") params.append("profile", profile);
      
      const res = await api.get(`/linkedin-import/jobs-by-week?${params}`);
      setWeekJobs(prev => ({ ...prev, [weekStart]: res.data.jobs }));
    } catch (error) {
      console.error("Error loading week jobs:", error);
    }
  };

  const loadJobDetail = async (jobId) => {
    try {
      const res = await api.get(`/linkedin-import/job/${jobId}`);
      setJobDetail(res.data);
    } catch (error) {
      console.error("Error loading job detail:", error);
      toast.error("Error al cargar detalle del job");
    }
  };

  const handleWeekClick = (weekStart) => {
    if (expandedWeek === weekStart) {
      setExpandedWeek(null);
    } else {
      setExpandedWeek(weekStart);
      loadWeekJobs(weekStart);
    }
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    loadJobDetail(job.job_id);
  };

  // Calculate totals for charts
  const chartData = history.filter(w => w.jobs_completed > 0 || w.processed_rows_sum > 0);

  return (
    <Card className="bg-[#111] border-[#222] mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Histórico de Importaciones
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger className="w-32 h-8 bg-[#0a0a0a] border-[#333] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 semanas</SelectItem>
                <SelectItem value="12">12 semanas</SelectItem>
                <SelectItem value="26">26 semanas</SelectItem>
                <SelectItem value="52">52 semanas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={profile} onValueChange={setProfile}>
              <SelectTrigger className="w-28 h-8 bg-[#0a0a0a] border-[#333] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="GB">GB</SelectItem>
                <SelectItem value="MG">MG</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && history.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Charts Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <SimpleBarChart 
                data={chartData} 
                dataKey="processed_rows_sum" 
                color="#3b82f6" 
                label="Filas procesadas" 
              />
              <SimpleBarChart 
                data={chartData} 
                dataKey="created_sum" 
                color="#22c55e" 
                label="Contactos creados" 
              />
              <SimpleBarChart 
                data={chartData} 
                dataKey="updated_sum" 
                color="#0ea5e9" 
                label="Actualizados" 
              />
              <SimpleBarChart 
                data={chartData} 
                dataKey="conflicts_sum" 
                color="#eab308" 
                label="Conflictos + Inválidos" 
              />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Filas", value: history.reduce((s, w) => s + w.processed_rows_sum, 0), icon: FileText },
                { label: "Creados", value: history.reduce((s, w) => s + w.created_sum, 0), icon: Users },
                { label: "Actualizados", value: history.reduce((s, w) => s + w.updated_sum, 0), icon: RefreshCw },
                { label: "Jobs", value: history.reduce((s, w) => s + w.jobs_completed, 0), icon: Check },
              ].map(stat => (
                <div key={stat.label} className="bg-black/20 p-3 rounded text-center">
                  <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
                  <div className="text-xl font-bold text-white">{formatNumber(stat.value)}</div>
                </div>
              ))}
            </div>

            {/* Weekly Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#333] hover:bg-transparent">
                    <TableHead className="text-slate-400 text-xs w-8"></TableHead>
                    <TableHead className="text-slate-400 text-xs">Semana</TableHead>
                    <TableHead className="text-slate-400 text-xs text-center">Jobs</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Filas</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Creados</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Actualizados</TableHead>
                    <TableHead className="text-slate-400 text-xs text-right">Errores</TableHead>
                    <TableHead className="text-slate-400 text-xs text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((week) => (
                    <>
                      <TableRow 
                        key={week.week_start}
                        className={`border-[#333] cursor-pointer hover:bg-[#1a1a1a] ${
                          expandedWeek === week.week_start ? "bg-[#1a1a1a]" : ""
                        }`}
                        onClick={() => handleWeekClick(week.week_start)}
                      >
                        <TableCell className="w-8">
                          {week.jobs_total > 0 && (
                            expandedWeek === week.week_start 
                              ? <ChevronDown className="w-4 h-4 text-slate-400" />
                              : <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-white font-medium">
                          {week.week_start}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-400">{week.jobs_completed}</span>
                          {week.jobs_failed > 0 && (
                            <span className="text-red-400 ml-1">/ {week.jobs_failed} ✗</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-300">
                          {formatNumber(week.processed_rows_sum)}
                        </TableCell>
                        <TableCell className="text-right text-green-400">
                          {formatNumber(week.created_sum)}
                        </TableCell>
                        <TableCell className="text-right text-blue-400">
                          {formatNumber(week.updated_sum)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-yellow-400">{week.conflicts_sum}</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-red-400">{week.invalid_sum}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {week.week_complete ? (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">Completa</Badge>
                          ) : week.jobs_completed > 0 ? (
                            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">Parcial</Badge>
                          ) : (
                            <Badge className="bg-slate-500/20 text-slate-400 text-xs">Sin datos</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded week jobs */}
                      {expandedWeek === week.week_start && weekJobs[week.week_start] && (
                        <TableRow className="border-[#333]">
                          <TableCell colSpan={8} className="p-0">
                            <div className="bg-[#0a0a0a] p-4 border-t border-[#333]">
                              <div className="text-xs text-slate-500 mb-2">
                                Jobs de la semana {week.week_start}
                              </div>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {weekJobs[week.week_start].map((job) => (
                                  <div 
                                    key={job.job_id}
                                    className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#222] hover:border-[#333] cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); handleJobClick(job); }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Badge className={`text-xs ${
                                        job.status === "completed" ? "bg-green-500/20 text-green-400" :
                                        job.status === "failed" ? "bg-red-500/20 text-red-400" :
                                        "bg-slate-500/20 text-slate-400"
                                      }`}>
                                        {job.profile}
                                      </Badge>
                                      <span className="text-sm text-white truncate max-w-[200px]">
                                        {job.file_name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                      <span>{formatNumber(job.processed_rows)} filas</span>
                                      <span className="text-green-400">+{job.contacts_created}</span>
                                      <span className="text-blue-400">~{job.contacts_updated}</span>
                                      <span>{formatDuration(job.duration_sec)}</span>
                                      <span>{formatDate(job.completed_at)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Job Detail Modal */}
        <Dialog open={!!selectedJob} onOpenChange={() => { setSelectedJob(null); setJobDetail(null); }}>
          <DialogContent className="bg-[#111] border-[#333] max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Detalle del Job
              </DialogTitle>
            </DialogHeader>
            
            {!jobDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Identity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs">Job ID</Label>
                    <div className="text-sm text-white font-mono">{jobDetail.job_id}</div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Archivo</Label>
                    <div className="text-sm text-white">{jobDetail.file_name}</div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Perfil</Label>
                    <Badge className="bg-orange-500/20 text-orange-400">{jobDetail.profile}</Badge>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Semana</Label>
                    <div className="text-sm text-white">{jobDetail.week_start}</div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Usuario</Label>
                    <div className="text-sm text-white">
                      {jobDetail.created_by_user?.name || jobDetail.created_by_user_id || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Worker</Label>
                    <div className="text-sm text-slate-400 font-mono">{jobDetail.worker_id || "-"}</div>
                  </div>
                </div>

                {/* Times */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs">Iniciado</Label>
                    <div className="text-sm text-white">{formatDate(jobDetail.started_at)}</div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Completado</Label>
                    <div className="text-sm text-white">{formatDate(jobDetail.completed_at)}</div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Duración</Label>
                    <div className="text-sm text-white">{formatDuration(jobDetail.duration_sec)}</div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Total Filas", value: jobDetail.total_rows, color: "text-white" },
                    { label: "Procesadas", value: jobDetail.processed_rows, color: "text-white" },
                    { label: "Creados", value: jobDetail.contacts_created, color: "text-green-400" },
                    { label: "Actualizados", value: jobDetail.contacts_updated, color: "text-blue-400" },
                    { label: "Conflictos", value: jobDetail.conflicts_count, color: "text-yellow-400" },
                    { label: "Inválidos", value: jobDetail.invalid_rows_count, color: "text-red-400" },
                    { label: "Fechas no parseadas", value: jobDetail.connected_on_parse_failed, color: "text-orange-400" },
                    { label: "Throughput", value: jobDetail.throughput_rows_per_sec ? `${jobDetail.throughput_rows_per_sec}/s` : "-", color: "text-slate-300" },
                  ].map(m => (
                    <div key={m.label} className="bg-black/20 p-2 rounded">
                      <div className="text-xs text-slate-500">{m.label}</div>
                      <div className={`text-lg font-bold ${m.color}`}>{m.value ?? 0}</div>
                    </div>
                  ))}
                </div>

                {/* Errors */}
                {(jobDetail.error_summary || jobDetail.last_error) && (
                  <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                    <Label className="text-red-400 text-xs">Error</Label>
                    <div className="text-sm text-red-300 mt-1">
                      {jobDetail.error_summary || jobDetail.last_error}
                    </div>
                  </div>
                )}

                {/* Buyer Personas */}
                {jobDetail.buyer_persona_counts && Object.keys(jobDetail.buyer_persona_counts).length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-xs">Distribución Buyer Persona</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(jobDetail.buyer_persona_counts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([persona, count]) => (
                          <Badge key={persona} variant="outline" className="border-slate-600">
                            {persona}: {count}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Column Mapping */}
                {jobDetail.column_mapping && Object.keys(jobDetail.column_mapping).length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-xs">Mapeo de Columnas</Label>
                    <div className="bg-black/20 p-3 rounded mt-2 grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(jobDetail.column_mapping).map(([csv, field]) => (
                        <div key={csv} className="flex justify-between">
                          <span className="text-slate-400">{csv}</span>
                          <span className="text-white">→ {field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Headers */}
                {jobDetail.headers && jobDetail.headers.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-xs">Headers del CSV</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {jobDetail.headers.map((h, i) => (
                        <Badge key={i} variant="outline" className="border-slate-700 text-xs">
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============ MAIN COMPONENT ============
export default function ImportNewConnectionsPage() {
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Per-profile state for importers
  const [importerState, setImporterState] = useState({
    GB: { uploading: false, currentJob: null, preview: null, columnMapping: {}, showPreview: false, progressInterval: null },
    MG: { uploading: false, currentJob: null, preview: null, columnMapping: {}, showPreview: false, progressInterval: null }
  });

  // Load import status
  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/linkedin-import/status");
      setStatus(res.data);
    } catch (error) {
      console.error("Error loading status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    return () => {
      // Cleanup intervals
      Object.values(importerState).forEach(state => {
        if (state.progressInterval) clearInterval(state.progressInterval);
      });
    };
  }, [loadStatus]);

  // Request export from LinkedIn (toggle checkbox)
  const handleRequestExport = async (profileId, currentValue) => {
    const newValue = !currentValue;
    
    try {
      const res = await api.post("/linkedin-import/request-export", { 
        profile: profileId,
        export_requested: newValue
      });
      toast.success(res.data.message);
      loadStatus();
    } catch (error) {
      console.error("Error toggling export:", error);
      const message = getErrorMessage(error);
      toast.error(`Error: ${message}`);
    }
  };

  // Reset week status (for testing)
  const handleResetWeek = async (profileId) => {
    try {
      const res = await api.post("/linkedin-import/reset-week", { profile: profileId });
      toast.success(res.data.message);
      loadStatus();
    } catch (error) {
      console.error("Error resetting week:", error);
      toast.error("Error al resetear estado semanal");
    }
  };

  // Update importer state for a specific profile
  const updateImporterState = (profileId, updates) => {
    setImporterState(prev => ({
      ...prev,
      [profileId]: { ...prev[profileId], ...updates }
    }));
  };

  // Handle file upload for a profile
  const handleFileUpload = async (profileId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error("Solo se permiten archivos CSV");
      return;
    }
    
    updateImporterState(profileId, { uploading: true });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("profile", profileId);
    
    try {
      const res = await api.post("/linkedin-import/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      updateImporterState(profileId, { currentJob: res.data });
      toast.success(`Archivo subido: ${res.data.total_rows} filas`);
      
      // Load preview
      await loadPreview(profileId, res.data.job_id);
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error(error.response?.data?.detail || "Error al subir archivo");
    } finally {
      updateImporterState(profileId, { uploading: false });
    }
  };

  // Load preview for a profile
  const loadPreview = async (profileId, jobId) => {
    try {
      const res = await api.get(`/linkedin-import/preview/${jobId}`);
      updateImporterState(profileId, { 
        preview: res.data, 
        columnMapping: res.data.column_mapping || {},
        showPreview: true 
      });
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Error al cargar vista previa");
    }
  };

  // Update column mapping for a profile
  const handleMappingChange = (profileId, csvColumn, fieldValue) => {
    setImporterState(prev => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        columnMapping: {
          ...prev[profileId].columnMapping,
          [csvColumn]: fieldValue
        }
      }
    }));
  };

  // Start import for a profile
  const handleStartImport = async (profileId) => {
    const state = importerState[profileId];
    if (!state.currentJob) return;
    
    try {
      await api.post(`/linkedin-import/start/${state.currentJob.job_id}`, state.columnMapping);
      toast.success("Importación iniciada");
      updateImporterState(profileId, { showPreview: false });
      
      // Start polling for progress
      startProgressPolling(profileId, state.currentJob.job_id);
    } catch (error) {
      console.error("Error starting import:", error);
      toast.error(error.response?.data?.detail || "Error al iniciar importación");
    }
  };

  // Poll for progress for a profile
  const startProgressPolling = (profileId, jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/linkedin-import/progress/${jobId}`);
        updateImporterState(profileId, { currentJob: res.data });
        
        if (res.data.status === "completed" || res.data.status === "failed" || res.data.status === "cancelled") {
          clearInterval(interval);
          updateImporterState(profileId, { progressInterval: null });
          loadStatus();
          
          if (res.data.status === "completed") {
            toast.success(`Importación ${profileId} completada: ${res.data.contacts_created} creados, ${res.data.contacts_updated} actualizados`);
          } else if (res.data.status === "failed") {
            toast.error(`Importación ${profileId} fallida: ${res.data.error_summary}`);
          }
        }
      } catch (error) {
        console.error("Error polling progress:", error);
      }
    }, 2000);
    
    updateImporterState(profileId, { progressInterval: interval });
  };

  // Cancel import for a profile
  const handleCancelImport = async (profileId) => {
    const state = importerState[profileId];
    if (!state.currentJob) return;
    
    try {
      await api.post(`/linkedin-import/cancel/${state.currentJob.job_id}`);
      toast.success("Importación cancelada");
      if (state.progressInterval) {
        clearInterval(state.progressInterval);
        updateImporterState(profileId, { progressInterval: null });
      }
      loadStatus();
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Error al cancelar");
    }
  };

  // Download conflicts for a job
  const handleDownloadConflicts = async (jobId) => {
    try {
      const res = await api.get(`/linkedin-import/${jobId}/conflicts/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `conflicts_${jobId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading conflicts:", error);
      toast.error("Error al descargar conflictos");
    }
  };

  // Download invalid rows for a job
  const handleDownloadInvalidRows = async (jobId) => {
    try {
      const res = await api.get(`/linkedin-import/job/${jobId}/invalid-rows/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invalid_rows_${jobId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading invalid rows:", error);
      toast.error("Error al descargar filas inválidas");
    }
  };

  // Download parse failures for a job
  const handleDownloadParseFailures = async (jobId) => {
    try {
      const res = await api.get(`/linkedin-import/job/${jobId}/parse-failures/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `parse_failures_${jobId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading parse failures:", error);
      toast.error("Error al descargar errores de parseo");
    }
  };

  // Reset importer for a profile
  const handleResetImporter = (profileId) => {
    updateImporterState(profileId, { 
      currentJob: null, 
      preview: null, 
      columnMapping: {}, 
      showPreview: false 
    });
  };

  // Get traffic status
  const getTrafficStatus = () => {
    const gb = status?.GB;
    const mg = status?.MG;
    
    const gbImported = gb?.import_completed;
    const mgImported = mg?.import_completed;
    const gbRequested = gb?.export_requested;
    const mgRequested = mg?.export_requested;
    
    if (gbImported && mgImported) return "green";
    if (!gbRequested && !mgRequested) return "red";
    return "yellow";
  };

  const trafficStatus = getTrafficStatus();

  if (loading) {
    return (
      <SectionLayout
        title="Import New Connections"
        subheadline="Cargando..."
        steps={[]}
        trafficRules={{}}
        isDaily={false}
        currentStatus="gray"
        icon={Download}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </SectionLayout>
    );
  }

  // Render a single profile importer module
  const renderProfileModule = (profile) => {
    const profileStatus = status[profile.id];
    const isRequested = profileStatus?.export_requested;
    const isImported = profileStatus?.import_completed;
    const completedJobsCount = profileStatus?.completed_jobs_count || 0;
    const latestJob = profileStatus?.latest_job;
    const state = importerState[profile.id];
    const isImporterEnabled = isRequested && !isImported;

    // Determine which job to show in the result panel
    const jobForResult = state.currentJob?.status === "completed" || state.currentJob?.status === "failed"
      ? state.currentJob
      : latestJob?.status === "completed" || latestJob?.status === "failed"
        ? latestJob
        : null;

    return (
      <Card key={profile.id} className="bg-[#111] border-[#222] mb-6" data-testid={`profile-module-${profile.id}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">
                {profile.label}
              </span>
              <span>{profile.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {isImported && completedJobsCount > 0 && (
                <Badge className="bg-green-500/20 text-green-400 text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  {completedJobsCount} imports esta semana
                </Badge>
              )}
              {/* Reset button for development/testing */}
              {isImported && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetWeek(profile.id)}
                  className="text-slate-500 hover:text-slate-300 h-6 px-2"
                  title="Resetear estado semanal (desarrollo)"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 1: Export Checkbox */}
          <div className="mb-4">
            <div
              className={`
                flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer
                ${isImported 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : isRequested
                    ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50'
                    : 'bg-[#0a0a0a] border-[#333] hover:border-[#444]'
                }
              `}
              onClick={() => !isImported && handleRequestExport(profile.id, isRequested)}
              data-testid={`checkbox-container-${profile.id}`}
            >
              <Checkbox 
                checked={isRequested || false}
                disabled={isImported}
                className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                data-testid={`checkbox-${profile.id}`}
              />
              <div className="flex-1">
                <span className="text-white font-medium">
                  {isImported 
                    ? "Export completado e importado" 
                    : isRequested 
                      ? "Export solicitado (click para desmarcar)" 
                      : "Marcar cuando se haya solicitado el export de LinkedIn"
                  }
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  <a 
                    href="https://www.linkedin.com/mypreferences/d/download-my-data" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3 inline mr-1" />
                    Ir a LinkedIn Data Export
                  </a>
                </p>
              </div>
              {isRequested && !isImported && (
                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                  Listo para importar
                </Badge>
              )}
            </div>
          </div>

          {/* Step 2: Importer (only visible when export is requested and not yet imported) */}
          {!isImporterEnabled ? (
            <div className="p-6 bg-[#0a0a0a] rounded-lg border border-[#333] flex items-center justify-center gap-3 text-slate-500">
              <Lock className="w-5 h-5" />
              <span>
                {isImported 
                  ? "Ya se importaron conexiones esta semana"
                  : "Marca el checkbox cuando hayas solicitado el export para habilitar la importación"
                }
              </span>
            </div>
          ) : (
            <div className="space-y-4" data-testid={`importer-${profile.id}`}>
              {/* File Upload */}
              {!state.showPreview && !state.currentJob?.status && (
                <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#333]">
                  <Label className="text-slate-400 text-sm mb-2 block">Subir archivo CSV de conexiones</Label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(profile.id, e)}
                    disabled={state.uploading}
                    className="bg-[#111] border-[#333] file:bg-orange-500/20 file:text-orange-400 file:border-0"
                    data-testid={`file-input-${profile.id}`}
                  />
                  {state.uploading && (
                    <div className="flex items-center gap-2 text-slate-400 mt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Subiendo archivo...
                    </div>
                  )}
                </div>
              )}

              {/* Preview & Mapping */}
              {state.showPreview && state.preview && (
                <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#333]">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Vista Previa y Mapeo
                    </h4>
                    <Badge variant="outline" className="border-[#333]">
                      {state.preview.total_rows} filas
                    </Badge>
                  </div>

                  {/* Column Mapping */}
                  <div className="mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {state.preview.headers.map(header => (
                        <div key={header} className="space-y-1">
                          <Label className="text-xs text-slate-500">{header}</Label>
                          <Select 
                            value={state.columnMapping[header] || "_ignore"} 
                            onValueChange={(v) => handleMappingChange(profile.id, header, v)}
                          >
                            <SelectTrigger className="bg-[#111] border-[#333] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="mb-4 overflow-x-auto max-h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[#333]">
                          {state.preview.headers.slice(0, 5).map(h => (
                            <TableHead key={h} className="text-slate-400 text-xs">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state.preview.preview_rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i} className="border-[#333]">
                            {state.preview.headers.slice(0, 5).map(h => (
                              <TableCell key={h} className="text-xs text-slate-300 max-w-[120px] truncate">
                                {row[h]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <Button 
                      onClick={() => handleStartImport(profile.id)}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid={`start-import-${profile.id}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Importación
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => updateImporterState(profile.id, { showPreview: false, currentJob: null })}
                      className="border-[#333]"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress */}
              {state.currentJob?.status === "processing" && (
                <div className="p-4 bg-[#0a0a0a] rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-sm font-semibold text-blue-400">Importación en progreso</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Progreso</span>
                      <span className="text-sm text-white">{state.currentJob.progress_percent}%</span>
                    </div>
                    <Progress value={state.currentJob.progress_percent} className="h-2" />
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center mb-4">
                    <div>
                      <div className="text-lg font-bold text-white">{state.currentJob.processed_rows}</div>
                      <div className="text-xs text-slate-500">Procesados</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-400">{state.currentJob.contacts_created}</div>
                      <div className="text-xs text-slate-500">Creados</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-400">{state.currentJob.contacts_updated}</div>
                      <div className="text-xs text-slate-500">Actualizados</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-yellow-400">{state.currentJob.conflicts_count}</div>
                      <div className="text-xs text-slate-500">Conflictos</div>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={() => handleCancelImport(profile.id)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Import Result Panel (immediate report) */}
          {jobForResult && (
            <ImportResultPanel 
              job={jobForResult} 
              onDownloadConflicts={handleDownloadConflicts}
              onDownloadInvalidRows={handleDownloadInvalidRows}
              onDownloadParseFailures={handleDownloadParseFailures}
            />
          )}

          {/* New Import Button (when completed) */}
          {(state.currentJob?.status === "completed" || state.currentJob?.status === "failed") && isImporterEnabled && (
            <Button 
              variant="outline" 
              onClick={() => handleResetImporter(profile.id)}
              className="border-[#333] mt-4"
              size="sm"
            >
              Nueva importación
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <SectionLayout
      title={SECTION?.label || "Import New Connections"}
          sectionId={SECTION.id}
      subheadline={SECTION?.subheadline || "Importa conexiones de LinkedIn semanalmente"}
      steps={SECTION?.steps || []}
      trafficRules={SECTION?.trafficRules || {}}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={Download}
    >
      {/* Instructions */}
      <Card className="bg-[#111] border-[#222] mb-6">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">Instrucciones</h4>
              <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                <li>Ve a <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">LinkedIn Data Export</a> y solicita "Connections"</li>
                <li>Marca el checkbox del perfil correspondiente</li>
                <li>Cuando recibas el archivo (2-3 días), súbelo en el importador que se habilita</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Profile Modules */}
      {LINKEDIN_PROFILES.map(profile => renderProfileModule(profile))}

      {/* Refresh Button */}
      <div className="flex justify-center mb-6">
        <Button variant="ghost" size="sm" onClick={loadStatus} className="text-slate-500">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar estado
        </Button>
      </div>

      {/* Historical Section */}
      <HistoricalSection />
    </SectionLayout>
  );
}
