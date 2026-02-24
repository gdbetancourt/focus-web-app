/**
 * InviteToEventsTabContent - Invite active companies to events weekly
 * Shows future events as cards and allows checking off which companies were invited
 * Invited companies go to the back of the queue next week (Monday)
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  RefreshCw,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Users,
  Save,
  Search,
  Send,
  CircleDot,
  Linkedin,
  ExternalLink,
} from "lucide-react";

export function InviteToEventsTabContent() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState("");
  
  // Selected event for invitation management
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingChanges, setPendingChanges] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/todays-focus/events-for-invitations");
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

  // Open dialog for a specific event
  const openInviteDialog = async (event) => {
    setSelectedEvent(event);
    setDialogOpen(true);
    setLoadingCompanies(true);
    setPendingChanges(new Set());
    setSearchTerm("");
    
    try {
      const res = await api.get(`/todays-focus/events/${event.id}/company-invitations`);
      setCompanies(res.data.companies || []);
    } catch (error) {
      console.error("Error loading companies:", error);
      toast.error("Error al cargar empresas");
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Toggle company invitation
  const toggleCompanyInvitation = (companyId) => {
    setPendingChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  // Save changes
  const handleSaveChanges = async () => {
    if (!selectedEvent || pendingChanges.size === 0) return;
    
    setSaving(true);
    try {
      // Get companies to mark as invited (toggle on)
      const toInvite = [];
      const toUninvite = [];
      
      for (const companyId of pendingChanges) {
        const company = companies.find(c => c.id === companyId);
        if (company) {
          if (company.invited_this_week) {
            // Was invited, now unmarking
            toUninvite.push({ id: company.id, name: company.name });
          } else {
            // Was not invited, now marking
            toInvite.push(company.id);
          }
        }
      }
      
      // Mark companies as invited
      if (toInvite.length > 0) {
        await api.post(`/todays-focus/events/${selectedEvent.id}/mark-companies-invited`, {
          company_ids: toInvite
        });
      }
      
      // Unmark companies
      for (const company of toUninvite) {
        await api.post(
          `/todays-focus/events/${selectedEvent.id}/unmark-company-invited?company_id=${encodeURIComponent(company.id)}&company_name=${encodeURIComponent(company.name)}`
        );
      }
      
      toast.success(`Guardado: ${toInvite.length} marcadas, ${toUninvite.length} desmarcadas`);
      
      // Refresh the list
      const res = await api.get(`/todays-focus/events/${selectedEvent.id}/company-invitations`);
      setCompanies(res.data.companies || []);
      setPendingChanges(new Set());
      
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  // Filter companies
  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate if company is checked (considering pending changes)
  const isCompanyChecked = (company) => {
    const hasChange = pendingChanges.has(company.id);
    if (hasChange) {
      return !company.invited_this_week; // Toggle the current state
    }
    return company.invited_this_week;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  };

  // Days until event
  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const eventDate = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = eventDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Count invited for an event (estimate from event data)
  const getEventInvitedCount = (event) => {
    return event.companies_invited_this_week || 0;
  };

  return (
    <>
      <Card className="bg-[#111] border-[#222]" data-testid="invite-to-events-tab">
        <CardHeader className="border-b border-[#222]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-cyan-400" />
              Invitar Empresas a Eventos
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
          <p className="text-sm text-slate-500 mt-2">
            Marca qué empresas activas fueron invitadas a cada evento esta semana.
            Las empresas invitadas irán al final de la lista la próxima semana (lunes).
          </p>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const daysUntil = getDaysUntil(event.webinar_date);
                const isUrgent = daysUntil !== null && daysUntil <= 7;
                
                return (
                  <Card 
                    key={event.id} 
                    className={`bg-[#0a0a0a] border-[#222] hover:border-cyan-500/30 transition-all cursor-pointer ${
                      isUrgent ? 'border-orange-500/30' : ''
                    }`}
                    onClick={() => openInviteDialog(event)}
                    data-testid={`event-card-${event.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-white text-sm leading-tight line-clamp-2">
                          {event.name}
                        </h3>
                        {isUrgent && (
                          <Badge className="bg-orange-500/20 text-orange-400 text-xs shrink-0 ml-2">
                            Urgente
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(event.webinar_date)}</span>
                          {event.webinar_time && (
                            <span className="text-slate-500">· {event.webinar_time}</span>
                          )}
                        </div>
                        
                        {daysUntil !== null && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `En ${daysUntil} días`}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-[#222] space-y-2">
                        {event.linkedin_event_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(event.linkedin_event_url, '_blank');
                            }}
                          >
                            <Linkedin className="w-4 h-4 mr-2" />
                            Abrir en LinkedIn
                            <ExternalLink className="w-3 h-3 ml-2" />
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          className="w-full bg-cyan-600 hover:bg-cyan-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInviteDialog(event);
                          }}
                        >
                          <Building2 className="w-4 h-4 mr-2" />
                          Gestionar Invitaciones
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Companies Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-cyan-400" />
              {selectedEvent?.name}
            </DialogTitle>
            <p className="text-sm text-slate-400">
              {formatDate(selectedEvent?.webinar_date)} · Semana {currentWeek}
            </p>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-[#0a0a0a] border-[#333]"
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">
                  {companies.filter(c => !c.invited_this_week).length} pendientes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-green-400">
                  {companies.filter(c => c.invited_this_week).length} invitadas
                </span>
              </div>
              {pendingChanges.size > 0 && (
                <Badge className="bg-cyan-500/20 text-cyan-400">
                  {pendingChanges.size} cambios sin guardar
                </Badge>
              )}
            </div>

            {/* Company List */}
            {loadingCompanies ? (
              <div className="p-8 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Cargando empresas...
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-1">
                  {filteredCompanies.map((company) => {
                    const isChecked = isCompanyChecked(company);
                    const hasChange = pendingChanges.has(company.id);
                    
                    return (
                      <div
                        key={company.id || company.name}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-green-500/10 border-green-500/30' 
                            : 'bg-[#0a0a0a] border-[#222] hover:border-[#333]'
                        } ${hasChange ? 'ring-2 ring-cyan-500/50' : ''}`}
                        onClick={() => toggleCompanyInvitation(company.id)}
                      >
                        <Checkbox
                          checked={isChecked}
                          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 pointer-events-none"
                        />
                        <Building2 className={`w-4 h-4 ${isChecked ? 'text-green-400' : 'text-slate-500'}`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${isChecked ? 'text-green-300' : company.invited_to_any_event ? 'text-slate-400' : 'text-white'}`}>
                            {company.name}
                          </span>
                          {company.case_count > 0 && (
                            <span className="ml-2 text-xs text-amber-400">
                              ({company.case_count} {company.case_count === 1 ? 'caso' : 'casos'})
                            </span>
                          )}
                          {company.invited_to_any_event && !isChecked && (
                            <span className="ml-2 text-xs text-slate-500">
                              (invitada a otro evento)
                            </span>
                          )}
                        </div>
                        {isChecked && !hasChange && (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        )}
                        {hasChange && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 text-xs shrink-0">
                            Modificado
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  {filteredCompanies.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No se encontraron empresas</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)} 
              className="border-[#333]"
            >
              Cerrar
            </Button>
            <Button 
              onClick={handleSaveChanges}
              disabled={saving || pendingChanges.size === 0}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar ({pendingChanges.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InviteToEventsTabContent;
