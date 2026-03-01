/**
 * CompanyEditorDialog - Complete company editor with all properties and associations
 * Reusable across Companies page and Prospection tab
 * Now supports role-based permissions
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  RefreshCw,
  Save,
  Globe,
  Phone,
  MapPin,
  Linkedin,
  FileText,
  Users,
  Briefcase,
  Search,
  ExternalLink,
  Mail,
  User,
  AlertTriangle,
  Power,
  Plus,
  X,
  Loader2,
  Tag,
  Merge,
  History,
  Clock,
  ArrowRightLeft,
} from "lucide-react";

// Stage labels
const STAGE_LABELS = {
  1: "Prospección",
  2: "Educación", 
  3: "Cierre",
  4: "Delivery",
  5: "Recompra"
};

export function CompanyEditorDialog({ 
  open, 
  onOpenChange, 
  companyId,
  companyName,
  onSaved 
}) {
  const { can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  
  // Permission checks
  const canEdit = can('companies', 'edit');
  const canDelete = can('companies', 'delete');
  const canChangeClassification = can('companies', 'change_classification');
  const canCreateSearch = can('searches', 'create');
  const canDeleteSearch = can('searches', 'delete');
  
  // Company data
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [cases, setCases] = useState([]);
  const [searches, setSearches] = useState([]);
  const [stats, setStats] = useState({});
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Editable fields
  const [name, setName] = useState("");
  const [domains, setDomains] = useState([""]);  // Array of domains
  const [industries, setIndustries] = useState([]);  // Array of industry codes
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [aliases, setAliases] = useState([]);
  const [newAlias, setNewAlias] = useState("");
  
  // Company merge states
  const [companyToMerge, setCompanyToMerge] = useState(null);
  const [companyMergeSearch, setCompanyMergeSearch] = useState("");
  const [companyMergeResults, setCompanyMergeResults] = useState([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [merging, setMerging] = useState(false);
  
  const [industryToAdd, setIndustryToAdd] = useState("");

  // Available industries for selector
  const [availableIndustries, setAvailableIndustries] = useState([]);
  const industriesMap = useMemo(() => {
    const entries = [];
    for (const i of (availableIndustries || [])) {
      const label = i.label || i.value;
      if (i.value) entries.push([i.value, label]);
      if (i.code) entries.push([i.code, label]);
      if (i.id) entries.push([i.id, label]);
      if (i.label) entries.push([i.label, label]);
    }
    return Object.fromEntries(entries);
  }, [availableIndustries]);

  // Contact/Case association states
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseSearchResults, setCaseSearchResults] = useState([]);
  const [searchingCases, setSearchingCases] = useState(false);

  // Load industries list from official endpoint (/industries-v2), paginated.
  const loadIndustries = async () => {
    try {
      const pageSize = 500;
      let skip = 0;
      let total = Infinity;
      const inds = [];

      while (skip < total) {
        const res = await api.get("/industries-v2", { params: { limit: pageSize, skip } });
        const batch = res.data.industries || [];
        total = Number(res.data.total ?? batch.length);
        inds.push(...batch);
        if (batch.length === 0) break;
        skip += batch.length;
      }

      const normalized = inds
        .filter((i) => i && typeof i.name === "string" && i.name.trim())
        .map((i) => ({
          // Keep canonical company storage as industry name for compatibility
          value: i.name.trim(),
          label: i.name.trim(),
          id: i.id,
          code: i.code,
          classification: i.classification || "inbound",
        }));

      const seen = new Set();
      const unique = normalized.filter((i) => {
        const k = i.value.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      setAvailableIndustries(unique);
    } catch (error) {
      console.error("Error loading industries:", error);
      try {
        const legacyRes = await api.get("/industries/");
        const legacy = legacyRes.data.industries || [];
        setAvailableIndustries(
          legacy
            .filter((i) => i && typeof i.name === "string" && i.name.trim())
            .map((i) => ({
              value: i.name.trim(),
              label: i.name.trim(),
              id: i.id,
              code: i.code,
              classification: i.classification || "inbound",
            }))
        );
      } catch (_legacyError) {
        toast.error("No se pudo cargar el catálogo oficial de industrias");
      }
    }
  };

  // Load company activities
  const loadActivities = async (compId) => {
    if (!compId) return;
    setLoadingActivities(true);
    try {
      const res = await api.get(`/unified-companies/${compId}/activities?limit=50`);
      setActivities(res.data.activities || []);
    } catch (error) {
      console.error("Error loading activities:", error);
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Search contacts to associate
  const searchContacts = async (query) => {
    if (!query || query.length < 2) {
      setContactSearchResults([]);
      return;
    }
    setSearchingContacts(true);
    try {
      const res = await api.get(`/contacts/search?q=${encodeURIComponent(query)}&limit=10`);
      // Filter out already associated contacts
      const existingIds = new Set(contacts.map(c => c.id));
      setContactSearchResults((res.data.contacts || res.data || []).filter(c => !existingIds.has(c.id)));
    } catch (error) {
      console.error("Error searching contacts:", error);
    } finally {
      setSearchingContacts(false);
    }
  };

  // Associate contact with company
  const associateContact = async (contact) => {
    const companyIdToUse = companyId || company?.id || company?.hubspot_id;
    if (!companyIdToUse) return;
    
    try {
      await api.post(`/companies/${companyIdToUse}/contacts/${contact.id}`);
      // Add to local state
      setContacts([...contacts, contact]);
      setContactSearch("");
      setContactSearchResults([]);
      toast.success(`${contact.name} asociado a la empresa`);
    } catch (error) {
      console.error("Error associating contact:", error);
      toast.error(error.response?.data?.detail || "Error al asociar contacto");
    }
  };

  // Disassociate contact from company
  const disassociateContact = async (contactId) => {
    const companyIdToUse = companyId || company?.id || company?.hubspot_id;
    if (!companyIdToUse) return;
    
    try {
      await api.delete(`/companies/${companyIdToUse}/contacts/${contactId}`);
      // Remove from local state
      setContacts(contacts.filter(c => c.id !== contactId));
      toast.success("Contacto desasociado");
    } catch (error) {
      console.error("Error disassociating contact:", error);
      toast.error(error.response?.data?.detail || "Error al desasociar contacto");
    }
  };

  // Search cases to associate
  const searchCases = async (query) => {
    if (!query || query.length < 2) {
      setCaseSearchResults([]);
      return;
    }
    setSearchingCases(true);
    try {
      const res = await api.get(`/cases/?search=${encodeURIComponent(query)}&limit=10`);
      // Filter out already associated cases
      const existingIds = new Set(cases.map(c => c.id));
      setCaseSearchResults((res.data.cases || res.data || []).filter(c => !existingIds.has(c.id)));
    } catch (error) {
      console.error("Error searching cases:", error);
    } finally {
      setSearchingCases(false);
    }
  };

  // Associate case with company
  const associateCase = async (caseItem) => {
    const companyIdToUse = companyId || company?.id || company?.hubspot_id;
    if (!companyIdToUse) return;
    
    try {
      await api.post(`/companies/${companyIdToUse}/cases/${caseItem.id}`);
      // Add to local state
      setCases([...cases, caseItem]);
      setCaseSearch("");
      setCaseSearchResults([]);
      toast.success(`Caso "${caseItem.name}" asociado a la empresa`);
    } catch (error) {
      console.error("Error associating case:", error);
      toast.error(error.response?.data?.detail || "Error al asociar caso");
    }
  };

  // Disassociate case from company
  const disassociateCase = async (caseId) => {
    const companyIdToUse = companyId || company?.id || company?.hubspot_id;
    if (!companyIdToUse) return;
    
    try {
      await api.delete(`/companies/${companyIdToUse}/cases/${caseId}`);
      // Remove from local state
      setCases(cases.filter(c => c.id !== caseId));
      toast.success("Caso desasociado");
    } catch (error) {
      console.error("Error disassociating case:", error);
      toast.error(error.response?.data?.detail || "Error al desasociar caso");
    }
  };

  // Add alias
  const addAlias = () => {
    const trimmed = newAlias.trim();
    if (trimmed && !aliases.includes(trimmed.toLowerCase())) {
      setAliases([...aliases, trimmed]);
      setNewAlias("");
    }
  };

  // Search companies for merge
  const searchCompaniesForMerge = async (query) => {
    if (!query || query.length < 2) {
      setCompanyMergeResults([]);
      return;
    }
    setSearchingCompanies(true);
    try {
      // Get current company ID to exclude from results
      const currentId = companyId || company?.id;
      
      // Search in unified-companies
      const url = `/unified-companies/search?q=${encodeURIComponent(query)}&limit=10`;
      const res = await api.get(url);
      
      // Filter out current company and merged companies
      const results = (res.data.companies || res.data || []).filter(c => {
        const cId = c.id;
        // Exclude current company
        if (currentId && cId === currentId) return false;
        // Exclude merged companies
        if (c.is_merged) return false;
        return true;
      });
      
      setCompanyMergeResults(results);
    } catch (error) {
      console.error("Error searching companies:", error);
      setCompanyMergeResults([]);
    } finally {
      setSearchingCompanies(false);
    }
  };

  // Select company to merge
  const selectCompanyToMerge = (selectedCompany) => {
    setCompanyToMerge(selectedCompany);
    setCompanyMergeSearch("");
    setCompanyMergeResults([]);
    setShowMergeConfirm(true);
  };

  // Execute merge
  const executeMerge = async () => {
    if (!companyToMerge) return;
    
    const primaryId = companyId || company?.id || company?.hubspot_id || company?.hs_object_id;
    const secondaryId = companyToMerge.id || companyToMerge.hubspot_id || companyToMerge.hs_object_id;
    
    // Prevent self-merge
    if (primaryId === secondaryId) {
      toast.error("No se puede combinar una empresa consigo misma");
      return;
    }
    
    setMerging(true);
    try {
      // Get company name for the merge request
      const primaryName = company?.name || editData?.name || "";
      const secondaryName = companyToMerge.name || "";
      
      const res = await api.post("/prospection/companies/merge", {
        target_id: primaryId,
        source_ids: [secondaryId],
        target_name: primaryName
      });
      
      // Success! Show correct message
      toast.success(`Se combinó "${secondaryName}" con "${primaryName}"`);
      
      // Reload company data to show updated aliases
      await loadCompanyData();
      
      // Reset merge state - only close merge confirm, keep main dialog open
      setCompanyToMerge(null);
      setShowMergeConfirm(false);
      setCompanyMergeSearch("");
      setCompanyMergeResults([]);
      
    } catch (error) {
      console.error("Error merging companies:", error);
      const errorMessage = error.response?.data?.detail || "Error al combinar empresas";
      toast.error(errorMessage);
    } finally {
      setMerging(false);
    }
  };

  // Debounced search for contacts
  useEffect(() => {
    const timer = setTimeout(() => {
      searchContacts(contactSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search for cases
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCases(caseSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [caseSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search for companies to merge
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCompaniesForMerge(companyMergeSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [companyMergeSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load company data
  const loadCompanyData = useCallback(async () => {
    if (!companyId && !companyName) return;
    
    setLoading(true);
    try {
      let res;
      if (companyId) {
        res = await api.get(`/unified-companies/${companyId}`);
      } else if (companyName) {
        // Search by name in unified-companies
        res = await api.get(`/unified-companies/search?q=${encodeURIComponent(companyName)}&limit=1`);
        if (res.data.companies && res.data.companies.length > 0) {
          res = { data: res.data.companies[0] };
        }
      }
      
      const c = res.data || {};
      setCompany(c);
      setContacts(c.contacts || []);
      setCases(c.cases || []);
      setSearches(c.searches || []);
      setStats(c.stats || {});
      
      // Populate form fields
      setName(c.name || "");
      
      // Handle multiple domains
      if (c.domains && c.domains.length > 0) {
        setDomains(c.domains);
      } else if (c.domain) {
        setDomains([c.domain]);
      } else {
        setDomains([""]);
      }
      
      // Handle multiple industries
      if (c.industries && c.industries.length > 0) {
        setIndustries(c.industries);
      } else if (c.industry) {
        setIndustries([c.industry]);
      } else {
        setIndustries([]);
      }
      
      // Handle aliases
      setAliases(c.aliases || []);
      
      setDescription(c.description || "");
      setPhone(c.phone || "");
      setAddress(c.address || "");
      setCity(c.city || "");
      setCountry(c.country || "");
      setLinkedinUrl(c.linkedin_url || "");
      setWebsite(c.website || "");
      setNotes(c.notes || "");
      setIsActive(c.classification === "outbound"); // Map classification to is_active
      
      // Load activities for this company
      const compId = c.id || companyId;
      if (compId) {
        loadActivities(compId);
      }
      
    } catch (error) {
      console.error("Error loading company:", error);
      // If company not found, initialize with name
      if (companyName) {
        setName(companyName);
        setCompany({ name: companyName });
        setDomains([""]);
        setIndustries([]);
        setAliases([]);
        setIsActive(true);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, companyName]);

  useEffect(() => {
    if (open) {
      loadCompanyData();
      loadIndustries();
    } else {
      // Reset state when closing
      setCompany(null);
      setContacts([]);
      setCases([]);
      setSearches([]);
      setActivities([]);
      setActiveTab("info");
      setDomains([""]);
      setIndustries([]);
      setAliases([]);
    }
  }, [open, loadCompanyData]);

  // Save changes
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    
    setSaving(true);
    try {
      // Filter out empty domains
      const validDomains = domains.filter(d => d.trim());
      
      const updateData = {
        name: name.trim(),
        domains: validDomains.length > 0 ? validDomains : null,
        domain: validDomains.length > 0 ? validDomains[0] : null,  // Primary domain
        industries: industries.length > 0 ? industries : null,
        industry: industries.length > 0 ? industries[0] : null,  // Primary industry
        description: description.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        website: website.trim() || null,
        notes: notes.trim() || null,
        classification: isActive ? "outbound" : "inbound",
        aliases: aliases.length > 0 ? aliases : null,
      };
      
      // Determine the company ID to use
      const idToUse = companyId || company?.id;
      
      if (idToUse) {
        await api.patch(`/unified-companies/${idToUse}`, updateData);
        toast.success("Empresa actualizada");
      } else {
        // Create new company
        await api.post("/unified-companies", {
          name: name.trim(),
          domain: validDomains[0] || null,
          industry: industries[0] || null,
          classification: isActive ? "outbound" : "inbound"
        });
        toast.success("Empresa creada");
      }
      
      if (onSaved) onSaved();
      onOpenChange(false);
      
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Check if name looks like a numeric ID
  const isNumericName = name && /^\d+$/.test(name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-[#222] text-white max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            {company ? "Editar Empresa" : "Nueva Empresa"}
            {isNumericName && (
              <Badge className="bg-yellow-500/20 text-yellow-400 ml-2">
                <AlertTriangle className="w-3 h-3 mr-1" />
                ID Numérico
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-[#0a0a0a] border border-[#222] w-full justify-start">
                <TabsTrigger 
                  value="info" 
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-1"
                >
                  <Building2 className="w-4 h-4" />
                  Info
                </TabsTrigger>
                <TabsTrigger 
                  value="contacts"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white gap-1"
                >
                  <Users className="w-4 h-4" />
                  Contactos ({stats.total_contacts || contacts.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="cases"
                  className="data-[state=active]:bg-orange-600 data-[state=active]:text-white gap-1"
                >
                  <Briefcase className="w-4 h-4" />
                  Casos ({stats.total_cases || cases.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="aliases"
                  className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white gap-1"
                >
                  <Tag className="w-4 h-4" />
                  Alias ({aliases.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="searches"
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white gap-1"
                >
                  <Search className="w-4 h-4" />
                  Búsquedas ({searches.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="activity"
                  className="data-[state=active]:bg-amber-600 data-[state=active]:text-white gap-1"
                >
                  <History className="w-4 h-4" />
                  Actividad
                </TabsTrigger>
              </TabsList>

              {/* Info Tab */}
              <TabsContent value="info" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {/* Name - highlighted if numeric */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 flex items-center gap-2">
                        Nombre *
                        {isNumericName && (
                          <span className="text-yellow-400 text-xs">
                            (Este parece un ID de HubSpot - cámbialo por el nombre real)
                          </span>
                        )}
                      </label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre de la empresa"
                        disabled={!canEdit}
                        className={`bg-[#0a0a0a] border-[#333] ${isNumericName ? 'border-yellow-500/50 text-yellow-400' : ''} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    {/* Active Status Toggle */}
                    <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                      <div className="flex items-center gap-2">
                        <Power className={`w-4 h-4 ${isActive ? 'text-green-400' : 'text-slate-500'}`} />
                        <div>
                          <p className="text-sm text-white">
                            {isActive ? 'Outbound' : 'Inbound'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {isActive ? 'Empresa activa para prospección' : 'Empresa inactiva'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                        disabled={!canChangeClassification}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                    
                    {!canEdit && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-sm text-yellow-400 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Modo solo lectura - no tienes permisos para editar
                        </p>
                      </div>
                    )}

                    {/* Domains (multiple) */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Dominios
                      </label>
                      <div className="space-y-2">
                        {domains.map((domain, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={domain}
                              onChange={(e) => {
                                const newDomains = [...domains];
                                newDomains[idx] = e.target.value;
                                setDomains(newDomains);
                              }}
                              placeholder="ejemplo.com"
                              className="bg-[#0a0a0a] border-[#333] flex-1"
                            />
                            {domains.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDomains(domains.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDomains([...domains, ""])}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Agregar dominio
                        </Button>
                      </div>
                    </div>

                    {/* Industries (multiple with selector) */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Industrias</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {industries.map((ind, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-sm"
                          >
                            {industriesMap[ind] || ind}
                            <button
                              onClick={() => setIndustries(industries.filter((_, i) => i !== idx))}
                              className="hover:text-blue-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <Select
                        value={industryToAdd}
                        onValueChange={(value) => {
                          if (value && !industries.includes(value)) {
                            setIndustries((prev) => [...prev, value]);
                          }
                          setIndustryToAdd("");
                        }}
                      >
                        <SelectTrigger className="w-full bg-[#0a0a0a] border border-[#333] text-white">
                          <SelectValue placeholder="+ Agregar industria..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border-[#333] max-h-64">
                          {availableIndustries
                            .filter((ind) => !industries.includes(ind.value))
                            .map((ind) => (
                              <SelectItem key={ind.value} value={ind.value}>
                                {ind.label || ind.value}
                              </SelectItem>
                            ))}
                          {availableIndustries.filter((ind) => !industries.includes(ind.value)).length === 0 && (
                            <SelectItem value="__none__" disabled>
                              No hay más industrias disponibles
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Website & LinkedIn */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-slate-400 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Sitio Web
                        </label>
                        <Input
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          placeholder="https://www.ejemplo.com"
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-slate-400 flex items-center gap-1">
                          <Linkedin className="w-3 h-3" /> LinkedIn
                        </label>
                        <Input
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          placeholder="https://linkedin.com/company/..."
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Teléfono
                      </label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+52 55 1234 5678"
                        className="bg-[#0a0a0a] border-[#333]"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Dirección
                      </label>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle, número, colonia"
                        className="bg-[#0a0a0a] border-[#333]"
                      />
                    </div>

                    {/* City & Country */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-slate-400">Ciudad</label>
                        <Input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Ciudad de México"
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-slate-400">País</label>
                        <Input
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="México"
                          className="bg-[#0a0a0a] border-[#333]"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Descripción
                      </label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descripción de la empresa..."
                        rows={2}
                        className="bg-[#0a0a0a] border-[#333]"
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Notas internas</label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notas, comentarios..."
                        rows={2}
                        className="bg-[#0a0a0a] border-[#333]"
                      />
                    </div>

                    {/* Active/Inactive Toggle */}
                    <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                      <div className="flex items-center gap-2">
                        <Power className={`w-4 h-4 ${isActive ? 'text-green-400' : 'text-slate-500'}`} />
                        <div>
                          <p className="text-sm text-white">Estado de la empresa</p>
                          <p className="text-xs text-slate-500">
                            {isActive ? "Activa - Visible en búsquedas y reportes" : "Inactiva - Oculta en búsquedas"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </div>

                    {/* Stats Summary */}
                    {stats.total_contacts > 0 && (
                      <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                        <p className="text-xs text-slate-500 mb-2">Resumen</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(stats.contacts_by_stage || {}).map(([stage, count]) => (
                            <Badge key={stage} variant="outline" className="border-[#333]">
                              {STAGE_LABELS[stage] || `Stage ${stage}`}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="mt-4">
                {/* Search to add contacts */}
                <div className="mb-4 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Buscar contactos para asociar..."
                      className="pl-10 bg-[#0a0a0a] border-[#333]"
                    />
                    {searchingContacts && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
                    )}
                  </div>
                  {/* Search results */}
                  {contactSearchResults.length > 0 && (
                    <div className="bg-[#111] border border-[#333] rounded-lg max-h-48 overflow-y-auto">
                      {contactSearchResults.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => associateContact(contact)}
                          className="w-full p-2 text-left hover:bg-[#1a1a1a] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="text-sm text-white">{contact.name}</p>
                              <p className="text-xs text-slate-500">{contact.email || contact.company || "-"}</p>
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-green-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[350px]">
                  {contacts.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay contactos asociados</p>
                      <p className="text-xs mt-1">Usa el buscador arriba para agregar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((contact) => (
                        <div 
                          key={contact.id}
                          className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-[#333] group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{contact.name || "Sin nombre"}</p>
                                <p className="text-xs text-slate-500">{contact.job_title || "-"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                className="text-xs"
                                style={{
                                  backgroundColor: contact.stage === 4 || contact.stage === 5 
                                    ? 'rgba(34, 197, 94, 0.2)' 
                                    : 'rgba(100, 116, 139, 0.2)',
                                  color: contact.stage === 4 || contact.stage === 5 
                                    ? 'rgb(134, 239, 172)' 
                                    : 'rgb(148, 163, 184)'
                                }}
                              >
                                {STAGE_LABELS[contact.stage] || `Stage ${contact.stage}`}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => disassociateContact(contact.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 w-7 p-0"
                                title="Desasociar contacto"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
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
                          {contact.roles?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {contact.roles.map((role) => (
                                <Badge key={role} variant="outline" className="text-[10px] border-[#333]">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Cases Tab */}
              <TabsContent value="cases" className="mt-4">
                {/* Search to add cases */}
                <div className="mb-4 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      value={caseSearch}
                      onChange={(e) => setCaseSearch(e.target.value)}
                      placeholder="Buscar casos/proyectos para asociar..."
                      className="pl-10 bg-[#0a0a0a] border-[#333]"
                    />
                    {searchingCases && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
                    )}
                  </div>
                  {/* Search results */}
                  {caseSearchResults.length > 0 && (
                    <div className="bg-[#111] border border-[#333] rounded-lg max-h-48 overflow-y-auto">
                      {caseSearchResults.map((caseItem) => (
                        <button
                          key={caseItem.id}
                          onClick={() => associateCase(caseItem)}
                          className="w-full p-2 text-left hover:bg-[#1a1a1a] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="text-sm text-white">{caseItem.name}</p>
                              <p className="text-xs text-slate-500">{caseItem.stage || caseItem.status || "-"}</p>
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-green-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[350px]">
                  {cases.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay casos asociados</p>
                      <p className="text-xs mt-1">Usa el buscador arriba para agregar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cases.map((c) => (
                        <div 
                          key={c.id}
                          className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-[#333] group"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-white font-medium text-sm">{c.name}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {c.delivery_stage ? `Delivery: ${c.delivery_stage}` : c.stage || "Sin etapa"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <Badge 
                                  className={`text-xs ${
                                    c.status === 'active' 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : 'bg-red-500/20 text-red-400'
                                  }`}
                                >
                                  {c.status || "activo"}
                                </Badge>
                                {c.amount && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    ${c.amount.toLocaleString()}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => disassociateCase(c.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 w-7 p-0"
                                title="Desasociar caso"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Aliases Tab */}
              <TabsContent value="aliases" className="mt-4">
                <div className="space-y-4">
                  {/* Current aliases */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">Alias actuales</label>
                    <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                      {aliases.length === 0 ? (
                        <span className="text-slate-500 text-sm">Sin alias configurados</span>
                      ) : (
                        aliases.map((alias, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded text-sm"
                          >
                            {alias}
                            <button
                              onClick={() => setAliases(aliases.filter((_, i) => i !== idx))}
                              className="hover:text-cyan-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add new alias */}
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">Agregar alias</label>
                    <div className="flex gap-2">
                      <Input
                        value={newAlias}
                        onChange={(e) => setNewAlias(e.target.value)}
                        placeholder="Nombre alternativo de la empresa..."
                        className="bg-[#0a0a0a] border-[#333] flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && addAlias()}
                      />
                      <Button
                        onClick={addAlias}
                        disabled={!newAlias.trim()}
                        className="bg-cyan-600 hover:bg-cyan-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Los alias permiten encontrar esta empresa con otros nombres (ej: siglas, nombres anteriores)
                    </p>
                  </div>

                  {/* Merge with another company */}
                  <div className="space-y-2 pt-4 border-t border-[#222]">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <Merge className="w-4 h-4" />
                      Combinar con otra empresa
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      Al combinar, la otra empresa se convertirá en alias de esta y sus contactos/casos serán migrados.
                    </p>
                    
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        value={companyMergeSearch}
                        onChange={(e) => setCompanyMergeSearch(e.target.value)}
                        placeholder="Buscar empresa para combinar..."
                        className="pl-10 bg-[#0a0a0a] border-[#333]"
                      />
                      {searchingCompanies && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
                      )}
                    </div>

                    {/* Company search results */}
                    {companyMergeResults.length > 0 && (
                      <div className="bg-[#111] border border-[#333] rounded-lg max-h-48 overflow-y-auto">
                        {companyMergeResults.map((comp) => (
                          <button
                            key={comp.id || comp.hubspot_id}
                            onClick={() => selectCompanyToMerge(comp)}
                            className="w-full p-2 text-left hover:bg-[#1a1a1a] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-500" />
                              <div>
                                <p className="text-sm text-white">{comp.name}</p>
                                <p className="text-xs text-slate-500">{comp.domain || comp.industry || "-"}</p>
                              </div>
                            </div>
                            <Merge className="w-4 h-4 text-cyan-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Merge confirmation dialog */}
                  {showMergeConfirm && companyToMerge && (
                    <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-yellow-400 font-medium">Estás a punto de combinar dos empresas</h4>
                          <p className="text-sm text-slate-400 mt-1">
                            <strong className="text-white">{companyToMerge.name}</strong> se combinará con <strong className="text-white">{name}</strong>.
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            • "{companyToMerge.name}" se convertirá en alias<br/>
                            • Sus contactos y casos serán migrados<br/>
                            • Sus dominios e industrias serán agregados<br/>
                            • Esta acción no se puede deshacer
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Button
                              onClick={executeMerge}
                              disabled={merging}
                              className="bg-yellow-600 hover:bg-yellow-700"
                            >
                              {merging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Merge className="w-4 h-4 mr-2" />}
                              Seguir
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowMergeConfirm(false);
                                setCompanyToMerge(null);
                              }}
                              className="border-[#333]"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Searches Tab */}
              <TabsContent value="searches" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {searches.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay búsquedas de LinkedIn configuradas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searches.map((search) => (
                        <div 
                          key={search.id}
                          className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-[#333]"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium text-sm">{search.keyword}</p>
                              {search.last_prospected_at && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Última: {new Date(search.last_prospected_at).toLocaleDateString('es-MX')}
                                  {search.last_prospected_by && ` (${search.last_prospected_by})`}
                                </p>
                              )}
                            </div>
                            <a
                              href={search.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  {loadingActivities ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>No hay actividad registrada</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((activity, idx) => (
                        <div
                          key={activity.id || idx}
                          className="p-3 rounded-lg border border-[#222] bg-[#0a0a0a]"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {/* Activity icon based on type */}
                              <div className={`p-2 rounded-lg ${
                                activity.type === "classification_change" ? "bg-green-500/20" :
                                activity.type === "propagation" ? "bg-cyan-500/20" :
                                activity.type === "company_merge" ? "bg-purple-500/20" :
                                activity.type === "case_associated" ? "bg-orange-500/20" :
                                activity.type === "case_stage_change" ? "bg-blue-500/20" :
                                activity.type === "company_create" ? "bg-emerald-500/20" :
                                "bg-slate-500/20"
                              }`}>
                                {activity.type === "classification_change" ? (
                                  <ArrowRightLeft className="w-4 h-4 text-green-400" />
                                ) : activity.type === "propagation" ? (
                                  <Users className="w-4 h-4 text-cyan-400" />
                                ) : activity.type === "company_merge" ? (
                                  <Merge className="w-4 h-4 text-purple-400" />
                                ) : activity.type === "case_associated" ? (
                                  <Briefcase className="w-4 h-4 text-orange-400" />
                                ) : activity.type === "case_stage_change" ? (
                                  <Briefcase className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <History className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              
                              <div>
                                {/* Activity description */}
                                <p className="text-white text-sm">
                                  {activity.type === "classification_change" && (
                                    <>
                                      Clasificación cambiada de{" "}
                                      <Badge variant="outline" className="text-xs mx-1">
                                        {activity.before?.classification || "inbound"}
                                      </Badge>
                                      a{" "}
                                      <Badge variant="outline" className={`text-xs mx-1 ${
                                        activity.after?.classification === "outbound" 
                                          ? "text-green-400 border-green-500/30" 
                                          : ""
                                      }`}>
                                        {activity.after?.classification || "outbound"}
                                      </Badge>
                                    </>
                                  )}
                                  {activity.type === "propagation" && (
                                    <>
                                      Clasificación propagada a{" "}
                                      <span className="text-cyan-400 font-medium">
                                        {activity.affected_count || 0} contactos
                                      </span>
                                    </>
                                  )}
                                  {activity.type === "company_merge" && (
                                    <>Empresa fusionada</>
                                  )}
                                  {activity.type === "company_create" && (
                                    <>Empresa creada</>
                                  )}
                                  {activity.type === "case_associated" && (
                                    <>
                                      Caso asociado:{" "}
                                      <span className="text-orange-400 font-medium">
                                        {activity.details?.case_name}
                                      </span>
                                    </>
                                  )}
                                  {activity.type === "case_stage_change" && (
                                    <>
                                      Caso {activity.details?.case_name} movido de Stage{" "}
                                      {activity.details?.from_stage} a Stage {activity.details?.to_stage}
                                    </>
                                  )}
                                </p>
                                
                                {/* Metadata */}
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span className="text-xs text-slate-500">
                                    {activity.timestamp 
                                      ? new Date(activity.timestamp).toLocaleString('es-MX')
                                      : "Fecha desconocida"
                                    }
                                  </span>
                                  {activity.user_email && (
                                    <>
                                      <span className="text-slate-600">•</span>
                                      <span className="text-xs text-slate-500">
                                        {activity.user_email}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <Separator className="bg-[#222]" />

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-[#333]"
              >
                {canEdit ? 'Cancelar' : 'Cerrar'}
              </Button>
              {canEdit && (
                <Button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CompanyEditorDialog;
