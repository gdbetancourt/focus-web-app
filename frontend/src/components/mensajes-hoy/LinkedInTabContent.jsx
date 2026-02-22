/**
 * LinkedIn Tab Content Component
 * Contains all LinkedIn contact management functionality
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import api from "../../lib/api";
import { PAGE_SIZE_OPTIONS } from "./constants";
import { copyToClipboard } from "./utils";
import {
  Linkedin,
  RefreshCw,
  User,
  Edit,
  Copy,
  Search,
  X,
  Mail,
  CheckCircle,
  XCircle,
} from "lucide-react";

export function LinkedInTabContent({
  embedded = false,
  onEditContact,
  onAddLinkedin,
  onLoadStats,
}) {
  // Data state
  const [personaGroups, setPersonaGroups] = useState({});
  const [stats, setStats] = useState({ total: 0, with_linkedin: 0, without_linkedin: 0 });
  const [loading, setLoading] = useState(false);
  
  // Pagination state
  const [groupPages, setGroupPages] = useState({});
  const [groupPageSizes, setGroupPageSizes] = useState({});
  const defaultPageSize = 10;
  
  // Diagnosis search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadLinkedinData();
  }, []);

  const loadLinkedinData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mensajes-hoy/linkedin/by-keyword");
      setPersonaGroups(res.data.persona_groups || {});
      setStats({
        total: res.data.total_contacts || 0,
        with_linkedin: res.data.total_with_linkedin || 0,
        without_linkedin: res.data.total_without_linkedin || 0
      });
    } catch (error) {
      console.error("Error loading LinkedIn data:", error);
      toast.error("Error loading LinkedIn contacts");
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

  // Copy LinkedIn URLs
  const copyLinkedinUrls = async (groupKey, contacts, isPaginated = false) => {
    const contactsToCopy = isPaginated 
      ? getPaginatedContacts(groupKey, contacts)
      : contacts;
    
    const urls = contactsToCopy
      .filter(c => c.linkedin_url || c.has_linkedin)
      .map(c => c.linkedin_url);
    
    if (urls.length === 0) {
      toast.error("No hay URLs de LinkedIn para copiar");
      return;
    }
    
    try {
      const copied = await copyToClipboard(urls.join("\n"));
      if (copied) {
        toast.success(`${urls.length} URLs copiadas${isPaginated ? ' (página actual)' : ''}`);
      } else {
        toast.error("No se pudo copiar al portapapeles");
        return;
      }
      
      // Mark contacts as contacted via LinkedIn
      const contactIds = contactsToCopy
        .filter(c => (c.linkedin_url || c.has_linkedin) && c.contact_id)
        .map(c => c.contact_id);
      
      if (contactIds.length > 0) {
        await api.post("/mensajes-hoy/mark-contacted", {
          contact_ids: contactIds,
          message_type: "linkedin"
        });
        
        loadLinkedinData();
        onLoadStats?.();
      }
    } catch (error) {
      toast.error("Error copying URLs");
    }
  };

  // Copy all LinkedIn URLs for a Persona
  const copyPersonaUrls = async (persona, personaData) => {
    const allContacts = Object.values(personaData.keywords).flat();
    const urls = allContacts
      .filter(c => c.linkedin_url || c.has_linkedin)
      .map(c => c.linkedin_url);
    
    if (urls.length === 0) {
      toast.error("No hay URLs de LinkedIn en este Buyer Persona");
      return;
    }
    
    try {
      const copied = await copyToClipboard(urls.join("\n"));
      if (copied) {
        toast.success(`${urls.length} URLs copiadas de "${persona}"`);
      } else {
        toast.error("No se pudo copiar al portapapeles");
        return;
      }
      
      const contactIds = allContacts
        .filter(c => (c.linkedin_url || c.has_linkedin) && c.contact_id)
        .map(c => c.contact_id);
      
      if (contactIds.length > 0) {
        await api.post("/mensajes-hoy/mark-contacted", {
          contact_ids: contactIds,
          message_type: "linkedin"
        });
        
        loadLinkedinData();
        onLoadStats?.();
      }
    } catch (error) {
      toast.error("Error copying URLs");
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
      const contacts = (res.data.contacts || []).filter(c => c.type === 'contact');
      setSearchResults(contacts);
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
      const res = await api.get(`/mensajes-hoy/linkedin/diagnose/${contact.id}`);
      setSelectedDiagnosis(res.data);
    } catch (error) {
      console.error("Error diagnosing contact for LinkedIn:", error);
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

  if (loading && Object.keys(personaGroups).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32" data-testid="linkedin-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        <p className="text-slate-500 text-sm">Cargando contactos de LinkedIn...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="linkedin-tab-content">
      {/* LinkedIn Contact Search & Diagnosis */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Search className="w-4 h-4 text-blue-400" />
            Buscar contacto para diagnóstico LinkedIn
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
                  data-testid="linkedin-diagnosis-search-input"
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
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {contact.email || contact.phone || 'Sin contacto'}
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
              <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-4" data-testid="linkedin-diagnosis-panel">
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
                      {selectedDiagnosis.contact.linkedin_url && (
                        <span className="flex items-center gap-1">
                          <Linkedin className="w-3 h-3" />
                          LinkedIn
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
                  {!selectedDiagnosis.has_linkedin && (
                    <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                      Sin LinkedIn URL
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
                  {selectedDiagnosis.diagnosis.days_since_contact !== null && (
                    <Badge variant="outline" className="text-xs">
                      Último contacto: {selectedDiagnosis.diagnosis.days_since_contact} días
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main LinkedIn Card */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Linkedin className="w-5 h-5 text-blue-400" />
              LinkedIn Contacts (Stage 1 & 2)
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-400">
                Total: <span className="text-white font-medium">{stats.total}</span>
              </span>
              <span className="text-green-400">
                With LinkedIn: <span className="font-medium">{stats.with_linkedin}</span>
              </span>
              <span className="text-yellow-400">
                Without LinkedIn: <span className="font-medium">{stats.without_linkedin}</span>
              </span>
            </div>
          </CardTitle>
          <p className="text-sm text-slate-500">
            Grouped by Buyer Persona → Keyword. Not contacted in 8+ days.
          </p>
        </CardHeader>
        <CardContent>
          {Object.keys(personaGroups).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Linkedin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="mb-2">No contacts available</p>
              <p className="text-xs text-slate-600">Contacts will appear when not contacted in 8 days</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {Object.entries(personaGroups).map(([persona, personaData]) => (
                <AccordionItem 
                  key={persona} 
                  value={persona} 
                  className="border border-[#222] rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="hover:no-underline px-4 py-3 bg-[#0a0a0a]">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-blue-500/20 text-blue-400">
                          {personaData.total_contacts}
                        </Badge>
                        <span className="text-white font-medium capitalize">
                          {persona === "sin_clasificar" ? "Unclassified" : persona}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-green-400">{personaData.with_linkedin} con URL</span>
                        <span className="text-xs text-yellow-400">{personaData.without_linkedin} sin URL</span>
                        {personaData.with_linkedin > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyPersonaUrls(persona, personaData);
                            }}
                            className="border-blue-500/30 text-blue-400 text-xs h-7 px-2 ml-2"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy ({personaData.with_linkedin})
                          </Button>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Accordion type="single" collapsible className="space-y-2 mt-2">
                      {Object.entries(personaData.keywords).map(([keyword, contacts]) => {
                        const groupKey = `${persona}-${keyword}`;
                        const paginatedContacts = getPaginatedContacts(groupKey, contacts);
                        const totalPages = getTotalPages(groupKey, contacts);
                        const currentPage = getCurrentPage(groupKey);
                        const pageSize = getPageSize(groupKey);
                        
                        const keywordWithLinkedin = contacts.filter(c => c.has_linkedin || c.linkedin_url).length;
                        const keywordWithoutLinkedin = contacts.length - keywordWithLinkedin;
                        const isPaginating = contacts.length > pageSize;
                        const urlsCountForButton = isPaginating 
                          ? paginatedContacts.filter(c => c.has_linkedin || c.linkedin_url).length
                          : keywordWithLinkedin;
                        
                        return (
                          <AccordionItem 
                            key={keyword} 
                            value={keyword}
                            className="border border-[#333] rounded-lg"
                          >
                            <AccordionTrigger className="hover:no-underline px-3 py-2">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="border-slate-500/30 text-slate-400 text-xs">
                                    {contacts.length}
                                  </Badge>
                                  <span className="text-slate-300 text-sm">{keyword}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-green-400">{keywordWithLinkedin} con URL</span>
                                  <span className="text-xs text-yellow-400">{keywordWithoutLinkedin} sin URL</span>
                                  {keywordWithLinkedin > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyLinkedinUrls(groupKey, contacts, isPaginating);
                                      }}
                                      className="border-blue-500/30 text-blue-400 text-xs h-7 px-2 ml-1"
                                    >
                                      <Copy className="w-3 h-3 mr-1" />
                                      Copy ({urlsCountForButton})
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3">
                              {/* Pagination Controls */}
                              <div className="flex items-center justify-between mb-3 py-2 border-b border-[#333]">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">Mostrar:</span>
                                  <Select 
                                    value={pageSize.toString()} 
                                    onValueChange={(v) => setPageSize(groupKey, parseInt(v))}
                                  >
                                    <SelectTrigger className="w-20 h-8 bg-[#0a0a0a] border-[#333] text-white text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PAGE_SIZE_OPTIONS.map(size => (
                                        <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {isPaginating && (
                                  <span className="text-xs text-slate-500">
                                    Pág. {currentPage}/{totalPages} • {paginatedContacts.filter(c => c.has_linkedin || c.linkedin_url).length} URLs en esta página
                                  </span>
                                )}
                              </div>
                              
                              {/* Contacts Table */}
                              <div className="border rounded-lg border-[#333] overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-[#333]">
                                      <TableHead className="text-slate-400 text-xs">Name</TableHead>
                                      <TableHead className="text-slate-400 text-xs">Title</TableHead>
                                      <TableHead className="text-slate-400 text-xs">Company</TableHead>
                                      <TableHead className="text-slate-400 text-xs">LinkedIn</TableHead>
                                      <TableHead className="text-right text-slate-400 text-xs">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {paginatedContacts.map((contact) => (
                                      <TableRow key={contact.contact_id} className="border-[#333]">
                                        <TableCell>
                                          <p className="font-medium text-white text-sm">{contact.name || "No name"}</p>
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-xs">{contact.job_title || "-"}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{contact.company || "-"}</TableCell>
                                        <TableCell>
                                          {contact.has_linkedin ? (
                                            <a
                                              href={contact.linkedin_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                                            >
                                              <Linkedin className="w-4 h-4" />
                                            </a>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">
                                                No LinkedIn
                                              </Badge>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onAddLinkedin?.(contact)}
                                                className="text-green-400 hover:text-green-300 h-7 px-2"
                                                title="Add LinkedIn"
                                              >
                                                <Linkedin className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEditContact?.(contact)}
                                            className="text-blue-400 hover:text-blue-300 h-7 px-2"
                                            title="Edit contact"
                                          >
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              
                              {/* Pagination Footer */}
                              {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#333]">
                                  <span className="text-xs text-slate-500">
                                    Página {currentPage} de {totalPages} ({contacts.length} contactos)
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCurrentPage(groupKey, 1)}
                                      disabled={currentPage === 1}
                                      className="h-7 px-2 border-[#333]"
                                    >
                                      «
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCurrentPage(groupKey, currentPage - 1)}
                                      disabled={currentPage === 1}
                                      className="h-7 px-2 border-[#333]"
                                    >
                                      ‹
                                    </Button>
                                    <span className="px-3 text-sm text-white">{currentPage}</span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCurrentPage(groupKey, currentPage + 1)}
                                      disabled={currentPage === totalPages}
                                      className="h-7 px-2 border-[#333]"
                                    >
                                      ›
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setCurrentPage(groupKey, totalPages)}
                                      disabled={currentPage === totalPages}
                                      className="h-7 px-2 border-[#333]"
                                    >
                                      »
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LinkedInTabContent;
