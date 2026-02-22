/**
 * WhatsApp Tab Content Component
 * Contains all WhatsApp messaging functionality
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { toast } from "sonner";
import api from "../../lib/api";
import { PaginationControls } from "./PaginationControls";
import { RULE_COLORS, WHATSAPP_TEMPLATE_MAP, RULES_LABELS } from "./constants";
import { copyToClipboard, groupContactsByRuleAndPersona } from "./utils";
import {
  MessageSquare,
  RefreshCw,
  Check,
  User,
  Edit,
  Sparkles,
  Search,
  X,
  Building,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
} from "lucide-react";

export function WhatsAppTabContent({
  embedded = false,
  onEditContact,
  onShowUrlsModal,
  onLoadStats,
}) {
  // Data state
  const [allContacts, setAllContacts] = useState([]);
  const [whatsappRuleGroups, setWhatsappRuleGroups] = useState({});
  const [rulesSummary, setRulesSummary] = useState({});
  const [trafficLight, setTrafficLight] = useState({ 
    status: "red", 
    all_done: false, 
    contacted_today: 0, 
    pending: 0 
  });
  const [loading, setLoading] = useState(false);
  
  // Pagination state
  const [groupPages, setGroupPages] = useState({});
  const [groupPageSizes, setGroupPageSizes] = useState({});
  const defaultPageSize = 10;
  
  // Accordion state
  const [expandedRule, setExpandedRule] = useState(null);
  const [expandedPersona, setExpandedPersona] = useState(null);
  
  // Generating state
  const [generatingGroup, setGeneratingGroup] = useState(null);
  
  // Diagnosis search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadAllContacts();
  }, []);

  const loadAllContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mensajes-hoy/whatsapp/all-contacts");
      const contacts = res.data.contacts || [];
      setAllContacts(contacts);
      setRulesSummary(res.data.rules_summary || {});
      setWhatsappRuleGroups(groupContactsByRuleAndPersona(contacts));
      if (res.data.traffic_light) {
        setTrafficLight(res.data.traffic_light);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Error loading contacts");
    } finally {
      setLoading(false);
    }
  };

  // Pagination helpers
  const getPageSize = (groupKey) => groupPageSizes[groupKey] || defaultPageSize;
  const setPageSize = (groupKey, size) => {
    setGroupPageSizes(prev => ({ ...prev, [groupKey]: size }));
    setGroupPages(prev => ({ ...prev, [groupKey]: 1 }));
  };
  const getCurrentPage = (groupKey) => groupPages[groupKey] || 1;
  const setCurrentPage = (groupKey, page) => {
    setGroupPages(prev => ({ ...prev, [groupKey]: page }));
  };
  const getPaginatedContacts = (groupKey, contacts) => {
    const currentPage = getCurrentPage(groupKey);
    const pageSize = getPageSize(groupKey);
    const startIndex = (currentPage - 1) * pageSize;
    return contacts.slice(startIndex, startIndex + pageSize);
  };
  const getTotalPages = (groupKey, contacts) => {
    const pageSize = getPageSize(groupKey);
    return Math.ceil(contacts.length / pageSize);
  };

  // Generate messages and copy WhatsApp URLs
  const handleGenerateAndCopy = async (groupKey, contacts) => {
    const paginatedContacts = getPaginatedContacts(groupKey, contacts);
    
    if (paginatedContacts.length === 0) {
      toast.error("No hay contactos en esta página");
      return;
    }
    
    setGeneratingGroup(groupKey);
    
    try {
      const contactIds = paginatedContacts
        .map(c => c.id || c.contact_id)
        .filter(id => id);
      
      if (contactIds.length === 0) {
        toast.error("No se encontraron IDs de contactos válidos");
        return;
      }
      
      const rule = groupKey.split(":")[0];
      const templateType = WHATSAPP_TEMPLATE_MAP[rule] || "alumni_checkin_whatsapp";
      
      const meetingDates = {};
      paginatedContacts.forEach(c => {
        const contactId = c.id || c.contact_id;
        if (contactId && c.meeting_date) {
          meetingDates[contactId] = c.meeting_date;
        }
      });
      
      const res = await api.post("/mensajes-hoy/regenerate-messages", {
        contact_ids: contactIds,
        template_type: templateType,
        meeting_dates: meetingDates
      });
      
      if (res.data.success) {
        const updatedMessages = res.data.messages;
        setAllContacts(prev => {
          const updated = prev.map(contact => {
            const contactId = contact.id || contact.contact_id;
            if (updatedMessages[contactId]) {
              return { ...contact, message: updatedMessages[contactId] };
            }
            return contact;
          });
          setWhatsappRuleGroups(groupContactsByRuleAndPersona(updated));
          return updated;
        });
        
        const urls = paginatedContacts.map(c => {
          const contactId = c.id || c.contact_id;
          const message = updatedMessages[contactId] || c.message || "";
          const phone = c.phone?.replace(/\D/g, "") || "";
          return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        }).filter(url => url.includes("wa.me/") && !url.includes("wa.me/?"));
        
        if (urls.length > 0) {
          onShowUrlsModal?.(urls);
          
          // Mark contacts as contacted
          const contactOnlyIds = paginatedContacts
            .filter(c => c.contact_type === "contact" || !c.contact_type)
            .map(c => c.id || c.contact_id);
          const businessOnlyIds = paginatedContacts
            .filter(c => c.contact_type === "business")
            .map(c => c.id || c.contact_id);
          
          if (contactOnlyIds.length > 0) {
            api.post("/mensajes-hoy/mark-contacted", {
              contact_ids: contactOnlyIds,
              message_type: "whatsapp"
            }).catch(console.error);
          }
          
          if (businessOnlyIds.length > 0) {
            api.post("/mensajes-hoy/whatsapp/mark-business-contacted", businessOnlyIds).catch(console.error);
          }
          
          loadAllContacts();
          onLoadStats?.();
        } else {
          toast.warning("Mensajes generados pero no hay teléfonos válidos");
        }
      }
    } catch (error) {
      console.error("Error generating messages:", error);
      const errorMsg = error.response?.data?.detail || error.message || "Error desconocido";
      toast.error(`Error al generar mensajes: ${errorMsg}`);
    } finally {
      setGeneratingGroup(null);
    }
  };

  // Search contacts
  const handleSearchContacts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await api.get(`/mensajes-hoy/whatsapp/search-contacts?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data.contacts || []);
      setShowSearchDropdown(true);
    } catch (error) {
      console.error("Error searching contacts:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearchContacts(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearchContacts]);

  // Diagnose contact
  const handleDiagnoseContact = async (contact) => {
    setShowSearchDropdown(false);
    setSearchQuery(contact.name);
    setDiagnosisLoading(true);
    
    try {
      const res = await api.get(`/mensajes-hoy/whatsapp/diagnose/${contact.id}?contact_type=${contact.type}`);
      setSelectedDiagnosis(res.data);
    } catch (error) {
      console.error("Error diagnosing contact:", error);
      toast.error("Error al diagnosticar contacto");
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const clearDiagnosis = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedDiagnosis(null);
    setShowSearchDropdown(false);
  };

  const visibleContacts = allContacts;

  if (loading && !allContacts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32" data-testid="whatsapp-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-green-500 mb-2" />
        <p className="text-slate-500 text-sm">Cargando contactos de WhatsApp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="whatsapp-tab-content">
      {/* Rules Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(rulesSummary).map(([rule, count]) => {
          return count > 0 ? (
            <Badge key={rule} variant="outline" className="text-sm">
              {RULES_LABELS[rule] || rule}: {count}
            </Badge>
          ) : null;
        })}
      </div>

      {/* Contact Search & Diagnosis */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Search className="w-4 h-4 text-blue-400" />
            Buscar contacto para diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white pr-10"
                  data-testid="whatsapp-diagnosis-search-input"
                />
                {searchLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                )}
                
                {/* Search Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleDiagnoseContact(contact)}
                        className="w-full px-3 py-2 text-left hover:bg-[#222] flex items-center gap-3 border-b border-[#222] last:border-0"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${contact.type === 'business' ? 'bg-teal-500/20' : 'bg-blue-500/20'}`}>
                          {contact.type === 'business' ? (
                            <Building className="w-4 h-4 text-teal-400" />
                          ) : (
                            <User className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {contact.email || contact.phone || (contact.type === 'business' ? contact.business_type : 'Sin contacto')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {contact.type === 'business' ? 'Negocio' : `Stage ${contact.stage || '?'}`}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {(searchQuery || selectedDiagnosis) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearDiagnosis}
                  className="border-[#333] shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Diagnosis Panel */}
            {diagnosisLoading && (
              <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg">
                <div className="flex items-center gap-2 text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analizando contacto...
                </div>
              </div>
            )}

            {selectedDiagnosis && !diagnosisLoading && (
              <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-4" data-testid="whatsapp-diagnosis-panel">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-medium">{selectedDiagnosis.contact.name}</h4>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                      {selectedDiagnosis.contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedDiagnosis.contact.email}
                        </span>
                      )}
                      {selectedDiagnosis.contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedDiagnosis.contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedDiagnosis.diagnosis.should_receive_message ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Debe recibir mensaje
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <XCircle className="w-3 h-3 mr-1" />
                        No cumple reglas
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!selectedDiagnosis.has_phone && (
                    <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                      Sin teléfono
                    </Badge>
                  )}
                  {selectedDiagnosis.contact.type === 'contact' && (
                    <Badge variant="outline" className="text-xs">
                      Stage {selectedDiagnosis.contact.stage || '?'}
                    </Badge>
                  )}
                  {selectedDiagnosis.contact.roles?.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {selectedDiagnosis.contact.roles.join(', ')}
                    </Badge>
                  )}
                </div>

                {/* Rules Checklist */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Reglas evaluadas:</p>
                  {selectedDiagnosis.diagnosis.rules_checked?.map((rule, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 p-2 rounded-lg ${
                        rule.passed 
                          ? 'bg-green-500/10 border border-green-500/20' 
                          : 'bg-[#111] border border-[#222]'
                      }`}
                    >
                      {rule.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${rule.passed ? 'text-green-400' : 'text-slate-400'}`}>
                          {rule.rule_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{rule.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contacts by Rule */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="w-5 h-5 text-green-400" />
              Contactos de WhatsApp
              <Badge className={trafficLight.status === 'green' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                {trafficLight.status === 'green' ? '✓ Completo' : `${visibleContacts.length} pendientes`}
              </Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllContacts}
              disabled={loading}
              className="border-[#333]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(whatsappRuleGroups).length === 0 ? (
            <div className="text-center py-8">
              {trafficLight.status === 'green' ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-green-400 font-semibold text-lg">All Done!</p>
                  <p className="text-slate-500 mt-2">
                    {trafficLight.contacted_today > 0 
                      ? `${trafficLight.contacted_today} contacts messaged today`
                      : "No contacts needed messaging today"}
                  </p>
                </>
              ) : (
                <>
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-500" />
                  <p className="text-slate-500">No pending contacts for today</p>
                </>
              )}
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3" value={expandedRule} onValueChange={setExpandedRule}>
              {Object.entries(whatsappRuleGroups).map(([rule, personaGroups]) => {
                const totalInRule = Object.values(personaGroups).flat().length;
                const ruleColor = RULE_COLORS[rule] || "border-slate-500/30 text-slate-400 bg-slate-500/10";
                
                return (
                  <AccordionItem 
                    key={rule} 
                    value={rule}
                    className="border border-[#333] rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="hover:no-underline px-4 py-3 bg-[#0a0a0a]">
                      <div className="flex items-center gap-3 flex-1">
                        <Badge variant="outline" className={`${ruleColor}`}>
                          {rule}
                        </Badge>
                        <span className="text-slate-400 text-sm">
                          {totalInRule} contactos
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Accordion type="single" collapsible className="space-y-2 mt-2" value={expandedPersona} onValueChange={setExpandedPersona}>
                        {Object.entries(personaGroups).map(([persona, contacts]) => {
                          const groupKey = `${rule}:${persona}`;
                          const paginatedContacts = getPaginatedContacts(groupKey, contacts);
                          const totalPages = getTotalPages(groupKey, contacts);
                          const currentPage = getCurrentPage(groupKey);
                          const pageSize = getPageSize(groupKey);
                          
                          return (
                            <AccordionItem 
                              key={groupKey} 
                              value={groupKey}
                              className="border border-[#222] rounded-lg overflow-hidden"
                            >
                              <AccordionTrigger className="hover:no-underline px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-slate-500" />
                                  <span className="text-white font-medium">{persona}</span>
                                  <span className="text-slate-500 text-sm">({contacts.length})</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3">
                                <PaginationControls
                                  currentPage={currentPage}
                                  totalPages={totalPages}
                                  totalItems={contacts.length}
                                  pageSize={pageSize}
                                  onPageChange={(page) => setCurrentPage(groupKey, page)}
                                  onPageSizeChange={(size) => setPageSize(groupKey, size)}
                                />
                                
                                {/* Contacts Table */}
                                <div className="border rounded-lg border-[#222] overflow-hidden mb-3">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-[#222] hover:bg-transparent">
                                        <TableHead className="text-slate-400 w-[200px]">Contacto</TableHead>
                                        <TableHead className="text-slate-400 w-[120px]">Teléfono</TableHead>
                                        <TableHead className="text-slate-400">Mensaje</TableHead>
                                        <TableHead className="text-slate-400 w-[80px]">Acciones</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {paginatedContacts.map((contact) => (
                                        <TableRow key={contact.id || contact.contact_id} className="border-[#222] hover:bg-[#0a0a0a]">
                                          <TableCell>
                                            <div>
                                              <p className="font-medium text-white text-sm">{contact.name || contact.first_name}</p>
                                              <p className="text-xs text-slate-500">{contact.company || '-'}</p>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {contact.phone ? (
                                              <span className="text-slate-300 text-sm">{contact.phone}</span>
                                            ) : (
                                              <span className="text-red-400 text-xs">Sin teléfono</span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {contact.message ? (
                                              <p className="text-sm text-slate-300 line-clamp-2">{contact.message}</p>
                                            ) : (
                                              <p className="text-sm text-slate-500 italic">Click &quot;Generar y Copiar&quot;</p>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => onEditContact?.(contact)}
                                              className="h-7 w-7 p-0 hover:bg-blue-500/20"
                                              title="Editar contacto"
                                            >
                                              <Edit className="w-3.5 h-3.5 text-blue-400" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                
                                {/* Generate and Copy Button */}
                                <Button
                                  onClick={() => handleGenerateAndCopy(groupKey, contacts)}
                                  disabled={generatingGroup === groupKey}
                                  className="w-full bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-700 hover:to-green-700"
                                >
                                  {generatingGroup === groupKey ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      Generando {paginatedContacts.length} mensajes...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4 mr-2" />
                                      Generar y Copiar ({paginatedContacts.length} de página actual)
                                    </>
                                  )}
                                </Button>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WhatsAppTabContent;
