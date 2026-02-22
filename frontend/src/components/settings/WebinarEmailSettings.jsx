/**
 * WebinarEmailSettings - Configuration page for automatic webinar emails
 * 
 * Allows editing of 5 universal email templates:
 * - E06: Registration confirmation (immediate)
 * - E07: Webinar starting NOW
 * - E08: 1 hour before
 * - E09: 24 hours before
 * - E10: 7 days before
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
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
import api from "../../lib/api";
import {
  Mail,
  Clock,
  Edit,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";

// Merge fields available for templates
const MERGE_FIELDS = [
  { key: "{contact_name}", description: "Nombre del contacto" },
  { key: "{webinar_name}", description: "Título del webinar" },
  { key: "{webinar_date}", description: "Fecha del webinar" },
  { key: "{webinar_time}", description: "Hora del webinar" },
  { key: "{webinar_link}", description: "Link al watch room" },
];

export default function WebinarEmailSettings() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState(null);
  
  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEventId, setPreviewEventId] = useState(null);
  const [previewEmailId, setPreviewEmailId] = useState(null);
  
  // Events for preview selection
  const [events, setEvents] = useState([]);
  
  // Edit state
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editHoursBefore, setEditHoursBefore] = useState(null);
  const [editDaysBefore, setEditDaysBefore] = useState(null);

  useEffect(() => {
    loadSettings();
    loadEvents();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get("/webinar-emails/settings");
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Error cargando configuración");
    } finally {
      setLoading(false);
    }
  };
  
  const loadEvents = async () => {
    try {
      const response = await api.get("/events-v2/");
      // Get events with registrants for preview
      const eventsWithRegistrants = (response.data || []).filter(e => 
        (e.registrants && e.registrants.length > 0) || e.total_registrants > 0
      );
      setEvents(eventsWithRegistrants.slice(0, 10)); // Latest 10 events with registrants
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };
  
  const openPreview = async (emailId) => {
    if (!events.length) {
      toast.error("No hay eventos con registrados para previsualizar");
      return;
    }
    
    setPreviewEmailId(emailId);
    setPreviewEventId(events[0]?.id);
    setPreviewOpen(true);
    
    // Load preview with first event
    await loadPreview(emailId, events[0]?.id);
  };
  
  const loadPreview = async (emailId, eventId) => {
    if (!emailId || !eventId) return;
    
    setPreviewLoading(true);
    try {
      const response = await api.get(`/webinar-emails/event/${eventId}/preview/${emailId}`);
      setPreviewData(response.data);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Error cargando vista previa");
    } finally {
      setPreviewLoading(false);
    }
  };
  
  const handleEventChange = async (eventId) => {
    setPreviewEventId(eventId);
    if (previewEmailId) {
      await loadPreview(previewEmailId, eventId);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/webinar-emails/settings", { templates });
      toast.success("Configuración guardada");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Error guardando configuración");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("¿Restaurar todos los correos a sus valores por defecto?")) return;
    
    setLoading(true);
    try {
      const response = await api.get("/webinar-emails/settings/reset");
      setTemplates(response.data.templates || []);
      toast.success("Restaurado a valores por defecto");
    } catch (error) {
      console.error("Error resetting:", error);
      toast.error("Error al restaurar");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (template) => {
    setEditingTemplate(template);
    setEditSubject(template.subject || "");
    setEditBody(template.body || "");
    setEditHoursBefore(template.hours_before);
    setEditDaysBefore(template.days_before);
  };

  const saveTemplateEdit = () => {
    if (!editingTemplate) return;
    
    const updatedTemplates = templates.map(t => {
      if (t.email_id === editingTemplate.email_id) {
        return {
          ...t,
          subject: editSubject,
          body: editBody,
          hours_before: editHoursBefore,
          days_before: editDaysBefore,
        };
      }
      return t;
    });
    
    setTemplates(updatedTemplates);
    setEditingTemplate(null);
    toast.info("Cambios guardados localmente. Haz clic en 'Guardar Todo' para aplicar.");
  };

  const insertMergeField = (field) => {
    // Insert at cursor position in body textarea
    const textarea = document.getElementById("edit-body-textarea");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = editBody.substring(0, start) + field + editBody.substring(end);
      setEditBody(newBody);
    } else {
      setEditBody(editBody + field);
    }
  };

  const getTimingLabel = (template) => {
    if (template.email_id === "E06") {
      return "Inmediato al registrarse";
    }
    if (template.hours_before === 0) {
      return "A la hora exacta del webinar";
    }
    if (template.hours_before) {
      return `${template.hours_before} hora${template.hours_before > 1 ? 's' : ''} antes`;
    }
    if (template.days_before) {
      return `${template.days_before} día${template.days_before > 1 ? 's' : ''} antes`;
    }
    return "No configurado";
  };

  const getEmailColor = (emailId) => {
    const colors = {
      "E06": "bg-green-500/20 text-green-400 border-green-500/30",
      "E07": "bg-red-500/20 text-red-400 border-red-500/30",
      "E08": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "E09": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "E10": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return colors[emailId] || "bg-slate-500/20 text-slate-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ff3300]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="webinar-email-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#ff3300]" />
            Correos Automáticos de Webinars
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configura los 5 correos que se envían automáticamente para cada webinar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="border-[#333] text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-[#ff3300] hover:bg-[#ff3300]/90"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar Todo
          </Button>
        </div>
      </div>

      {/* Merge Fields Info */}
      <Card className="bg-blue-500/5 border-blue-500/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-blue-400 font-medium">Variables disponibles:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {MERGE_FIELDS.map((field) => (
                  <code key={field.key} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                    {field.key}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <div className="space-y-3">
        {templates.map((template) => (
          <Card 
            key={template.email_id} 
            className="bg-[#111] border-[#222] overflow-hidden"
          >
            <Collapsible
              open={expandedEmail === template.email_id}
              onOpenChange={(open) => setExpandedEmail(open ? template.email_id : null)}
            >
              <CollapsibleTrigger asChild>
                <div className="p-4 cursor-pointer hover:bg-[#151515] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getEmailColor(template.email_id)} border`}>
                        {template.email_id}
                      </Badge>
                      <div>
                        <h3 className="font-medium text-white">{template.name}</h3>
                        <p className="text-xs text-slate-500">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-[#222] text-slate-400 text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimingLabel(template)}
                      </Badge>
                      {expandedEmail === template.email_id ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-4 pb-4 border-t border-[#222] pt-4">
                  {/* Subject */}
                  <div className="mb-3">
                    <label className="text-xs text-slate-500 block mb-1">Asunto:</label>
                    <div className="bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm text-white">
                      {template.subject}
                    </div>
                  </div>
                  
                  {/* Body Preview */}
                  <div className="mb-3">
                    <label className="text-xs text-slate-500 block mb-1">Contenido:</label>
                    <div 
                      className="bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm text-slate-300 max-h-40 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: template.body }}
                    />
                  </div>
                  
                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(template.email_id)}
                      className="border-[#333] text-slate-300 hover:text-white"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Vista Previa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(template)}
                      className="border-[#333] text-slate-300 hover:text-white"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className={editingTemplate ? getEmailColor(editingTemplate.email_id) : ""}>
                {editingTemplate?.email_id}
              </Badge>
              Editar: {editingTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Timing Config (not for E06) */}
            {editingTemplate && editingTemplate.email_id !== "E06" && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <label className="text-sm text-slate-400 mb-2 block">Momento de envío:</label>
                
                {editingTemplate.email_id === "E07" ? (
                  <p className="text-sm text-slate-300">A la hora exacta del webinar (no modificable)</p>
                ) : (
                  <div className="flex items-center gap-4">
                    {editingTemplate.email_id === "E08" && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          value={editHoursBefore || ""}
                          onChange={(e) => setEditHoursBefore(parseInt(e.target.value) || null)}
                          className="w-20 bg-[#111] border-[#333] text-white"
                        />
                        <span className="text-slate-400 text-sm">horas antes</span>
                      </div>
                    )}
                    {(editingTemplate.email_id === "E09" || editingTemplate.email_id === "E10") && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          value={editDaysBefore || (editHoursBefore ? Math.floor(editHoursBefore / 24) : "")}
                          onChange={(e) => {
                            const days = parseInt(e.target.value) || null;
                            setEditDaysBefore(days);
                            setEditHoursBefore(days ? days * 24 : null);
                          }}
                          className="w-20 bg-[#111] border-[#333] text-white"
                        />
                        <span className="text-slate-400 text-sm">días antes</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Subject */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Asunto:</label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="Asunto del correo..."
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            
            {/* Merge Fields */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Insertar variable:</label>
              <div className="flex flex-wrap gap-1">
                {MERGE_FIELDS.map((field) => (
                  <Button
                    key={field.key}
                    variant="outline"
                    size="sm"
                    onClick={() => insertMergeField(field.key)}
                    className="h-6 text-xs border-[#333] text-slate-300 hover:text-white hover:bg-[#222]"
                  >
                    {field.key}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Body */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Contenido (HTML):</label>
              <Textarea
                id="edit-body-textarea"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder="<p>Contenido del correo...</p>"
                className="bg-[#0a0a0a] border-[#333] text-white font-mono text-sm min-h-[200px]"
              />
            </div>
            
            {/* Preview */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Vista previa:</label>
              <div 
                className="bg-white text-black p-4 rounded-lg text-sm max-h-48 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: editBody }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingTemplate(null)}
              className="border-[#333] text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveTemplateEdit}
              className="bg-[#ff3300] hover:bg-[#ff3300]/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aplicar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#ff3300]" />
              Vista Previa de Email
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Event Selector */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Seleccionar evento:</label>
              <Select value={previewEventId || ""} onValueChange={handleEventChange}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue placeholder="Seleccionar evento..." />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} ({event.webinar_date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ff3300]"></div>
              </div>
            ) : previewData ? (
              <>
                {/* Contact Info */}
                <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                  <p className="text-xs text-slate-500 mb-1">Enviando a:</p>
                  <p className="text-sm text-white">{previewData.contact?.name} &lt;{previewData.contact?.email}&gt;</p>
                </div>
                
                {/* Subject */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Asunto:</label>
                  <div className="bg-[#0a0a0a] border border-[#333] rounded px-3 py-2 text-sm text-white">
                    {previewData.subject}
                  </div>
                </div>
                
                {/* Body */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Contenido:</label>
                  <div 
                    className="bg-white text-black p-4 rounded-lg text-sm max-h-80 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: previewData.body }}
                  />
                </div>
                
                {/* Variables Used */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400 font-medium mb-2">Variables utilizadas:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(previewData.variables_used || {}).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <code className="text-blue-300">{`{${key}}`}</code>
                        <span className="text-slate-400">→</span>
                        <span className="text-slate-300 truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Selecciona un evento para ver la vista previa
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="border-[#333] text-slate-300"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
