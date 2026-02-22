import { useEffect, useState, useMemo } from "react";
import { 
  getCampaigns, 
  createCampaign, 
  deleteCampaign, 
  getTemplates,
  getUnifiedContacts
} from "../lib/api";
import api from "../lib/api";
import { createSafeHTML } from "../lib/sanitize";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { ScrollArea } from "../components/ui/scroll-area";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { 
  Send, 
  Plus, 
  Trash2,
  Users,
  Calendar,
  FileText,
  Sparkles,
  Eye,
  MousePointer,
  Mail,
  ArrowRightLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  CalendarDays,
  Info,
  Lock
} from "lucide-react";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventsChecklist, setEventsChecklist] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [personaMap, setPersonaMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [forceSendLoading, setForceSendLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [selectedPreviewContact, setSelectedPreviewContact] = useState("");
  const [buyerPersonasDB, setBuyerPersonasDB] = useState([]);
  
  const [formData, setFormData] = useState({
    name: "",
    template_id: "",
    event_ids: [],  // Will only have one event now
    contact_ids: [],
    use_ai_generation: true
  });

  // Selected event for filtering contacts
  const selectedEvent = useMemo(() => {
    if (formData.event_ids.length === 0) return null;
    return events.find(e => e.id === formData.event_ids[0]);
  }, [formData.event_ids, events]);

  // Filter contacts based on selected event's buyer personas
  const availableContacts = useMemo(() => {
    if (!selectedEvent || !selectedEvent.buyer_personas || selectedEvent.buyer_personas.length === 0) {
      return [];
    }
    // Filter contacts that match any of the event's buyer personas
    return contacts.filter(c => {
      // Check if contact's buyer_persona matches any of the event's buyer_personas
      if (c.buyer_persona && selectedEvent.buyer_personas.includes(c.buyer_persona)) {
        return true;
      }
      return false;
    });
  }, [selectedEvent, contacts]);

  // Get display name for buyer persona
  const getPersonaDisplayName = (code) => {
    const dbPersona = buyerPersonasDB.find(p => p.code === code);
    if (dbPersona) return dbPersona.display_name || dbPersona.name;
    return personaMap[code] || code;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [campaignsRes, templatesRes, eventsRes, checklistRes, contactsRes, personasRes, personasDBRes] = await Promise.all([
        getCampaigns(),
        getTemplates(),
        api.get("/events/"),
        api.get("/events/checklist"),
        getUnifiedContacts({ limit: 2000 }),
        api.get("/hubspot/buyer-personas"),
        api.get("/buyer-personas-db/")
      ]);
      setCampaigns(campaignsRes.data);
      setTemplates(templatesRes.data);
      setEvents(eventsRes.data);
      setEventsChecklist(checklistRes.data);
      setContacts(contactsRes.data.contacts || contactsRes.data || []);
      setBuyerPersonas(personasRes.data.buyer_personas || []);
      setPersonaMap(personasRes.data.persona_map || {});
      setBuyerPersonasDB(personasDBRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get completion percentage for an event
  const getEventCompletion = (eventId) => {
    const checkItem = eventsChecklist.find(c => c.id === eventId);
    return checkItem?.completion_percentage || 0;
  };

  // Check if event is complete (100%)
  const isEventComplete = (eventId) => {
    return getEventCompletion(eventId) === 100;
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    
    if (!formData.template_id) {
      toast.error("Selecciona una plantilla");
      return;
    }

    if (formData.event_ids.length === 0) {
      toast.error("Selecciona un evento");
      return;
    }
    
    if (formData.contact_ids.length === 0) {
      toast.error("Selecciona al menos un contacto");
      return;
    }
    
    try {
      await createCampaign(formData);
      toast.success("Campaña creada");
      setDialogOpen(false);
      setFormData({
        name: "",
        template_id: "",
        event_ids: [],
        contact_ids: [],
        use_ai_generation: true
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear campaña");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta campaña?")) return;
    
    try {
      await deleteCampaign(id);
      toast.success("Campaña eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar campaña");
    }
  };

  const handlePreview = async (campaign) => {
    setSelectedCampaign(campaign);
    setSelectedPreviewContact("");
    setPreviewData(null);
    setPreviewDialogOpen(true);
  };

  const handleConfirm = async (campaign) => {
    setSelectedCampaign(campaign);
    setConfirmData(null);
    setConfirmDialogOpen(true);
    setConfirmLoading(true);
    
    try {
      const response = await api.post("/campaigns/confirm", {
        campaign_id: campaign.id
      });
      setConfirmData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cargar confirmación");
      setConfirmDialogOpen(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedCampaign) return;
    
    setApproveLoading(true);
    try {
      const response = await api.post(`/campaigns/approve/${selectedCampaign.id}`);
      toast.success(response.data.message);
      setConfirmDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al aprobar campaña");
    } finally {
      setApproveLoading(false);
    }
  };

  const handleForceSend = async () => {
    if (!selectedCampaign) return;
    
    setForceSendLoading(true);
    try {
      const response = await api.post(`/campaigns/force-send/${selectedCampaign.id}`);
      if (response.data.success) {
        toast.success(`Enviados: ${response.data.sent} correos`);
        if (response.data.failed > 0) {
          toast.warning(`Fallidos: ${response.data.failed} correos`);
        }
      }
      setConfirmDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enviar campaña");
    } finally {
      setForceSendLoading(false);
    }
  };

  const generatePreview = async () => {
    if (!selectedPreviewContact) {
      toast.error("Selecciona un contacto para ver el preview");
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await api.post("/preview/", {
        template_id: selectedCampaign.template_id,
        contact_id: selectedPreviewContact,
        event_ids: selectedCampaign.event_ids
      });
      setPreviewData(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al generar preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleContact = (contactId) => {
    setFormData(prev => ({
      ...prev,
      contact_ids: prev.contact_ids.includes(contactId)
        ? prev.contact_ids.filter(id => id !== contactId)
        : [...prev.contact_ids, contactId]
    }));
  };

  // Single event selection (only one at a time)
  const selectEvent = (eventId) => {
    // Clear selected contacts when event changes
    setFormData(prev => ({
      ...prev,
      event_ids: [eventId],
      contact_ids: []  // Reset contacts when event changes
    }));
  };

  const selectAllAvailableContacts = () => {
    setFormData(prev => ({
      ...prev,
      contact_ids: availableContacts.map(c => c.id)
    }));
  };

  const getCampaignContacts = () => {
    if (!selectedCampaign) return [];
    return contacts.filter(c => selectedCampaign.contact_ids.includes(c.id));
  };

  const getPersonaName = (key) => {
    if (!key) return "Sin asignar";
    const persona = buyerPersonas.find(p => p.key === key);
    return persona?.name || personaMap[key] || key;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Aprobada</Badge>;
      case 'sent':
        return <Badge className="badge-success">Enviada</Badge>;
      case 'sending':
        return <Badge className="badge-warning">Enviando</Badge>;
      default:
        return <Badge className="badge-neutral">Borrador</Badge>;
    }
  };

  return (
    <div className="space-y-8" data-testid="campaigns-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Campañas</h1>
          <p className="text-slate-500 mt-1">Crea campañas y previsualiza emails personalizados con IA</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-accent" data-testid="create-campaign-btn">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Campaña
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Campaña</DialogTitle>
              <DialogDescription>
                Configura tu campaña. Los emails se enviarán de Lunes a Jueves, entre 8-11 AM y 4-6 PM.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCampaign} className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la campaña</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Invitación Webinar IA Médicos"
                  required
                  data-testid="campaign-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Plantilla de email</Label>
                <Select
                  value={formData.template_id}
                  onValueChange={(value) => setFormData({ ...formData, template_id: value })}
                >
                  <SelectTrigger data-testid="campaign-template-select">
                    <SelectValue placeholder="Selecciona una plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {template.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Generación con IA (Gemini)</p>
                    <p className="text-sm text-slate-500">Cada email será único y personalizado</p>
                  </div>
                </div>
                <Switch
                  checked={formData.use_ai_generation}
                  onCheckedChange={(checked) => setFormData({ ...formData, use_ai_generation: checked })}
                  data-testid="campaign-ai-toggle"
                />
              </div>

              {/* Event Selection - Single selection only */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Evento (selecciona uno)
                </Label>
                <Alert className="border-blue-200 bg-blue-50 mb-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 text-sm">
                    Solo los eventos con 100% de completitud están disponibles. 
                    Los contactos se filtrarán según el Buyer Persona del evento.
                  </AlertDescription>
                </Alert>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {events.length > 0 ? events.map((event) => {
                    const completion = getEventCompletion(event.id);
                    const isComplete = completion === 100;
                    const isSelected = formData.event_ids.includes(event.id);
                    
                    return (
                      <div 
                        key={event.id} 
                        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                          isComplete 
                            ? isSelected 
                              ? 'bg-orange-100 border border-orange-300' 
                              : 'hover:bg-[#0f0f0f] cursor-pointer' 
                            : 'opacity-50 bg-[#151515]'
                        }`}
                        onClick={() => isComplete && selectEvent(event.id)}
                      >
                        {isComplete ? (
                          <Checkbox
                            id={`event-${event.id}`}
                            checked={isSelected}
                            onCheckedChange={() => selectEvent(event.id)}
                          />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                        <label 
                          htmlFor={`event-${event.id}`} 
                          className={`text-sm flex-1 ${isComplete ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <span className={isComplete ? 'font-medium' : 'text-slate-500'}>
                            {event.name}
                          </span>
                          {event.date && <span className="text-slate-500 ml-2">({event.date})</span>}
                        </label>
                        <Badge 
                          variant={isComplete ? "default" : "secondary"}
                          className={isComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}
                        >
                          {completion}%
                        </Badge>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-slate-500 text-center py-2">No hay eventos. Crea uno primero.</p>
                  )}
                </div>
              </div>

              {/* Contacts - Filtered by event's buyer personas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Destinatarios ({formData.contact_ids.length})
                  </Label>
                  {availableContacts.length > 0 && (
                    <Button 
                      type="button" 
                      variant="link" 
                      size="sm" 
                      onClick={selectAllAvailableContacts} 
                      className="text-orange-600"
                    >
                      Seleccionar todos ({availableContacts.length})
                    </Button>
                  )}
                </div>
                
                {!selectedEvent ? (
                  <div className="border rounded-lg p-6 text-center bg-[#0f0f0f]">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">Selecciona un evento primero</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Los contactos se filtrarán según el Buyer Persona del evento
                    </p>
                  </div>
                ) : availableContacts.length === 0 ? (
                  <div className="border rounded-lg p-6 text-center bg-amber-50 border-amber-200">
                    <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                    <p className="text-sm text-amber-700">No hay contactos disponibles</p>
                    <p className="text-xs text-amber-600 mt-1">
                      El evento "{selectedEvent.name}" tiene Buyer Personas: {' '}
                      {selectedEvent.buyer_personas?.map(bp => getPersonaDisplayName(bp)).join(", ") || "ninguno asignado"}
                    </p>
                  </div>
                ) : (
                  <>
                    <Alert className="border-emerald-200 bg-emerald-50 mb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700 text-sm">
                        Mostrando {availableContacts.length} contactos del Buyer Persona: {' '}
                        <strong>{selectedEvent.buyer_personas?.map(bp => getPersonaDisplayName(bp)).join(", ")}</strong>
                      </AlertDescription>
                    </Alert>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-3 space-y-2">
                      {availableContacts.map((contact) => (
                        <div key={contact.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`contact-${contact.id}`}
                            checked={formData.contact_ids.includes(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                          <label htmlFor={`contact-${contact.id}`} className="text-sm cursor-pointer flex-1">
                            {contact.firstname || contact.email}
                            {contact.company && <span className="text-slate-500 ml-2">({contact.company})</span>}
                          </label>
                          <Badge variant="outline" className="text-xs">
                            {contact.buyer_persona_display_name || getPersonaDisplayName(contact.buyer_persona)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button 
                  type="submit" 
                  className="btn-accent" 
                  data-testid="save-campaign-btn"
                  disabled={!formData.template_id || formData.event_ids.length === 0 || formData.contact_ids.length === 0}
                >
                  Crear Campaña
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview de Email</DialogTitle>
            <DialogDescription>Selecciona un contacto para ver cómo lucirá su email personalizado.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>Selecciona un contacto</Label>
              <Select value={selectedPreviewContact} onValueChange={setSelectedPreviewContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un contacto" />
                </SelectTrigger>
                <SelectContent>
                  {getCampaignContacts().map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.firstname} {contact.lastname} - {contact.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={generatePreview} disabled={!selectedPreviewContact || previewLoading} className="btn-accent w-full">
                <Eye className="w-4 h-4 mr-2" />
                {previewLoading ? "Generando..." : "Generar Preview con IA"}
              </Button>
            </div>

            {previewData && (
              <div className="space-y-4">
                <div className="p-4 bg-[#0f0f0f] rounded-lg">
                  <p className="text-sm text-slate-500">Para:</p>
                  <p className="font-medium">{previewData.contact_name} &lt;{previewData.contact_email}&gt;</p>
                </div>
                <div className="p-4 bg-[#0f0f0f] rounded-lg">
                  <p className="text-sm text-slate-500">Asunto:</p>
                  <p className="font-medium">{previewData.subject}</p>
                </div>
                <div className="border rounded-lg p-6 bg-[#111111]">
                  <p className="text-sm text-slate-500 mb-4">Contenido:</p>
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={createSafeHTML(previewData.body_html)} />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirmar Envío de Campaña
            </DialogTitle>
            <DialogDescription>
              Revisa todos los detalles antes de aprobar el envío.
            </DialogDescription>
          </DialogHeader>
          
          {confirmLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#222222] border-t-orange-500 rounded-full mx-auto" />
              <p className="text-slate-500 mt-4">Calculando horarios de envío...</p>
            </div>
          ) : confirmData && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Campaign Summary */}
                <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
                  <CardContent className="p-6">
                    <h3 className="font-bold text-xl mb-4">{confirmData.campaign_name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-3xl font-bold">{confirmData.total_contacts}</p>
                        <p className="text-slate-400 text-sm">Contactos</p>
                      </div>
                      <div>
                        <p className="text-3xl font-bold">{confirmData.events.length}</p>
                        <p className="text-slate-400 text-sm">Eventos</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-400">{confirmData.first_send_date}</p>
                        <p className="text-slate-400 text-sm">Primer envío</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-400">{confirmData.last_send_date}</p>
                        <p className="text-slate-400 text-sm">Último envío</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Schedule Info */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900">Horarios de envío</p>
                        <p className="text-sm text-blue-700">
                          Lunes a Jueves • 8:00-11:00 AM y 4:00-6:00 PM • Cada contacto en horario diferente
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Accordion type="multiple" className="space-y-2">
                  {/* Events */}
                  <AccordionItem value="events" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-purple-600" />
                        <span>Eventos a promocionar ({confirmData.events.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {confirmData.events.map((event, i) => (
                          <div key={i} className="p-3 bg-purple-50 rounded-lg">
                            <p className="font-medium">{event.name}</p>
                            <p className="text-sm text-slate-500">Fecha: {event.date}</p>
                            {event.registration_link && (
                              <a href={event.registration_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                                Ver link de registro
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Email Previews */}
                  <AccordionItem value="previews" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-orange-600" />
                        <span>Ejemplos de emails generados ({confirmData.email_previews.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        {confirmData.email_previews.map((preview, i) => (
                          <Card key={i} className="bg-[#111111]">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium">{preview.contact_name}</span>
                                <span className="text-slate-500 text-sm">{preview.contact_email}</span>
                              </div>
                              <p className="text-sm font-medium text-orange-600 mb-2">Asunto: {preview.subject}</p>
                              <div className="text-sm text-slate-300 bg-[#0f0f0f] p-3 rounded" dangerouslySetInnerHTML={createSafeHTML(preview.body_preview)} />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Schedule Details */}
                  <AccordionItem value="schedule" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>Horarios programados ({confirmData.scheduled_emails.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {confirmData.scheduled_emails.slice(0, 20).map((email, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded text-sm">
                            <span className="font-medium truncate max-w-[200px]">{email.contact_name}</span>
                            <span className="text-slate-500">{email.time_slot}</span>
                          </div>
                        ))}
                        {confirmData.scheduled_emails.length > 20 && (
                          <p className="text-center text-slate-500 text-sm py-2">
                            ... y {confirmData.scheduled_emails.length - 20} más
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4 pt-4 border-t flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleForceSend} 
              disabled={forceSendLoading || confirmLoading}
              variant="destructive"
              data-testid="force-send-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              {forceSendLoading ? "Enviando..." : "Enviar Ahora (Prueba)"}
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={approveLoading || confirmLoading}
              className="btn-accent"
              data-testid="approve-campaign-btn"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {approveLoading ? "Aprobando..." : "Aprobar y Programar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-orange-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <ArrowRightLeft className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Automatización de Deals</h3>
              <p className="text-slate-300 mt-1 text-sm">
                Cuando un contacto hace clic en el link de registro, su Deal se moverá automáticamente 
                de <strong>"DM Identificado"</strong> a <strong>"Interés en Caso"</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : campaigns.length > 0 ? (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="stat-card" data-testid={`campaign-card-${campaign.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 rounded-xl">
                      <Send className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">{campaign.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {campaign.total_recipients} destinatarios
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {campaign.event_ids?.length || 0} evento(s)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Mail className="w-4 h-4" />
                          <span>{campaign.emails_sent}</span>
                        </div>
                        <p className="text-xs text-slate-400">Enviados</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-blue-600">
                          <Eye className="w-4 h-4" />
                          <span>{campaign.emails_opened}</span>
                        </div>
                        <p className="text-xs text-slate-400">Abiertos</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <MousePointer className="w-4 h-4" />
                          <span>{campaign.emails_clicked}</span>
                        </div>
                        <p className="text-xs text-slate-400">Clics</p>
                      </div>
                    </div>
                    
                    {getStatusBadge(campaign.status)}
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handlePreview(campaign)} data-testid={`preview-campaign-${campaign.id}`}>
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      {campaign.status === 'draft' && (
                        <Button size="sm" className="btn-accent" onClick={() => handleConfirm(campaign)} data-testid={`confirm-campaign-${campaign.id}`}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Confirmar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(campaign.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        data-testid={`delete-campaign-${campaign.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="stat-card">
          <CardContent className="p-12 text-center">
            <Send className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay campañas</h3>
            <p className="text-slate-500 mb-4">Crea tu primera campaña de email</p>
            <Button onClick={() => setDialogOpen(true)} className="btn-accent">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Campaña
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
