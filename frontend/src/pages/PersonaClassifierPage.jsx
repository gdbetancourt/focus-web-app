/**
 * PersonaClassifierPage - Main page for Persona Classifier V3
 * 
 * Features:
 * 1. Tree view: Buyer Persona → Keywords with inline editing
 * 2. Diagnostic panel: Test classification on any job title
 * 3. Reclassification panel: Create and monitor reclassification jobs
 * 4. Statistics dashboard
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  ChevronRight,
  ChevronDown,
  Tag,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Users,
  Zap,
  Play,
  Pause,
  Check,
  X,
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  ArrowRight,
  Activity,
  TrendingUp,
  Eye,
  GripVertical,
  Loader2,
  BarChart3,
  FileText,
  Settings,
  Info
} from "lucide-react";
import api from "../lib/api";

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_COLORS = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: Check,
  failed: X,
  cancelled: Pause,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PersonaClassifierPage() {
  const [activeTab, setActiveTab] = useState("keywords");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadStats();
  }, []);
  
  const loadStats = async () => {
    try {
      const response = await api.get("/persona-classifier/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6" data-testid="persona-classifier-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Persona Classifier</h1>
            <p className="text-sm text-slate-400">
              Gestiona keywords y clasifica contactos automáticamente
            </p>
          </div>
        </div>
        
        {/* Quick Stats */}
        {stats && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Keywords:</span>
              <span className="text-white font-medium">{stats.keywords?.total || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Contactos:</span>
              <span className="text-white font-medium">{(stats.contacts?.total || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">Bloqueados:</span>
              <span className="text-white font-medium">{stats.contacts?.locked || 0}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700/50">
          <TabsTrigger value="keywords" className="data-[state=active]:bg-slate-700">
            <Tag className="w-4 h-4 mr-2" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="diagnostic" className="data-[state=active]:bg-slate-700">
            <Search className="w-4 h-4 mr-2" />
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="reclassify" className="data-[state=active]:bg-slate-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reclasificar
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-slate-700">
            <BarChart3 className="w-4 h-4 mr-2" />
            Estadísticas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="keywords" className="mt-6">
          <KeywordsTreePanel onStatsChange={loadStats} />
        </TabsContent>
        
        <TabsContent value="diagnostic" className="mt-6">
          <DiagnosticPanel />
        </TabsContent>
        
        <TabsContent value="reclassify" className="mt-6">
          <ReclassifyPanel onComplete={loadStats} />
        </TabsContent>
        
        <TabsContent value="stats" className="mt-6">
          <StatsPanel stats={stats} loading={loading} onRefresh={loadStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// KEYWORDS TREE PANEL
// =============================================================================

function KeywordsTreePanel({ onStatsChange }) {
  const [personas, setPersonas] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPersonas, setExpandedPersonas] = useState([]);
  const [addKeywordDialog, setAddKeywordDialog] = useState({ open: false, personaId: null });
  const [newKeyword, setNewKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, keyword: null });
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [keywordsRes, personasRes, prioritiesRes] = await Promise.all([
        api.get("/job-keywords/"),
        api.get("/buyer-personas-db/"),
        api.get("/job-keywords/priorities"),
      ]);
      
      // Extract data from response objects
      setKeywords(keywordsRes.data?.keywords || keywordsRes.data || []);
      setPersonas(personasRes.data || []);
      setPriorities(prioritiesRes.data?.priorities || prioritiesRes.data || []);
      
      // Expand first persona by default
      const prioritiesList = prioritiesRes.data?.priorities || prioritiesRes.data || [];
      if (Array.isArray(prioritiesList) && prioritiesList.length > 0) {
        setExpandedPersonas([prioritiesList[0].buyer_persona_id]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };
  
  const getKeywordsForPersona = (personaId) => {
    return keywords
      .filter((kw) => kw.buyer_persona_id === personaId)
      .filter((kw) => !searchTerm || kw.keyword.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.keyword.localeCompare(b.keyword));
  };
  
  const toggleExpanded = (personaId) => {
    setExpandedPersonas((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId]
    );
  };
  
  const handleAddKeyword = async () => {
    if (!newKeyword.trim() || !addKeywordDialog.personaId) return;
    
    setSaving(true);
    try {
      const persona = priorities.find((p) => p.buyer_persona_id === addKeywordDialog.personaId);
      await api.post("/job-keywords/", {
        keyword: newKeyword.trim().toLowerCase(),
        buyer_persona_id: addKeywordDialog.personaId,
        buyer_persona_name: persona?.buyer_persona_name || "",
      });
      
      toast.success("Keyword agregada");
      setNewKeyword("");
      setAddKeywordDialog({ open: false, personaId: null });
      loadData();
      onStatsChange?.();
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error("Esta keyword ya existe");
      } else {
        toast.error("Error al agregar keyword");
      }
    } finally {
      setSaving(false);
    }
  };
  
  const handleDeleteKeyword = async () => {
    if (!deleteConfirm.keyword) return;
    
    try {
      await api.delete(`/job-keywords/${deleteConfirm.keyword.id}`);
      toast.success("Keyword eliminada");
      setDeleteConfirm({ open: false, keyword: null });
      loadData();
      onStatsChange?.();
    } catch (error) {
      toast.error("Error al eliminar keyword");
    }
  };
  
  // Sort priorities by priority number (Mateo should always be last)
  // Ensure priorities is always an array
  const sortedPriorities = Array.isArray(priorities) 
    ? [...priorities].sort((a, b) => a.priority - b.priority)
    : [];
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="border-slate-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>
      
      {/* Tree */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-slate-700/50">
              {sortedPriorities.map((persona) => {
                const personaKeywords = getKeywordsForPersona(persona.buyer_persona_id);
                const isExpanded = expandedPersonas.includes(persona.buyer_persona_id);
                const isMateo = persona.buyer_persona_id === "mateo";
                
                return (
                  <div key={persona.buyer_persona_id}>
                    {/* Persona Header */}
                    <div
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors ${
                        isExpanded ? "bg-slate-700/20" : ""
                      }`}
                      onClick={() => toggleExpanded(persona.buyer_persona_id)}
                      data-testid={`persona-row-${persona.buyer_persona_id}`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-slate-700/50 border-slate-600">
                            P{persona.priority}
                          </Badge>
                          <span className="text-white font-medium">
                            {persona.buyer_persona_name}
                          </span>
                          {isMateo && (
                            <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                              Catch-all
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                          {personaKeywords.length} keywords
                        </Badge>
                        {!isMateo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-slate-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddKeywordDialog({ open: true, personaId: persona.buyer_persona_id });
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Keywords List */}
                    {isExpanded && (
                      <div className="bg-slate-800/20 px-4 py-2">
                        {personaKeywords.length === 0 ? (
                          <div className="text-center py-4 text-slate-500 text-sm">
                            {searchTerm ? "No hay keywords que coincidan" : "No hay keywords"}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {personaKeywords.map((kw) => (
                              <div
                                key={kw.id}
                                className="group flex items-center gap-1 px-2.5 py-1 bg-slate-700/50 rounded-lg border border-slate-600/50 hover:border-slate-500 transition-colors"
                                data-testid={`keyword-${kw.id}`}
                              >
                                <Tag className="w-3 h-3 text-slate-400" />
                                <span className="text-sm text-slate-200">{kw.keyword}</span>
                                <button
                                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400"
                                  onClick={() => setDeleteConfirm({ open: true, keyword: kw })}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Add Keyword Dialog */}
      <Dialog open={addKeywordDialog.open} onOpenChange={(open) => setAddKeywordDialog({ open, personaId: null })}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle>Agregar Keyword</DialogTitle>
            <DialogDescription>
              Agregar keyword a{" "}
              <span className="font-medium text-white">
                {priorities.find((p) => p.buyer_persona_id === addKeywordDialog.personaId)?.buyer_persona_name}
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Keyword</Label>
              <Input
                placeholder="Ej: director de marketing"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="bg-slate-800 border-slate-700"
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              />
              <p className="text-xs text-slate-400">
                La keyword se convertirá a minúsculas automáticamente
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddKeywordDialog({ open: false, personaId: null })}
              className="border-slate-700"
            >
              Cancelar
            </Button>
            <Button onClick={handleAddKeyword} disabled={saving || !newKeyword.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ open, keyword: null })}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar keyword?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar la keyword{" "}
              <span className="font-medium text-white">"{deleteConfirm.keyword?.keyword}"</span>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKeyword} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// DIAGNOSTIC PANEL
// =============================================================================

function DiagnosticPanel() {
  const [jobTitle, setJobTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const runDiagnosis = async (titleToTest) => {
    if (!titleToTest?.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.post("/persona-classifier/diagnose", {
        job_title: titleToTest.trim(),
      });
      setDiagnosis(response.data.diagnosis);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al diagnosticar");
    } finally {
      setLoading(false);
    }
  };
  
  const searchContacts = async () => {
    if (!contactSearch.trim()) return;
    
    setSearchingContacts(true);
    try {
      const response = await api.get("/unified-contacts/", {
        params: {
          search: contactSearch,
          limit: 10,
        },
      });
      setContactResults(response.data.contacts || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al buscar contactos");
    } finally {
      setSearchingContacts(false);
    }
  };
  
  const selectContact = async (contact) => {
    setSelectedContact(contact);
    setJobTitle(contact.job_title || "");
    if (contact.job_title) {
      await runDiagnosis(contact.job_title);
    }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Input */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-400" />
            Diagnosticar Clasificación
          </CardTitle>
          <CardDescription>
            Prueba cómo se clasificará un job title
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manual Input */}
          <div className="space-y-3">
            <Label>Job Title (texto libre)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ej: Director de Marketing Digital"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="bg-slate-800 border-slate-700"
                onKeyDown={(e) => e.key === "Enter" && runDiagnosis(jobTitle)}
              />
              <Button onClick={() => runDiagnosis(jobTitle)} disabled={loading || !jobTitle.trim()}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          
          <Separator className="bg-slate-700" />
          
          {/* Contact Search */}
          <div className="space-y-3">
            <Label>O buscar contacto existente</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nombre o email..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="bg-slate-800 border-slate-700"
                onKeyDown={(e) => e.key === "Enter" && searchContacts()}
              />
              <Button
                variant="outline"
                onClick={searchContacts}
                disabled={searchingContacts}
                className="border-slate-700"
              >
                {searchingContacts ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {/* Contact Results */}
            {contactResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700">
                {contactResults.map((contact) => (
                  <div
                    key={contact.id}
                    className="px-3 py-2 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => selectContact(contact)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white text-sm">
                          {contact.first_name} {contact.last_name}
                        </span>
                        <span className="text-slate-400 text-xs ml-2">
                          {contact.email}
                        </span>
                      </div>
                      {contact.buyer_persona_locked && (
                        <Lock className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {contact.job_title || "(Sin job title)"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Selected Contact Info */}
          {selectedContact && (
            <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Contacto seleccionado</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-slate-400"
                  onClick={() => setSelectedContact(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Nombre:</span>
                  <span className="text-white">{selectedContact.first_name} {selectedContact.last_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Persona actual:</span>
                  <Badge variant="outline" className="bg-slate-700/50">
                    {selectedContact.buyer_persona || "Sin asignar"}
                  </Badge>
                </div>
                {selectedContact.buyer_persona_locked && (
                  <div className="flex items-center gap-2 text-amber-400">
                    <Lock className="w-3 h-3" />
                    <span>Clasificación bloqueada</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Right: Results */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            Resultado del Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!diagnosis ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>Ingresa un job title para ver cómo será clasificado</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Input/Output */}
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-700/30">
                  <Label className="text-xs text-slate-400">Original</Label>
                  <p className="text-white font-mono">{diagnosis.input?.original}</p>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </div>
                <div className="p-3 rounded-lg bg-slate-700/30">
                  <Label className="text-xs text-slate-400">Normalizado</Label>
                  <p className="text-cyan-400 font-mono">{diagnosis.input?.normalized || "(vacío)"}</p>
                </div>
              </div>
              
              {/* Result */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-700/30">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-slate-400">Buyer Persona Asignada</Label>
                    <p className="text-xl font-bold text-white">
                      {diagnosis.result?.buyer_persona_name}
                    </p>
                    <p className="text-sm text-slate-400">
                      ID: {diagnosis.result?.buyer_persona_id}
                    </p>
                  </div>
                  {diagnosis.result?.is_default && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      Default (sin match)
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Matches */}
              {diagnosis.matching?.all_matches?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Keywords que hicieron match:</Label>
                  <div className="flex flex-wrap gap-2">
                    {diagnosis.matching.all_matches.map((match, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className={
                          match.priority === diagnosis.matching.priority_used
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-slate-700/50 text-slate-300"
                        }
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {match.keyword}
                        <span className="ml-1 text-xs opacity-70">P{match.priority}</span>
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Prioridad usada: P{diagnosis.matching?.priority_used} (menor = mayor prioridad)
                  </p>
                </div>
              )}
              
              {/* Cache Status */}
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${diagnosis.cache_status?.is_valid ? "bg-green-400" : "bg-amber-400"}`} />
                  Cache: {diagnosis.cache_status?.is_valid ? "Válido" : "Inválido"}
                  {diagnosis.cache_status?.keywords_count > 0 && (
                    <span>({diagnosis.cache_status.keywords_count} keywords)</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// RECLASSIFY PANEL
// =============================================================================

function ReclassifyPanel({ onComplete }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedJobType, setSelectedJobType] = useState("all");
  const [dryRun, setDryRun] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  
  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);
  
  const loadJobs = async () => {
    try {
      const response = await api.get("/persona-classifier/jobs", {
        params: { limit: 20 },
      });
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error("Error loading jobs:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const runEstimate = async () => {
    setEstimating(true);
    try {
      const response = await api.post(`/persona-classifier/reclassify/estimate?job_type=${selectedJobType}`);
      setEstimate(response.data);
    } catch (error) {
      toast.error("Error al estimar");
    } finally {
      setEstimating(false);
    }
  };
  
  const createJob = async () => {
    setCreating(true);
    try {
      const response = await api.post(`/persona-classifier/reclassify/${selectedJobType}`, {
        dry_run: dryRun,
      });
      toast.success(dryRun ? "Job de prueba creado" : "Reclasificación iniciada");
      setConfirmDialog(false);
      loadJobs();
      onComplete?.();
    } catch (error) {
      toast.error("Error al crear job");
    } finally {
      setCreating(false);
    }
  };
  
  const cancelJob = async (jobId) => {
    try {
      await api.post(`/persona-classifier/jobs/${jobId}/cancel`);
      toast.success("Job cancelado");
      loadJobs();
    } catch (error) {
      toast.error("No se pudo cancelar el job");
    }
  };
  
  const StatusIcon = ({ status }) => {
    const Icon = STATUS_ICONS[status] || Clock;
    return <Icon className={`w-4 h-4 ${status === "processing" ? "animate-spin" : ""}`} />;
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Create Job */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-400" />
            Nueva Reclasificación
          </CardTitle>
          <CardDescription>
            Crea un job para reclasificar contactos según las keywords actuales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Job Type */}
          <div className="space-y-3">
            <Label>Tipo de reclasificación</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "all", label: "Todos los contactos", icon: Users },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedJobType(type.id);
                    setEstimate(null);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedJobType === type.id
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <type.icon className="w-5 h-5 mb-2 text-slate-400" />
                  <div className="text-sm font-medium text-white">{type.label}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Dry Run Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-white">Modo prueba (dry-run)</div>
                <div className="text-xs text-slate-400">Simula sin aplicar cambios</div>
              </div>
            </div>
            <Button
              variant={dryRun ? "default" : "outline"}
              size="sm"
              onClick={() => setDryRun(!dryRun)}
              className={dryRun ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600"}
            >
              {dryRun ? "Activado" : "Desactivado"}
            </Button>
          </div>
          
          {/* Estimate */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full border-slate-700"
              onClick={runEstimate}
              disabled={estimating}
            >
              {estimating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Activity className="w-4 h-4 mr-2" />
              )}
              Estimar impacto
            </Button>
            
            {estimate && (
              <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/50 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Contactos afectados:</span>
                  <span className="text-white font-medium">
                    {estimate.estimated_contacts?.toLocaleString() || 0}
                  </span>
                </div>
                {estimate.sample_contacts?.length > 0 && (
                  <div className="pt-2 border-t border-slate-600/50">
                    <Label className="text-xs text-slate-400">Muestra:</Label>
                    <div className="mt-1 text-xs text-slate-300 space-y-1">
                      {estimate.sample_contacts.slice(0, 3).map((c) => (
                        <div key={c.id} className="truncate">
                          {c.first_name} {c.last_name} - {c.job_title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Create Button */}
          <Button
            className="w-full"
            onClick={() => setConfirmDialog(true)}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {dryRun ? "Ejecutar prueba" : "Iniciar reclasificación"}
          </Button>
          
          {!dryRun && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Esto modificará contactos permanentemente
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Right: Jobs List */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Historial de Jobs
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadJobs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay jobs recientes</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.job_id}
                    className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/50 cursor-pointer hover:border-slate-500 transition-colors"
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={STATUS_COLORS[job.status]}>
                          <StatusIcon status={job.status} />
                          <span className="ml-1 capitalize">{job.status}</span>
                        </Badge>
                        {job.dry_run && (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                            Dry-run
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-slate-300 mb-2">
                      Tipo: <span className="text-white">{job.job_type}</span>
                    </div>
                    
                    {/* Progress */}
                    {(job.status === "processing" || job.status === "completed") && (
                      <div className="space-y-1">
                        <Progress value={job.progress?.percent || 0} className="h-1.5" />
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{job.progress?.processed || 0} / {job.progress?.total_contacts || 0}</span>
                          <span>{job.progress?.updated || 0} actualizados</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Actions */}
                    {job.status === "processing" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelJob(job.job_id);
                        }}
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      
      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dryRun ? "¿Ejecutar prueba?" : "¿Iniciar reclasificación?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dryRun ? (
                "Se simulará la reclasificación sin aplicar cambios. Podrás ver qué contactos serían afectados."
              ) : (
                <>
                  <span className="text-amber-400">Esta acción modificará contactos permanentemente.</span>
                  <br />
                  Los contactos con buyer_persona bloqueada serán excluidos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={createJob}
              className={dryRun ? "" : "bg-amber-600 hover:bg-amber-700"}
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Job Detail Modal */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Job</DialogTitle>
          </DialogHeader>
          
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-400">ID</Label>
                  <p className="text-white font-mono text-xs">{selectedJob.job_id}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Estado</Label>
                  <Badge variant="outline" className={STATUS_COLORS[selectedJob.status]}>
                    {selectedJob.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-slate-400">Tipo</Label>
                  <p className="text-white">{selectedJob.job_type}</p>
                </div>
                <div>
                  <Label className="text-slate-400">Creado por</Label>
                  <p className="text-white">{selectedJob.created_by}</p>
                </div>
              </div>
              
              <Separator className="bg-slate-700" />
              
              <div>
                <Label className="text-slate-400">Progreso</Label>
                <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                  <div className="p-2 rounded bg-slate-800 text-center">
                    <div className="text-2xl font-bold text-white">{selectedJob.progress?.total_contacts || 0}</div>
                    <div className="text-xs text-slate-400">Total</div>
                  </div>
                  <div className="p-2 rounded bg-slate-800 text-center">
                    <div className="text-2xl font-bold text-green-400">{selectedJob.progress?.updated || 0}</div>
                    <div className="text-xs text-slate-400">Actualizados</div>
                  </div>
                  <div className="p-2 rounded bg-slate-800 text-center">
                    <div className="text-2xl font-bold text-amber-400">{selectedJob.progress?.skipped_locked || 0}</div>
                    <div className="text-xs text-slate-400">Bloqueados</div>
                  </div>
                </div>
              </div>
              
              {selectedJob.result?.sample_changes?.length > 0 && (
                <>
                  <Separator className="bg-slate-700" />
                  <div>
                    <Label className="text-slate-400">Muestra de cambios ({selectedJob.result.total_changes} total)</Label>
                    <ScrollArea className="h-48 mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead>Job Title</TableHead>
                            <TableHead>Anterior</TableHead>
                            <TableHead>Nuevo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedJob.result.sample_changes.slice(0, 10).map((change, idx) => (
                            <TableRow key={idx} className="border-slate-700">
                              <TableCell className="text-slate-300 text-xs max-w-[200px] truncate">
                                {change.job_title}
                              </TableCell>
                              <TableCell className="text-slate-400 text-xs">{change.old_persona}</TableCell>
                              <TableCell className="text-green-400 text-xs">{change.new_persona}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </>
              )}
              
              {selectedJob.error && (
                <>
                  <Separator className="bg-slate-700" />
                  <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                    <Label className="text-red-400">Error</Label>
                    <p className="text-red-300 text-sm mt-1">{selectedJob.error}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// STATS PANEL
// =============================================================================

function StatsPanel({ stats, loading, onRefresh }) {
  const [precomputedMetrics, setPrecomputedMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [computingMetrics, setComputingMetrics] = useState(false);
  
  useEffect(() => {
    loadPrecomputedMetrics();
  }, []);
  
  const loadPrecomputedMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const response = await api.get("/persona-classifier/metrics/latest");
      setPrecomputedMetrics(response.data.metrics);
    } catch (error) {
      console.error("Error loading precomputed metrics:", error);
    } finally {
      setLoadingMetrics(false);
    }
  };
  
  const triggerMetricsComputation = async () => {
    setComputingMetrics(true);
    try {
      const response = await api.post("/persona-classifier/metrics/compute");
      setPrecomputedMetrics(response.data.metrics);
      toast.success("Métricas calculadas");
    } catch (error) {
      toast.error("Error al calcular métricas");
    } finally {
      setComputingMetrics(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }
  
  if (!stats) {
    return (
      <div className="text-center py-12 text-slate-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No hay estadísticas disponibles</p>
        <Button variant="outline" className="mt-4" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Cargar
        </Button>
      </div>
    );
  }
  
  const contactsByPersona = Object.entries(stats.contacts?.by_persona || {})
    .filter(([key]) => key && key !== "null" && key !== "undefined")
    .sort((a, b) => b[1] - a[1]);
  
  const keywordsByPersona = Object.entries(stats.keywords?.by_persona || {})
    .filter(([key]) => key && key !== "null" && key !== "undefined")
    .sort((a, b) => b[1] - a[1]);
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Keywords</p>
                <p className="text-3xl font-bold text-white">{stats.keywords?.total || 0}</p>
              </div>
              <Tag className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Contactos</p>
                <p className="text-3xl font-bold text-white">{(stats.contacts?.total || 0).toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Bloqueados</p>
                <p className="text-3xl font-bold text-amber-400">{stats.contacts?.locked || 0}</p>
              </div>
              <Lock className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Normalización</p>
                <p className="text-3xl font-bold text-green-400">{stats.contacts?.normalization_coverage || 0}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts by Persona */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg">Contactos por Buyer Persona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contactsByPersona.map(([persona, count]) => {
                const total = stats.contacts?.total || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div key={persona}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{persona}</span>
                      <span className="text-sm text-slate-400">{count.toLocaleString()} ({percent}%)</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* Keywords by Persona */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg">Keywords por Buyer Persona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keywordsByPersona.map(([persona, count]) => {
                const total = stats.keywords?.total || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div key={persona}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-300">{persona}</span>
                      <span className="text-sm text-slate-400">{count} ({percent}%)</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Jobs */}
      {stats.recent_jobs?.length > 0 && (
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg">Jobs Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent_jobs.map((job) => (
                  <TableRow key={job.job_id} className="border-slate-700">
                    <TableCell className="text-slate-300">{job.job_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[job.status]}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {job.progress?.updated || 0} / {job.progress?.total_contacts || 0}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(job.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Precomputed Metrics */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Métricas Preagregadas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPrecomputedMetrics}
                disabled={loadingMetrics}
                className="border-slate-700"
              >
                {loadingMetrics ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="sm"
                onClick={triggerMetricsComputation}
                disabled={computingMetrics}
              >
                {computingMetrics ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Calcular ahora
              </Button>
            </div>
          </div>
          <CardDescription>
            Métricas precalculadas cada 6 horas para carga rápida
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMetrics ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : !precomputedMetrics ? (
            <div className="text-center py-8 text-slate-500">
              <Info className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay métricas preagregadas disponibles</p>
              <p className="text-xs mt-1">Se calcularán automáticamente cada 6 horas</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Last computed */}
              <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-slate-700/30">
                <span className="text-slate-400">Última actualización:</span>
                <span className="text-white">
                  {new Date(precomputedMetrics.computed_at).toLocaleString()}
                </span>
              </div>
              
              {/* Coverage metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-slate-700/30 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {precomputedMetrics.coverage?.classification_percent || 0}%
                  </div>
                  <div className="text-xs text-slate-400">Clasificados</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-700/30 text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {precomputedMetrics.coverage?.normalization_percent || 0}%
                  </div>
                  <div className="text-xs text-slate-400">Normalizados</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-700/30 text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {precomputedMetrics.coverage?.job_title_percent || 0}%
                  </div>
                  <div className="text-xs text-slate-400">Con Job Title</div>
                </div>
              </div>
              
              {/* Trends */}
              {precomputedMetrics.trends && Object.keys(precomputedMetrics.trends).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-400">Tendencias (vs última medición)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {precomputedMetrics.trends.contact_growth !== undefined && (
                      <div className="p-2 rounded bg-slate-700/30 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Crecimiento contactos</span>
                        <span className={`text-sm font-medium ${
                          precomputedMetrics.trends.contact_growth >= 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {precomputedMetrics.trends.contact_growth >= 0 ? "+" : ""}
                          {precomputedMetrics.trends.contact_growth}
                        </span>
                      </div>
                    )}
                    {precomputedMetrics.trends.keyword_growth !== undefined && (
                      <div className="p-2 rounded bg-slate-700/30 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Keywords nuevas</span>
                        <span className={`text-sm font-medium ${
                          precomputedMetrics.trends.keyword_growth >= 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {precomputedMetrics.trends.keyword_growth >= 0 ? "+" : ""}
                          {precomputedMetrics.trends.keyword_growth}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Top keywords */}
              {precomputedMetrics.top_keywords?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-400">Top Keywords (por matches)</Label>
                  <div className="flex flex-wrap gap-2">
                    {precomputedMetrics.top_keywords.slice(0, 10).map((kw, idx) => (
                      <Badge 
                        key={idx} 
                        variant="outline" 
                        className="bg-slate-700/50 text-slate-300"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {kw.keyword}
                        <span className="ml-1 text-xs text-slate-500">({kw.matches})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Unused keywords warning */}
              {precomputedMetrics.unused_keywords?.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-400">
                      Keywords sin uso ({precomputedMetrics.unused_keywords.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {precomputedMetrics.unused_keywords.slice(0, 5).map((kw, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs text-slate-400 border-slate-600">
                        {kw.keyword}
                      </Badge>
                    ))}
                    {precomputedMetrics.unused_keywords.length > 5 && (
                      <span className="text-xs text-slate-500">
                        +{precomputedMetrics.unused_keywords.length - 5} más
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={onRefresh} className="border-slate-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar estadísticas
        </Button>
      </div>
    </div>
  );
}
