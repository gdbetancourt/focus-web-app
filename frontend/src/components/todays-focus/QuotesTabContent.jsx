/**
 * Quotes Tab Content Component
 * Shows cases in "caso_solicitado" stage - pending quote generation
 * Includes case detail dialog and discard functionality (reused from CasesPage)
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { ScrollArea } from "../ui/scroll-area";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  RefreshCw,
  Check,
  FileText,
  Phone,
  ExternalLink,
  Calculator,
  Users,
  Building2,
  Loader2,
  Eye,
  XCircle,
  Briefcase,
  ChevronRight,
  Mail,
  Copy,
  Hash,
  FileSpreadsheet,
  Plus,
  Sparkles,
  GraduationCap,
  BookOpen,
  Target,
} from "lucide-react";

// Stage labels and colors (reused from CasesPage)
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

export function QuotesTabContent({
  quotesCases,
  loadingQuotes,
  onRefresh,
  formatCurrency,
}) {
  // Case detail dialog (reused from CasesPage)
  const [selectedCase, setSelectedCase] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Discard dialog
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [markingDiscarded, setMarkingDiscarded] = useState(false);
  
  // Quote wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculatedTotals, setCalculatedTotals] = useState(null);
  
  // Catalogs
  const [thematicAxes, setThematicAxes] = useState([]);
  const [benefits, setBenefits] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    company: "",
    currency: "USD",
    discount_percent: 0,
    leaderlix_responsible: "",
    valid_until: ""
  });
  
  // Group composition
  const [group, setGroup] = useState({
    direccion: 0,
    management: 0,
    operacion: 0
  });
  
  // Thematic axis
  const [selectedAxisId, setSelectedAxisId] = useState("");
  
  // Objectives
  const [objectives, setObjectives] = useState({
    resultado_objetivo: "",
    resultado_descripcion: "",
    comportamiento_objetivo: "",
    comportamiento_descripcion: "",
    aprendizaje_objetivo: "",
    aprendizaje_descripcion: "",
    experiencia_objetivo: "",
    experiencia_descripcion: ""
  });
  
  // Additional benefits
  const [selectedBenefits, setSelectedBenefits] = useState([]);
  const [selectedPdfBlocks, setSelectedPdfBlocks] = useState([]);

  // Open case detail (same logic as CasesPage)
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

  // Open discard dialog
  const openDiscardDialog = (caseItem) => {
    setSelectedCase(caseItem);
    setDiscardReason("");
    setDiscardDialogOpen(true);
  };

  // Mark case as discarded
  const markAsDiscarded = async () => {
    setMarkingDiscarded(true);
    try {
      await api.patch(`/cases/${selectedCase.id}/discard${discardReason ? `?discard_reason=${encodeURIComponent(discardReason)}` : ''}`);
      toast.success("Caso marcado como descartado");
      setDiscardDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error("Error marking as discarded:", error);
      toast.error("Error al descartar caso");
    } finally {
      setMarkingDiscarded(false);
    }
  };

  // Load catalogs when wizard opens
  const loadCatalogs = async () => {
    setLoadingCatalogs(true);
    try {
      const [axesRes, benefitsRes] = await Promise.all([
        api.get("/cotizador/catalog/thematic-axes"),
        api.get("/cotizador/catalog/benefits"),
      ]);
      setThematicAxes(axesRes.data.thematic_axes || []);
      setBenefits(benefitsRes.data.additional_benefits || []);
    } catch (error) {
      console.error("Error loading catalogs:", error);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const openQuoteWizard = async (caseItem) => {
    setSelectedCase(caseItem);
    setWizardStep(1);
    setCalculatedTotals(null);
    
    // Pre-fill from case data
    const dealMaker = caseItem.deal_maker || {};
    setFormData({
      client_name: dealMaker.name || "",
      client_email: dealMaker.email || "",
      client_phone: dealMaker.phone || "",
      company: caseItem.company_name || caseItem.company_names?.[0] || "",
      currency: "USD",
      discount_percent: 0,
      leaderlix_responsible: "",
      valid_until: ""
    });
    
    setGroup({ direccion: 0, management: 0, operacion: 0 });
    setSelectedAxisId("");
    setObjectives({
      resultado_objetivo: "",
      resultado_descripcion: "",
      comportamiento_objetivo: "",
      comportamiento_descripcion: "",
      aprendizaje_objetivo: "",
      aprendizaje_descripcion: "",
      experiencia_objetivo: "",
      experiencia_descripcion: ""
    });
    setSelectedBenefits([]);
    
    setWizardOpen(true);
    await loadCatalogs();
  };

  const totalParticipants = group.direccion + group.management + group.operacion;
  const includesMasterclass = totalParticipants >= 4;
  const includesCourse = totalParticipants >= 8;

  const calculateQuote = async () => {
    if (totalParticipants === 0) {
      toast.error("Agrega al menos un participante");
      return;
    }
    
    setCalculating(true);
    try {
      const res = await api.post("/cotizador/calculate", {
        ...formData,
        group,
        thematic_axis_id: selectedAxisId || null,
        objectives,
        additional_benefits: selectedBenefits
      });
      setCalculatedTotals(res.data);
      setWizardStep(3);
    } catch (error) {
      toast.error("Error calculando cotización");
    } finally {
      setCalculating(false);
    }
  };

  const saveQuote = async () => {
    if (!formData.company) {
      toast.error("Ingresa la empresa");
      return;
    }
    if (totalParticipants === 0) {
      toast.error("Agrega al menos un participante");
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.post("/cotizador/quotes", {
        ...formData,
        group,
        thematic_axis_id: selectedAxisId || null,
        objectives,
        additional_benefits: selectedBenefits,
        pdf_blocks: selectedPdfBlocks,
        case_id: selectedCase?.id
      });
      toast.success(`Cotización ${res.data.quote_number} creada`);
      setWizardOpen(false);
      onRefresh();
    } catch (error) {
      toast.error("Error guardando cotización");
    } finally {
      setSaving(false);
    }
  };

  const toggleBenefit = (benefitId) => {
    if (selectedBenefits.includes(benefitId)) {
      setSelectedBenefits(selectedBenefits.filter(id => id !== benefitId));
    } else {
      setSelectedBenefits([...selectedBenefits, benefitId]);
    }
  };

  return (
    <>
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="border-b border-[#222]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-400" />
              Casos "Solicitados" (Pendientes de Cotización)
              {quotesCases.length > 0 && (
                <Badge className="bg-orange-500/20 text-orange-400">{quotesCases.length}</Badge>
              )}
            </CardTitle>
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              size="sm"
              className="border-[#333]"
              data-testid="refresh-quotes-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loadingQuotes ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingQuotes ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Cargando...
            </div>
          ) : quotesCases.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>¡No hay casos pendientes de cotización!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#222] hover:bg-transparent">
                  <TableHead className="text-slate-400">Caso</TableHead>
                  <TableHead className="text-slate-400">Cotizaciones</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotesCases.map((caseItem) => (
                  <TableRow key={caseItem.id} className="border-[#222] hover:bg-[#151515]">
                    <TableCell>
                      <div>
                        {/* Case name */}
                        <p className="font-medium text-white">{caseItem.name}</p>
                        
                        {/* Contacts count and services */}
                        <p className="text-xs text-slate-500">
                          {caseItem.contact_ids?.length || 0} contacto(s)
                          {caseItem.services?.length > 0 && (
                            <span className="ml-2 text-orange-400">
                              • {caseItem.services.join(", ")}
                            </span>
                          )}
                        </p>
                        
                        {/* Companies */}
                        {(caseItem.company_names?.length > 0 || caseItem.company_name) && (
                          <div className="flex items-center gap-1 mt-1 text-slate-400 text-xs">
                            <Building2 className="w-3 h-3" />
                            {caseItem.company_names?.length > 0 
                              ? caseItem.company_names.slice(0, 2).join(", ")
                              : caseItem.company_name
                            }
                            {caseItem.company_names?.length > 2 && (
                              <span className="text-slate-500">+{caseItem.company_names.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {caseItem.quotes?.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400">
                            {caseItem.quotes.length} cotización(es)
                          </span>
                          {caseItem.quotes.slice(0, 2).map((quote, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Badge className="text-[10px] bg-green-700">
                                {quote.quote_number || quote.title || "Quote"}
                              </Badge>
                              {(quote.pdf_url || quote.public_url || quote.url) && (
                                <a 
                                  href={quote.pdf_url || quote.public_url || quote.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Badge className="bg-orange-500/20 text-orange-400">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View detail button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCaseDetail(caseItem)}
                          className="text-slate-400 hover:text-white p-1"
                          title="Ver detalle"
                          data-testid={`view-detail-btn-${caseItem.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {/* Generate quote button */}
                        <Button
                          size="sm"
                          onClick={() => openQuoteWizard(caseItem)}
                          className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                          data-testid={`generate-quote-btn-${caseItem.id}`}
                        >
                          <Calculator className="w-3 h-3 mr-1" />
                          Generate Quote
                        </Button>
                        
                        {/* Discard button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDiscardDialog(caseItem)}
                          className="text-slate-400 hover:text-red-400 p-1"
                          title="Descartar"
                          data-testid={`discard-btn-${caseItem.id}`}
                        >
                          <XCircle className="w-4 h-4" />
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

      {/* Case Detail Dialog (same as CasesPage) */}
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
                  <Badge className={`${STAGE_COLORS[selectedCase.stage] || 'bg-slate-700'} border`}>
                    {STAGE_LABELS[selectedCase.stage] || selectedCase.stage}
                  </Badge>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <Badge className={selectedCase.status === 'descartado' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                    {STATUS_LABELS[selectedCase.status] || selectedCase.status}
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
                  <span className="text-sm text-slate-300">Empresas ({selectedCase.companies?.length || selectedCase.company_names?.length || 0})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-6">
                    {selectedCase.companies?.length > 0 ? (
                      selectedCase.companies.map((company, idx) => (
                        <div key={company.id || idx} className="p-3 bg-[#0a0a0a] rounded-lg flex items-center justify-between">
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
                    ) : selectedCase.company_names?.length > 0 ? (
                      selectedCase.company_names.map((name, idx) => (
                        <div key={idx} className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="font-medium text-white">{name}</p>
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
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-1">
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
                            <p className="font-medium text-white">{quote.title || quote.quote_number}</p>
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
                      onClick={() => { setDetailDialogOpen(false); openQuoteWizard(selectedCase); }}
                      className="mt-2 border-[#333] text-slate-300"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Generar cotización
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
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

      {/* Quote Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-400" />
              Generar Cotización - {selectedCase?.name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingCatalogs ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                {/* Step Indicator */}
                <div className="flex items-center gap-2">
                  <Badge className={wizardStep >= 1 ? "bg-blue-600" : "bg-slate-700"}>1. Datos</Badge>
                  <div className="h-px flex-1 bg-[#333]" />
                  <Badge className={wizardStep >= 2 ? "bg-blue-600" : "bg-slate-700"}>2. Grupo</Badge>
                  <div className="h-px flex-1 bg-[#333]" />
                  <Badge className={wizardStep >= 3 ? "bg-blue-600" : "bg-slate-700"}>3. Confirmar</Badge>
                </div>

                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contacto</Label>
                        <Input 
                          value={formData.client_name}
                          onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Empresa *</Label>
                        <Input 
                          value={formData.company}
                          onChange={(e) => setFormData({...formData, company: e.target.value})}
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input 
                          value={formData.client_email}
                          onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Teléfono</Label>
                        <Input 
                          value={formData.client_phone}
                          onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Moneda</Label>
                        <Select value={formData.currency} onValueChange={(v) => setFormData({...formData, currency: v})}>
                          <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111] border-[#333]">
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="MXN">MXN</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Descuento %</Label>
                        <Input 
                          type="number"
                          min="0"
                          max="100"
                          value={formData.discount_percent}
                          onChange={(e) => setFormData({...formData, discount_percent: parseFloat(e.target.value) || 0})}
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Responsable Leaderlix</Label>
                        <Input 
                          value={formData.leaderlix_responsible}
                          onChange={(e) => setFormData({...formData, leaderlix_responsible: e.target.value})}
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                    </div>

                    <Button onClick={() => setWizardStep(2)} className="w-full bg-blue-600 hover:bg-blue-700">
                      Siguiente: Composición del Grupo
                    </Button>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#0a0a0a] rounded-lg space-y-4">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Composición del Grupo
                      </Label>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2 text-center">
                          <Label className="text-sm">Dirección</Label>
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#333]"
                              onClick={() => setGroup({...group, direccion: Math.max(0, group.direccion - 1)})}
                            >-</Button>
                            <span className="w-12 text-center text-xl font-bold">{group.direccion}</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#333]"
                              onClick={() => setGroup({...group, direccion: group.direccion + 1})}
                            >+</Button>
                          </div>
                          <p className="text-xs text-slate-500">$3,500 USD c/u</p>
                        </div>
                        
                        <div className="space-y-2 text-center">
                          <Label className="text-sm">Management</Label>
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#333]"
                              onClick={() => setGroup({...group, management: Math.max(0, group.management - 1)})}
                            >-</Button>
                            <span className="w-12 text-center text-xl font-bold">{group.management}</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#333]"
                              onClick={() => setGroup({...group, management: group.management + 1})}
                            >+</Button>
                          </div>
                          <p className="text-xs text-slate-500">$3,000 USD c/u</p>
                        </div>
                        
                        <div className="space-y-2 text-center">
                          <Label className="text-sm">Operación</Label>
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#333]"
                              onClick={() => setGroup({...group, operacion: Math.max(0, group.operacion - 1)})}
                            >-</Button>
                            <span className="w-12 text-center text-xl font-bold">{group.operacion}</span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-[#333]"
                              onClick={() => setGroup({...group, operacion: group.operacion + 1})}
                            >+</Button>
                          </div>
                          <p className="text-xs text-slate-500">$2,500 USD c/u</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-[#222]">
                        <span className="font-medium">Total participantes: {totalParticipants}</span>
                        <div className="flex gap-2">
                          {includesMasterclass && (
                            <Badge className="bg-purple-500/20 text-purple-400">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Masterclass
                            </Badge>
                          )}
                          {includesCourse && (
                            <Badge className="bg-green-500/20 text-green-400">
                              <GraduationCap className="w-3 h-3 mr-1" />
                              Curso Titular
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {(includesMasterclass || includesCourse) && thematicAxes.length > 0 && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Eje Temático
                        </Label>
                        <Select value={selectedAxisId} onValueChange={setSelectedAxisId}>
                          <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                            <SelectValue placeholder="Seleccionar eje temático..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111] border-[#333]">
                            {thematicAxes.map(axis => (
                              <SelectItem key={axis.id} value={axis.id}>
                                {axis.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Objetivo Principal
                      </Label>
                      <Textarea 
                        value={objectives.resultado_objetivo}
                        onChange={(e) => setObjectives({...objectives, resultado_objetivo: e.target.value})}
                        placeholder="Este programa tiene el objetivo de..."
                        className="bg-[#0a0a0a] border-[#333]"
                        rows={2}
                      />
                    </div>

                    {benefits.length > 0 && (
                      <div className="space-y-2">
                        <Label>Beneficios Adicionales</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {benefits.slice(0, 6).map(benefit => (
                            <label key={benefit.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox 
                                checked={selectedBenefits.includes(benefit.id)}
                                onCheckedChange={() => toggleBenefit(benefit.id)}
                              />
                              <span className="text-slate-300">{benefit.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setWizardStep(1)} className="flex-1 border-[#333]">
                        Atrás
                      </Button>
                      <Button 
                        onClick={calculateQuote} 
                        disabled={calculating || totalParticipants === 0}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {calculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
                        Calcular Cotización
                      </Button>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && calculatedTotals && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[#0a0a0a] rounded-lg space-y-3">
                      <h3 className="font-semibold text-lg">Resumen de Cotización</h3>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Empresa:</span>
                          <span className="ml-2 text-white">{formData.company}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Participantes:</span>
                          <span className="ml-2 text-white">{calculatedTotals.total_participants}</span>
                        </div>
                      </div>

                      <div className="border-t border-[#222] pt-3 space-y-2">
                        {calculatedTotals.breakdown?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-400">{item.description}</span>
                            <span className="text-white">
                              {formData.currency === "MXN" ? "$" : "US$"}
                              {item.total?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-[#222] pt-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Subtotal antes de descuento:</span>
                          <span className="text-white">
                            {formData.currency === "MXN" ? "$" : "US$"}
                            {calculatedTotals.total_before_discount?.toLocaleString()}
                          </span>
                        </div>
                        {formData.discount_percent > 0 && (
                          <div className="flex justify-between text-green-400">
                            <span>Descuento ({formData.discount_percent}%):</span>
                            <span>-{formData.currency === "MXN" ? "$" : "US$"}{calculatedTotals.discount_amount?.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Subtotal:</span>
                          <span className="text-white">
                            {formData.currency === "MXN" ? "$" : "US$"}
                            {calculatedTotals.subtotal?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">IVA (16%):</span>
                          <span className="text-white">
                            {formData.currency === "MXN" ? "$" : "US$"}
                            {calculatedTotals.iva?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xl font-bold pt-2 border-t border-[#333]">
                          <span>Total:</span>
                          <span className="text-green-400">
                            {formData.currency === "MXN" ? "$" : "US$"}
                            {calculatedTotals.total?.toLocaleString()} {formData.currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setWizardStep(2)} className="flex-1 border-[#333]">
                        Modificar
                      </Button>
                      <Button 
                        onClick={saveQuote} 
                        disabled={saving}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        Crear Cotización
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QuotesTabContent;
