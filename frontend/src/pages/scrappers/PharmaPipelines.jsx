import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Checkbox } from "../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import api from "../../lib/api";
import ApifyStatusAlert from "../../components/ApifyStatusAlert";
import {
  Play,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Building2,
  Activity,
  Loader2,
  Calendar,
  FileText,
  Pill,
  Filter,
  X,
  Plus,
  Trash2,
  Edit2,
  Database,
  Beaker,
  Settings,
  Link,
  FlaskConical,
  Search,
  AlertCircle,
  Users
} from "lucide-react";

// Days of the week
const DAYS = [
  { id: 0, name: "Sunday", short: "Sun" },
  { id: 1, name: "Monday", short: "Mon" },
  { id: 2, name: "Tuesday", short: "Tue" },
  { id: 3, name: "Wednesday", short: "Wed" },
  { id: 4, name: "Thursday", short: "Thu" },
  { id: 5, name: "Friday", short: "Fri" },
  { id: 6, name: "Saturday", short: "Sat" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`
}));

export default function PharmaPipelines() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("companies");
  
  // Medications state
  const [medications, setMedications] = useState([]);
  const [medicationFilters, setMedicationFilters] = useState({
    empresa: "",
    area_terapeutica: "",
    fase: ""
  });
  const [filterOptions, setFilterOptions] = useState({
    empresas: [],
    areas_terapeuticas: [],
    fases: []
  });
  
  // Companies state
  const [companies, setCompanies] = useState([]);
  const [companyStats, setCompanyStats] = useState({});
  const [companyFilter, setCompanyFilter] = useState("all"); // all, with_research, without_research, with_url, without_url
  const [companySearch, setCompanySearch] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [newCompany, setNewCompany] = useState({ 
    name: "", 
    domain: "", 
    pipeline_url: "", 
    has_research: true,
    notes: "" 
  });
  
  // Therapeutic Areas state
  const [therapeuticAreas, setTherapeuticAreas] = useState([]);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newArea, setNewArea] = useState({ code: "", name: "", description: "" });
  
  // Scrapper state
  const [runs, setRuns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState({ enabled: false, days: [1, 3, 5], hour: 9 });
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadMedications();
  }, [medicationFilters]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMedications(),
        loadCompanies(),
        loadTherapeuticAreas(),
        loadRunsAndLogs(),
        loadStats()
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const loadMedications = async () => {
    try {
      const params = new URLSearchParams();
      if (medicationFilters.empresa) params.append("empresa", medicationFilters.empresa);
      if (medicationFilters.area_terapeutica) params.append("area_terapeutica", medicationFilters.area_terapeutica);
      if (medicationFilters.fase) params.append("fase", medicationFilters.fase);
      
      const res = await api.get(`/scrappers/pharma/medications?${params.toString()}`);
      setMedications(res.data.medications || []);
      setFilterOptions(res.data.filters || { empresas: [], areas_terapeuticas: [], fases: [] });
    } catch (error) {
      console.error("Error loading medications:", error);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await api.get("/scrappers/pharma/companies");
      setCompanies(res.data.companies || []);
      setCompanyStats(res.data.stats || {});
    } catch (error) {
      console.error("Error loading companies:", error);
    }
  };

  const loadTherapeuticAreas = async () => {
    try {
      const res = await api.get("/scrappers/pharma/therapeutic-areas");
      setTherapeuticAreas(res.data.therapeutic_areas || []);
    } catch (error) {
      console.error("Error loading therapeutic areas:", error);
    }
  };

  const loadRunsAndLogs = async () => {
    try {
      const [logsRes, runsRes] = await Promise.all([
        api.get("/scrappers/logs?scrapper_id=pharma_pipelines&limit=50"),
        api.get("/scrappers/logs/runs?scrapper_id=pharma_pipelines&limit=20")
      ]);
      setLogs(logsRes.data.logs || []);
      setRuns(runsRes.data.runs || []);
    } catch (error) {
      console.error("Error loading runs/logs:", error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get("/scrappers/pharma/medications/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const runScrapper = async () => {
    // Check if there are companies ready for scraping
    const readyCompanies = companies.filter(c => c.pipeline_url && c.has_research && c.active);
    if (readyCompanies.length === 0) {
      toast.error("No companies ready for scraping. Add pipeline URLs to companies first.");
      return;
    }
    
    setRunning(true);
    try {
      const res = await api.post("/scrappers/run/pharma_pipelines");
      toast.success(`Scrapper started. Processing ${readyCompanies.length} companies...`);
      
      const runId = res.data.run_id;
      const checkStatus = async () => {
        try {
          const statusRes = await api.get(`/scrappers/run/${runId}/status`);
          if (statusRes.data.status === "running") {
            setTimeout(checkStatus, 5000);
          } else {
            setRunning(false);
            loadAllData();
            if (statusRes.data.status === "completed") {
              toast.success(`Completed: ${statusRes.data.results?.medications_found || 0} medications found`);
            } else {
              toast.error(`Failed: ${statusRes.data.error}`);
            }
          }
        } catch (e) {
          setRunning(false);
        }
      };
      setTimeout(checkStatus, 5000);
    } catch (error) {
      setRunning(false);
      toast.error("Error starting scrapper");
    }
  };

  const saveCompany = async () => {
    const data = editingCompany || newCompany;
    if (!data.name) {
      toast.error("Company name is required");
      return;
    }
    try {
      if (editingCompany) {
        await api.put(`/scrappers/pharma/companies/${editingCompany.id}`, data);
        toast.success("Company updated");
      } else {
        await api.post("/scrappers/pharma/companies", data);
        toast.success("Company added");
      }
      setShowAddCompany(false);
      setEditingCompany(null);
      setNewCompany({ name: "", domain: "", pipeline_url: "", has_research: true, notes: "" });
      loadCompanies();
    } catch (error) {
      toast.error("Error saving company");
    }
  };

  const updateCompanyField = async (companyId, field, value) => {
    try {
      await api.put(`/scrappers/pharma/companies/${companyId}`, { [field]: value });
      loadCompanies();
    } catch (error) {
      toast.error("Error updating company");
    }
  };

  const deleteCompany = async (companyId) => {
    if (!window.confirm("Delete this company?")) return;
    try {
      await api.delete(`/scrappers/pharma/companies/${companyId}`);
      toast.success("Company deleted");
      loadCompanies();
    } catch (error) {
      toast.error("Error deleting company");
    }
  };

  const resetCompanies = async () => {
    if (!window.confirm("This will delete all companies and add only Big Pharma companies. Continue?")) return;
    try {
      await api.post("/scrappers/pharma/companies/reset");
      toast.success("Companies reset to Big Pharma only");
      loadCompanies();
    } catch (error) {
      toast.error("Error resetting companies");
    }
  };

  const scrapeCompany = async (companyId, companyName) => {
    try {
      const res = await api.post(`/scrappers/pharma/scrape-company/${companyId}`);
      toast.success(`Started scraping ${companyName}`);
      // Update local state to show running status
      setCompanies(prev => prev.map(c => 
        c.id === companyId 
          ? { ...c, pipeline_scrape_status: "running" }
          : c
      ));
      // Refresh after a delay to get results
      setTimeout(() => loadCompanies(), 5000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error starting scrape");
    }
  };

  const importFromContacts = async () => {
    try {
      const res = await api.post("/scrappers/pharma/companies/import-from-contacts");
      toast.success(`Imported ${res.data.added} companies, ${res.data.skipped} skipped`);
      loadCompanies();
    } catch (error) {
      toast.error("Error importing companies");
    }
  };

  const addBigPharmaKeepExisting = async () => {
    try {
      const res = await api.post("/scrappers/pharma/companies/add-big-pharma-keep-existing");
      toast.success(`Added ${res.data.added} Big Pharma, updated ${res.data.updated} existing`);
      loadCompanies();
    } catch (error) {
      toast.error("Error adding Big Pharma");
    }
  };

  const removeNonPharma = async () => {
    if (!window.confirm("This will remove all non-pharmaceutical companies. Continue?")) return;
    try {
      const res = await api.post("/scrappers/pharma/companies/cleanup-non-pharma");
      toast.success(`Removed ${res.data.deleted} non-pharma, kept ${res.data.kept} pharma companies`);
      loadCompanies();
    } catch (error) {
      toast.error("Error removing non-pharma companies");
    }
  };

  const findDecisionMakers = async (medicationId, medicationName) => {
    try {
      const res = await api.post(`/scrappers/pharma/medications/${medicationId}/find-decision-makers`);
      toast.success(`Searching decision makers for ${medicationName}`);
      // Update local state
      setMedications(prev => prev.map(m =>
        m.id === medicationId
          ? { ...m, dm_search_status: "running" }
          : m
      ));
      // Refresh after delay
      setTimeout(() => loadMedications(), 5000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error starting search");
    }
  };

  const addTherapeuticArea = async () => {
    if (!newArea.code || !newArea.name) {
      toast.error("Code and name are required");
      return;
    }
    try {
      await api.post("/scrappers/pharma/therapeutic-areas", newArea);
      toast.success("Therapeutic area added");
      setShowAddArea(false);
      setNewArea({ code: "", name: "", description: "" });
      loadTherapeuticAreas();
    } catch (error) {
      toast.error("Error adding therapeutic area");
    }
  };

  const toggleArea = async (areaId, active) => {
    try {
      await api.put(`/scrappers/pharma/therapeutic-areas/${areaId}`, { active: !active });
      loadTherapeuticAreas();
    } catch (error) {
      toast.error("Error updating area");
    }
  };

  // LinkedIn Keywords management
  const addKeyword = async (areaId, keyword) => {
    const area = therapeuticAreas.find(a => a.id === areaId);
    if (!area) return;
    
    const currentKeywords = area.linkedin_keywords || [];
    if (currentKeywords.includes(keyword)) {
      toast.error("Keyword already exists");
      return;
    }
    
    try {
      await api.put(`/scrappers/pharma/therapeutic-areas/${areaId}`, {
        linkedin_keywords: [...currentKeywords, keyword.trim()]
      });
      loadTherapeuticAreas();
      toast.success("Keyword added");
    } catch (error) {
      toast.error("Error adding keyword");
    }
  };

  const removeKeyword = async (areaId, keyword) => {
    const area = therapeuticAreas.find(a => a.id === areaId);
    if (!area) return;
    
    const currentKeywords = area.linkedin_keywords || [];
    
    try {
      await api.put(`/scrappers/pharma/therapeutic-areas/${areaId}`, {
        linkedin_keywords: currentKeywords.filter(k => k !== keyword)
      });
      loadTherapeuticAreas();
      toast.success("Keyword removed");
    } catch (error) {
      toast.error("Error removing keyword");
    }
  };

  const seedKeywords = async () => {
    try {
      const res = await api.post("/scrappers/pharma/therapeutic-areas/seed-keywords");
      toast.success(`Updated ${res.data.updated} areas with default keywords`);
      loadTherapeuticAreas();
    } catch (error) {
      toast.error("Error seeding keywords");
    }
  };

  const clearFilters = () => {
    setMedicationFilters({ empresa: "", area_terapeutica: "", fase: "" });
  };

  const hasActiveFilters = medicationFilters.empresa || medicationFilters.area_terapeutica || medicationFilters.fase;

  const getPhaseBadgeColor = (phase) => {
    const colors = {
      "Preclinical": "bg-slate-500/20 text-slate-400",
      "Phase 1": "bg-blue-500/20 text-blue-400",
      "Phase 2": "bg-yellow-500/20 text-yellow-400",
      "Phase 3": "bg-orange-500/20 text-orange-400",
      "Filed": "bg-purple-500/20 text-purple-400",
      "Approved": "bg-green-500/20 text-green-400"
    };
    return colors[phase] || "bg-slate-500/20 text-slate-400";
  };

  // Filter companies
  const filteredCompanies = companies.filter(c => {
    // Search filter
    if (companySearch && !c.name.toLowerCase().includes(companySearch.toLowerCase())) {
      return false;
    }
    // Category filter
    if (companyFilter === "with_research" && !c.has_research) return false;
    if (companyFilter === "without_research" && c.has_research) return false;
    if (companyFilter === "with_url" && !c.pipeline_url) return false;
    if (companyFilter === "without_url" && c.pipeline_url) return false;
    if (companyFilter === "ready" && !(c.pipeline_url && c.has_research && c.active)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="pharma-pipelines-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#00ffaa]" />
      </div>
    );
  }

  const readyForScraping = companyStats.ready_for_scraping || 0;

  return (
    <div className="space-y-6" data-testid="pharma-pipelines-page">
      {/* Apify Status Alert */}
      <ApifyStatusAlert />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#00ffaa]/20">
            <Pill className="w-6 h-6 text-[#00ffaa]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">1.1 Pharma Pipelines</h1>
            <p className="text-slate-400 text-sm">Track drug development phases across pharmaceutical companies</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAllData} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={runScrapper}
            disabled={running || readyForScraping === 0}
            className="btn-primary"
            data-testid="run-pharma-scrapper"
          >
            {running ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run ({readyForScraping} companies)
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{stats?.total_medications || medications.length}</p>
            <p className="text-xs text-slate-400">Medications</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-[#00ffaa]">{readyForScraping}</p>
            <p className="text-xs text-slate-400">Ready to Scrape</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-400">{companyStats.with_research || 0}</p>
            <p className="text-xs text-slate-400">With Research</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-400">{therapeuticAreas.filter(a => a.active).length}</p>
            <p className="text-xs text-slate-400">Therapeutic Areas</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-orange-400">{stats?.phase_changes_detected || 0}</p>
            <p className="text-xs text-slate-400">Phase Changes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222] p-1">
          <TabsTrigger value="companies" className="data-[state=active]:bg-[#00ffaa]/20 data-[state=active]:text-[#00ffaa]">
            <Building2 className="w-4 h-4 mr-2" />
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="medications" className="data-[state=active]:bg-[#00ffaa]/20 data-[state=active]:text-[#00ffaa]">
            <Beaker className="w-4 h-4 mr-2" />
            Medications ({medications.length})
          </TabsTrigger>
          <TabsTrigger value="therapeutic-areas" className="data-[state=active]:bg-[#00ffaa]/20 data-[state=active]:text-[#00ffaa]">
            <Database className="w-4 h-4 mr-2" />
            Therapeutic Areas
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-[#00ffaa]/20 data-[state=active]:text-[#00ffaa]">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab - Checklist Style */}
        <TabsContent value="companies" className="mt-4 space-y-4">
          {/* Filters and Actions */}
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Search companies..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="pl-10 bg-[#0f0f0f] border-[#333] text-white"
                  />
                </div>
                
                {/* Filter dropdown */}
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-[180px] bg-[#0f0f0f] border-[#333] text-white">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    <SelectItem value="ready">Ready for Scraping</SelectItem>
                    <SelectItem value="with_research">With Research</SelectItem>
                    <SelectItem value="without_research">Without Research</SelectItem>
                    <SelectItem value="with_url">With Pipeline URL</SelectItem>
                    <SelectItem value="without_url">Missing URL</SelectItem>
                  </SelectContent>
                </Select>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => setShowAddCompany(true)} className="btn-primary" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Company
                  </Button>
                  <Button onClick={importFromContacts} variant="outline" size="sm" className="border-[#333] text-slate-300">
                    Import Pharma
                  </Button>
                  <Button onClick={addBigPharmaKeepExisting} variant="outline" size="sm" className="border-[#333] text-slate-300">
                    + Big Pharma
                  </Button>
                  <Button onClick={removeNonPharma} variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clean Non-Pharma
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Alert */}
          {companyStats.without_pipeline_url > 0 && (
            <Card className="border-yellow-500/30 bg-yellow-500/10">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium">{companyStats.without_pipeline_url} companies missing Pipeline URL</p>
                  <p className="text-sm text-yellow-400/70">Add Pipeline URLs to enable scraping. Filter by "Missing URL" to see them.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Companies Checklist */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#00ffaa]" />
                  Companies Checklist ({filteredCompanies.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCompanies.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No companies found</p>
                  <Button onClick={() => setShowAddCompany(true)} className="mt-4 btn-primary" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Company
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCompanies.map(company => (
                    <div
                      key={company.id}
                      className={`p-4 rounded-lg border transition-all ${
                        company.pipeline_url && company.has_research && company.active
                          ? 'border-[#00ffaa]/30 bg-[#00ffaa]/5'
                          : 'border-[#222] bg-[#111]'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Active Checkbox */}
                        <Checkbox
                          checked={company.active}
                          onCheckedChange={(checked) => updateCompanyField(company.id, "active", checked)}
                          className="border-[#444]"
                        />
                        
                        {/* Company Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{company.name}</span>
                            {company.source === "big_pharma" && (
                              <Badge className="bg-purple-500/20 text-purple-400 text-xs">Big Pharma</Badge>
                            )}
                          </div>
                          {company.domain && (
                            <p className="text-xs text-slate-500">{company.domain}</p>
                          )}
                        </div>

                        {/* Has Research Toggle */}
                        <div className="flex items-center gap-2">
                          <FlaskConical className={`w-4 h-4 ${company.has_research ? 'text-blue-400' : 'text-slate-600'}`} />
                          <Switch
                            checked={company.has_research}
                            onCheckedChange={(checked) => updateCompanyField(company.id, "has_research", checked)}
                          />
                          <span className="text-xs text-slate-400 w-20">
                            {company.has_research ? "Research" : "No R&D"}
                          </span>
                        </div>

                        {/* Pipeline URL */}
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <Link className={`w-4 h-4 ${company.pipeline_url ? 'text-[#00ffaa]' : 'text-slate-600'}`} />
                          {company.pipeline_url ? (
                            <a 
                              href={company.pipeline_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-[#00ffaa] hover:underline truncate max-w-[150px]"
                            >
                              {company.pipeline_url.replace('https://', '').substring(0, 30)}...
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">No URL</span>
                          )}
                        </div>

                        {/* Status Badge */}
                        {company.pipeline_url && company.has_research && company.active ? (
                          <Badge className="bg-[#00ffaa]/20 text-[#00ffaa] border border-[#00ffaa]/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Ready
                          </Badge>
                        )}

                        {/* Last Medication Update */}
                        <div className="text-center min-w-[90px]">
                          {company.medication_count > 0 ? (
                            <div>
                              <p className="text-xs text-[#00ffaa]">{company.medication_count} meds</p>
                              <p className="text-[10px] text-slate-500">
                                {company.last_medication_update 
                                  ? new Date(company.last_medication_update).toLocaleDateString()
                                  : "Never"}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-600">No meds</p>
                          )}
                        </div>

                        {/* Pipeline Scrape Status */}
                        <div className="text-center min-w-[80px]">
                          {company.pipeline_scrape_status === "running" ? (
                            <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                              Running
                            </Badge>
                          ) : company.pipeline_scrape_status === "success" ? (
                            <div>
                              <Badge className="bg-green-500/20 text-green-400 text-xs">Success</Badge>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {company.last_pipeline_scrape 
                                  ? new Date(company.last_pipeline_scrape).toLocaleDateString()
                                  : ""}
                              </p>
                            </div>
                          ) : company.pipeline_scrape_status === "failed" ? (
                            <Badge className="bg-red-500/20 text-red-400 text-xs" title={company.pipeline_scrape_error}>
                              Failed
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500/20 text-slate-500 text-xs">Never</Badge>
                          )}
                        </div>

                        {/* Scrape Button */}
                        {company.pipeline_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => scrapeCompany(company.id, company.name)}
                            disabled={company.pipeline_scrape_status === "running"}
                            className="text-[#00ffaa] hover:text-[#00ffaa]/80 hover:bg-[#00ffaa]/10"
                            title="Scrape pipeline"
                          >
                            <RefreshCw className={`w-4 h-4 ${company.pipeline_scrape_status === "running" ? 'animate-spin' : ''}`} />
                          </Button>
                        )}

                        {/* Actions */}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCompany(company);
                              setShowAddCompany(true);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCompany(company.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Notes */}
                      {company.notes && (
                        <p className="mt-2 ml-10 text-xs text-slate-500">{company.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medications Tab */}
        <TabsContent value="medications" className="mt-4 space-y-4">
          {/* Filters */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-[#00ffaa]" />
                  Filters
                </span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Company</Label>
                  <Select
                    value={medicationFilters.empresa || "all"}
                    onValueChange={(v) => setMedicationFilters(prev => ({ ...prev, empresa: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger className="bg-[#0f0f0f] border-[#333] text-white">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Companies</SelectItem>
                      {filterOptions.empresas.map(e => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.value} ({e.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Therapeutic Area</Label>
                  <Select
                    value={medicationFilters.area_terapeutica || "all"}
                    onValueChange={(v) => setMedicationFilters(prev => ({ ...prev, area_terapeutica: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger className="bg-[#0f0f0f] border-[#333] text-white">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {filterOptions.areas_terapeuticas.map(a => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.value} ({a.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Phase</Label>
                  <Select
                    value={medicationFilters.fase || "all"}
                    onValueChange={(v) => setMedicationFilters(prev => ({ ...prev, fase: v === "all" ? "" : v }))}
                  >
                    <SelectTrigger className="bg-[#0f0f0f] border-[#333] text-white">
                      <SelectValue placeholder="All Phases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Phases</SelectItem>
                      {filterOptions.fases.map(f => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.value} ({f.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medications Table */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white">
                <Beaker className="w-5 h-5 text-[#00ffaa]" />
                Medications ({medications.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {medications.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Pill className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No medications found</p>
                  <p className="text-sm">Run the scrapper to discover medications</p>
                </div>
              ) : (
                <div className="border border-[#222] rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#222] hover:bg-[#111]">
                        <TableHead className="text-slate-300">Molecule</TableHead>
                        <TableHead className="text-slate-300">Company</TableHead>
                        <TableHead className="text-slate-300">Therapeutic Area</TableHead>
                        <TableHead className="text-slate-300">Phase</TableHead>
                        <TableHead className="text-slate-300">Updated</TableHead>
                        <TableHead className="text-slate-300">DM Search</TableHead>
                        <TableHead className="text-right text-slate-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medications.slice(0, 50).map(med => (
                        <TableRow key={med.id} className="border-[#222] hover:bg-[#111]">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Pill className="w-4 h-4 text-[#00ffaa]" />
                              <span className="font-medium text-white">{med.molecula}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">{med.empresa}</TableCell>
                          <TableCell>
                            <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              {med.area_terapeutica}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getPhaseBadgeColor(med.fase)}>
                              {med.fase}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {med.last_updated ? new Date(med.last_updated).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {med.dm_search_status === "running" ? (
                                <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  Searching
                                </Badge>
                              ) : med.dm_search_status === "success" ? (
                                <div className="text-center">
                                  <Badge className="bg-green-500/20 text-green-400 text-xs">
                                    {med.dm_found_count || 0} found
                                  </Badge>
                                  <p className="text-[10px] text-slate-500">
                                    {med.dm_last_search ? new Date(med.dm_last_search).toLocaleDateString() : ""}
                                  </p>
                                </div>
                              ) : med.dm_search_status === "failed" ? (
                                <Badge className="bg-red-500/20 text-red-400 text-xs" title={med.dm_search_error}>
                                  Failed
                                </Badge>
                              ) : med.dm_search_status === "pending" ? (
                                <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                                  Pending
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-500/20 text-slate-500 text-xs">-</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => findDecisionMakers(med.id, med.molecula)}
                                disabled={med.dm_search_status === "running"}
                                className="text-[#ff3300] hover:text-[#ff3300]/80 hover:bg-[#ff3300]/10"
                                title="Find decision makers"
                              >
                                <Users className={`w-4 h-4 ${med.dm_search_status === "running" ? 'animate-pulse' : ''}`} />
                              </Button>
                              {med.source_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(med.source_url, "_blank")}
                                  className="text-slate-400 hover:text-white"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Therapeutic Areas Tab */}
        <TabsContent value="therapeutic-areas" className="mt-4 space-y-4">
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#00ffaa]" />
                  Therapeutic Areas ({therapeuticAreas.length})
                </span>
                <div className="flex gap-2">
                  <Button onClick={seedKeywords} variant="outline" size="sm" className="border-[#333] text-slate-300">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Seed Keywords
                  </Button>
                  <Button onClick={() => setShowAddArea(true)} className="btn-primary" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Area
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 mb-4">
                Configure LinkedIn keywords for each therapeutic area to find decision makers when medications are discovered.
              </p>
              <div className="space-y-4">
                {therapeuticAreas.map(area => (
                  <div
                    key={area.id}
                    className={`p-4 rounded-lg border ${area.active ? 'border-[#333] bg-[#111]' : 'border-[#222] bg-[#0a0a0a] opacity-50'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white">{area.name}</h4>
                          <Badge className="text-xs bg-slate-800 text-slate-400">{area.code}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{area.description}</p>
                      </div>
                      <Switch
                        checked={area.active}
                        onCheckedChange={() => toggleArea(area.id, area.active)}
                      />
                    </div>
                    
                    {/* LinkedIn Keywords */}
                    <div className="mt-3 pt-3 border-t border-[#222]">
                      <Label className="text-xs text-slate-400 flex items-center gap-1 mb-2">
                        <Search className="w-3 h-3" />
                        LinkedIn Keywords (for finding decision makers)
                      </Label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(area.linkedin_keywords || []).map((keyword, idx) => (
                          <Badge 
                            key={idx} 
                            className="bg-blue-500/20 text-blue-400 text-xs cursor-pointer hover:bg-red-500/20 hover:text-red-400"
                            onClick={() => removeKeyword(area.id, keyword)}
                          >
                            {keyword}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                        ))}
                        {(!area.linkedin_keywords || area.linkedin_keywords.length === 0) && (
                          <span className="text-xs text-slate-600">No keywords configured</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add keyword (e.g., 'oncology director')"
                          className="bg-[#0a0a0a] border-[#333] text-white text-xs h-8 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value) {
                              addKeyword(area.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-[#333] text-slate-300 h-8"
                          onClick={(e) => {
                            const input = e.target.closest('.flex').querySelector('input');
                            if (input && input.value) {
                              addKeyword(area.id, input.value);
                              input.value = '';
                            }
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4 space-y-4">
          {/* Schedule */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#00ffaa]" />
                  Weekly Schedule
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScheduleEdit(true)}
                  className="border-[#333] text-slate-300"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={schedule.enabled} disabled />
                  <span className={schedule.enabled ? "text-green-400" : "text-slate-500"}>
                    {schedule.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map(day => (
                      <div
                        key={day.id}
                        className={`px-3 py-1.5 rounded text-xs font-medium ${
                          schedule.days?.includes(day.id)
                            ? 'bg-[#00ffaa]/30 text-[#00ffaa]'
                            : 'bg-[#1a1a1a] text-slate-600'
                        }`}
                      >
                        {day.short}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Runs */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-[#00ffaa]" />
                Recent Runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No runs yet</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {runs.slice(0, 10).map(run => (
                    <div key={run.id} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                      <div className="flex items-center gap-3">
                        {run.status === "completed" ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : run.status === "failed" ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        )}
                        <div>
                          <p className="text-sm text-white">{run.status}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(run.started_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        {run.results?.medications_found !== undefined && (
                          <span className="text-green-400">{run.results.medications_found} meds</span>
                        )}
                        {run.results?.phase_changes_detected > 0 && (
                          <span className="text-orange-400 ml-2">{run.results.phase_changes_detected} changes</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logs */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="w-5 h-5 text-[#00ffaa]" />
                Execution Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No logs available</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {logs.slice(0, 20).map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-[#0f0f0f] rounded-lg text-sm">
                      <Badge className={
                        log.level === "SUCCESS" ? "bg-green-500/20 text-green-400" :
                        log.level === "ERROR" ? "bg-red-500/20 text-red-400" :
                        log.level === "WARN" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-blue-500/20 text-blue-400"
                      }>{log.level}</Badge>
                      <div className="flex-1">
                        <p className="text-white">{log.message}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Company Dialog */}
      <Dialog open={showAddCompany} onOpenChange={(open) => { setShowAddCompany(open); if (!open) setEditingCompany(null); }}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Company Name *</Label>
              <Input
                value={editingCompany?.name || newCompany.name}
                onChange={(e) => editingCompany 
                  ? setEditingCompany({...editingCompany, name: e.target.value})
                  : setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Pfizer"
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Domain</Label>
              <Input
                value={editingCompany?.domain || newCompany.domain}
                onChange={(e) => editingCompany
                  ? setEditingCompany({...editingCompany, domain: e.target.value})
                  : setNewCompany(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="e.g., pfizer.com"
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Pipeline URL</Label>
              <Input
                value={editingCompany?.pipeline_url || newCompany.pipeline_url}
                onChange={(e) => editingCompany
                  ? setEditingCompany({...editingCompany, pipeline_url: e.target.value})
                  : setNewCompany(prev => ({ ...prev, pipeline_url: e.target.value }))}
                placeholder="e.g., https://pfizer.com/pipeline"
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Has Research & Development</Label>
              <Switch
                checked={editingCompany?.has_research ?? newCompany.has_research}
                onCheckedChange={(checked) => editingCompany
                  ? setEditingCompany({...editingCompany, has_research: checked})
                  : setNewCompany(prev => ({ ...prev, has_research: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Notes</Label>
              <Input
                value={editingCompany?.notes || newCompany.notes}
                onChange={(e) => editingCompany
                  ? setEditingCompany({...editingCompany, notes: e.target.value})
                  : setNewCompany(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes..."
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCompany(false); setEditingCompany(null); }} className="border-[#333] text-slate-300">
              Cancel
            </Button>
            <Button onClick={saveCompany} className="btn-primary">
              {editingCompany ? "Update" : "Add"} Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Therapeutic Area Dialog */}
      <Dialog open={showAddArea} onOpenChange={setShowAddArea}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Add Therapeutic Area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Code *</Label>
              <Input
                value={newArea.code}
                onChange={(e) => setNewArea(prev => ({ ...prev, code: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                placeholder="e.g., pediatrics"
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Name *</Label>
              <Input
                value={newArea.name}
                onChange={(e) => setNewArea(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Pediatrics"
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>
              <Input
                value={newArea.description}
                onChange={(e) => setNewArea(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Children's diseases"
                className="bg-[#0f0f0f] border-[#333] text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddArea(false)} className="border-[#333] text-slate-300">
              Cancel
            </Button>
            <Button onClick={addTherapeuticArea} className="btn-primary">
              Add Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Edit Dialog */}
      <Dialog open={showScheduleEdit} onOpenChange={setShowScheduleEdit}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Configure Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Enable Automatic Runs</Label>
              <Switch
                checked={schedule.enabled}
                onCheckedChange={(checked) => setSchedule(prev => ({ ...prev, enabled: checked }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Active Days</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(day => {
                  const isSelected = schedule.days?.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      onClick={() => {
                        const currentDays = schedule.days || [];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== day.id)
                          : [...currentDays, day.id];
                        setSchedule(prev => ({ ...prev, days: newDays }));
                      }}
                      className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-[#00ffaa] text-black'
                          : 'bg-[#1a1a1a] text-slate-500 hover:bg-[#222]'
                      }`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Run Time</Label>
              <Select
                value={schedule.hour?.toString() || "9"}
                onValueChange={(v) => setSchedule(prev => ({ ...prev, hour: parseInt(v) }))}
              >
                <SelectTrigger className="bg-[#0f0f0f] border-[#333] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map(hour => (
                    <SelectItem key={hour.value} value={hour.value.toString()}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleEdit(false)} className="border-[#333] text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                localStorage.setItem('pharma_schedule', JSON.stringify(schedule));
                toast.success("Schedule saved");
                setShowScheduleEdit(false);
              }} 
              className="btn-primary"
            >
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
