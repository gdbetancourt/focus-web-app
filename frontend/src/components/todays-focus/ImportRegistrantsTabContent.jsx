/**
 * Import Event Registrants Tab Content Component
 * Shows future events and allows importing registrants from CSV
 * Tracks weekly import status
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  RefreshCw,
  Check,
  Calendar,
  Upload,
  Linkedin,
  ExternalLink,
  Edit2,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import ImportWizard from "../../pages/foundations/ImportWizard";

export function ImportRegistrantsTabContent({ buyerPersonas = [], industries = [] }) {
  // Events state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState("");

  // Import wizard state
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importingEvent, setImportingEvent] = useState(null);

  // Edit event dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editLinkedInUrl, setEditLinkedInUrl] = useState("");
  const [editBuyerPersonas, setEditBuyerPersonas] = useState([]);
  const [editIndustries, setEditIndustries] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/todays-focus/events-pending-import");
      setEvents(res.data.events || []);
      setCurrentWeek(res.data.current_week || "");
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("Error al cargar eventos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Open import dialog
  const openImportDialog = (event) => {
    setImportingEvent(event);
    setImportWizardOpen(true);
  };

  // Handle import completion
  const handleImportComplete = async () => {
    if (importingEvent) {
      try {
        // Mark event as imported this week
        await api.patch(`/todays-focus/events/${importingEvent.id}/mark-imported`);
        toast.success(`Registrantes importados para ${importingEvent.name}`);
        loadEvents();
      } catch (error) {
        console.error("Error marking import:", error);
        toast.error("Error al marcar importación");
      }
    }
    setImportWizardOpen(false);
    setImportingEvent(null);
  };

  // Open edit dialog
  const openEditDialog = (event) => {
    setEditingEvent(event);
    setEditName(event.name || "");
    setEditDescription(event.description || "");
    setEditDate(event.webinar_date || "");
    setEditTime(event.webinar_time || "");
    setEditLinkedInUrl(event.linkedin_event_url || "");
    setEditBuyerPersonas(event.buyer_personas || []);
    setEditIndustries(event.industries || []);
    setEditDialogOpen(true);
  };

  // Save edit
  const saveEditEvent = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await api.put(`/events-v2/${editingEvent.id}`, {
        name: editName,
        description: editDescription,
        webinar_date: editDate,
        webinar_time: editTime,
        linkedin_event_url: editLinkedInUrl || null,
        buyer_personas: editBuyerPersonas,
        industries: editIndustries
      });
      toast.success("Evento actualizado");
      setEditDialogOpen(false);
      setEditingEvent(null);
      loadEvents();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Error al actualizar evento");
    } finally {
      setSaving(false);
    }
  };

  // Toggle buyer persona in edit
  const toggleEditBuyerPersona = (code) => {
    setEditBuyerPersonas(prev => 
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };

  // Toggle industry in edit
  const toggleEditIndustry = (id) => {
    setEditIndustries(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  };

  // Get days until event
  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const eventDate = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Count pending imports
  const pendingCount = events.filter(e => !e.imported_this_week).length;

  // Active industries for edit dialog
  const activeIndustries = industries.filter(i => i.status === "active");

  return (
    <>
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="border-b border-[#222]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Importar Registrantes de Eventos
              {pendingCount > 0 && (
                <Badge className="bg-purple-500/20 text-purple-400">{pendingCount} pendientes</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-slate-400 border-slate-600">
                Semana: {currentWeek}
              </Badge>
              <Button 
                onClick={loadEvents} 
                variant="outline" 
                size="sm"
                className="border-[#333]"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Cargando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No hay eventos futuros programados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const daysUntil = getDaysUntil(event.webinar_date);
                const isUrgent = daysUntil !== null && daysUntil <= 7;
                const hasLinkedIn = !!event.linkedin_event_url;
                
                return (
                  <div 
                    key={event.id} 
                    className={`p-4 rounded-lg border ${
                      event.imported_this_week 
                        ? 'bg-green-500/5 border-green-500/30' 
                        : isUrgent 
                          ? 'bg-orange-500/5 border-orange-500/30'
                          : 'bg-[#0a0a0a] border-[#222]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Event Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white truncate">{event.name}</h3>
                          {event.imported_this_week && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Importado
                            </Badge>
                          )}
                          {!event.imported_this_week && isUrgent && (
                            <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Urgente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(event.webinar_date)}
                            {event.webinar_time && ` · ${event.webinar_time}`}
                          </span>
                          {daysUntil !== null && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `${daysUntil} días`}
                            </span>
                          )}
                          {event.registrant_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {event.registrant_count} registrados
                            </span>
                          )}
                        </div>

                        {/* Buyer Personas badges */}
                        {event.buyer_personas?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {event.buyer_personas.slice(0, 3).map((bp, idx) => {
                              const persona = buyerPersonas.find(p => p.code === bp);
                              return (
                                <Badge 
                                  key={idx} 
                                  className="text-[10px]"
                                  style={{ 
                                    backgroundColor: `${persona?.color || '#666'}20`,
                                    color: persona?.color || '#888',
                                    borderColor: `${persona?.color || '#666'}50`
                                  }}
                                >
                                  {persona?.display_name || bp}
                                </Badge>
                              );
                            })}
                            {event.buyer_personas.length > 3 && (
                              <Badge className="text-[10px] bg-slate-700">
                                +{event.buyer_personas.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* LinkedIn Link */}
                        {hasLinkedIn ? (
                          <a
                            href={event.linkedin_event_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                            title="Ver en LinkedIn"
                          >
                            <Linkedin className="w-4 h-4" />
                          </a>
                        ) : (
                          <div 
                            className="p-2 rounded-lg bg-slate-700/50 text-slate-500 cursor-not-allowed"
                            title="Sin URL de LinkedIn - Edita el evento para agregar"
                          >
                            <Linkedin className="w-4 h-4" />
                          </div>
                        )}

                        {/* Edit Event */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(event)}
                          className="text-slate-400 hover:text-white"
                          title="Editar evento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        {/* Import Button */}
                        {event.imported_this_week ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                            onClick={() => openImportDialog(event)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Reimportar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => openImportDialog(event)}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            Importar CSV
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Wizard */}
      <ImportWizard
        open={importWizardOpen}
        onOpenChange={(open) => {
          setImportWizardOpen(open);
          if (!open) setImportingEvent(null);
        }}
        onImportComplete={handleImportComplete}
        eventId={importingEvent?.id}
        eventName={importingEvent?.name}
        eventDate={importingEvent?.webinar_date}
      />

      {/* Edit Event Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-purple-400" />
              Editar Evento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nombre del evento *</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Descripción</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Fecha *</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Hora</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                />
              </div>
            </div>
            
            {/* LinkedIn Event URL */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-blue-400" />
                URL del evento en LinkedIn
              </label>
              <Input
                value={editLinkedInUrl}
                onChange={(e) => setEditLinkedInUrl(e.target.value)}
                placeholder="https://www.linkedin.com/events/..."
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
              <p className="text-xs text-slate-500 mt-1">
                Requerido para identificar rápidamente el evento
              </p>
            </div>
            
            {/* Buyer Personas */}
            {buyerPersonas.length > 0 && (
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Buyer Personas</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                  {buyerPersonas.map(bp => (
                    <div
                      key={bp.code}
                      onClick={() => toggleEditBuyerPersona(bp.code)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                        editBuyerPersonas.includes(bp.code)
                          ? 'bg-purple-500/20 border border-purple-500/50'
                          : 'bg-[#111] border border-[#222] hover:border-[#333]'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: bp.color }}
                      />
                      <span className="text-xs text-slate-300">{bp.display_name || bp.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Industries */}
            {activeIndustries.length > 0 && (
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Industrias</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                  {activeIndustries.map(ind => (
                    <div
                      key={ind.id}
                      onClick={() => toggleEditIndustry(ind.id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                        editIndustries.includes(ind.id)
                          ? 'bg-blue-500/20 border border-blue-500/50'
                          : 'bg-[#111] border border-[#222] hover:border-[#333]'
                      }`}
                    >
                      <Building2 className="w-3 h-3 text-blue-400" />
                      <span className="text-xs text-slate-300">{ind.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setEditDialogOpen(false); setEditingEvent(null); }} 
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveEditEvent} 
              disabled={saving || !editName || !editDate}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ImportRegistrantsTabContent;
