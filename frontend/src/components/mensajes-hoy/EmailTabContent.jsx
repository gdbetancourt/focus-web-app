/**
 * Email Tab Content Component
 * Contains all Email contact management functionality
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
import { EMAIL_RULE_COLORS, EMAIL_RULE_NAMES } from "./constants";
import { copyToClipboard, groupContactsByRuleAndPersona } from "./utils";
import {
  Mail,
  RefreshCw,
  User,
  Copy,
  Search,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";

export function EmailTabContent({
  embedded = false,
  onGenerateEmail,
  onLoadStats,
}) {
  // Data state
  const [contacts, setContacts] = useState([]);
  const [ruleGroups, setRuleGroups] = useState({});
  const [summary, setSummary] = useState({});
  const [stats, setStats] = useState(null);
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
    loadEmailContacts();
  }, []);

  const loadEmailContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/email-individual/contacts");
      const contactList = res.data.contacts || [];
      setContacts(contactList);
      setSummary(res.data.summary || {});
      setRuleGroups(groupContactsByRuleAndPersona(contactList));
      
      // Also load stats
      const statsRes = await api.get("/email-individual/stats");
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error loading email contacts:", error);
      toast.error("Error loading email contacts");
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
  const getPaginatedContacts = (groupKey, contactList) => {
    const currentPage = getCurrentPage(groupKey);
    const pageSize = getPageSize(groupKey);
    const startIndex = (currentPage - 1) * pageSize;
    return contactList.slice(startIndex, startIndex + pageSize);
  };
  const getTotalPages = (groupKey, contactList) => {
    const pageSize = getPageSize(groupKey);
    return Math.ceil(contactList.length / pageSize);
  };

  // Copy emails
  const handleCopyEmails = async (groupKey, contactList) => {
    const paginatedContacts = getPaginatedContacts(groupKey, contactList);
    
    if (paginatedContacts.length === 0) {
      toast.error("No hay contactos en esta página");
      return;
    }
    
    setGeneratingGroup(groupKey);
    
    try {
      const emails = paginatedContacts
        .filter(c => c.email)
        .map(c => c.email);
      
      if (emails.length > 0) {
        const copied = await copyToClipboard(emails.join("\n"));
        if (copied) {
          toast.success(`${emails.length} emails copiados`);
        } else {
          toast.error("No se pudo copiar al portapapeles");
        }
      } else {
        toast.warning("No hay emails válidos para copiar");
      }
    } catch (error) {
      console.error("Error copying emails:", error);
      toast.error("Error al copiar emails");
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
      const contactList = (res.data.contacts || []).filter(c => c.type === 'contact');
      setSearchResults(contactList);
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

  const handleDiagnoseContact = async (contact) => {
    setShowSearchDropdown(false);
    setSearchQuery(contact.name);
    setDiagnosisLoading(true);
    
    try {
      const res = await api.get(`/mensajes-hoy/email/diagnose/${contact.id}`);
      setSelectedDiagnosis(res.data);
    } catch (error) {
      console.error("Error diagnosing contact for Email:", error);
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

  if (loading && contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32" data-testid="email-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mb-2" />
        <p className="text-slate-500 text-sm">Cargando contactos de Email...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-tab-content">
      {/* Email Contact Search & Diagnosis */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Search className="w-4 h-4 text-purple-400" />
            Buscar contacto para diagnóstico Email (E1-E4)
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
                  data-testid="email-diagnosis-search-input"
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
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {contact.email || 'Sin email'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          Stage {contact.stage || '?'}
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
              <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-4" data-testid="email-diagnosis-panel">
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
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedDiagnosis.diagnosis.should_receive_message ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Cumple regla {selectedDiagnosis.diagnosis.matched_rule}
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
                  {!selectedDiagnosis.has_email && (
                    <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                      Sin email
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    Stage {selectedDiagnosis.contact.stage || '?'}
                  </Badge>
                  {selectedDiagnosis.contact.buyer_persona && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedDiagnosis.contact.buyer_persona}
                    </Badge>
                  )}
                  {selectedDiagnosis.contact.roles?.length > 0 && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedDiagnosis.contact.roles.join(", ")}
                    </Badge>
                  )}
                </div>

                {/* Rules Checklist */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Reglas E1-E4 evaluadas:</p>
                  {selectedDiagnosis.diagnosis.rules_checked?.map((rule, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded border ${rule.passed ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'}`}
                    >
                      <div className="flex items-center gap-2">
                        {rule.passed ? (
                          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${rule.passed ? 'text-green-400' : 'text-slate-400'}`}>
                          {rule.rule_name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-6">{rule.reason}</p>
                    </div>
                  ))}
                </div>

                {/* Email History */}
                {selectedDiagnosis.diagnosis.email_history && (
                  <div className="p-2 bg-slate-800/30 rounded border border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Historial de emails:</p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {["E1", "E2", "E3", "E4"].map(type => (
                        <div key={type} className="text-center">
                          <span className="text-slate-500">{type}:</span>
                          <span className="text-slate-300 ml-1">
                            {selectedDiagnosis.diagnosis.email_history[type] 
                              ? new Date(selectedDiagnosis.diagnosis.email_history[type]).toLocaleDateString()
                              : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conclusion */}
                <div className={`p-3 rounded-lg ${selectedDiagnosis.diagnosis.should_receive_message ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800/50 border border-slate-700'}`}>
                  <p className={`text-sm font-medium ${selectedDiagnosis.diagnosis.should_receive_message ? 'text-green-400' : 'text-slate-400'}`}>
                    {selectedDiagnosis.diagnosis.should_receive_message
                      ? `✅ Este contacto CUMPLE la regla ${selectedDiagnosis.diagnosis.matched_rule}`
                      : `❌ Este contacto NO cumple ninguna regla E1-E4 hoy`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Stats */}
      {stats && (
        <div className="flex flex-wrap gap-3 mb-4">
          <Badge variant="outline" className="border-purple-500/30 text-purple-400">
            Sent today: {stats.today?.total || 0}
          </Badge>
          {stats.today?.E1 > 0 && (
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              E1: {stats.today.E1}
            </Badge>
          )}
          {stats.today?.E2 > 0 && (
            <Badge variant="outline" className="border-orange-500/30 text-orange-400">
              E2: {stats.today.E2}
            </Badge>
          )}
          {stats.today?.E3 > 0 && (
            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
              E3: {stats.today.E3}
            </Badge>
          )}
          {stats.today?.E4 > 0 && (
            <Badge variant="outline" className="border-green-500/30 text-green-400">
              E4: {stats.today.E4}
            </Badge>
          )}
        </div>
      )}

      {/* Rules Summary */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(summary).map(([rule, count]) => {
          const labels = {
            E1: "E1 - Webinar Invitation",
            E2: "E2 - Quote Follow-up",
            E3: "E3 - Coaching Reminder",
            E4: "E4 - Repurchase (3mo)",
          };
          return count > 0 ? (
            <Badge key={rule} variant="outline" className={EMAIL_RULE_COLORS[rule] || ""}>
              {labels[rule] || rule}: {count}
            </Badge>
          ) : null;
        })}
      </div>

      {/* Main Email Card */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" />
              Email Contacts ({contacts.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={loadEmailContacts}
              className="border-[#333]"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading contacts...
            </div>
          ) : Object.keys(ruleGroups).length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No contacts need email today</p>
              <p className="text-xs mt-1 text-slate-500">
                Contacts appear based on E1-E5 rules and cadence
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3" value={expandedRule} onValueChange={setExpandedRule}>
              {Object.entries(ruleGroups).map(([rule, personaGroups]) => {
                const totalInRule = Object.values(personaGroups).flat().length;
                const ruleColor = EMAIL_RULE_COLORS[rule] || "border-slate-500/30 text-slate-400 bg-slate-500/10";
                const ruleName = EMAIL_RULE_NAMES[rule] || rule;
                
                return (
                  <AccordionItem 
                    key={rule} 
                    value={rule}
                    className="border border-[#333] rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="hover:no-underline px-4 py-3 bg-[#0a0a0a]">
                      <div className="flex items-center gap-3 flex-1">
                        <Badge variant="outline" className={`${ruleColor}`}>
                          {ruleName}
                        </Badge>
                        <span className="text-slate-400 text-sm">
                          {totalInRule} contactos
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <Accordion type="single" collapsible className="space-y-2 mt-2" value={expandedPersona} onValueChange={setExpandedPersona}>
                        {Object.entries(personaGroups).map(([persona, contactList]) => {
                          const groupKey = `${rule}:${persona}`;
                          const paginatedContacts = getPaginatedContacts(groupKey, contactList);
                          const totalPages = getTotalPages(groupKey, contactList);
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
                                  <span className="text-slate-500 text-sm">({contactList.length})</span>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3">
                                <PaginationControls
                                  currentPage={currentPage}
                                  totalPages={totalPages}
                                  totalItems={contactList.length}
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
                                        <TableHead className="text-slate-400">Email</TableHead>
                                        <TableHead className="text-slate-400 w-[100px]">Detalles</TableHead>
                                        <TableHead className="text-slate-400 w-[80px]">Acción</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {paginatedContacts.map((contact) => (
                                        <TableRow key={contact.contact_id || contact.id} className="border-[#222] hover:bg-[#0a0a0a]">
                                          <TableCell>
                                            <div>
                                              <p className="font-medium text-white text-sm">{contact.name}</p>
                                              <p className="text-xs text-slate-500">{contact.company || '-'}</p>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <span className="text-blue-400 text-sm">{contact.email}</span>
                                          </TableCell>
                                          <TableCell>
                                            {contact.rule_type === "E1" && contact.webinar_name && (
                                              <p className="text-xs text-slate-400">{contact.webinar_name}</p>
                                            )}
                                            {contact.last_email_sent && (
                                              <p className="text-xs text-slate-600">
                                                Último: {new Date(contact.last_email_sent).toLocaleDateString()}
                                              </p>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => onGenerateEmail?.(contact)}
                                              className="text-purple-400 hover:text-purple-300 h-7 px-2"
                                              title="Generate Email"
                                            >
                                              <Mail className="w-4 h-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                
                                {/* Copy Emails Button */}
                                <Button
                                  onClick={() => handleCopyEmails(groupKey, contactList)}
                                  disabled={generatingGroup === groupKey}
                                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                                >
                                  {generatingGroup === groupKey ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      Copiando...
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copiar Emails ({paginatedContacts.length} de página actual)
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

export default EmailTabContent;
