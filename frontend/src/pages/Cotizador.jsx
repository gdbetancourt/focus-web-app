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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Slider } from "../components/ui/slider";
import { toast } from "sonner";
import api from "../lib/api";
import { 
  FileText,
  Plus,
  Calculator,
  Download,
  Send,
  RefreshCw,
  Users,
  DollarSign,
  Percent,
  CheckCircle,
  XCircle,
  Target,
  Sparkles,
  BookOpen,
  GraduationCap,
  Award
} from "lucide-react";

export default function Cotizador() {
  const [benefits, setBenefits] = useState([]);
  const [thematicAxes, setThematicAxes] = useState([]);
  const [cierreContacts, setCierreContacts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(17.5);
  const [loading, setLoading] = useState(true);
  const [showNewQuote, setShowNewQuote] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculatedTotals, setCalculatedTotals] = useState(null);
  
  // Form state
  const [selectedContactId, setSelectedContactId] = useState("");
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
  
  // Thematic axis for Masterclass/Course
  const [selectedAxisId, setSelectedAxisId] = useState("");
  
  // Project objectives
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
  
  // PDF Blocks
  const [pdfBlocks, setPdfBlocks] = useState([]);
  const [selectedPdfBlocks, setSelectedPdfBlocks] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [benefitsRes, axesRes, contactsRes, quotesRes, rateRes, blocksRes] = await Promise.all([
        api.get("/cotizador/catalog/benefits"),
        api.get("/cotizador/catalog/thematic-axes"),
        api.get("/cotizador/contacts/cierre"),
        api.get("/cotizador/quotes"),
        api.get("/cotizador/exchange-rate"),
        api.get("/cotizador/catalog/pdf-blocks")
      ]);
      setBenefits(benefitsRes.data.additional_benefits || []);
      setThematicAxes(axesRes.data.thematic_axes || []);
      setCierreContacts(contactsRes.data.contacts || []);
      setQuotes(quotesRes.data.quotes || []);
      setExchangeRate(rateRes.data.usd_to_mxn || 17.5);
      
      const blocks = blocksRes.data.pdf_blocks || [];
      setPdfBlocks(blocks);
      // Set default selected blocks
      setSelectedPdfBlocks(blocks.filter(b => b.default).map(b => b.id));
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contactId) => {
    if (contactId === "manual") {
      setSelectedContactId("");
      setFormData({
        ...formData,
        client_name: "",
        client_email: "",
        client_phone: "",
        company: ""
      });
      return;
    }
    
    setSelectedContactId(contactId);
    const contact = cierreContacts.find(c => c.id === contactId);
    if (contact) {
      setFormData({
        ...formData,
        client_name: `${contact.firstname || ''} ${contact.lastname || ''}`.trim(),
        client_email: contact.email || "",
        client_phone: contact.phone || "",
        company: contact.company || ""
      });
    }
  };

  const totalParticipants = group.direccion + group.management + group.operacion;
  const includesMasterclass = totalParticipants >= 4;
  const includesCourse = totalParticipants >= 8;

  const toggleBenefit = (benefitId) => {
    if (selectedBenefits.includes(benefitId)) {
      setSelectedBenefits(selectedBenefits.filter(id => id !== benefitId));
    } else {
      setSelectedBenefits([...selectedBenefits, benefitId]);
    }
  };

  const togglePdfBlock = (blockId) => {
    if (selectedPdfBlocks.includes(blockId)) {
      setSelectedPdfBlocks(selectedPdfBlocks.filter(id => id !== blockId));
    } else {
      setSelectedPdfBlocks([...selectedPdfBlocks, blockId]);
    }
  };

  const calculateQuote = async () => {
    if (totalParticipants === 0) {
      toast.error("Agrega al menos un participante");
      return;
    }
    
    setCalculating(true);
    try {
      const res = await api.post("/cotizador/calculate", {
        contact_id: selectedContactId || null,
        ...formData,
        group,
        thematic_axis_id: selectedAxisId || null,
        objectives,
        additional_benefits: selectedBenefits
      });
      setCalculatedTotals(res.data);
    } catch (error) {
      toast.error("Error calculando cotización");
    } finally {
      setCalculating(false);
    }
  };

  const saveQuote = async () => {
    if (!formData.company) {
      toast.error("Selecciona un contacto o ingresa la empresa");
      return;
    }
    if (totalParticipants === 0) {
      toast.error("Agrega al menos un participante");
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.post("/cotizador/quotes", {
        contact_id: selectedContactId || null,
        ...formData,
        group,
        thematic_axis_id: selectedAxisId || null,
        objectives,
        additional_benefits: selectedBenefits,
        pdf_blocks: selectedPdfBlocks
      });
      toast.success(`Cotización ${res.data.quote_number} creada`);
      setShowNewQuote(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error("Error guardando cotización");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedContactId("");
    setFormData({
      client_name: "",
      client_email: "",
      client_phone: "",
      company: "",
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
    setSelectedPdfBlocks(pdfBlocks.filter(b => b.default).map(b => b.id));
    setCalculatedTotals(null);
  };

  const downloadPdf = async (quoteId, quoteNumber) => {
    try {
      const response = await api.get(`/cotizador/quotes/${quoteId}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cotizacion_${quoteNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF descargado");
    } catch (error) {
      toast.error("Error descargando PDF");
    }
  };

  const updateQuoteStatus = async (quoteId, status) => {
    try {
      await api.put(`/cotizador/quotes/${quoteId}/status?status=${status}`);
      toast.success(`Status actualizado`);
      loadData();
    } catch (error) {
      toast.error("Error actualizando status");
    }
  };

  const generateGoogleDoc = async (quoteId) => {
    try {
      toast.info("Generando documento en Google Docs...");
      const res = await api.post(`/cotizador/quotes/${quoteId}/generate-doc`);
      toast.success("Documento generado exitosamente");
      
      // Reload data to get the updated google_doc_url
      loadData();
      
      // Optionally open the document
      if (res.data.google_doc_url) {
        window.open(res.data.google_doc_url, '_blank');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Error generando documento";
      toast.error(errorMsg);
    }
  };

  const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: "bg-[#151515] text-slate-200",
      sent: "bg-blue-100 text-blue-700",
      accepted: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      expired: "bg-amber-100 text-amber-700"
    };
    const labels = {
      draft: "Borrador",
      sent: "Enviada",
      accepted: "Aceptada",
      rejected: "Rechazada",
      expired: "Expirada"
    };
    return <Badge className={styles[status]}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cotizador-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Cotizador</h1>
          <p className="text-slate-500 mt-1">Programa "Lo Hago Contigo" - Coaching Ejecutivo</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-sm">
            TC: 1 USD = {exchangeRate.toFixed(2)} MXN
          </Badge>
          <Button onClick={() => setShowNewQuote(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{quotes.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-300">{quotes.filter(q => q.status === 'draft').length}</p>
            <p className="text-xs text-slate-500">Borradores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{quotes.filter(q => q.status === 'sent').length}</p>
            <p className="text-xs text-slate-500">Enviadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{quotes.filter(q => q.status === 'accepted').length}</p>
            <p className="text-xs text-slate-500">Aceptadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{quotes.filter(q => q.status === 'rejected').length}</p>
            <p className="text-xs text-slate-500">Rechazadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Quotes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Cotizaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No hay cotizaciones</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowNewQuote(true)}>
                Crear primera cotización
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente / Empresa</TableHead>
                    <TableHead className="text-center">Participantes</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-mono font-medium">{quote.quote_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{quote.client_name}</p>
                          <p className="text-sm text-slate-500">{quote.company}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{quote.total_participants}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(quote.total, quote.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* Google Doc Link/Generate Button */}
                          {quote.google_doc_url ? (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(quote.google_doc_url, '_blank')}
                              className="text-blue-600"
                              title="Abrir documento en Google Docs"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => generateGoogleDoc(quote.id)}
                              className="text-green-600"
                              title="Generar documento en Google Docs"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => downloadPdf(quote.id, quote.quote_number)}
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {quote.status === 'draft' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => updateQuoteStatus(quote.id, 'sent')}
                              className="text-blue-600"
                              title="Marcar como enviada"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {quote.status === 'sent' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => updateQuoteStatus(quote.id, 'accepted')}
                                className="text-green-600"
                                title="Aceptada"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => updateQuoteStatus(quote.id, 'rejected')}
                                className="text-red-600"
                                title="Rechazada"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Quote Dialog */}
      <Dialog open={showNewQuote} onOpenChange={setShowNewQuote}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Cotización - Lo Hago Contigo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Contact Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Seleccionar Contacto (Cierre)</Label>
              <Select value={selectedContactId || "manual"} onValueChange={handleContactSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar contacto de Cierre..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">-- Ingreso manual --</SelectItem>
                  {cierreContacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.firstname} {contact.lastname} - {contact.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Manual entry or show selected */}
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="space-y-2">
                  <Label>Nombre del Contacto</Label>
                  <Input 
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    disabled={!!selectedContactId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Input 
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    disabled={!!selectedContactId}
                  />
                </div>
              </div>
            </div>

            {/* Group Composition */}
            <div className="space-y-4 p-4 bg-[#0f0f0f] rounded-lg">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                Composición del Grupo
              </Label>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Dirección</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setGroup({...group, direccion: Math.max(0, group.direccion - 1)})}
                    >-</Button>
                    <span className="w-12 text-center text-xl font-bold">{group.direccion}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setGroup({...group, direccion: group.direccion + 1})}
                    >+</Button>
                  </div>
                  <p className="text-xs text-slate-500">$3,500 USD c/u</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Management</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setGroup({...group, management: Math.max(0, group.management - 1)})}
                    >-</Button>
                    <span className="w-12 text-center text-xl font-bold">{group.management}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setGroup({...group, management: group.management + 1})}
                    >+</Button>
                  </div>
                  <p className="text-xs text-slate-500">$3,000 USD c/u</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Operación</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setGroup({...group, operacion: Math.max(0, group.operacion - 1)})}
                    >-</Button>
                    <span className="w-12 text-center text-xl font-bold">{group.operacion}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setGroup({...group, operacion: group.operacion + 1})}
                    >+</Button>
                  </div>
                  <p className="text-xs text-slate-500">$2,500 USD c/u</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-medium">Total participantes: {totalParticipants}</span>
                <div className="flex gap-2">
                  {includesMasterclass && (
                    <Badge className="bg-purple-100 text-purple-700">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Incluye Masterclass
                    </Badge>
                  )}
                  {includesCourse && (
                    <Badge className="bg-green-100 text-green-700">
                      <GraduationCap className="w-3 h-3 mr-1" />
                      Incluye Curso Titular
                    </Badge>
                  )}
                </div>
              </div>
              
              <p className="text-xs text-slate-500">
                * 1 persona: $3,000 USD | 4+ personas: incluye Masterclass | 8+ personas: incluye Curso Titular
              </p>
            </div>

            {/* Thematic Axis (if Masterclass or Course included) */}
            {(includesMasterclass || includesCourse) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Eje Temático para {includesCourse ? "Curso Titular" : "Masterclass"}
                </Label>
                <Select value={selectedAxisId} onValueChange={setSelectedAxisId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar eje temático..." />
                  </SelectTrigger>
                  <SelectContent>
                    {thematicAxes.map(axis => (
                      <SelectItem key={axis.id} value={axis.id}>
                        {axis.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Project Objectives */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Target className="w-5 h-5" />
                Objetivos del Proyecto
              </Label>
              
              <div className="grid gap-4">
                <div className="p-3 border rounded-lg space-y-2">
                  <Label className="text-sm font-medium text-blue-700">
                    Este programa tiene el objetivo de... (Resultados)
                  </Label>
                  <Input 
                    value={objectives.resultado_objetivo}
                    onChange={(e) => setObjectives({...objectives, resultado_objetivo: e.target.value})}
                    placeholder="Ej: incrementar las ventas del equipo comercial"
                  />
                  <Textarea 
                    value={objectives.resultado_descripcion}
                    onChange={(e) => setObjectives({...objectives, resultado_descripcion: e.target.value})}
                    placeholder="Describe el objetivo específico..."
                    rows={2}
                  />
                </div>
                
                <div className="p-3 border rounded-lg space-y-2">
                  <Label className="text-sm font-medium text-green-700">
                    Para acercarnos a este objetivo procuraremos... (Cambio de comportamiento)
                  </Label>
                  <Input 
                    value={objectives.comportamiento_objetivo}
                    onChange={(e) => setObjectives({...objectives, comportamiento_objetivo: e.target.value})}
                    placeholder="Ej: que los participantes realicen presentaciones más efectivas"
                  />
                  <Textarea 
                    value={objectives.comportamiento_descripcion}
                    onChange={(e) => setObjectives({...objectives, comportamiento_descripcion: e.target.value})}
                    placeholder="Describe el cambio de comportamiento esperado..."
                    rows={2}
                  />
                </div>
                
                <div className="p-3 border rounded-lg space-y-2">
                  <Label className="text-sm font-medium text-purple-700">
                    Lo haremos... (Aprendizaje)
                  </Label>
                  <Input 
                    value={objectives.aprendizaje_objetivo}
                    onChange={(e) => setObjectives({...objectives, aprendizaje_objetivo: e.target.value})}
                    placeholder="Ej: desarrollando habilidades de storytelling"
                  />
                  <Textarea 
                    value={objectives.aprendizaje_descripcion}
                    onChange={(e) => setObjectives({...objectives, aprendizaje_descripcion: e.target.value})}
                    placeholder="Describe qué aprenderán..."
                    rows={2}
                  />
                </div>
                
                <div className="p-3 border rounded-lg space-y-2">
                  <Label className="text-sm font-medium text-amber-700">
                    Para hacerlo... (Experiencia)
                  </Label>
                  <Input 
                    value={objectives.experiencia_objetivo}
                    onChange={(e) => setObjectives({...objectives, experiencia_objetivo: e.target.value})}
                    placeholder="Ej: mediante sesiones de coaching individual"
                  />
                  <Textarea 
                    value={objectives.experiencia_descripcion}
                    onChange={(e) => setObjectives({...objectives, experiencia_descripcion: e.target.value})}
                    placeholder="Describe la experiencia de aprendizaje..."
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Currency and Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select 
                  value={formData.currency} 
                  onValueChange={(v) => setFormData({...formData, currency: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD (Dólares)</SelectItem>
                    <SelectItem value="MXN">MXN (Pesos Mexicanos)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.currency === "MXN" && (
                  <p className="text-xs text-slate-500">TC: 1 USD = {exchangeRate.toFixed(2)} MXN</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Descuento: {formData.discount_percent}%</Label>
                <Slider
                  value={[formData.discount_percent]}
                  onValueChange={([v]) => setFormData({...formData, discount_percent: v})}
                  max={50}
                  step={5}
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            {/* Additional Benefits */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Beneficios Adicionales (Extras)</Label>
              <div className="grid grid-cols-2 gap-2">
                {benefits.map(benefit => (
                  <div 
                    key={benefit.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedBenefits.includes(benefit.id) 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:border-[#333333]'
                    }`}
                    onClick={() => toggleBenefit(benefit.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedBenefits.includes(benefit.id)} />
                      <span className="text-sm font-medium">{benefit.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-6">
                      +${benefit.price_usd} USD
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* PDF Blocks Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Secciones del PDF
              </Label>
              <p className="text-xs text-slate-500">Selecciona qué secciones incluir en el documento PDF</p>
              <div className="grid grid-cols-2 gap-2">
                {pdfBlocks.map(block => (
                  <div 
                    key={block.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPdfBlocks.includes(block.id) 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-[#222] hover:border-[#333]'
                    }`}
                    onClick={() => togglePdfBlock(block.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedPdfBlocks.includes(block.id)} />
                      <span className="text-sm font-medium">{block.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-6">
                      {block.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculate Button */}
            <div className="flex justify-center">
              <Button onClick={calculateQuote} disabled={calculating} size="lg">
                {calculating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                Calcular Cotización
              </Button>
            </div>

            {/* Totals Preview */}
            {calculatedTotals && (
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50 border-blue-200">
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold text-slate-200">Resumen de Inversión</h4>
                  
                  {calculatedTotals.coaching_breakdown?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.level} ({item.quantity})</span>
                      <span>{formatCurrency(item.total, formData.currency)}</span>
                    </div>
                  ))}
                  
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Subtotal Coaching:</span>
                    <span>{formatCurrency(calculatedTotals.coaching_subtotal, formData.currency)}</span>
                  </div>
                  
                  {calculatedTotals.benefits_total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Beneficios Adicionales:</span>
                      <span>{formatCurrency(calculatedTotals.benefits_total, formData.currency)}</span>
                    </div>
                  )}
                  
                  {calculatedTotals.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Descuento ({calculatedTotals.discount_percent}%):</span>
                      <span>-{formatCurrency(calculatedTotals.discount_amount, formData.currency)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span>IVA (16%):</span>
                    <span>{formatCurrency(calculatedTotals.iva, formData.currency)}</span>
                  </div>
                  
                  <div className="flex justify-between text-xl font-bold border-t pt-3">
                    <span>TOTAL:</span>
                    <span className="text-blue-600">{formatCurrency(calculatedTotals.total, formData.currency)}</span>
                  </div>
                  
                  {/* Included benefits */}
                  <div className="pt-3 border-t space-y-1">
                    <p className="text-sm font-medium text-slate-300">Incluye:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Coaching 1:1</Badge>
                      <Badge variant="outline">Autoevaluación 360°</Badge>
                      <Badge variant="outline">Certificado</Badge>
                      {calculatedTotals.includes_masterclass && (
                        <Badge className="bg-purple-100 text-purple-700">Masterclass</Badge>
                      )}
                      {calculatedTotals.includes_course && (
                        <Badge className="bg-green-100 text-green-700">Curso Titular</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewQuote(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={saveQuote} disabled={saving}>
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Guardar Cotización
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
