import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import ContactSheet from "../components/ContactSheet";
import api from "../lib/api";
import {
  Briefcase,
  Plus,
  RefreshCw,
  Users,
  DollarSign,
  Building2,
  ExternalLink,
  FileText,
  XCircle,
  CheckCircle2,
  Upload,
  Loader2,
  ChevronRight,
  ChevronDown,
  Link2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Eye,
  Trash2,
  Edit2,
  Mail,
  Phone,
  Target,
  GraduationCap,
  Sparkles,
  FileSpreadsheet,
  PlayCircle,
  RotateCcw,
  Copy,
  Hash
} from "lucide-react";

// Stage labels
const STAGE_LABELS = {
  caso_solicitado: "Caso Solicitado",
  caso_presentado: "Caso Presentado",
  interes_en_caso: "Interés en Caso",
  cierre_administrativo: "En Cierre Administrativo"
};

const STAGE_COLORS = {
  caso_solicitado: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  caso_presentado: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  interes_en_caso: "bg-green-500/20 text-green-400 border-green-500/50",
  cierre_administrativo: "bg-amber-500/20 text-amber-400 border-amber-500/50"
};

const STATUS_LABELS = {
  active: "Activo",
  descartado: "Descartado"
};

export default function CasesPage() {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    caso_solicitado: 0,
    caso_presentado: 0,
    interes_en_caso: 0,
    cierre_administrativo: 0,
    descartado: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  
  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hubspotUrl, setHubspotUrl] = useState("");
  const [importStage, setImportStage] = useState("caso_solicitado");
  const [importStatus, setImportStatus] = useState("active");
  const [importProgress, setImportProgress] = useState(null);
  const [importId, setImportId] = useState(null);
  const [isPollingProgress, setIsPollingProgress] = useState(false);
  
  // Case detail dialog
  const [selectedCase, setSelectedCase] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Quote dialog
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteTitle, setQuoteTitle] = useState("");
  const [quoteUrl, setQuoteUrl] = useState("");
  const [quoteSource, setQuoteSource] = useState("google_drive");
  const [savingQuote, setSavingQuote] = useState(false);
  
  // Discard dialog
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [markingDiscarded, setMarkingDiscarded] = useState(false);

  // Contact edit
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Batting stats
  const [battingStats, setBattingStats] = useState(null);
  const [battingDialogOpen, setBattingDialogOpen] = useState(false);

  useEffect(() => {
    loadCases();
    loadBattingStats();
  }, []);

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await api.get("/cases/");
      setCases(response.data.cases || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error("Error loading cases:", error);
      toast.error("Error cargando casos");
    } finally {
      setLoading(false);
    }
  };

  const loadBattingStats = async () => {
    try {
      const response = await api.get("/todays-focus/batting-stats");
      setBattingStats(response.data);
    } catch (error) {
      console.error("Error loading batting stats:", error);
    }
  };

  // Poll for import progress
  const pollImportProgress = useCallback(async (id) => {
    try {
      const response = await api.get(`/cases/import-progress/${id}`);
      const progress = response.data;
      setImportProgress(progress);
      
      if (progress.status === 'complete') {
        setIsPollingProgress(false);
        toast.success(
          `¡Importación completada! ${progress.created} nuevos, ${progress.updated} actualizados, ` +
          `${progress.contacts_updated} contactos, ${progress.companies_imported} empresas, ${progress.quotes_imported} cotizaciones`
        );
        setImporting(false);
        setImportDialogOpen(false);
        setHubspotUrl("");
        setImportProgress(null);
        setImportId(null);
        loadCases();
      } else if (progress.status === 'error') {
        setIsPollingProgress(false);
        toast.error(progress.error || 'Error en importación');
        setImporting(false);
        setImportProgress(null);
        setImportId(null);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, []);

  // Polling effect
  useEffect(() => {
    let interval;
    if (isPollingProgress && importId) {
      interval = setInterval(() => pollImportProgress(importId), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPollingProgress, importId, pollImportProgress]);

  const startImport = async () => {
    if (!hubspotUrl.trim()) {
      toast.error("Ingresa la URL de la lista de HubSpot");
      return;
    }
    
    setImporting(true);
    setImportProgress({ status: 'starting', phase: 'Iniciando...', percent: 0 });
    
    try {
      const response = await api.post("/cases/import-hubspot", {
        hubspot_list_url: hubspotUrl,
        case_stage: importStage,
        case_status: importStatus
      });
      
      if (response.data.status === 'started') {
        setImportId(response.data.import_id);
        setIsPollingProgress(true);
        toast.info("Importación iniciada...");
      }
    } catch (error) {
      console.error("Error starting import:", error);
      toast.error("Error al iniciar importación");
      setImporting(false);
      setImportProgress(null);
    }
  };

  const openCaseDetail = async (caseItem) => {
    setSelectedCase(caseItem);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    
    try {
      const response = await api.get(`/cases/${caseItem.id}`);
      setSelectedCase(response.data);
    } catch (error) {
      console.error("Error loading case detail:", error);
      toast.error("Error cargando detalle");
    } finally {
      setLoadingDetail(false);
    }
  };

  const removeContactFromCase = async (caseId, contactId) => {
    if (!window.confirm("¿Eliminar este contacto del caso?")) return;
    
    try {
      await api.delete(`/cases/${caseId}/remove-contact/${contactId}`);
      toast.success("Contacto eliminado del caso");
      // Reload the case detail
      openCaseDetail({ id: caseId });
    } catch (error) {
      console.error("Error removing contact:", error);
      toast.error("Error al eliminar contacto");
    }
  };

  const openQuoteDialog = (caseItem) => {
    setSelectedCase(caseItem);
    setQuoteTitle("");
    setQuoteUrl("");
    setQuoteSource("google_drive");
    setQuoteDialogOpen(true);
  };

  const saveQuote = async () => {
    if (!quoteUrl.trim() || !quoteTitle.trim()) {
      toast.error("Ingresa título y URL de la cotización");
      return;
    }
    
    setSavingQuote(true);
    try {
      await api.post(`/cases/${selectedCase.id}/quotes`, {
        title: quoteTitle,
        url: quoteUrl,
        source: quoteSource
      });
      toast.success("Cotización agregada");
      setQuoteDialogOpen(false);
      loadCases();
    } catch (error) {
      console.error("Error saving quote:", error);
      toast.error("Error al guardar cotización");
    } finally {
      setSavingQuote(false);
    }
  };

  const openDiscardDialog = (caseItem) => {
    setSelectedCase(caseItem);
    setDiscardReason("");
    setDiscardDialogOpen(true);
  };

  const markAsDiscarded = async () => {
    setMarkingDiscarded(true);
    try {
      await api.patch(`/cases/${selectedCase.id}/discard${discardReason ? `?discard_reason=${encodeURIComponent(discardReason)}` : ''}`);
      toast.success("Caso marcado como descartado");
      setDiscardDialogOpen(false);
      loadCases();
    } catch (error) {
      console.error("Error marking as discarded:", error);
      toast.error("Error al descartar caso");
    } finally {
      setMarkingDiscarded(false);
    }
  };

  const reactivateCase = async (caseId) => {
    try {
      await api.patch(`/cases/${caseId}/reactivate`);
      toast.success("Caso reactivado");
      loadCases();
    } catch (error) {
      console.error("Error reactivating case:", error);
      toast.error("Error al reactivar caso");
    }
  };

  const updateCaseStage = async (caseId, newStage) => {
    try {
      await api.patch(`/cases/${caseId}`, { stage: newStage });
      toast.success(`Caso movido a ${STAGE_LABELS[newStage]}`);
      loadCases();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Error al actualizar etapa");
    }
  };

  const deleteCase = async (caseId) => {
    if (!confirm("¿Eliminar este caso? Esta acción no se puede deshacer.")) return;
    
    try {
      await api.delete(`/cases/${caseId}`);
      toast.success("Caso eliminado");
      loadCases();
    } catch (error) {
      console.error("Error deleting case:", error);
      toast.error("Error al eliminar caso");
    }
  };

  const formatCurrency = (amount, currency = "MXN") => {
    if (!amount) return "-";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Filter cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (filterStage !== "all" && c.stage !== filterStage) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      return true;
    });
  }, [cases, filterStage, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cases-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#ff3300]/20">
            <Briefcase className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Casos (Cotizaciones)</h1>
            <p className="text-slate-500">Fase 3: Cierre - Negocios con interés en cotización</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Batting Percentage Indicator */}
          {battingStats && (
            <div 
              className="flex items-center gap-4 px-4 py-2 bg-[#111] border border-[#333] rounded-lg cursor-pointer hover:border-[#ff3300]/50 transition-colors"
              onClick={() => setBattingDialogOpen(true)}
            >
              <div className="text-center">
                <p className="text-xs text-slate-500">Bateo Total</p>
                <p className="text-lg font-bold text-[#ff3300]">{battingStats.all_time?.batting_percentage}%</p>
              </div>
              <div className="w-px h-8 bg-[#333]" />
              <div className="text-center">
                <p className="text-xs text-slate-500">{battingStats.current_year?.year}</p>
                <p className="text-lg font-bold text-emerald-400">{battingStats.current_year?.batting_percentage}%</p>
              </div>
            </div>
          )}
          <Button onClick={loadCases} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => setImportDialogOpen(true)} 
            className="bg-[#ff3300] hover:bg-[#ff3300]/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Importar desde HubSpot
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Casos</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Briefcase className="w-8 h-8 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-400">Solicitados</p>
                <p className="text-2xl font-bold text-blue-400">{stats.caso_solicitado}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-400">Presentados</p>
                <p className="text-2xl font-bold text-purple-400">{stats.caso_presentado}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-400">Con Interés</p>
                <p className="text-2xl font-bold text-green-400">{stats.interes_en_caso}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-400">Cierre Admin.</p>
                <p className="text-2xl font-bold text-amber-400">{stats.cierre_administrativo}</p>
              </div>
              <Sparkles className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-400">Descartados</p>
                <p className="text-2xl font-bold text-red-400">{stats.descartado}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-48 bg-[#111] border-[#333] text-white">
            <SelectValue placeholder="Filtrar por etapa" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-[#333]">
            <SelectItem value="all">Todas las etapas</SelectItem>
            <SelectItem value="caso_solicitado">Caso Solicitado</SelectItem>
            <SelectItem value="caso_presentado">Caso Presentado</SelectItem>
            <SelectItem value="interes_en_caso">Interés en Caso</SelectItem>
            <SelectItem value="cierre_administrativo">En Cierre Administrativo</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-[#111] border-[#333] text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-[#333]">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="descartado">Descartados</SelectItem>
          </SelectContent>
        </Select>
        
        {(filterStage !== "all" || filterStatus !== "active") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setFilterStage("all"); setFilterStatus("active"); }}
            className="text-slate-400 hover:text-white"
          >
            Limpiar filtros
          </Button>
        )}
        
        <span className="text-sm text-slate-500 ml-auto">
          {filteredCases.length} casos
        </span>
      </div>

      {/* Cases Table */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-0">
          {filteredCases.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No hay casos</h3>
              <p className="text-sm">Importa negocios desde HubSpot para comenzar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#222] hover:bg-transparent">
                  <TableHead className="text-slate-400">Caso</TableHead>
                  <TableHead className="text-slate-400">Empresas</TableHead>
                  <TableHead className="text-slate-400">Monto</TableHead>
                  <TableHead className="text-slate-400">Etapa</TableHead>
                  <TableHead className="text-slate-400">Cotizaciones</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((caseItem) => (
                  <TableRow 
                    key={caseItem.id} 
                    className={`border-[#222] hover:bg-[#151515] ${caseItem.status === 'descartado' ? 'opacity-60' : ''}`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{caseItem.name}</p>
                        {caseItem.anonymous_name && (
                          <p className="text-xs text-slate-500">({caseItem.anonymous_name})</p>
                        )}
                        <p className="text-xs text-slate-500">
                          {caseItem.contact_ids?.length || 0} contacto(s)
                          {caseItem.services?.length > 0 && (
                            <span className="ml-2 text-orange-400">
                              • {caseItem.services.join(", ")}
                            </span>
                          )}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {caseItem.company_names?.length > 0 ? (
                          caseItem.company_names.map((name, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-slate-300 text-sm">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {name}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-400 font-medium">
                        {formatCurrency(caseItem.amount, caseItem.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {caseItem.status === 'descartado' ? (
                        <Badge className="bg-red-500/20 text-red-400 border border-red-500/50">
                          Descartado
                        </Badge>
                      ) : (
                        <Select 
                          value={caseItem.stage} 
                          onValueChange={(val) => updateCaseStage(caseItem.id, val)}
                        >
                          <SelectTrigger className={`w-44 h-8 text-xs border ${STAGE_COLORS[caseItem.stage]} bg-transparent`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111] border-[#333]">
                            <SelectItem value="caso_solicitado">Caso Solicitado</SelectItem>
                            <SelectItem value="caso_presentado">Caso Presentado</SelectItem>
                            <SelectItem value="interes_en_caso">Interés en Caso</SelectItem>
                            <SelectItem value="cierre_administrativo">En Cierre Admin.</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {caseItem.quotes?.length > 0 ? (
                          <>
                            <span className="text-xs text-slate-400">
                              {caseItem.quotes.length} cotización(es)
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openCaseDetail(caseItem)}
                              className="text-blue-400 hover:text-blue-300 h-6 px-2 justify-start"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Ver
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openQuoteDialog(caseItem)}
                            className="text-slate-400 hover:text-white h-8"
                          >
                            <Link2 className="w-4 h-4 mr-1" />
                            Agregar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCaseDetail(caseItem)}
                          className="text-slate-400 hover:text-white p-1"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {caseItem.status !== 'descartado' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openDiscardDialog(caseItem)}
                            className="text-slate-400 hover:text-red-400 p-1"
                            title="Descartar"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => reactivateCase(caseItem.id)}
                            className="text-slate-400 hover:text-green-400 p-1"
                            title="Reactivar"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteCase(caseItem.id)}
                          className="text-slate-400 hover:text-red-400 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#ff3300]" />
              Importar Negocios desde HubSpot
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">URL de la lista de HubSpot *</label>
              <Input
                placeholder="https://app.hubspot.com/contacts/.../objectLists/..."
                value={hubspotUrl}
                onChange={(e) => setHubspotUrl(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
                disabled={importing}
              />
              <p className="text-xs text-slate-500 mt-1">
                Crea una lista de negocios en HubSpot y pega la URL aquí
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Etapa del caso</label>
                <Select value={importStage} onValueChange={setImportStage} disabled={importing}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#333]">
                    <SelectItem value="caso_solicitado">Caso Solicitado</SelectItem>
                    <SelectItem value="caso_presentado">Caso Presentado</SelectItem>
                    <SelectItem value="interes_en_caso">Interés en Caso</SelectItem>
                    <SelectItem value="cierre_administrativo">En Cierre Admin.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Status</label>
                <Select value={importStatus} onValueChange={setImportStatus} disabled={importing}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#333]">
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="descartado">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-sm font-medium">¿Qué se importará?</p>
              <ul className="text-blue-400/70 text-xs mt-1 space-y-0.5">
                <li>• Negocios (deals) de la lista de HubSpot</li>
                <li>• Todas las empresas asociadas a cada negocio</li>
                <li>• Todos los contactos asociados (movidos a Fase 3)</li>
                <li>• Todas las cotizaciones de HubSpot + Google Drive</li>
                <li>• Objetivos, transcripciones, slides, reportes, etc.</li>
              </ul>
            </div>
            
            {/* Progress Bar */}
            {importProgress && importProgress.status !== 'not_found' && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {importProgress.status === 'complete' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : importProgress.status === 'error' ? (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                    )}
                    <div>
                      <p className="font-medium text-white text-sm">{importProgress.phase}</p>
                      {importProgress.total > 0 && (
                        <p className="text-xs text-slate-400">
                          {importProgress.processed || 0} de {importProgress.total} negocios
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xl font-bold text-orange-400">
                    {importProgress.percent || 0}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300 ease-out"
                    style={{ width: `${importProgress.percent || 0}%` }}
                  />
                </div>
                
                {/* Stats */}
                {(importProgress.status === 'importing' || importProgress.status === 'complete') && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-400">{importProgress.created || 0}</p>
                      <p className="text-xs text-slate-400">Casos nuevos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-400">{importProgress.contacts_updated || 0}</p>
                      <p className="text-xs text-slate-400">Contactos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-purple-400">{importProgress.quotes_imported || 0}</p>
                      <p className="text-xs text-slate-400">Cotizaciones</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setImportDialogOpen(false)} 
              className="border-[#333]"
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button 
              onClick={startImport} 
              disabled={importing || !hubspotUrl.trim()} 
              className="bg-[#ff3300]"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#ff3300]" />
              {selectedCase?.name || "Detalle del Caso"}
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : selectedCase && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Monto</p>
                  <p className="text-green-400 font-bold">
                    {formatCurrency(selectedCase.amount, selectedCase.currency)}
                  </p>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Etapa</p>
                  <Badge className={`${STAGE_COLORS[selectedCase.stage]} border`}>
                    {STAGE_LABELS[selectedCase.stage]}
                  </Badge>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <Badge className={selectedCase.status === 'descartado' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                    {STATUS_LABELS[selectedCase.status]}
                  </Badge>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Nombre Anónimo</p>
                  <p className="text-white text-sm">{selectedCase.anonymous_name || "-"}</p>
                </div>
              </div>
              
              {/* Services */}
              {selectedCase.services?.length > 0 && (
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">Servicios</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCase.services.map((service, idx) => (
                      <Badge key={idx} className="bg-orange-500/20 text-orange-400">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Companies */}
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                  <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-300">Empresas ({selectedCase.companies?.length || 0})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-6">
                    {selectedCase.companies?.length > 0 ? (
                      selectedCase.companies.map((company) => (
                        <div key={company.id} className="p-3 bg-[#0a0a0a] rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{company.name}</p>
                            <p className="text-xs text-slate-500">
                              {[company.industry, company.city, company.country].filter(Boolean).join(" • ")}
                            </p>
                          </div>
                          {company.domain && (
                            <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No hay empresas asociadas</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Contacts */}
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                  <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                  <Users className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-slate-300">Contactos ({selectedCase.contacts?.length || 0})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-6">
                    {selectedCase.contacts?.length > 0 ? (
                      selectedCase.contacts.map((contact) => (
                        <div key={contact.id} className="p-3 bg-[#0a0a0a] rounded-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">{contact.name}</p>
                                {contact.buyer_persona && (
                                  <Badge className="text-[10px] bg-slate-700">{contact.buyer_persona}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{contact.job_title || "-"} • {contact.company || "-"}</p>
                              
                              {/* Email and Phone with copy */}
                              <div className="mt-2 space-y-1">
                                {contact.email && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Mail className="w-3 h-3 text-slate-500" />
                                    <span className="text-slate-300">{contact.email}</span>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(contact.email); toast.success("Email copiado"); }}
                                      className="text-slate-500 hover:text-white"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                {contact.phone && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    <span className="text-slate-300">{contact.phone}</span>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(contact.phone); toast.success("Teléfono copiado"); }}
                                      className="text-slate-500 hover:text-white"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                {/* Internal ID for search */}
                                <div className="flex items-center gap-2 text-xs">
                                  <Hash className="w-3 h-3 text-slate-500" />
                                  <span className="text-slate-500 font-mono text-[10px]">{contact.id}</span>
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(contact.id); toast.success("ID copiado"); }}
                                    className="text-slate-500 hover:text-white"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeContactFromCase(selectedCase.id, contact.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                                title="Eliminar contacto del caso"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Quitar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingContact(contact); setEditContactOpen(true); }}
                                className="text-slate-400 hover:text-white h-7 px-2"
                                title="Editar contacto"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              {contact.email && (
                                <a 
                                  href={`mailto:${contact.email}`} 
                                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2"
                                >
                                  <Mail className="w-3 h-3" /> Email
                                </a>
                              )}
                              {contact.phone && (
                                <a 
                                  href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 px-2"
                                >
                                  <Phone className="w-3 h-3" /> WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No hay contactos asociados</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Quotes */}
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                  <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-slate-300">Cotizaciones ({selectedCase.quotes?.length || 0})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-6">
                    {selectedCase.quotes?.length > 0 ? (
                      selectedCase.quotes.map((quote, idx) => (
                        <div key={quote.hubspot_quote_id || quote.id || idx} className="p-3 bg-[#0a0a0a] rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{quote.title}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Badge className="text-[10px] bg-slate-700">
                                {quote.source === 'hubspot_native' ? 'HubSpot' : quote.source === 'google_drive' ? 'Google Drive' : 'Manual'}
                              </Badge>
                              {quote.amount && <span>{formatCurrency(parseFloat(quote.amount))}</span>}
                              {quote.status && <span>• {quote.status}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(quote.public_url || quote.url) && (
                              <a href={quote.public_url || quote.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {quote.pdf_url && (
                              <a href={quote.pdf_url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300" title="Descargar PDF">
                                <FileSpreadsheet className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No hay cotizaciones</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDetailDialogOpen(false); openQuoteDialog(selectedCase); }}
                      className="mt-2 border-[#333] text-slate-300"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar cotización
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Objectives */}
              {(selectedCase.objective_business_results || selectedCase.objective_behavior_change || 
                selectedCase.objective_learning || selectedCase.objective_experience) && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                    <Target className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-slate-300">Objetivos</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-6">
                      {selectedCase.objective_business_results && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Resultados de Negocio</p>
                          <p className="text-sm text-slate-300">{selectedCase.objective_business_results}</p>
                        </div>
                      )}
                      {selectedCase.objective_behavior_change && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Cambio de Comportamiento</p>
                          <p className="text-sm text-slate-300">{selectedCase.objective_behavior_change}</p>
                        </div>
                      )}
                      {selectedCase.objective_learning && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Aprendizaje</p>
                          <p className="text-sm text-slate-300">{selectedCase.objective_learning}</p>
                        </div>
                      )}
                      {selectedCase.objective_experience && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Experiencia</p>
                          <p className="text-sm text-slate-300">{selectedCase.objective_experience}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Drive Links */}
              {(selectedCase.slides_url || selectedCase.report_url || selectedCase.case_drive_url || 
                selectedCase.alignment_calls_transcription || selectedCase.students_transcription) && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                    <Link2 className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-slate-300">Archivos y Enlaces</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 grid grid-cols-2 gap-2 pl-6">
                      {selectedCase.slides_url && (
                        <a href={selectedCase.slides_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <PlayCircle className="w-4 h-4" />
                          <span className="text-sm">Slides</span>
                        </a>
                      )}
                      {selectedCase.report_url && (
                        <a href={selectedCase.report_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <FileSpreadsheet className="w-4 h-4" />
                          <span className="text-sm">Reporte</span>
                        </a>
                      )}
                      {selectedCase.case_drive_url && (
                        <a href={selectedCase.case_drive_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <Briefcase className="w-4 h-4" />
                          <span className="text-sm">Caso en Drive</span>
                        </a>
                      )}
                      {selectedCase.alignment_calls_transcription && (
                        <a href={selectedCase.alignment_calls_transcription} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">Transcripciones Alineación</span>
                        </a>
                      )}
                      {selectedCase.students_transcription && (
                        <a href={selectedCase.students_transcription} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <GraduationCap className="w-4 h-4" />
                          <span className="text-sm">Transcripciones Alumnos</span>
                        </a>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Notes */}
              {selectedCase.notes && (
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Notas</p>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{selectedCase.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)} className="border-[#333]">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Agregar Cotización
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Título *</label>
              <Input
                placeholder="Ej: Cotización v2 - Actualizada"
                value={quoteTitle}
                onChange={(e) => setQuoteTitle(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">URL de la cotización *</label>
              <Input
                placeholder="https://drive.google.com/..."
                value={quoteUrl}
                onChange={(e) => setQuoteUrl(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Origen</label>
              <Select value={quoteSource} onValueChange={setQuoteSource}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button 
              onClick={saveQuote} 
              disabled={savingQuote || !quoteUrl.trim() || !quoteTitle.trim()} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingQuote ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Dialog */}
      <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              Descartar Caso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-slate-400">
              ¿Estás seguro de descartar <strong className="text-white">{selectedCase?.name}</strong>?
            </p>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Razón (opcional)</label>
              <Textarea
                placeholder="¿Por qué se descarta este caso?"
                value={discardReason}
                onChange={(e) => setDiscardReason(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardDialogOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button 
              onClick={markAsDiscarded} 
              disabled={markingDiscarded} 
              className="bg-red-600 hover:bg-red-700"
            >
              {markingDiscarded ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Edit Sheet */}
      <ContactSheet
        contact={editingContact}
        open={editContactOpen}
        onOpenChange={(open) => {
          setEditContactOpen(open);
          if (!open) {
            setEditingContact(null);
            // Reload case detail to get updated contact info
            if (selectedCase?.id) {
              openCaseDetail(selectedCase);
            }
          }
        }}
      />

      {/* Batting Stats Dialog */}
      <Dialog open={battingDialogOpen} onOpenChange={setBattingDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ff3300]" />
              Porcentaje de Bateo
            </DialogTitle>
          </DialogHeader>
          
          {battingStats && (
            <div className="py-4 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#0a0a0a] rounded-lg text-center">
                  <p className="text-xs text-slate-500 mb-1">Bateo Total (Histórico)</p>
                  <p className="text-3xl font-bold text-[#ff3300]">{battingStats.all_time?.batting_percentage}%</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {battingStats.all_time?.converted} de {battingStats.all_time?.total} contactos
                  </p>
                </div>
                <div className="p-4 bg-[#0a0a0a] rounded-lg text-center">
                  <p className="text-xs text-slate-500 mb-1">Bateo {battingStats.current_year?.year}</p>
                  <p className="text-3xl font-bold text-emerald-400">{battingStats.current_year?.batting_percentage}%</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {battingStats.current_year?.won} de {battingStats.current_year?.total} contactos
                  </p>
                </div>
              </div>

              {/* Yearly Breakdown */}
              <div>
                <p className="text-sm text-slate-400 mb-3">Desglose Anual</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {battingStats.yearly_breakdown?.map((year) => (
                    <div key={year.year} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                      <span className="font-medium text-white">{year.year}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-400">
                          {year.won} / {year.total}
                        </span>
                        <Badge className={`${
                          year.batting_percentage >= 20 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : year.batting_percentage >= 10 
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {year.batting_percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBattingDialogOpen(false)} className="border-[#333]">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
