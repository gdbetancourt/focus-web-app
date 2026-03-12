/**
 * IndustrySearchesContent - Saved LinkedIn searches organized by industry
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { toast } from "sonner";
import api from "../../lib/api";
import { copyToClipboard } from "../mensajes-hoy/utils";
import { LINKEDIN_PROFILES } from "../focus/focusSections";
import {
  Factory,
  Search,
  Plus,
  Copy,
  Trash2,
  Clock,
  User,
  RefreshCw,
  CheckCircle,
  ChevronDown,
} from "lucide-react";

const PROFILES = {
  GB: "Gerardo Betancourt",
  MG: "María del Mar Gargari",
};

const PROFILE_GROUPS = [
  ...LINKEDIN_PROFILES.map((p) => ({ key: p.id.toLowerCase(), label: `${p.name} (${p.label})` })),
  { key: "__none__", label: "Sin perfil asignado" },
];

function IndustrySearchProfileGroups({ searches, onCopyUrl, onDeleteSearch }) {
  const [collapsed, setCollapsed] = useState({});
  const knownKeys = new Set(LINKEDIN_PROFILES.map((p) => p.id.toLowerCase()));

  const grouped = PROFILE_GROUPS.map((group) => {
    const items =
      group.key === "__none__"
        ? searches.filter((s) => !s.assigned_profile || !knownKeys.has(s.assigned_profile.toLowerCase()))
        : searches.filter((s) => s.assigned_profile?.toLowerCase() === group.key);
    return { ...group, items };
  });

  const toggle = (key) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3">
      {grouped.map((group) => (
        <div key={group.key} className="border border-[#222] rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(group.key)}
            className="flex items-center justify-between w-full px-3 py-2 bg-[#0a0a0a] hover:bg-[#151515] transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">{group.label}</span>
              <Badge variant="outline" className="border-[#333] text-slate-500 text-[10px] px-1.5 py-0">
                {group.items.length}
              </Badge>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${collapsed[group.key] ? "-rotate-90" : ""}`}
            />
          </button>
          {!collapsed[group.key] && (
            <div className="px-3 pb-3 pt-2 space-y-2">
              {group.items.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-2">Sin búsquedas</p>
              ) : (
                group.items.map((search) => (
                  <div
                    key={search.id}
                    className="flex items-center justify-between p-3 bg-[#111] rounded border border-[#333]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Search className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white">{search.keyword}</p>
                          {search.last_prospected_by && (
                            <Badge variant="outline" className="border-[#444] text-slate-400 text-[10px] px-1.5 py-0">
                              {search.last_prospected_by}
                            </Badge>
                          )}
                        </div>
                        {search.last_prospected_at && (
                          <p className="text-xs text-slate-600">
                            Prospectado: {new Date(search.last_prospected_at).toLocaleDateString("es-MX")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCopyUrl(search)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-green-400"
                        title="Copiar URL y marcar como usada"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteSearch(search.id)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-red-400"
                        title="Eliminar búsqueda"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function IndustrySearchesContent() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add industry dialog
  const [addIndustryOpen, setAddIndustryOpen] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [addingIndustry, setAddingIndustry] = useState(false);

  // Add search dialog
  const [addSearchOpen, setAddSearchOpen] = useState(false);
  const [addSearchIndustry, setAddSearchIndustry] = useState(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newProfile, setNewProfile] = useState("");
  const [adding, setAdding] = useState(false);

  // Copy URL dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyingSearch, setCopyingSearch] = useState(null);
  const [copyProfile, setCopyProfile] = useState("GB");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/prospection/active-industries");
      setIndustries(res.data.industries || []);
    } catch (error) {
      console.error("Error loading industries:", error);
      toast.error("Error cargando industrias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddIndustry = async () => {
    const name = newIndustryName.trim();
    if (!name) return;
    setAddingIndustry(true);
    try {
      await api.post("/prospection/industries", { name });
      toast.success("Industria creada");
      setAddIndustryOpen(false);
      setNewIndustryName("");
      loadData();
    } catch (error) {
      console.error("Error creating industry:", error);
      toast.error("Error al crear industria");
    } finally {
      setAddingIndustry(false);
    }
  };

  const handleDeleteIndustry = async (industryId) => {
    try {
      await api.delete(`/prospection/industries/${industryId}`);
      toast.success("Industria eliminada");
      loadData();
    } catch (error) {
      console.error("Error deleting industry:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleAddSearch = async () => {
    if (!addSearchIndustry || !newKeyword.trim() || !newUrl.trim()) return;
    setAdding(true);
    try {
      await api.post(`/prospection/industries/${addSearchIndustry.id}/searches`, {
        keyword: newKeyword.trim(),
        url: newUrl.trim(),
        assigned_profile: newProfile ? newProfile.toLowerCase() : null,
      });
      toast.success("Búsqueda agregada");
      setAddSearchOpen(false);
      setNewKeyword("");
      setNewUrl("");
      setNewProfile("");
      setAddSearchIndustry(null);
      loadData();
    } catch (error) {
      console.error("Error adding search:", error);
      toast.error("Error al agregar búsqueda");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSearch = async (searchId) => {
    try {
      await api.delete(`/prospection/industry-searches/${searchId}`);
      toast.success("Búsqueda eliminada");
      loadData();
    } catch (error) {
      console.error("Error deleting search:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleCopyUrl = (search) => {
    setCopyingSearch(search);
    setCopyProfile(search.assigned_profile?.toUpperCase() || "GB");
    setCopyDialogOpen(true);
  };

  const confirmCopyUrl = async () => {
    if (!copyingSearch) return;
    try {
      const copied = await copyToClipboard(copyingSearch.url);
      if (!copied) {
        toast.error("No se pudo copiar al portapapeles");
        return;
      }
      await api.post(`/prospection/industry-searches/${copyingSearch.id}/mark-copied`, {
        profile_id: copyProfile,
      });
      toast.success(`URL copiada - Prospección con ${PROFILES[copyProfile]}`);
      setCopyDialogOpen(false);
      setCopyingSearch(null);
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al marcar como copiada");
    }
  };

  // Build global queue
  const allSearches = industries.flatMap((ind) =>
    (ind.searches || []).map((s) => ({ ...s, industry_name: ind.name, industry_id: ind.id }))
  );

  const sortedQueue = [...allSearches].sort((a, b) => {
    if (!a.last_prospected_at && b.last_prospected_at) return -1;
    if (a.last_prospected_at && !b.last_prospected_at) return 1;
    if (!a.last_prospected_at && !b.last_prospected_at) return 0;
    return a.last_prospected_at.localeCompare(b.last_prospected_at);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-500/30 text-purple-400">
            {sortedQueue.length} búsquedas en cola
          </Badge>
          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
            {industries.length} industrias
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setAddIndustryOpen(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva industria
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="border-[#333]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Search Queue */}
      <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border-purple-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Clock className="w-5 h-5 text-purple-400" />
            Cola de Prospección — Industrias
          </CardTitle>
          <p className="text-sm text-slate-400">
            Ordenada por prioridad: sin prospectar primero, luego las más antiguas
          </p>
        </CardHeader>
        <CardContent>
          {sortedQueue.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-50" />
              <p>No hay búsquedas en la cola</p>
              <p className="text-xs mt-1">Agrega búsquedas desde las tarjetas de industrias</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedQueue.slice(0, 10).map((search, index) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className="bg-purple-500/20 text-purple-400 shrink-0">
                      #{index + 1}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">
                          {search.industry_name}
                        </p>
                        {search.last_prospected_by && (
                          <Badge variant="outline" className="border-[#444] text-slate-500 text-[10px] px-1.5 py-0 shrink-0">
                            {search.last_prospected_by}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{search.keyword}</p>
                    </div>
                    {search.last_prospected_at ? (
                      <div className="text-xs text-slate-600 shrink-0">
                        {new Date(search.last_prospected_at).toLocaleDateString("es-MX")}
                      </div>
                    ) : (
                      <Badge className="bg-green-500/20 text-green-400 text-xs shrink-0">Nueva</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Button
                      size="sm"
                      onClick={() => handleCopyUrl(search)}
                      className="bg-purple-600 hover:bg-purple-700 h-8"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                </div>
              ))}
              {sortedQueue.length > 10 && (
                <p className="text-center text-xs text-slate-500 py-2">
                  +{sortedQueue.length - 10} más en la cola
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Industries List */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Factory className="w-5 h-5 text-purple-400" />
            Industrias ({industries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {industries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay industrias</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {industries.map((industry) => (
                <AccordionItem
                  key={industry.id}
                  value={industry.id}
                  className="border rounded-lg overflow-hidden border-[#222]"
                >
                  <AccordionTrigger className="hover:no-underline px-4 py-3 bg-[#0a0a0a]">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Factory className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-white">{industry.name}</span>
                      </div>
                      <Badge variant="outline" className="border-[#333] text-slate-400">
                        {industry.searches?.length || 0} búsquedas
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3 mt-2">
                      <IndustrySearchProfileGroups
                        searches={industry.searches || []}
                        onCopyUrl={handleCopyUrl}
                        onDeleteSearch={handleDeleteSearch}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddSearchIndustry(industry);
                          setAddSearchOpen(true);
                        }}
                        className="w-full border-dashed border-[#333] text-slate-400 hover:text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar búsqueda
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteIndustry(industry.id)}
                        className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar industria
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Add Industry Dialog */}
      <Dialog open={addIndustryOpen} onOpenChange={setAddIndustryOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva industria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Nombre de la industria</label>
              <Input
                placeholder="Ej: Farmacéutica, Tecnología, Manufactura"
                value={newIndustryName}
                onChange={(e) => setNewIndustryName(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddIndustryOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleAddIndustry}
              disabled={addingIndustry || !newIndustryName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {addingIndustry ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Search Dialog */}
      <Dialog open={addSearchOpen} onOpenChange={setAddSearchOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              Agregar búsqueda - {addSearchIndustry?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Keyword</label>
              <Input
                placeholder="Ej: marketing, recursos humanos"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">URL de búsqueda de LinkedIn</label>
              <Input
                placeholder="https://linkedin.com/search/results/people/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Perfil asignado</label>
              <Select value={newProfile} onValueChange={setNewProfile}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                  <SelectValue placeholder="Selecciona un perfil" />
                </SelectTrigger>
                <SelectContent>
                  {LINKEDIN_PROFILES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        {p.name} ({p.label})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSearchOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleAddSearch}
              disabled={adding || !newKeyword.trim() || !newUrl.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy URL Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">¿Con qué perfil prospectarás?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-400 mb-4">
              Selecciona el perfil de LinkedIn que usarás para agregar contactos:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={copyProfile === "GB" ? "default" : "outline"}
                onClick={() => setCopyProfile("GB")}
                className={copyProfile === "GB" ? "bg-purple-600" : "border-[#333]"}
              >
                <User className="w-4 h-4 mr-2" />
                Gerardo (GB)
              </Button>
              <Button
                variant={copyProfile === "MG" ? "default" : "outline"}
                onClick={() => setCopyProfile("MG")}
                className={copyProfile === "MG" ? "bg-purple-600" : "border-[#333]"}
              >
                <User className="w-4 h-4 mr-2" />
                María (MG)
              </Button>
            </div>
            {copyingSearch && (
              <div className="mt-4 p-3 bg-[#0a0a0a] rounded border border-[#222]">
                <p className="text-xs text-slate-500">Búsqueda:</p>
                <p className="text-sm text-white">{copyingSearch.keyword}</p>
                <p className="text-xs text-slate-500 mt-1">Industria: {copyingSearch.industry_name}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button onClick={confirmCopyUrl} className="bg-green-600 hover:bg-green-700">
              <Copy className="w-4 h-4 mr-2" />
              Copiar URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default IndustrySearchesContent;
