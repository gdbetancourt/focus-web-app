import { useEffect, useState } from "react";
import { getUnifiedContacts } from "../lib/api";
import api from "../lib/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
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
import ContactSheet from "../components/ContactSheet";
import { 
  Users, 
  RefreshCw, 
  Search,
  Mail,
  Building,
  Briefcase,
  AlertTriangle,
  UserCircle,
  Edit,
  Sparkles,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  Factory,
  Handshake,
  ArrowRight,
  GraduationCap,
  Eye,
  Pencil
} from "lucide-react";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [buyerPersonasDB, setBuyerPersonasDB] = useState([]); // From /buyer-personas-db
  const [contactsWithoutPersona, setContactsWithoutPersona] = useState([]);
  const [editingContact, setEditingContact] = useState(null);
  const [newPersona, setNewPersona] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Selection and AI Review states
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [reviewingGlobal, setReviewingGlobal] = useState(false);
  const [reviewingPersona, setReviewingPersona] = useState(null);
  const [reviewingContact, setReviewingContact] = useState(null);
  
  // Accordion state for collapse all
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [allExpanded, setAllExpanded] = useState(false);
  
  // Group by mode: "persona" | "jobtitle" | "sector"
  const [groupByMode, setGroupByMode] = useState("persona");
  
  // Move to Cierre state
  const [movingToCierre, setMovingToCierre] = useState(null);
  const [cierreReason, setCierreReason] = useState("Solicitó propuesta");
  
  // Edit company dialog
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: "", industry: "" });
  const [savingCompany, setSavingCompany] = useState(false);
  const [sectors, setSectors] = useState([]);

  // Contact Details dialog with LMS courses
  const [viewingContact, setViewingContact] = useState(null);
  const [contactCourses, setContactCourses] = useState([]);
  
  // Contact Sheet for full editing
  const [editSheetContact, setEditSheetContact] = useState(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Get functional areas for grouping
  const [functionalAreas, setFunctionalAreas] = useState([]);
  
  const loadFunctionalAreas = async () => {
    try {
      const response = await api.get("/buyer-personas-db/functional-areas");
      setFunctionalAreas(response.data || []);
    } catch (error) {
      console.error("Error loading functional areas:", error);
    }
  };

  useEffect(() => {
    loadContacts();
    loadBuyerPersonasDB();
    loadSectors();
    loadFunctionalAreas();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [search, contacts]);

  useEffect(() => {
    const withoutPersona = contacts.filter(c => !c.buyer_persona);
    setContactsWithoutPersona(withoutPersona);
  }, [contacts]);

  const loadContacts = async () => {
    try {
      const response = await getUnifiedContacts({ limit: 2000 });
      const contactsList = response.data.contacts || response.data || [];
      setContacts(contactsList);
      setFilteredContacts(contactsList);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Error al cargar contactos.");
    } finally {
      setLoading(false);
    }
  };

  const loadBuyerPersonasDB = async () => {
    try {
      const response = await api.get("/buyer-personas-db/");
      setBuyerPersonasDB(response.data || []);
    } catch (error) {
      console.error("Error loading buyer personas DB:", error);
    }
  };

  const viewContactDetails = async (contact) => {
    setViewingContact(contact);
    setLoadingCourses(true);
    try {
      const response = await api.get(`/lms/contact/${contact.id}/courses`);
      setContactCourses(response.data.courses || []);
    } catch (error) {
      console.error("Error loading contact courses:", error);
      setContactCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const closeContactDetails = () => {
    setViewingContact(null);
    setContactCourses([]);
  };

  const loadSectors = async () => {
    try {
      const response = await api.get("/hubspot/sectors");
      setSectors(response.data || []);
    } catch (error) {
      console.error("Error loading sectors:", error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Sync is no longer needed - just reload contacts from unified_contacts
      await loadContacts();
      await loadBuyerPersonasDB();
      toast.success("Contactos actualizados");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar contactos");
    } finally {
      setSyncing(false);
    }
  };

  const filterContacts = () => {
    if (!search.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    
    const query = search.toLowerCase();
    const filtered = contacts.filter(
      (contact) =>
        contact.firstname?.toLowerCase().includes(query) ||
        contact.lastname?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query) ||
        contact.buyer_persona?.toLowerCase().includes(query) ||
        contact.buyer_persona_display_name?.toLowerCase().includes(query) ||
        contact.jobtitle?.toLowerCase().includes(query)
    );
    setFilteredContacts(filtered);
  };

  // Get persona info from DB by code
  const getPersonaInfo = (personaCode) => {
    if (!personaCode) return null;
    return buyerPersonasDB.find(p => p.code === personaCode);
  };

  // Group contacts by selected mode
  const getGroupedContacts = () => {
    const groups = {};
    
    if (groupByMode === "persona") {
      // Group by buyer persona
      filteredContacts.forEach(contact => {
        const key = contact.buyer_persona || '__sin_persona__';
        if (!groups[key]) {
          groups[key] = {
            code: contact.buyer_persona,
            contacts: [],
            displayName: contact.buyer_persona_display_name,
            area: contact.classified_area,
            sector: contact.classified_sector,
            groupType: "persona"
          };
        }
        groups[key].contacts.push(contact);
      });
      
      // If display info not in contact, try to get from DB
      Object.keys(groups).forEach(key => {
        if (key !== '__sin_persona__' && !groups[key].displayName) {
          const personaInfo = getPersonaInfo(key);
          if (personaInfo) {
            groups[key].displayName = personaInfo.display_name || personaInfo.name;
            groups[key].area = personaInfo.area;
            groups[key].sector = personaInfo.sector;
          }
        }
      });
    } else if (groupByMode === "jobtitle") {
      // Group by FUNCTIONAL AREA (not individual job titles)
      // Areas: Marketing, Comercial, Médicas, RRHH, Compras, Otras Direcciones, Event/Meeting Planner
      const areaNames = {
        "marketing": "Direcciones de Marketing",
        "comercial": "Direcciones Comerciales",
        "medico": "Direcciones Médicas",
        "rrhh": "Direcciones de RRHH",
        "compras": "Direcciones de Compras",
        "otras": "Otras Direcciones",
        "event_planner": "Event/Meeting Planner",
        "ramona": "Médicos Especialistas (Ramona)",
        "mateo": "Sin Clasificar (Mateo)"
      };
      
      filteredContacts.forEach(contact => {
        // Use classified_area if available, otherwise try to determine from buyer_persona
        let areaCode = contact.classified_area || '';
        let areaKey = '__sin_area__';
        
        // Map common area names to codes
        const areaLower = areaCode.toLowerCase();
        if (areaLower.includes('marketing')) areaKey = 'marketing';
        else if (areaLower.includes('comercial')) areaKey = 'comercial';
        else if (areaLower.includes('médic') || areaLower.includes('medic')) areaKey = 'medico';
        else if (areaLower.includes('rrhh') || areaLower.includes('recursos humanos') || areaLower.includes('human')) areaKey = 'rrhh';
        else if (areaLower.includes('compras') || areaLower.includes('procurement')) areaKey = 'compras';
        else if (areaLower.includes('event') || areaLower.includes('meeting') || areaLower.includes('planner')) areaKey = 'event_planner';
        else if (areaLower.includes('otras') || areaLower.includes('other')) areaKey = 'otras';
        else if (areaLower.includes('ramona')) areaKey = 'ramona';
        else if (areaLower.includes('mateo') || areaLower.includes('sin clasif')) areaKey = 'mateo';
        else if (areaCode) areaKey = 'otras';
        
        if (!groups[areaKey]) {
          groups[areaKey] = {
            contacts: [],
            displayName: areaNames[areaKey] || areaCode || "Sin Área",
            groupType: "jobtitle"
          };
        }
        groups[areaKey].contacts.push(contact);
      });
    } else if (groupByMode === "sector") {
      // Group by sector/industry of the company
      // Active sectors go to their own groups, inactive go to "Sectores Inactivos"
      const activeSectorNames = new Set([
        'Pharmaceuticals', 'PHARMACEUTICALS',
        'Medical Devices', 'MEDICAL_DEVICES', 'MEDICAL DEVICES',
        'Retail', 'RETAIL',
        'Banking', 'BANKING',
        'Telecommunications', 'TELECOMMUNICATIONS',
        'Consumer', 'CONSUMER', 'Consumer Goods', 'CONSUMER_GOODS',
        'Automotive', 'AUTOMOTIVE',
        'Technology', 'TECHNOLOGY', 'COMPUTER_SOFTWARE', 'COMPUTER_HARDWARE',
        'Energy', 'ENERGY', 'OIL_ENERGY',
        'Insurance', 'INSURANCE'
      ]);
      
      filteredContacts.forEach(contact => {
        const sector = contact.classified_sector || contact.company_industry || '';
        
        // Check if sector is active
        const isActiveSector = sector && activeSectorNames.has(sector);
        const key = isActiveSector ? sector : '__sectores_inactivos__';
        
        if (!groups[key]) {
          groups[key] = {
            contacts: [],
            displayName: key === '__sectores_inactivos__' ? "Sectores Inactivos" : sector,
            groupType: "sector"
          };
        }
        groups[key].contacts.push(contact);
      });
    }
    
    // Convert to array and sort by contact count (descending)
    return Object.entries(groups)
      .map(([key, data]) => ({
        key,
        ...data
      }))
      .sort((a, b) => {
        // Empty/unclassified always last (not first)
        if (a.key.startsWith('__')) return 1;
        if (b.key.startsWith('__')) return -1;
        // Then by contact count descending
        return b.contacts.length - a.contacts.length;
      });
  };

  const groupedContacts = getGroupedContacts();

  // Handle company edit
  const handleEditCompany = (contact) => {
    setEditingCompany(contact);
    setCompanyForm({
      name: contact.company || "",
      industry: contact.company_industry || ""
    });
  };

  const handleSaveCompany = async () => {
    if (!editingCompany) return;
    
    setSavingCompany(true);
    try {
      // Update company industry locally
      await api.put(`/hubspot/companies/${encodeURIComponent(editingCompany.company)}/industry?industry=${encodeURIComponent(companyForm.industry)}`);
      
      toast.success("Empresa actualizada");
      
      // Update local contacts state
      setContacts(prev => prev.map(c => 
        c.company === editingCompany.company 
          ? { ...c, company_industry: companyForm.industry } 
          : c
      ));
      
      setEditingCompany(null);
    } catch (error) {
      toast.error("Error al actualizar empresa");
    } finally {
      setSavingCompany(false);
    }
  };

  // Expand/Collapse all
  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedGroups([]);
      setAllExpanded(false);
    } else {
      setExpandedGroups(groupedContacts.map(g => g.key));
      setAllExpanded(true);
    }
  };

  const handleEditPersona = (contact) => {
    setEditingContact(contact);
    setNewPersona(contact.buyer_persona || "");
  };

  const handleSavePersona = async () => {
    if (!editingContact || !newPersona.trim()) return;
    
    setSaving(true);
    try {
      await api.put(`/hubspot/contact/${editingContact.id}/buyer-persona?buyer_persona=${encodeURIComponent(newPersona.trim())}`);
      toast.success("Buyer persona actualizado");
      
      setContacts(prev => prev.map(c => 
        c.id === editingContact.id ? { ...c, buyer_persona: newPersona.trim() } : c
      ));
      
      setEditingContact(null);
      setNewPersona("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar buyer persona");
    } finally {
      setSaving(false);
    }
  };

  // Selection handlers
  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const toggleAllInGroup = (contactIds) => {
    const allSelected = contactIds.every(id => selectedContacts.has(id));
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      contactIds.forEach(id => {
        if (allSelected) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      });
      return newSet;
    });
  };

  // AI Review handlers
  const handleReviewGlobal = async () => {
    setReviewingGlobal(true);
    try {
      const contactIds = selectedContacts.size > 0 
        ? Array.from(selectedContacts) 
        : [];
      
      const response = await api.post("/buyer-personas-db/review-contacts", {
        contact_ids: contactIds,
        force_update: true
      });
      
      if (response.data.success) {
        toast.success(`Revisión completada: ${response.data.reviewed} revisados, ${response.data.changed} actualizados`);
        await loadContacts();
        setSelectedContacts(new Set());
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en la revisión");
    } finally {
      setReviewingGlobal(false);
    }
  };

  const handleReviewByPersona = async (personaKey) => {
    setReviewingPersona(personaKey);
    try {
      const group = groupedContacts.find(g => g.key === personaKey);
      const personaContacts = group?.contacts || [];
      const selectedInGroup = personaContacts.filter(c => selectedContacts.has(c.id));
      
      const contactIds = selectedInGroup.length > 0 
        ? selectedInGroup.map(c => c.id)
        : personaContacts.map(c => c.id);
      
      const response = await api.post("/buyer-personas-db/review-contacts", {
        contact_ids: contactIds,
        force_update: true
      });
      
      if (response.data.success) {
        toast.success(`Revisión completada: ${response.data.reviewed} revisados, ${response.data.changed} actualizados`);
        await loadContacts();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en la revisión");
    } finally {
      setReviewingPersona(null);
    }
  };

  const handleReviewSingleContact = async (contact) => {
    setReviewingContact(contact.id);
    try {
      const response = await api.post("/buyer-personas-db/review-contacts", {
        contact_ids: [contact.id],
        force_update: true
      });
      
      if (response.data.success) {
        if (response.data.changed > 0) {
          toast.success("Buyer persona actualizado");
        } else {
          toast.info("Sin cambios necesarios");
        }
        await loadContacts();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error en la revisión");
    } finally {
      setReviewingContact(null);
    }
  };

  // Handle move to cierre
  const handleMoveToCierre = async () => {
    if (!movingToCierre) return;
    
    try {
      await api.put(`/hubspot/contact/${movingToCierre.id}/move-to-cierre`, {
        reason: cierreReason,
        notes: ""
      });
      toast.success(`${movingToCierre.firstname || movingToCierre.email} movido a Cierre`);
      setMovingToCierre(null);
      setCierreReason("Solicitó propuesta");
      await loadContacts();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al mover a Cierre");
    }
  };

  const ContactRow = ({ contact, showPersonaEdit = false, showCheckbox = true }) => (
    <TableRow 
      key={contact.id} 
      className="table-row-hover"
      data-testid={`contact-row-${contact.id}`}
    >
      {showCheckbox && (
        <TableCell className="w-12">
          <Checkbox
            checked={selectedContacts.has(contact.id)}
            onCheckedChange={() => toggleContactSelection(contact.id)}
          />
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#151515] rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-slate-300">
              {(contact.firstname?.[0] || contact.email?.[0] || "?").toUpperCase()}
            </span>
          </div>
          <span className="font-medium text-white">
            {contact.firstname || contact.lastname
              ? `${contact.firstname || ""} ${contact.lastname || ""}`.trim()
              : "Sin nombre"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-slate-300">
          <Mail className="w-4 h-4 text-slate-400" />
          <span className="truncate max-w-[200px]">{contact.email || "-"}</span>
        </div>
      </TableCell>
      <TableCell>
        {contact.company ? (
          <button
            onClick={() => handleEditCompany(contact)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            <Building className="w-4 h-4" />
            <span className="truncate max-w-[150px]">{contact.company}</span>
            <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100" />
          </button>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-slate-300">
          <Briefcase className="w-4 h-4 text-slate-400" />
          <span className="truncate max-w-[200px]">{contact.jobtitle || "-"}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => viewContactDetails(contact)}
            className="text-slate-400 hover:text-slate-200"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditSheetContact(contact);
              setShowEditSheet(true);
            }}
            className="text-orange-600 hover:text-orange-700"
            title="Editar contacto completo"
            data-testid={`edit-contact-${contact.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          {showPersonaEdit && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleEditPersona(contact)}
              className="text-blue-600 hover:text-blue-700"
              title="Cambiar buyer persona"
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleReviewSingleContact(contact)}
            disabled={reviewingContact === contact.id}
            className="text-purple-600 hover:text-purple-700"
            title="Revisar con IA"
          >
            {reviewingContact === contact.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
          </Button>
          {contact.pipeline_stage !== "cierre" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMovingToCierre(contact)}
              className="text-green-600 hover:text-green-700"
              title="Mover a Cierre"
            >
              <Handshake className="w-4 h-4" />
            </Button>
          )}
          {contact.pipeline_stage === "cierre" && (
            <Badge className="bg-green-100 text-green-700 text-xs">En Cierre</Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  const selectedCount = selectedContacts.size;

  return (
    <div className="space-y-6" data-testid="contacts-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Contactos</h1>
          <p className="text-slate-500 mt-1">
            {contacts.length} contactos • {groupedContacts.filter(g => g.key !== '__sin_persona__').length} grupos
            {selectedCount > 0 && (
              <Badge className="ml-2 bg-purple-100 text-purple-700">
                {selectedCount} seleccionados
              </Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReviewGlobal}
            disabled={reviewingGlobal}
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            {reviewingGlobal ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            {reviewingGlobal 
              ? "Revisando..." 
              : selectedCount > 0 
                ? `Revisar ${selectedCount}` 
                : "Revisar Todos"
            }
          </Button>
          <Button 
            onClick={handleSync} 
            disabled={syncing}
            className="btn-accent"
            data-testid="sync-contacts-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      {/* Alert for contacts without buyer persona */}
      {contactsWithoutPersona.length > 0 && (
        <Alert variant="destructive" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Contactos sin clasificar</AlertTitle>
          <AlertDescription className="text-amber-700">
            Hay {contactsWithoutPersona.length} contacto(s) sin buyer persona. 
            Usa el botón de revisión con IA para clasificarlos.
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Collapse All */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, email, empresa, cargo o buyer persona..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-contacts"
              />
            </div>
            
            {/* Group by buttons */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 shrink-0">Agrupar por:</span>
              <div className="flex border rounded-lg overflow-hidden">
                <Button 
                  variant={groupByMode === "persona" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupByMode("persona")}
                  className="rounded-none"
                >
                  <UserCircle className="w-4 h-4 mr-1" />
                  Buyer Persona
                </Button>
                <Button 
                  variant={groupByMode === "jobtitle" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupByMode("jobtitle")}
                  className="rounded-none border-l"
                >
                  <Briefcase className="w-4 h-4 mr-1" />
                  Área
                </Button>
                <Button 
                  variant={groupByMode === "sector" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupByMode("sector")}
                  className="rounded-none border-l"
                >
                  <Factory className="w-4 h-4 mr-1" />
                  Sector
                </Button>
              </div>
            </div>
            
            {/* Expand/Collapse */}
            <Button
              variant="outline"
              onClick={handleToggleAll}
              className="shrink-0"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Colapsar Todo
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Expandir Todo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts grouped by Buyer Persona */}
      {loading ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#222222] border-t-slate-600 rounded-full mx-auto" />
            <p className="text-slate-500 mt-4">Cargando contactos...</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion 
          type="multiple" 
          value={expandedGroups}
          onValueChange={setExpandedGroups}
          className="space-y-3"
        >
          {groupedContacts.map((group) => {
            const isSinPersona = group.key === '__sin_persona__';
            const selectedInGroup = group.contacts.filter(c => selectedContacts.has(c.id)).length;
            const displayName = isSinPersona ? "Sin Clasificar" : (group.displayName || group.code);
            
            return (
              <AccordionItem 
                key={group.key} 
                value={group.key} 
                className={`border rounded-xl overflow-hidden bg-[#111111] shadow-sm ${
                  isSinPersona ? 'border-amber-200' : ''
                }`}
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-[#0f0f0f]">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${isSinPersona ? 'bg-amber-100' : 'bg-blue-100'}`}>
                      {isSinPersona ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      ) : (
                        <UserCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      {/* Display Name (fictitious name) */}
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {displayName}
                        <Badge variant="secondary" className="text-xs">
                          {group.contacts.length}
                        </Badge>
                        {selectedInGroup > 0 && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">
                            {selectedInGroup} sel.
                          </Badge>
                        )}
                      </h3>
                      {/* Area and Sector info */}
                      {!isSinPersona && (group.area || group.sector) && (
                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                          {group.area && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {group.area}
                            </span>
                          )}
                          {group.area && group.sector && <span>•</span>}
                          {group.sector && (
                            <span className="flex items-center gap-1">
                              <Factory className="w-3 h-3" />
                              {group.sector}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReviewByPersona(group.key);
                      }}
                      disabled={reviewingPersona === group.key}
                      className="mr-4 border-purple-200 text-purple-700"
                    >
                      {reviewingPersona === group.key ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4 mr-1" />
                      )}
                      {selectedInGroup > 0 ? `Revisar ${selectedInGroup}` : "Revisar"}
                    </Button>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={group.contacts.length > 0 && group.contacts.every(c => selectedContacts.has(c.id))}
                              onCheckedChange={() => toggleAllInGroup(group.contacts.map(c => c.id))}
                            />
                          </TableHead>
                          <TableHead className="font-semibold">Nombre</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="font-semibold">Empresa</TableHead>
                          <TableHead className="font-semibold">Cargo</TableHead>
                          <TableHead className="font-semibold">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.contacts.map((contact) => (
                          <ContactRow 
                            key={contact.id} 
                            contact={contact} 
                            showPersonaEdit={isSinPersona}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Empty state */}
      {!loading && contacts.length === 0 && (
        <Card className="stat-card">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay contactos</h3>
            <p className="text-slate-500 mb-4">Sincroniza tus contactos desde HubSpot</p>
            <Button onClick={handleSync} disabled={syncing} className="btn-accent">
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar Contactos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {contacts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold text-white">{contacts.length}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Grupos</p>
                  <p className="text-2xl font-bold text-white">
                    {groupedContacts.filter(g => g.key !== '__sin_persona__').length}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <UserCircle className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Con email</p>
                  <p className="text-2xl font-bold text-white">
                    {contacts.filter(c => c.email).length}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <Mail className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Sin clasificar</p>
                  <p className="text-2xl font-bold text-amber-600">{contactsWithoutPersona.length}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Persona Dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Buyer Persona</DialogTitle>
          </DialogHeader>
          
          {editingContact && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-[#0f0f0f] rounded-lg">
                <p className="font-medium">{editingContact.firstname} {editingContact.lastname}</p>
                <p className="text-sm text-slate-500">{editingContact.email}</p>
                <p className="text-sm text-slate-500">{editingContact.company} • {editingContact.jobtitle}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Buyer Persona</label>
                <Select value={newPersona} onValueChange={setNewPersona}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar buyer persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {buyerPersonasDB.map(p => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.display_name || p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePersona} disabled={saving || !newPersona}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Editar Empresa
            </DialogTitle>
          </DialogHeader>
          
          {editingCompany && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-[#0f0f0f] rounded-lg">
                <p className="font-medium text-white">{editingCompany.company}</p>
                <p className="text-sm text-slate-500">
                  Contacto: {editingCompany.firstname} {editingCompany.lastname}
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Sector / Industria</label>
                <Select value={companyForm.industry} onValueChange={(v) => setCompanyForm(prev => ({ ...prev, industry: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.filter(s => s.is_active).map(s => (
                      <SelectItem key={s.id} value={s.hubspot_value}>
                        {s.custom_name || s.hubspot_label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">Otro sector</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Este cambio solo afecta la base de datos local, no HubSpot
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCompany} disabled={savingCompany}>
              {savingCompany ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Cierre Dialog */}
      <Dialog open={!!movingToCierre} onOpenChange={() => setMovingToCierre(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-green-600" />
              Mover a Cierre
            </DialogTitle>
          </DialogHeader>
          
          {movingToCierre && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-white">
                  {movingToCierre.firstname} {movingToCierre.lastname}
                </p>
                <p className="text-sm text-slate-300">{movingToCierre.email}</p>
                {movingToCierre.company && (
                  <p className="text-sm text-slate-500">{movingToCierre.company}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Razón para mover a Cierre</label>
                <Select value={cierreReason} onValueChange={setCierreReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Solicitó propuesta">Solicitó propuesta</SelectItem>
                    <SelectItem value="Solicitó cotización">Solicitó cotización</SelectItem>
                    <SelectItem value="Mostró interés en compra">Mostró interés en compra</SelectItem>
                    <SelectItem value="Agendó reunión de cierre">Agendó reunión de cierre</SelectItem>
                    <SelectItem value="Referido calificado">Referido calificado</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-sm text-slate-500">
                Este contacto se moverá a la sección de Cierre donde podrás dar seguimiento a su proceso de venta.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovingToCierre(null)}>
              Cancelar
            </Button>
            <Button onClick={handleMoveToCierre} className="bg-green-600 hover:bg-green-700">
              <ArrowRight className="w-4 h-4 mr-2" />
              Mover a Cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Details Dialog with LMS Courses */}
      <Dialog open={!!viewingContact} onOpenChange={closeContactDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-blue-600" />
              Detalles del Contacto
            </DialogTitle>
          </DialogHeader>
          
          {viewingContact && (
            <div className="space-y-6 py-4">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Nombre</p>
                  <p className="font-medium text-white">
                    {viewingContact.firstname || viewingContact.lastname
                      ? `${viewingContact.firstname || ""} ${viewingContact.lastname || ""}`.trim()
                      : "Sin nombre"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium text-white">{viewingContact.email || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Empresa</p>
                  <p className="font-medium text-white">{viewingContact.company || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Cargo</p>
                  <p className="font-medium text-white">{viewingContact.jobtitle || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Buyer Persona</p>
                  <p className="font-medium text-white">{viewingContact.buyer_persona || "Sin clasificar"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Teléfono</p>
                  <p className="font-medium text-white">{viewingContact.phone || "-"}</p>
                </div>
              </div>

              {/* LMS Courses Section */}
              <div className="border-t border-[#222] pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-white">Cursos LMS Inscritos</h3>
                </div>
                
                {loadingCourses ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : contactCourses.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No está inscrito en ningún curso</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contactCourses.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center gap-4 p-3 bg-[#0f0f0f] rounded-lg border border-[#222]"
                      >
                        {course.thumbnail_url ? (
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="w-16 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-12 rounded bg-purple-500/20 flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-purple-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{course.title}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            {course.enfoque_name && (
                              <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                {course.enfoque_name}
                              </Badge>
                            )}
                            {course.nivel_name && (
                              <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                                {course.nivel_name}
                              </Badge>
                            )}
                            <span>{course.lesson_count || 0} lecciones</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={closeContactDetails}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Sheet for full editing */}
      {editSheetContact && (
        <ContactSheet
          contact={editSheetContact}
          isOpen={showEditSheet}
          onClose={() => {
            setShowEditSheet(false);
            setEditSheetContact(null);
          }}
          onSave={(updatedContact) => {
            // Update local state with the updated contact
            setContacts(prev => prev.map(c => 
              c.id === updatedContact.id ? { ...c, ...updatedContact } : c
            ));
            setShowEditSheet(false);
            setEditSheetContact(null);
            toast.success("Contacto actualizado");
          }}
        />
      )}
    </div>
  );
}
