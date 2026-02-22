/**
 * Assign Deal Makers Tab Content Component
 * Includes contact search and create new contact functionality using ContactSheet
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { toast } from "sonner";
import api from "../../lib/api";
import ContactSheet from "../ContactSheet";
import {
  RefreshCw,
  Check,
  AlertTriangle,
  UserPlus,
  UserCheck,
  ChevronRight,
  Search,
  X,
  Plus,
  Building,
  Mail,
  Phone,
} from "lucide-react";

// Component for a case row with expandable contacts
function CaseWithoutDMRow({ caseItem, onAssign, onComplete, onAddContact, onCreateContact, formatCurrency }) {
  const [isOpen, setIsOpen] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [dealMakers, setDealMakers] = useState(caseItem.deal_makers || []);
  const [contacts, setContacts] = useState(caseItem.contacts || []);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [addingContact, setAddingContact] = useState(null);
  
  // Create contact dialog state - using ContactSheet
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({});

  const handleAssign = async (contactId) => {
    setAssigning(contactId);
    const result = await onAssign(contactId);
    if (result?.deal_makers) {
      setDealMakers(result.deal_makers);
    }
    setAssigning(null);
  };

  const handleComplete = async () => {
    setCompleting(true);
    await onComplete();
    setCompleting(false);
  };

  // Search contacts in database
  const searchContacts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await api.get(`/todays-focus/search-contacts?q=${encodeURIComponent(query)}&case_id=${caseItem.id}`);
      setSearchResults(res.data.contacts || []);
      setShowSearchDropdown(true);
    } catch (error) {
      console.error("Error searching contacts:", error);
      toast.error("Error buscando contactos");
    } finally {
      setSearchLoading(false);
    }
  }, [caseItem.id]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContacts(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchContacts]);

  // Add contact to case
  const handleAddContactToCase = async (contact) => {
    setAddingContact(contact.id);
    try {
      const result = await onAddContact(contact.id);
      if (result?.success) {
        if (result.contacts) {
          setContacts(result.contacts);
        }
        if (result.deal_makers) {
          setDealMakers(result.deal_makers);
        }
        toast.success(result.message);
        setSearchQuery("");
        setSearchResults([]);
        setShowSearchDropdown(false);
      } else if (result?.already_associated) {
        toast.info(result.message);
      }
    } catch (error) {
      console.error("Error adding contact to case:", error);
      toast.error("Error al agregar contacto");
    } finally {
      setAddingContact(null);
    }
  };

  // Open create sheet with defaults
  const openCreateSheet = () => {
    // Parse name parts if searchQuery looks like a name
    const nameParts = searchQuery.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    
    setCreateDefaults({
      name: searchQuery,
      first_name: firstName,
      last_name: lastName,
      company: caseItem.company_names?.[0] || "",
      stage: 3,
      roles: ["deal_maker"]
    });
    setShowSearchDropdown(false);
    setShowCreateSheet(true);
  };

  // Handle contact creation from ContactSheet
  const handleContactCreated = async (contactData) => {
    try {
      const result = await onCreateContact(contactData);
      if (result?.success) {
        if (result.contacts) {
          setContacts(result.contacts);
        }
        if (result.deal_makers) {
          setDealMakers(result.deal_makers);
        }
        toast.success(result.message);
        setSearchQuery("");
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    } catch (error) {
      console.error("Error creating contact:", error);
      const errorMsg = error.response?.data?.detail || "Error al crear contacto";
      toast.error(errorMsg);
      throw error; // Re-throw to keep sheet open on error
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  // Filter out contacts that are already deal makers
  const nonDMContacts = contacts?.filter(
    c => !dealMakers.some(dm => dm.id === c.id)
  ) || [];

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-[#151515] transition-colors cursor-pointer">
            <div className="flex items-center gap-4 flex-1">
              <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <div className="flex-1 text-left">
                <p className="font-medium text-white text-sm">{caseItem.name}</p>
                {caseItem.company_names?.length > 0 && (
                  <p className="text-xs text-slate-500">{caseItem.company_names.join(", ")}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={`${
                caseItem.current_stage === "Stage 4" 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : "bg-blue-500/20 text-blue-400"
              }`}>
                {caseItem.current_stage}
              </Badge>
              <span className="text-xs text-slate-400 capitalize">
                {caseItem.stage_detail?.replace(/_/g, " ") || "-"}
              </span>
              <span className="text-green-400 font-medium text-sm w-24 text-right">
                {formatCurrency(caseItem.amount)}
              </span>
              {dealMakers.length > 0 ? (
                <Badge className="bg-emerald-500/20 text-emerald-400">
                  {dealMakers.length} DM{dealMakers.length > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400">
                  Sin DM
                </Badge>
              )}
              <Badge className="bg-slate-700 text-slate-300">
                {contacts?.length || 0} contactos
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pl-12">
            {/* Show assigned Deal Makers */}
            {dealMakers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Deal Makers asignados:
                </p>
                <div className="flex flex-wrap gap-2">
                  {dealMakers.map((dm) => (
                    <div 
                      key={dm.id}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                    >
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-sm text-white">{dm.name}</p>
                        {dm.job_title && <p className="text-xs text-slate-500">{dm.job_title}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete button when at least one DM is assigned */}
            {dealMakers.length > 0 && (
              <div className="mb-4 p-3 bg-[#0a0a0a] rounded-lg border border-dashed border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    ¿Ya están todos los Deal Makers asignados?
                  </p>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComplete();
                    }}
                    disabled={completing}
                    className="bg-emerald-600 hover:bg-emerald-700 h-8"
                  >
                    {completing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Marcar como completo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Search to add new contacts */}
            <div className="mb-4 p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
              <p className="text-xs text-blue-400 font-medium mb-2 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Buscar o crear contacto para agregar como Deal Maker
              </p>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="text"
                      placeholder="Buscar por nombre, email, teléfono, empresa..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="pl-10 bg-[#111] border-[#333] text-white text-sm h-9"
                      data-testid="search-contact-input"
                    />
                    {searchLoading && (
                      <RefreshCw className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    )}
                  </div>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSearch();
                      }}
                      className="border-[#333] h-9 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {/* Direct create button - always visible */}
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreateSheet();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 h-9 px-3"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Crear
                  </Button>
                </div>
                
                {/* Search Results Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {/* Search results */}
                    <div className="px-3 py-2 bg-[#111] border-b border-[#333]">
                      <p className="text-xs text-slate-500">Contactos existentes ({searchResults.length})</p>
                    </div>
                    {searchResults.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 hover:bg-[#222] border-b border-[#333] last:border-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddContactToCase(contact);
                        }}
                      >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-white font-medium truncate">{contact.name}</p>
                                {contact.stage && (
                                  <Badge className="text-[10px] bg-slate-700">Stage {contact.stage}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                {contact.job_title && <span>{contact.job_title}</span>}
                                {contact.company && (
                                  <span className="flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    {contact.company}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={addingContact === contact.id}
                              className="bg-[#ff3300] hover:bg-[#ff3300]/90 h-7 text-xs ml-2 shrink-0"
                            >
                              {addingContact === contact.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  Agregar
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                  </div>
                )}
              </div>
            </div>

            {/* List of existing contacts to assign as DM */}
            {contacts?.length === 0 ? (
              <div className="p-4 bg-[#0a0a0a] rounded-lg text-center">
                <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Este caso no tiene contactos asociados</p>
                <p className="text-xs text-slate-500 mt-1">Usa el buscador arriba para agregar o crear contactos</p>
              </div>
            ) : nonDMContacts.length === 0 ? (
              <div className="p-4 bg-[#0a0a0a] rounded-lg text-center">
                <UserCheck className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Todos los contactos ya son Deal Makers</p>
                <p className="text-xs text-slate-500 mt-1">Puedes agregar más contactos usando el buscador</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 mb-2">
                  Contactos asociados - selecciona para asignar como Deal Maker:
                </p>
                {nonDMContacts.map((contact) => (
                  <div 
                    key={contact.id} 
                    className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white text-sm">{contact.name}</p>
                        {contact.roles?.length > 0 && (
                          <div className="flex gap-1">
                            {contact.roles.map((role, idx) => (
                              <Badge key={idx} className="text-[10px] bg-slate-700 text-slate-300">
                                {role.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {contact.job_title && <span>{contact.job_title}</span>}
                        {contact.email && <span>{contact.email}</span>}
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssign(contact.id);
                      }}
                      disabled={assigning === contact.id}
                      className="bg-[#ff3300] hover:bg-[#ff3300]/90 h-8"
                    >
                      {assigning === contact.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-1" />
                          Asignar DM
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ContactSheet for creating new contacts */}
      <ContactSheet
        contact={null}
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        createMode={true}
        defaultValues={createDefaults}
        onCreate={handleContactCreated}
      />
    </>
  );
}

export function AssignDMTabContent({
  casesWithoutDM,
  setCasesWithoutDM,
  loadingDM,
  onRefresh,
  formatCurrency,
}) {
  const handleAssignDM = async (caseId, contactId) => {
    try {
      const response = await api.post("/todays-focus/assign-dealmaker", {
        case_id: caseId,
        contact_id: contactId
      });
      if (response.data.already_dm) {
        toast.info(`${response.data.message} (ya era Deal Maker)`);
      } else {
        toast.success(response.data.message);
      }
      return response.data;
    } catch (error) {
      console.error("Error assigning deal maker:", error);
      toast.error("Error al asignar Deal Maker");
      return null;
    }
  };

  const handleAddContactToCase = async (caseId, contactId) => {
    try {
      const response = await api.post("/todays-focus/add-contact-to-case", {
        case_id: caseId,
        contact_id: contactId
      });
      return response.data;
    } catch (error) {
      console.error("Error adding contact to case:", error);
      toast.error("Error al agregar contacto al caso");
      return null;
    }
  };

  const handleCreateContactForCase = async (caseId, contactData) => {
    // Extract relevant fields from ContactSheet data format
    const response = await api.post("/todays-focus/create-contact-for-case", {
      case_id: caseId,
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      job_title: contactData.job_title,
      company: contactData.company
    });
    return response.data;
  };

  const handleMarkComplete = async (caseId) => {
    try {
      await api.post("/todays-focus/mark-dm-complete", {
        case_id: caseId
      });
      toast.success("Asignación de Deal Makers completada");
      setCasesWithoutDM(prev => prev.filter(c => c.id !== caseId));
    } catch (error) {
      console.error("Error marking DM complete:", error);
      toast.error("Error al marcar como completo");
    }
  };

  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader className="border-b border-[#222]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Casos sin Deal Maker Asignado
          </CardTitle>
          <Button 
            onClick={onRefresh} 
            variant="outline" 
            size="sm"
            className="border-[#333]"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDM ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loadingDM ? (
          <div className="p-8 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : casesWithoutDM.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p>¡Todos los casos tienen Deal Maker asignado!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#222]">
            {casesWithoutDM.map((caseItem) => (
              <CaseWithoutDMRow 
                key={caseItem.id} 
                caseItem={caseItem}
                onAssign={(contactId) => handleAssignDM(caseItem.id, contactId)}
                onAddContact={(contactId) => handleAddContactToCase(caseItem.id, contactId)}
                onCreateContact={(contactData) => handleCreateContactForCase(caseItem.id, contactData)}
                onComplete={() => handleMarkComplete(caseItem.id)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AssignDMTabContent;
