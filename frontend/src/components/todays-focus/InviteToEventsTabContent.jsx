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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../ui/alert-dialog";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import {
  RefreshCw,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Save,
  Search,
  Send,
  CircleDot,
  Linkedin,
  ExternalLink,
  Power,
  Users,
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
  const [togglingCompany, setTogglingCompany] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [togglingIndustry, setTogglingIndustry] = useState(null);
  const [confirmDeactivateIndustry, setConfirmDeactivateIndustry] = useState(null);
  const [showOnlyInvited, setShowOnlyInvited] = useState(false);

  // Ask for confirmation before deactivating
  const askDeactivate = (e, company) => {
    e.stopPropagation();
    setConfirmDeactivate(company);
  };

  // Actually deactivate after confirmation
  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivate) return;
    const company = confirmDeactivate;
    setConfirmDeactivate(null);
    setTogglingCompany(company.id);
    try {
      await api.patch(`/prospection/companies/${company.id}/toggle-active`);
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      toast.success(`${company.name} desactivada de outbound`);
    } catch (error) {
      console.error("Error toggling company:", error);
      toast.error("Error al cambiar estado de empresa");
    } finally {
      setTogglingCompany(null);
    }
  };

  // Ask for confirmation before deactivating an industry
  const askDeactivateIndustry = (e, industry) => {
    e.stopPropagation();
    setConfirmDeactivateIndustry(industry);
  };

  // Actually deactivate industry after confirmation
  const handleConfirmDeactivateIndustry = async () => {
    if (!confirmDeactivateIndustry) return;
    const industry = confirmDeactivateIndustry;
    setConfirmDeactivateIndustry(null);
    setTogglingIndustry(industry.code);
    try {
      const res = await api.patch(`/todays-focus/industries/${industry.code}/toggle-outbound`);
      const { companies_updated, new_classification } = res.data;
      if (new_classification === "inbound") {
        // Remove all companies that belong to this industry
        setCompanies(prev => prev.filter(c => !(c.industries || []).includes(industry.code)));
        // Update industry in local state
        setIndustries(prev => prev.map(ind =>
          ind.code === industry.code ? { ...ind, classification: "inbound" } : ind
        ));
        toast.success(`${industry.name} desactivada (${companies_updated} empresas afectadas)`);
      }
    } catch (error) {
      console.error("Error toggling industry:", error);
      toast.error("Error al cambiar estado de industria");
    } finally {
      setTogglingIndustry(null);
    }
  };

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
      const [companiesRes, industriesRes] = await Promise.allSettled([
        api.get(`/todays-focus/events/${event.id}/company-invitations`),
        api.get("/todays-focus/industries-for-invitations"),
      ]);
      if (companiesRes.status === "fulfilled") {
        setCompanies(companiesRes.value.data.companies || []);
      } else {
        console.error("Error loading companies:", companiesRes.reason);
        toast.error("Error al cargar empresas");
      }
      if (industriesRes.status === "fulfilled") {
        setIndustries(industriesRes.value.data.industries || []);
      } else {
        console.error("Error loading industries:", industriesRes.reason);
      }
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
  const filteredCompanies = companies.filter(c => {
    if (!c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (showOnlyInvited && !c.invited_this_week) return false;
    return true;
  });

  // Group companies by industry for accordion view
  // Build groups dynamically from company data, enrich with industry metadata
  const groupedByIndustry = (() => {
    // Lookup map: industry code → metadata from industries collection
    const industryMeta = {};
    for (const ind of industries) {
      industryMeta[ind.code] = ind;
    }

    // Build groups from actual company industries
    const groupMap = {};
    for (const company of filteredCompanies) {
      const ci = company.industries || [];
      if (ci.length === 0) {
        // No industry → "Sin industria"
        if (!groupMap["_sin_industria"]) {
          groupMap["_sin_industria"] = {
            code: "_sin_industria",
            name: "Sin industria",
            color: "#64748b",
            classification: "outbound",
            companies: [],
          };
        }
        groupMap["_sin_industria"].companies.push(company);
      } else {
        for (const code of ci) {
          if (!groupMap[code]) {
            const meta = industryMeta[code] || {};
            groupMap[code] = {
              code,
              name: meta.name || code.replace(/_/g, " "),
              color: meta.color || "#6366f1",
              classification: meta.classification || "outbound",
              companies: [],
            };
          }
          groupMap[code].companies.push(company);
        }
      }
    }

    // Sort companies within each group by contacts_count desc
    const groups = Object.values(groupMap);
    for (const g of groups) {
      g.companies.sort((a, b) => (b.contacts_count || 0) - (a.contacts_count || 0));
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  })();

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

  // Weeks until event (including incomplete weeks)
  const getWeeksUntil = (dateStr) => {
    if (!dateStr) return null;
    const days = getDaysUntil(dateStr);
    if (days === null || days <= 0) return 0;
    return Math.ceil(days / 7);
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
                const weeksUntil = getWeeksUntil(event.webinar_date);
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

                        {weeksUntil !== null && weeksUntil > 0 && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {weeksUntil === 1 ? "1 semana" : `${weeksUntil} semanas`}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-slate-400">
                          <Users className="w-3.5 h-3.5" />
                          <span className={event.registrants_count > 0 ? "text-cyan-400" : ""}>
                            {event.registrants_count || 0} registrados
                          </span>
                        </div>
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
              <button
                onClick={() => setShowOnlyInvited(prev => !prev)}
                className={`flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors ${
                  showOnlyInvited
                    ? "bg-green-500/20 ring-1 ring-green-500/40"
                    : "hover:bg-[#1a1a1a]"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-green-400">
                  {companies.filter(c => c.invited_this_week).length} invitadas
                </span>
              </button>
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
                {groupedByIndustry.length > 0 ? (
                  <Accordion type="multiple" defaultValue={groupedByIndustry.map(g => g.code)} className="space-y-1">
                    {groupedByIndustry.map((group) => (
                      <AccordionItem key={group.code} value={group.code} className="border-[#222] border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-[#1a1a1a]">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className="text-sm font-medium text-white truncate">
                              {group.name}
                            </span>
                            <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs shrink-0">
                              {group.companies.length}
                            </Badge>
                            {group.code !== "_sin_industria" && (
                              <button
                                title="Desactivar industria de outbound"
                                className="p-1 rounded text-green-500 hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0 ml-auto mr-2"
                                onClick={(e) => askDeactivateIndustry(e, group)}
                                disabled={togglingIndustry === group.code}
                              >
                                {togglingIndustry === group.code ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-1 pb-1">
                          <div className="space-y-1">
                            {group.companies.map((company) => {
                              const isChecked = isCompanyChecked(company);
                              const hasChange = pendingChanges.has(company.id);

                              return (
                                <div
                                  key={`${group.code}-${company.id}`}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                                    isChecked
                                      ? "bg-green-500/10 border-green-500/30"
                                      : "bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#333]"
                                  } ${hasChange ? "ring-2 ring-cyan-500/50" : ""}`}
                                  onClick={() => toggleCompanyInvitation(company.id)}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 pointer-events-none"
                                  />
                                  <Building2 className={`w-3.5 h-3.5 ${isChecked ? "text-green-400" : "text-slate-500"}`} />
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm ${isChecked ? "text-green-300" : company.invited_to_any_event ? "text-slate-400" : "text-white"}`}>
                                      {company.name}
                                    </span>
                                    {company.active_cases_count > 0 && (
                                      <span className="ml-2 text-xs text-amber-400">
                                        ({company.active_cases_count} {company.active_cases_count === 1 ? "caso" : "casos"})
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
                                  <span className={`flex items-center gap-1 text-xs shrink-0 ${
                                    (company.contacts_count || 0) > 0 ? "text-cyan-400" : "text-slate-600"
                                  }`} title="Contactos asociados">
                                    <Users className="w-3 h-3" />
                                    {company.contacts_count || 0}
                                  </span>
                                  <button
                                    title="Desactivar de outbound"
                                    className="p-1 rounded text-green-500 hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0"
                                    onClick={(e) => askDeactivate(e, company)}
                                    disabled={togglingCompany === company.id}
                                  >
                                    {togglingCompany === company.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Power className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : filteredCompanies.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No se encontraron empresas</p>
                  </div>
                ) : null}
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

      {/* Confirm Company Deactivation Dialog */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent className="bg-[#111] border-[#222] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar empresa de outbound</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              ¿Estás seguro de que quieres desactivar <span className="text-white font-medium">{confirmDeactivate?.name}</span> de outbound?
              La empresa dejará de aparecer en esta lista y en otras secciones de prospección.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#333] text-white hover:bg-[#222]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivate}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Industry Deactivation Dialog */}
      <AlertDialog open={!!confirmDeactivateIndustry} onOpenChange={(open) => !open && setConfirmDeactivateIndustry(null)}>
        <AlertDialogContent className="bg-[#111] border-[#222] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar industria de outbound</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              ¿Estás seguro de que quieres desactivar la industria <span className="text-white font-medium">{confirmDeactivateIndustry?.name}</span> de outbound?
              Todas las empresas dentro de esta industria ({confirmDeactivateIndustry?.companies?.length || 0}) serán desactivadas de outbound.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#333] text-white hover:bg-[#222]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivateIndustry}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Desactivar industria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default InviteToEventsTabContent;
