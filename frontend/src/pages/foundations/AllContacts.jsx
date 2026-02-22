import { useState, useEffect, useCallback } from "react";
import { 
  Database, Users, Search, Filter, Download, Plus, Edit, Trash2,
  Phone, Mail, Linkedin, Building2, ChevronDown, ChevronUp,
  X, Check, Loader2, UserPlus, FileSpreadsheet,
  GraduationCap, Briefcase, ArrowRight, GitMerge, CheckSquare, Square,
  BarChart3, PieChart, TrendingUp, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import api from "../../lib/api";
import ImportWizard from "./ImportWizard";
import ContactSheet from "../../components/ContactSheet";
import MoveToStageDialog from "../../components/MoveToStageDialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';

const STAGE_NAMES = {
  1: "Prospect",
  2: "Nurture",
  3: "Close",
  4: "Deliver",
  5: "Repurchase"
};

const STAGE_COLORS = {
  1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  2: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  3: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  4: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  5: "bg-pink-500/20 text-pink-400 border-pink-500/30"
};

const CHART_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

const ROLE_COLORS = {
  deal_maker: "bg-emerald-500/20 text-emerald-400",
  influencer: "bg-purple-500/20 text-purple-400",
  student: "bg-blue-500/20 text-blue-400",
  advisor: "bg-amber-500/20 text-amber-400"
};

const SALUTATION_OPTIONS = ["_none", "Dr.", "Dra.", "Lic.", "Ing.", "Mtro.", "Mtra.", "Sr.", "Sra."];
const ROLE_OPTIONS = ["deal_maker", "influencer", "student", "advisor"];

const TABS_CONFIG = [
  { id: "all", label: "Todos", stage: null, role: null, icon: Database },
  { id: "stage1", label: "Stage 1", stage: 1, role: null, icon: Users },
  { id: "stage2", label: "Stage 2", stage: 2, role: null, icon: Users },
  { id: "stage3", label: "Stage 3", stage: 3, role: null, icon: Users },
  { id: "stage4_dm", label: "Stage 4 (Deal Makers)", stage: 4, role: "deal_maker", icon: Briefcase },
  { id: "stage4_st", label: "Stage 4 (Students)", stage: 4, role: "student", icon: GraduationCap },
  { id: "stage5_dm", label: "Stage 5 (Deal Makers)", stage: 5, role: "deal_maker", icon: Briefcase },
  { id: "stage5_st", label: "Stage 5 (Students)", stage: 5, role: "student", icon: GraduationCap },
];

export default function AllContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [sources, setSources] = useState([]);
  const [pagination, setPagination] = useState({ skip: 0, limit: 50, total: 0 });
  const [tabCounts, setTabCounts] = useState({});
  const [dashboardStats, setDashboardStats] = useState(null);
  
  const [filters, setFilters] = useState({ buyer_persona: "", source: "", companies: [] });
  
  // Companies for filter
  const [companies, setCompanies] = useState([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  
  const [editDialog, setEditDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [viewingContact, setViewingContact] = useState(null);
  
  // Move stage dialog
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [contactToMove, setContactToMove] = useState(null);
  const [moveTargetStage, setMoveTargetStage] = useState(2);
  
  // Bulk actions
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkTargetStage, setBulkTargetStage] = useState("1");
  const [bulkMoving, setBulkMoving] = useState(false);
  
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  const currentTabConfig = TABS_CONFIG.find(t => t.id === activeTab) || TABS_CONFIG[0];

  useEffect(() => {
    loadTabCounts();
    loadBuyerPersonas();
    loadSources();
    loadCompanies();
    loadDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadContacts();
    setSelectedContacts([]);
    setSelectMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pagination.skip]);

  // Close company dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (companyDropdownOpen && !e.target.closest('.company-dropdown-container')) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [companyDropdownOpen]);

  const loadDashboardStats = async () => {
    try {
      const res = await api.get("/contacts/stats");
      setDashboardStats(res.data);
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  };

  const loadTabCounts = async () => {
    try {
      const counts = {};
      const allRes = await api.get("/contacts?limit=1");
      counts.all = allRes.data.total || 0;
      
      for (let s = 1; s <= 5; s++) {
        const res = await api.get(`/contacts?stage=${s}&limit=1`);
        counts[`stage${s}`] = res.data.total || 0;
      }
      
      for (const stage of [4, 5]) {
        const dmRes = await api.get(`/contacts?stage=${stage}&role=deal_maker&limit=1`);
        counts[`stage${stage}_dm`] = dmRes.data.total || 0;
        const stRes = await api.get(`/contacts?stage=${stage}&role=student&limit=1`);
        counts[`stage${stage}_st`] = stRes.data.total || 0;
      }
      
      setTabCounts(counts);
    } catch (error) {
      console.error("Error loading tab counts:", error);
    }
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", pagination.limit);
      params.append("skip", pagination.skip);
      
      if (currentTabConfig.stage !== null) params.append("stage", currentTabConfig.stage);
      if (currentTabConfig.role) params.append("role", currentTabConfig.role);
      if (searchQuery) params.append("search", searchQuery);
      if (filters.buyer_persona) params.append("buyer_persona", filters.buyer_persona);
      if (filters.source) params.append("source", filters.source);
      if (filters.companies && filters.companies.length > 0) {
        params.append("companies", filters.companies.join(","));
      }
      
      const response = await api.get(`/contacts?${params.toString()}`);
      setContacts(response.data.contacts || response.data || []);
      setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Error cargando contactos");
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async (search = "") => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}&limit=100` : "?limit=100";
      const response = await api.get(`/contacts/companies${params}`);
      setCompanies(response.data.companies || []);
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  // Debounced company search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadCompanies(companySearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [companySearch]);

  const loadSources = async () => {
    try {
      const response = await api.get("/contacts/sources");
      setSources(response.data.sources || []);
    } catch (error) {
      console.error("Error loading sources:", error);
    }
  };

  const loadBuyerPersonas = async () => {
    try {
      const response = await api.get("/buyer-personas-db/");
      setBuyerPersonas(response.data || []);
    } catch (error) {
      console.error("Error loading buyer personas:", error);
    }
  };

  const formatSourceName = (source) => {
    if (!source) return "Sin fuente";
    const sourceMap = {
      'HubSpot Import': 'HubSpot',
      'deal_makers_by_post': 'LinkedIn - Post',
      'molecules_deal_makers': 'LinkedIn - Molecules',
      'linkedin_position': 'LinkedIn - Position',
      'import': 'CSV Import',
      'manual': 'Manual',
      'google_maps': 'Google Maps'
    };
    return sourceMap[source] || source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleSearch = useCallback(() => {
    setPagination(prev => ({ ...prev, skip: 0 }));
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filters]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setPagination(prev => ({ ...prev, skip: 0 }));
    setSearchQuery("");
    setFilters({ buyer_persona: "", source: "", companies: [] });
    setCompanySearch("");
  };

  const openEditDialog = (contact = null) => {
    if (contact) {
      // Edit existing - use ContactSheet
      setViewingContact(contact);
      setContactSheetOpen(true);
    } else {
      // Create new contact - use ContactSheet in create mode
      setViewingContact(null);
      setContactSheetOpen(true);
    }
  };

  const handleContactCreated = async (contactData) => {
    try {
      // Make API call to create the contact
      await api.post("/contacts/", contactData);
      toast.success("Contacto creado");
      
      setContactSheetOpen(false);
      setViewingContact(null);
      loadContacts();
      loadTabCounts();
      loadDashboardStats();
      loadCompanies(companySearch); // Refresh companies list
    } catch (error) {
      console.error("Error creating contact:", error);
      toast.error(error.response?.data?.detail || "Error creando contacto");
      throw error; // Re-throw so ContactSheet knows creation failed
    }
  };

  const handleContactUpdated = async () => {
    setContactSheetOpen(false);
    setViewingContact(null);
    loadContacts();
    loadTabCounts();
    loadDashboardStats();
  };

  const saveContact = async () => {
    setSaving(true);
    try {
      // Extract only the fields that should be sent to the backend
      const data = {
        salutation: editingContact.salutation,
        first_name: editingContact.first_name,
        last_name: editingContact.last_name,
        email: editingContact.emails?.find(e => e.is_primary)?.email || editingContact.emails?.[0]?.email || editingContact.email || "",
        phone: editingContact.phones?.find(p => p.is_primary)?.e164 || editingContact.phones?.[0]?.raw_input || editingContact.phone || "",
        emails: editingContact.emails,
        phones: editingContact.phones,
        linkedin_url: editingContact.linkedin_url,
        stage: editingContact.stage,
        company: editingContact.company,
        companies: editingContact.companies,
        job_title: editingContact.job_title,
        buyer_persona: editingContact.buyer_persona,
        contact_types: editingContact.roles || editingContact.contact_types || [],
        roles: editingContact.roles || editingContact.contact_types || [],
        status: editingContact.status,
        location: editingContact.location,
        country: editingContact.country,
        notes: editingContact.notes,
        specialty: editingContact.specialty,
      };
      
      // Remove undefined/null values to avoid overwriting with null
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== null)
      );
      
      if (editingContact.id) {
        await api.put(`/contacts/${editingContact.id}`, cleanData);
        toast.success("Contacto actualizado");
      } else {
        await api.post("/contacts/", cleanData);
        toast.success("Contacto creado");
      }
      
      setEditDialog(false);
      loadContacts();
      loadTabCounts();
      loadDashboardStats();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error(error.response?.data?.detail || "Error guardando contacto");
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contactId) => {
    if (!window.confirm("¿Eliminar este contacto?")) return;
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success("Contacto eliminado");
      loadContacts();
      loadTabCounts();
      loadDashboardStats();
    } catch (error) {
      toast.error("Error eliminando contacto");
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!selectedContacts.length) return;
    if (!window.confirm(`¿Eliminar ${selectedContacts.length} contactos?`)) return;
    
    try {
      await api.delete("/contacts/bulk", { data: { contact_ids: selectedContacts } });
      toast.success(`${selectedContacts.length} contactos eliminados`);
      setSelectedContacts([]);
      setSelectMode(false);
      loadContacts();
      loadTabCounts();
      loadDashboardStats();
    } catch (error) {
      toast.error("Error eliminando contactos");
    }
  };

  const handleBulkMove = async () => {
    if (!selectedContacts.length || !bulkTargetStage) return;
    setBulkMoving(true);
    
    try {
      let successCount = 0;
      for (const contactId of selectedContacts) {
        try {
          await api.put(`/contacts/${contactId}/stage?stage=${bulkTargetStage}`);
          successCount++;
        } catch (e) {
          console.error(`Error moving contact ${contactId}:`, e);
        }
      }
      
      toast.success(`${successCount} contactos movidos a ${STAGE_NAMES[bulkTargetStage]}`);
      setBulkMoveDialogOpen(false);
      setSelectedContacts([]);
      setSelectMode(false);
      loadContacts();
      loadTabCounts();
      loadDashboardStats();
    } catch (error) {
      toast.error("Error moviendo contactos");
    } finally {
      setBulkMoving(false);
    }
  };

  const toggleContactSelection = (contactId) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const selectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  const openContactSheet = (contact) => {
    setViewingContact(contact);
    setContactSheetOpen(true);
  };

  const handleMoveStage = (contact) => {
    setContactToMove(contact);
    // Set default target stage to next stage (if not at max)
    const nextStage = Math.min((contact.stage || 1) + 1, 5);
    setMoveTargetStage(nextStage);
    setMoveDialogOpen(true);
  };

  const onStageMoved = () => {
    loadContacts();
    loadTabCounts();
    loadDashboardStats();
    setMoveDialogOpen(false);
    setContactToMove(null);
  };

  // Email/Phone field management
  const addEmailField = () => setEditingContact(prev => ({ ...prev, emails: [...(prev.emails || []), { email: "", is_primary: false }] }));
  const removeEmailField = (index) => setEditingContact(prev => ({ ...prev, emails: prev.emails.filter((_, i) => i !== index) }));
  const updateEmailField = (index, value) => setEditingContact(prev => ({ ...prev, emails: prev.emails.map((e, i) => i === index ? { ...e, email: value } : e) }));
  const setPrimaryEmail = (index) => setEditingContact(prev => ({ ...prev, emails: prev.emails.map((e, i) => ({ ...e, is_primary: i === index })) }));
  
  const addPhoneField = () => setEditingContact(prev => ({ ...prev, phones: [...(prev.phones || []), { raw_input: "", country_code: "+52", is_primary: false, is_valid: true }] }));
  const removePhoneField = (index) => setEditingContact(prev => ({ ...prev, phones: prev.phones.filter((_, i) => i !== index) }));
  const updatePhoneField = (index, value) => setEditingContact(prev => ({ ...prev, phones: prev.phones.map((p, i) => i === index ? { ...p, raw_input: value, e164: value } : p) }));
  const setPrimaryPhone = (index) => setEditingContact(prev => ({ ...prev, phones: prev.phones.map((p, i) => ({ ...p, is_primary: i === index })) }));
  
  const toggleRole = (role) => setEditingContact(prev => ({ ...prev, roles: prev.roles?.includes(role) ? prev.roles.filter(r => r !== role) : [...(prev.roles || []), role] }));

  const getPrimaryEmail = (contact) => contact.emails?.find(e => e.is_primary)?.email || contact.emails?.[0]?.email || contact.email || "";
  const getPrimaryPhone = (contact) => contact.phones?.find(p => p.is_primary)?.e164 || contact.phones?.[0]?.raw_input || contact.phone || "";
  const getDisplayName = (contact) => contact.name || [contact.salutation, contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Sin nombre";

  const exportContacts = () => {
    const headers = [
      "Tratamiento", "Nombre", "Apellido", "Nombre Completo",
      "Email Principal", "Emails Adicionales", 
      "Teléfono Principal", "Teléfonos Adicionales",
      "LinkedIn", "Empresa Principal", "Otras Empresas", "Cargo", 
      "Location", "Country",
      "Buyer Persona", "Stage", "Roles", 
      "Source", "Created", "Notes"
    ];
    
    const rows = contacts.map(c => {
      const allEmails = c.emails?.map(e => e.email).filter(Boolean) || [c.email].filter(Boolean);
      const allPhones = c.phones?.map(p => p.e164 || p.raw_input).filter(Boolean) || [c.phone].filter(Boolean);
      
      // Get companies - primary first, then others
      const allCompanies = c.companies || [];
      const primaryCompany = allCompanies.find(co => co.is_primary)?.company_name || c.company || "";
      const otherCompanies = allCompanies.filter(co => !co.is_primary).map(co => co.company_name).join("; ");
      
      return [
        c.salutation || c.title || "",
        c.first_name || "",
        c.last_name || "",
        getDisplayName(c),
        getPrimaryEmail(c),
        allEmails.slice(1).join("; "),
        getPrimaryPhone(c),
        allPhones.slice(1).join("; "),
        c.linkedin_url || "",
        primaryCompany,
        otherCompanies,
        c.job_title || "",
        c.location || "",
        c.country || "",
        c.buyer_persona || "",
        STAGE_NAMES[c.stage] || "",
        (c.roles || c.contact_types || []).join("; "),
        c.source || "",
        c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
        (c.notes || "").replace(/[\n\r]+/g, " ")
      ];
    });
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${contacts.length} contactos exportados`);
  };

  // Dashboard data preparation
  const stageChartData = dashboardStats ? Object.entries(dashboardStats.by_stage || {}).map(([stage, count]) => ({
    name: STAGE_NAMES[parseInt(stage)] || `Stage ${stage}`,
    value: count,
    fill: CHART_COLORS[parseInt(stage) - 1]
  })) : [];

  const personaChartData = dashboardStats ? Object.entries(dashboardStats.by_persona || {}).slice(0, 8).map(([persona, count], i) => ({
    name: persona.charAt(0).toUpperCase() + persona.slice(1),
    value: count,
    fill: CHART_COLORS[i % CHART_COLORS.length]
  })) : [];

  return (
    <div className="space-y-6" data-testid="all-contacts-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-[#ff3300]" />
            Todos los Contactos
          </h1>
          <p className="text-slate-400 mt-1">
            Centro unificado de contactos • {tabCounts.all || 0} contactos totales
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showDashboard ? "default" : "outline"} 
            onClick={() => setShowDashboard(!showDashboard)}
            className={showDashboard ? "bg-[#ff3300] hover:bg-[#cc2900]" : ""}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button variant="outline" onClick={() => setImportWizardOpen(true)} data-testid="import-csv-btn">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Button variant="outline" onClick={exportContacts} data-testid="export-btn">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button className="btn-accent" onClick={() => openEditDialog()} data-testid="add-contact-btn">
            <UserPlus className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Collapsible Dashboard */}
      {showDashboard && dashboardStats && (
        <Card className="stat-card animate-in slide-in-from-top duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ff3300]" />
              Dashboard de Métricas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400">Total Contactos</p>
                <p className="text-2xl font-bold text-white">{dashboardStats.total?.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400">Nuevos Este Mes</p>
                <p className="text-2xl font-bold text-emerald-400">{dashboardStats.new_this_month?.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400">Con Email</p>
                <p className="text-2xl font-bold text-blue-400">
                  {Math.round((dashboardStats.by_status?.new || 0) / (dashboardStats.total || 1) * 100)}%
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <p className="text-sm text-slate-400">Buyer Personas</p>
                <p className="text-2xl font-bold text-purple-400">{Object.keys(dashboardStats.by_persona || {}).length}</p>
              </div>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
              {/* Stage Bar Chart */}
              <div className="bg-slate-800/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Contactos por Stage
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stageChartData}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {stageChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Persona Pie Chart */}
              <div className="bg-slate-800/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4" /> Distribución por Buyer Persona
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPie>
                    <Pie
                      data={personaChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {personaChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full flex flex-wrap justify-start bg-slate-800/50 p-1 rounded-lg gap-1">
          {TABS_CONFIG.map(tab => {
            const TabIcon = tab.icon;
            const count = tabCounts[tab.id] || 0;
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="data-[state=active]:bg-[#ff3300] data-[state=active]:text-white flex items-center gap-2 px-3 py-2"
                data-testid={`tab-${tab.id}`}
              >
                <TabIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Search and Filters */}
        <Card className="stat-card mt-4">
          <CardContent className="pt-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-slate-400 text-sm">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Buscar por nombre, email, teléfono, empresa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
              </Button>
              <Button onClick={handleSearch} data-testid="search-btn">
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-700">
                <div>
                  <Label className="text-slate-400 text-sm">Buyer Persona</Label>
                  <Select value={filters.buyer_persona || "_all"} onValueChange={(v) => setFilters(prev => ({ ...prev, buyer_persona: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todas</SelectItem>
                      {buyerPersonas.map(p => (
                        <SelectItem key={p.id || p.key} value={p.key || p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Fuente</Label>
                  <Select value={filters.source || "_all"} onValueChange={(v) => setFilters(prev => ({ ...prev, source: v === "_all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todas</SelectItem>
                      {sources.map(source => (
                        <SelectItem key={source} value={source}>{formatSourceName(source)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative company-dropdown-container">
                  <Label className="text-slate-400 text-sm">Empresa</Label>
                  <div 
                    className="mt-1 flex items-center gap-1 flex-wrap min-h-[40px] p-2 bg-[#0a0a0a] border border-[#333] rounded-md cursor-pointer"
                    onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                  >
                    {filters.companies.length === 0 ? (
                      <span className="text-slate-500 text-sm">Todas las empresas...</span>
                    ) : (
                      filters.companies.map(comp => (
                        <Badge 
                          key={comp} 
                          className="bg-purple-500/20 text-purple-400 text-xs cursor-pointer hover:bg-purple-500/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilters(prev => ({
                              ...prev,
                              companies: prev.companies.filter(c => c !== comp)
                            }));
                          }}
                        >
                          {comp} <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))
                    )}
                  </div>
                  {companyDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg">
                      <div className="p-2 border-b border-[#333]">
                        <Input
                          placeholder="Buscar empresa..."
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          className="bg-[#0a0a0a] border-[#333] h-8"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {companies.length > 0 ? companies.map(company => {
                            const isSelected = filters.companies.includes(company);
                            return (
                              <div
                                key={company}
                                className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-[#222] ${isSelected ? 'bg-purple-500/10' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilters(prev => ({
                                    ...prev,
                                    companies: isSelected 
                                      ? prev.companies.filter(c => c !== company)
                                      : [...prev.companies, company]
                                  }));
                                }}
                              >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-[#444]'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm text-white truncate">{company}</span>
                              </div>
                            );
                          }) : (
                          <div className="px-3 py-4 text-center text-slate-500 text-sm">
                            No se encontraron empresas
                          </div>
                        )}
                      </div>
                      {filters.companies.length > 0 && (
                        <div className="p-2 border-t border-[#333]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-slate-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters(prev => ({ ...prev, companies: [] }));
                              setCompanyDropdownOpen(false);
                            }}
                          >
                            Limpiar selección
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    variant={selectMode ? "default" : "outline"} 
                    size="sm"
                    onClick={() => {
                      setSelectMode(!selectMode);
                      if (selectMode) setSelectedContacts([]);
                    }}
                    className={selectMode ? "bg-purple-600 hover:bg-purple-700" : ""}
                  >
                    <GitMerge className="w-4 h-4 mr-2" />
                    {selectMode ? `Seleccionados: ${selectedContacts.length}` : "Selección Múltiple"}
                  </Button>
                  {selectMode && selectedContacts.length > 0 && (
                    <>
                      <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setBulkMoveDialogOpen(true)}>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Mover ({selectedContacts.length})
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <TabsContent value={activeTab} className="mt-4">
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  {(() => { const TabIcon = currentTabConfig.icon; return <TabIcon className="w-5 h-5 text-[#ff3300]" />; })()}
                  {currentTabConfig.label}
                </CardTitle>
                <Badge variant="outline" className="border-[#ff3300]/30 text-[#ff3300]">{pagination.total} contactos</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[#ff3300]" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-20">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white">No hay contactos</h3>
                  <p className="text-slate-400">Intenta ajustar tu búsqueda o filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        {selectMode && (
                          <th className="px-4 py-3 w-10">
                            <Button variant="ghost" size="sm" onClick={selectAll}>
                              {selectedContacts.length === contacts.length ? <CheckSquare className="w-4 h-4 text-[#ff3300]" /> : <Square className="w-4 h-4" />}
                            </Button>
                          </th>
                        )}
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Nombre</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Email</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Teléfono</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Empresa</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Persona</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Stage</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Roles</th>
                        <th className="px-4 py-3 text-sm font-medium text-slate-400">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map(contact => (
                        <tr 
                          key={contact.id} 
                          className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                          onClick={() => openContactSheet(contact)}
                          data-testid={`contact-row-${contact.id}`}
                        >
                          {selectMode && (
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" onClick={() => toggleContactSelection(contact.id)}>
                                {selectedContacts.includes(contact.id) ? <CheckSquare className="w-4 h-4 text-[#ff3300]" /> : <Square className="w-4 h-4" />}
                              </Button>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#ff3300]/20 flex items-center justify-center text-[#ff3300] font-medium text-sm">
                                {(contact.first_name || contact.name || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-white">{getDisplayName(contact)}</p>
                                {contact.job_title && <p className="text-xs text-slate-500">{contact.job_title}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {getPrimaryEmail(contact) ? (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span className="text-sm text-slate-300">{getPrimaryEmail(contact)}</span>
                              </div>
                            ) : <span className="text-slate-600 text-sm">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {getPrimaryPhone(contact) ? (
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span className="text-sm text-slate-300">{getPrimaryPhone(contact)}</span>
                              </div>
                            ) : <span className="text-slate-600 text-sm">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {(contact.companies?.length > 0) ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                <div className="flex flex-wrap gap-1">
                                  {contact.companies.map((c, idx) => (
                                    <span key={idx} className={`text-sm ${c.is_primary ? 'text-white font-medium' : 'text-slate-400'}`}>
                                      {c.company_name}{idx < contact.companies.length - 1 ? ',' : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : contact.company ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                <span className="text-sm text-slate-300">{contact.company}</span>
                              </div>
                            ) : <span className="text-slate-600 text-sm">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {contact.buyer_persona ? (
                              <Badge className="bg-slate-700 text-slate-300 capitalize">{contact.buyer_persona}</Badge>
                            ) : <span className="text-slate-600 text-sm">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={STAGE_COLORS[contact.stage] || STAGE_COLORS[1]}>
                              {STAGE_NAMES[contact.stage] || "Prospect"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {(contact.roles || contact.contact_types || []).map(role => (
                                <Badge key={role} className={`${ROLE_COLORS[role]} text-xs capitalize`}>{role.replace("_", " ")}</Badge>
                              ))}
                              {!(contact.roles?.length || contact.contact_types?.length) && <span className="text-slate-600 text-sm">-</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openContactSheet(contact)} data-testid={`edit-contact-${contact.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleMoveStage(contact)} title="Mover de Stage">
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteContact(contact.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {contacts.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Mostrando {pagination.skip + 1} - {Math.min(pagination.skip + pagination.limit, pagination.total)} de {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={pagination.skip === 0} onClick={() => setPagination(prev => ({ ...prev, skip: Math.max(0, prev.skip - prev.limit) }))}>
              Anterior
            </Button>
            <Button variant="outline" disabled={pagination.skip + pagination.limit >= pagination.total} onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }))}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover {selectedContacts.length} contactos</DialogTitle>
            <DialogDescription>Selecciona el stage destino para mover los contactos seleccionados.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Stage Destino</Label>
            <Select value={bulkTargetStage} onValueChange={setBulkTargetStage}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_NAMES).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkMove} disabled={bulkMoving} className="bg-blue-600 hover:bg-blue-700">
              {bulkMoving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mover Contactos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactSheet 
        contact={viewingContact} 
        open={contactSheetOpen} 
        onOpenChange={setContactSheetOpen} 
        onUpdate={handleContactUpdated}
        onCreate={handleContactCreated}
        createMode={!viewingContact}
        defaultValues={{ stage: currentTabConfig.stage || 1, buyer_persona: "mateo" }}
      />
      <MoveToStageDialog contact={contactToMove} open={moveDialogOpen} onOpenChange={setMoveDialogOpen} onSuccess={onStageMoved} targetStage={moveTargetStage} />
      <ImportWizard open={importWizardOpen} onOpenChange={setImportWizardOpen} onImportComplete={() => { loadContacts(); loadTabCounts(); loadDashboardStats(); toast.success("Contactos actualizados"); }} />
    </div>
  );
}
