/**
 * ProspectionTabContent - Manual prospection with LinkedIn search URLs
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { CompanyEditorDialog } from "../CompanyEditorDialog";
import {
  Building2,
  Search,
  Plus,
  Copy,
  Trash2,
  Clock,
  User,
  RefreshCw,
  CheckCircle,
  Merge,
  Edit,
  Check,
  Wrench,
} from "lucide-react";

const PROFILES = {
  GB: "Gerardo Betancourt",
  MG: "María del Mar Gargari"
};

export function ProspectionTabContent() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Add search dialog
  const [addSearchOpen, setAddSearchOpen] = useState(false);
  const [addSearchCompany, setAddSearchCompany] = useState(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  
  // Copy URL dialog - select profile
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyingSearch, setCopyingSearch] = useState(null);
  const [copyProfile, setCopyProfile] = useState("GB");
  
  // Merge companies state
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [targetCompany, setTargetCompany] = useState(null);
  const [targetName, setTargetName] = useState("");
  const [merging, setMerging] = useState(false);
  
  // Edit company state - using CompanyEditorDialog
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const companiesRes = await api.get("/prospection/active-companies");
      setCompanies(companiesRes.data.companies || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleAddSearch = async () => {
    if (!addSearchCompany || !newKeyword.trim() || !newUrl.trim()) return;
    
    setAdding(true);
    try {
      await api.post(`/prospection/companies/${addSearchCompany.id}/searches`, {
        keyword: newKeyword.trim(),
        url: newUrl.trim()
      });
      
      toast.success("Búsqueda agregada");
      setAddSearchOpen(false);
      setNewKeyword("");
      setNewUrl("");
      setAddSearchCompany(null);
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
      await api.delete(`/prospection/searches/${searchId}`);
      toast.success("Búsqueda eliminada");
      loadData();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };
  
  // Open copy dialog to select profile
  const handleCopyUrl = (search) => {
    setCopyingSearch(search);
    setCopyDialogOpen(true);
  };
  
  // Confirm copy with selected profile
  const confirmCopyUrl = async () => {
    if (!copyingSearch) return;
    
    try {
      // Copy to clipboard first
      const copied = await copyToClipboard(copyingSearch.url);
      if (!copied) {
        toast.error("No se pudo copiar al portapapeles");
        return;
      }
      
      // Mark as copied with profile
      await api.post(`/prospection/searches/${copyingSearch.id}/mark-copied`, {
        profile: copyProfile
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
  
  // Toggle merge selection
  const toggleMergeSelection = (company) => {
    setSelectedForMerge(prev => {
      const isSelected = prev.find(c => c.id === company.id);
      if (isSelected) {
        if (targetCompany?.id === company.id) {
          setTargetCompany(null);
          setTargetName("");
        }
        return prev.filter(c => c.id !== company.id);
      } else {
        return [...prev, company];
      }
    });
  };
  
  // Set target for merge
  const handleSetTarget = (company) => {
    setTargetCompany(company);
    setTargetName(company.name);
  };
  
  // Execute merge
  const handleMerge = async () => {
    if (!targetCompany || selectedForMerge.length < 2 || !targetName.trim()) {
      toast.error("Selecciona empresas y escribe el nombre final");
      return;
    }
    
    setMerging(true);
    try {
      const sourceIds = selectedForMerge
        .filter(c => c.id !== targetCompany.id)
        .map(c => c.id);
      
      const res = await api.post("/prospection/companies/merge", {
        source_ids: sourceIds,
        target_id: targetCompany.id,
        target_name: targetName.trim()
      });
      
      toast.success(`Combinadas: ${res.data.contacts_updated} contactos actualizados`);
      setMergeDialogOpen(false);
      setSelectedForMerge([]);
      setTargetCompany(null);
      setTargetName("");
      loadData();
    } catch (error) {
      console.error("Error merging:", error);
      toast.error("Error al combinar");
    } finally {
      setMerging(false);
    }
  };
  
  // Open edit company dialog - using full editor
  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setEditCompanyOpen(true);
  };
  
  // Check if company name is invalid (numeric)
  const isInvalidName = (name) => /^\d+$/.test(name);

  // Build global search queue from all companies
  const allSearches = companies.flatMap(company => 
    (company.searches || []).map(search => ({
      ...search,
      company_name: company.name,
      company_id: company.id
    }))
  );
  
  // Sort: not prospected first, then oldest prospected
  const sortedQueue = [...allSearches].sort((a, b) => {
    const aProspected = a.last_prospected_at;
    const bProspected = b.last_prospected_at;
    
    // Not prospected first
    if (!aProspected && bProspected) return -1;
    if (aProspected && !bProspected) return 1;
    if (!aProspected && !bProspected) return 0;
    
    // Then by date (oldest first)
    return aProspected.localeCompare(bProspected);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="prospection-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="prospection-tab">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#ff3300]/30 text-[#ff3300]">
            {sortedQueue.length} búsquedas en cola
          </Badge>
          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
            {companies.length} empresas activas
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedForMerge.length >= 2 && (
            <Button
              size="sm"
              onClick={() => setMergeDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Merge className="w-4 h-4 mr-2" />
              Combinar ({selectedForMerge.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadData} className="border-[#333]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Search Queue */}
      <Card className="bg-gradient-to-br from-[#ff3300]/10 to-orange-500/5 border-[#ff3300]/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Clock className="w-5 h-5 text-[#ff3300]" />
            Cola de Prospección
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
              <p className="text-xs mt-1">Agrega búsquedas desde las tarjetas de empresas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedQueue.slice(0, 10).map((search, index) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-[#ff3300]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className="bg-[#ff3300]/20 text-[#ff3300] shrink-0">
                      #{index + 1}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium truncate">
                          {search.company_name}
                        </p>
                        {search.last_prospected_by && (
                          <Badge variant="outline" className="border-[#444] text-slate-500 text-[10px] px-1.5 py-0 shrink-0">
                            {search.last_prospected_by}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {search.keyword}
                      </p>
                    </div>
                    {search.last_prospected_at ? (
                      <div className="text-xs text-slate-600 shrink-0">
                        {new Date(search.last_prospected_at).toLocaleDateString('es-MX')}
                      </div>
                    ) : (
                      <Badge className="bg-green-500/20 text-green-400 text-xs shrink-0">
                        Nueva
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Button
                      size="sm"
                      onClick={() => handleCopyUrl(search)}
                      className="bg-[#ff3300] hover:bg-[#cc2900] h-8"
                      title="Copiar URL y marcar como prospectada"
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

      {/* Active Companies */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Building2 className="w-5 h-5 text-blue-400" />
            Empresas Activas ({companies.length})
          </CardTitle>
          <p className="text-sm text-slate-500">
            Empresas con casos ganados (Stage 4/5), ordenadas por cantidad. Selecciona varias para combinar.
          </p>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay empresas activas</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {companies.map(company => {
                const isSelected = selectedForMerge.find(c => c.id === company.id);
                const isTarget = targetCompany?.id === company.id;
                const hasInvalidName = isInvalidName(company.name);
                
                return (
                <AccordionItem
                  key={company.id}
                  value={company.id}
                  className={`border rounded-lg overflow-hidden ${isTarget ? 'border-purple-500' : hasInvalidName ? 'border-yellow-500/50' : 'border-[#222]'}`}
                >
                  <AccordionTrigger className="hover:no-underline px-4 py-3 bg-[#0a0a0a]">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!!isSelected}
                          onCheckedChange={() => toggleMergeSelection(company)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Building2 className={`w-4 h-4 ${hasInvalidName ? 'text-yellow-400' : 'text-blue-400'}`} />
                        <span className={`font-medium ${hasInvalidName ? 'text-yellow-400' : 'text-white'}`}>
                          {company.name}
                        </span>
                        {hasInvalidName && (
                          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">
                            ID numérico
                          </Badge>
                        )}
                        {isTarget && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-xs">Principal</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCompany(company);
                          }}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400"
                          title="Editar empresa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {company.case_count > 0 && (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">
                            {company.case_count} {company.case_count === 1 ? 'caso ganado' : 'casos ganados'}
                          </Badge>
                        )}
                        <Badge variant="outline" className="border-[#333] text-slate-400">
                          {company.searches?.length || 0} búsquedas
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3 mt-2">
                      {/* Searches List */}
                      {company.searches?.length > 0 ? (
                        <div className="space-y-2">
                          {company.searches.map(search => (
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
                                      Prospectado: {new Date(search.last_prospected_at).toLocaleDateString('es-MX')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyUrl(search)}
                                  className="h-8 w-8 p-0 text-slate-500 hover:text-green-400"
                                  title="Copiar URL y marcar como usada"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteSearch(search.id)}
                                  className="h-8 w-8 p-0 text-slate-500 hover:text-red-400"
                                  title="Eliminar búsqueda"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No hay búsquedas configuradas
                        </p>
                      )}
                      
                      {/* Add Search Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddSearchCompany(company);
                          setAddSearchOpen(true);
                        }}
                        className="w-full border-dashed border-[#333] text-slate-400 hover:text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar búsqueda
                      </Button>
                      
                      {/* Mark as target for merge if selected */}
                      {isSelected && selectedForMerge.length >= 2 && !isTarget && (
                        <Button
                          size="sm"
                          onClick={() => handleSetTarget(company)}
                          className="w-full bg-purple-600 hover:bg-purple-700 mt-2"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Marcar como empresa principal
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Add Search Dialog */}
      <Dialog open={addSearchOpen} onOpenChange={setAddSearchOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              Agregar búsqueda - {addSearchCompany?.name}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSearchOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleAddSearch}
              disabled={adding || !newKeyword.trim() || !newUrl.trim()}
              className="bg-[#ff3300] hover:bg-[#cc2900]"
            >
              {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy URL Dialog - Select Profile */}
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
                className={copyProfile === "GB" ? "bg-[#ff3300]" : "border-[#333]"}
              >
                <User className="w-4 h-4 mr-2" />
                Gerardo (GB)
              </Button>
              <Button
                variant={copyProfile === "MG" ? "default" : "outline"}
                onClick={() => setCopyProfile("MG")}
                className={copyProfile === "MG" ? "bg-[#ff3300]" : "border-[#333]"}
              >
                <User className="w-4 h-4 mr-2" />
                María (MG)
              </Button>
            </div>
            {copyingSearch && (
              <div className="mt-4 p-3 bg-[#0a0a0a] rounded border border-[#222]">
                <p className="text-xs text-slate-500">Búsqueda:</p>
                <p className="text-sm text-white">{copyingSearch.keyword}</p>
                <p className="text-xs text-slate-500 mt-1">Empresa: {copyingSearch.company_name}</p>
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

      {/* Merge Companies Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-purple-400" />
              Combinar Empresas
            </DialogTitle>
            <DialogDescription>
              Selecciona la empresa principal y el nombre final
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Empresas a combinar:</label>
              <div className="space-y-2">
                {selectedForMerge.map(company => (
                  <div
                    key={company.id}
                    className={`flex items-center justify-between p-2 rounded border ${
                      targetCompany?.id === company.id 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-[#333] bg-[#0a0a0a]'
                    }`}
                  >
                    <span className="text-white">{company.name}</span>
                    <Button
                      size="sm"
                      variant={targetCompany?.id === company.id ? "default" : "outline"}
                      onClick={() => handleSetTarget(company)}
                      className={targetCompany?.id === company.id ? "bg-purple-600" : "border-[#333]"}
                    >
                      {targetCompany?.id === company.id ? <Check className="w-4 h-4" /> : "Principal"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            {targetCompany && (
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Nombre final:</label>
                <Input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="Nombre de la empresa combinada"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !targetCompany || !targetName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {merging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
              Combinar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog - Full Editor */}
      <CompanyEditorDialog
        open={editCompanyOpen}
        onOpenChange={setEditCompanyOpen}
        companyId={editingCompany?.id}
        companyName={editingCompany?.name}
        onSaved={() => {
          loadData();
          setEditingCompany(null);
        }}
      />
    </div>
  );
}

export default ProspectionTabContent;
