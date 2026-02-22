import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Factory, Loader2, Download, ArrowRightLeft, Target, Inbox, Merge, Check, X, Lock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Industries() {
  const { can } = useAuth();
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [togglingClassification, setTogglingClassification] = useState(null);
  
  // Permission checks
  const canCreate = can('industries', 'create');
  const canEdit = can('industries', 'edit');
  const canDelete = can('industries', 'delete');
  const canMerge = can('industries', 'merge');
  const canChangeClassification = can('industries', 'change_classification');
  
  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [primaryIndustry, setPrimaryIndustry] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergePreview, setMergePreview] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    color: "#6366f1",
    classification: "inbound"
  });

  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      // Use industries-v2 endpoint which has classification support
      const response = await api.get("/industries-v2");
      setIndustries(response.data.industries || []);
    } catch (error) {
      console.error("Error loading industries:", error);
      // Fallback to old endpoint
      try {
        const fallback = await api.get("/industries/");
        setIndustries(fallback.data.industries || []);
      } catch (e) {
        toast.error("Error al cargar industrias");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const response = await api.post("/industries/load-defaults");
      toast.success(`Added ${response.data.added} industries, ${response.data.skipped} already existed`);
      loadIndustries();
    } catch (error) {
      console.error("Error loading defaults:", error);
      toast.error("Failed to load default industries");
    } finally {
      setLoadingDefaults(false);
    }
  };

  const openCreateDialog = () => {
    setEditingIndustry(null);
    setFormData({ name: "", code: "", description: "", color: "#6366f1", classification: "inbound" });
    setShowDialog(true);
  };

  const openEditDialog = (industry) => {
    setEditingIndustry(industry);
    setFormData({
      name: industry.name,
      code: industry.code,
      description: industry.description || "",
      color: industry.color || "#6366f1",
      classification: industry.classification || "inbound"
    });
    setShowDialog(true);
  };

  const toggleClassification = async (industry) => {
    setTogglingClassification(industry.id);
    const newClassification = industry.classification === "outbound" ? "inbound" : "outbound";
    
    try {
      // Try industries-v2 endpoint first
      await api.patch(`/industries-v2/${industry.id}/classification`, {
        classification: newClassification
      });
      
      // Update local state
      setIndustries(prev => prev.map(ind => 
        ind.id === industry.id 
          ? { ...ind, classification: newClassification }
          : ind
      ));
      
      toast.success(`Industria marcada como ${newClassification === "outbound" ? "Outbound" : "Inbound"}`);
    } catch (error) {
      console.error("Error toggling classification:", error);
      // Fallback to old endpoint
      try {
        await api.put(`/industries/${industry.id}`, {
          classification: newClassification
        });
        setIndustries(prev => prev.map(ind => 
          ind.id === industry.id 
            ? { ...ind, classification: newClassification }
            : ind
        ));
        toast.success(`Industria marcada como ${newClassification === "outbound" ? "Outbound" : "Inbound"}`);
      } catch (e) {
        toast.error("Error al cambiar clasificación");
      }
    } finally {
      setTogglingClassification(null);
    }
  };

  // Merge functions
  const toggleMergeMode = () => {
    setMergeMode(!mergeMode);
    setSelectedForMerge([]);
    setPrimaryIndustry(null);
  };

  const toggleIndustrySelection = (industry) => {
    setSelectedForMerge(prev => {
      const isSelected = prev.some(i => i.id === industry.id);
      if (isSelected) {
        // Remove from selection
        const newSelection = prev.filter(i => i.id !== industry.id);
        // If we removed the primary, reset it
        if (primaryIndustry?.id === industry.id) {
          setPrimaryIndustry(newSelection[0] || null);
        }
        return newSelection;
      } else {
        // Add to selection
        const newSelection = [...prev, industry];
        // Set first selected as primary if no primary set
        if (!primaryIndustry && newSelection.length === 1) {
          setPrimaryIndustry(industry);
        }
        return newSelection;
      }
    });
  };

  const openMergeDialog = async () => {
    if (selectedForMerge.length < 2) {
      toast.error("Selecciona al menos 2 industrias para combinar");
      return;
    }
    
    if (!primaryIndustry) {
      setPrimaryIndustry(selectedForMerge[0]);
    }
    
    // Get merge preview
    try {
      const secondaryIds = selectedForMerge
        .filter(i => i.id !== primaryIndustry?.id)
        .map(i => i.id)
        .join(",");
      
      const response = await api.get(`/industries-v2/merge/preview`, {
        params: {
          primary_id: primaryIndustry?.id || selectedForMerge[0].id,
          secondary_ids: secondaryIds
        }
      });
      setMergePreview(response.data);
    } catch (error) {
      console.error("Error getting merge preview:", error);
      setMergePreview(null);
    }
    
    setShowMergeDialog(true);
  };

  const executeMerge = async () => {
    if (!primaryIndustry || selectedForMerge.length < 2) return;
    
    setMerging(true);
    try {
      const industriesToMerge = selectedForMerge
        .filter(i => i.id !== primaryIndustry.id)
        .map(i => i.id);
      
      await api.post("/industries-v2/merge", {
        primary_industry_id: primaryIndustry.id,
        industries_to_merge: industriesToMerge
      });
      
      toast.success(`${industriesToMerge.length} industrias combinadas en "${primaryIndustry.name}"`);
      setShowMergeDialog(false);
      setMergeMode(false);
      setSelectedForMerge([]);
      setPrimaryIndustry(null);
      loadIndustries();
    } catch (error) {
      console.error("Error merging industries:", error);
      toast.error(error.response?.data?.detail || "Error al combinar industrias");
    } finally {
      setMerging(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      toast.error("Name and code are required");
      return;
    }

    try {
      if (editingIndustry) {
        await api.put(`/industries/${editingIndustry.id}`, formData);
        toast.success("Industry updated");
      } else {
        await api.post("/industries/", formData);
        toast.success("Industry created");
      }
      setShowDialog(false);
      loadIndustries();
    } catch (error) {
      console.error("Error saving industry:", error);
      toast.error(error.response?.data?.detail || "Failed to save industry");
    }
  };

  const deleteIndustry = async (industry) => {
    if (!confirm(`Delete "${industry.name}"?`)) return;
    
    try {
      await api.delete(`/industries/${industry.id}`);
      toast.success("Industry deleted");
      loadIndustries();
    } catch (error) {
      console.error("Error deleting industry:", error);
      toast.error("Failed to delete industry");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="industries-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Industries</h2>
          <p className="text-slate-500 text-sm">
            Industry list for events and sponsorship categorization
          </p>
        </div>
        <div className="flex gap-2">
          {mergeMode ? (
            <>
              <Button
                onClick={toggleMergeMode}
                variant="outline"
                className="border-red-500/30 text-red-400"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={openMergeDialog}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={selectedForMerge.length < 2}
              >
                <Merge className="w-4 h-4 mr-2" />
                Combinar ({selectedForMerge.length})
              </Button>
            </>
          ) : (
            <>
              {canMerge && (
                <Button
                  onClick={toggleMergeMode}
                  variant="outline"
                  className="border-[#333] text-slate-300"
                >
                  <Merge className="w-4 h-4 mr-2" />
                  Combinar
                </Button>
              )}
              <Button
                onClick={loadDefaults}
                variant="outline"
                className="border-[#333] text-slate-300"
                disabled={loadingDefaults}
              >
                {loadingDefaults ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="ml-2">Load Defaults</span>
              </Button>
              {canCreate && (
                <Button onClick={openCreateDialog} className="bg-[#ff3300] hover:bg-[#e62e00]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Industry
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Industries Grid */}
      {industries.length === 0 ? (
        <Card className="bg-[#111111] border-[#222]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-500 text-center mb-4">
              No industries configured yet
            </p>
            {canCreate && (
              <Button onClick={loadDefaults} variant="outline" className="border-[#333]">
                Load Default Industries
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {industries.map((industry) => {
            const isSelected = selectedForMerge.some(i => i.id === industry.id);
            const isPrimary = primaryIndustry?.id === industry.id;
            
            return (
            <Card 
              key={industry.id} 
              className={`bg-[#111111] border-[#222] hover:border-[#333] transition-colors cursor-pointer ${
                mergeMode && isSelected ? 'ring-2 ring-blue-500' : ''
              } ${mergeMode && isPrimary ? 'ring-2 ring-green-500' : ''}`}
              onClick={mergeMode ? (e) => {
                // Prevent double-toggle when clicking checkbox
                if (e.target.closest('[role="checkbox"]')) return;
                toggleIndustrySelection(industry);
              } : undefined}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {mergeMode ? (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleIndustrySelection(industry)}
                          className="w-5 h-5"
                        />
                        {isPrimary && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" title="Industria principal" />
                        )}
                      </div>
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${industry.color}20` }}
                      >
                        <Factory 
                          className="w-5 h-5" 
                          style={{ color: industry.color }} 
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-white">{industry.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {industry.code}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            industry.classification === "outbound" 
                              ? "bg-green-500/10 text-green-400 border-green-500/30" 
                              : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                          }`}
                        >
                          {industry.classification === "outbound" ? (
                            <><Target className="w-3 h-3 mr-1" /> Outbound</>
                          ) : (
                            <><Inbox className="w-3 h-3 mr-1" /> Inbound</>
                          )}
                        </Badge>
                        {mergeMode && isPrimary && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            Principal
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {!mergeMode && (
                    <div className="flex gap-1">
                      {canChangeClassification && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 w-8 p-0 ${
                            industry.classification === "outbound" 
                              ? "text-green-400 hover:text-green-300" 
                              : "text-slate-500 hover:text-white"
                          }`}
                          onClick={() => toggleClassification(industry)}
                          disabled={togglingClassification === industry.id}
                          title={industry.classification === "outbound" ? "Cambiar a Inbound" : "Cambiar a Outbound"}
                        >
                          {togglingClassification === industry.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-white"
                          onClick={() => openEditDialog(industry)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-red-500"
                          onClick={() => deleteIndustry(industry)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  {mergeMode && isSelected && !isPrimary && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-500/30 text-green-400"
                      onClick={(e) => { e.stopPropagation(); setPrimaryIndustry(industry); }}
                    >
                      Principal
                    </Button>
                  )}
                </div>
                {industry.description && (
                  <p className="text-slate-500 text-sm mt-3 line-clamp-2">
                    {industry.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )})}
        </div>
      )}

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="bg-[#111111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="w-5 h-5" />
              Combinar Industrias
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Las industrias seleccionadas se combinarán en la industria principal.
              Las empresas asociadas serán actualizadas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Primary Industry */}
            <div className="space-y-2">
              <Label className="text-slate-400">Industria Principal (se conserva)</Label>
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-white font-medium">{primaryIndustry?.name}</span>
                </div>
              </div>
            </div>
            
            {/* Industries to merge */}
            <div className="space-y-2">
              <Label className="text-slate-400">Industrias a combinar (se eliminarán)</Label>
              <div className="space-y-2">
                {selectedForMerge
                  .filter(i => i.id !== primaryIndustry?.id)
                  .map(industry => (
                    <div key={industry.id} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-slate-300">{industry.name}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            {/* Preview */}
            {mergePreview && (
              <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-lg">
                <p className="text-sm text-slate-400">
                  <span className="text-white font-medium">{mergePreview.total_companies_affected}</span> empresas serán actualizadas
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowMergeDialog(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={executeMerge}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={merging}
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Combinando...
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Confirmar Combinación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#111111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingIndustry ? "Edit Industry" : "Add Industry"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {editingIndustry 
                ? "Update industry details"
                : "Create a new industry for event categorization"
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Pharmaceutical"
                className="bg-[#0a0a0a] border-[#222]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  code: e.target.value.toLowerCase().replace(/\s+/g, "_") 
                })}
                placeholder="e.g., pharma"
                className="bg-[#0a0a0a] border-[#222]"
                disabled={!!editingIndustry}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
                className="bg-[#0a0a0a] border-[#222]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 p-1 bg-[#0a0a0a] border-[#222]"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#6366f1"
                  className="flex-1 bg-[#0a0a0a] border-[#222]"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="classification">Clasificación</Label>
              <Select
                value={formData.classification}
                onValueChange={(value) => setFormData({ ...formData, classification: value })}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#222]">
                  <SelectValue placeholder="Seleccionar clasificación" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#222]">
                  <SelectItem value="inbound">
                    <span className="flex items-center gap-2">
                      <Inbox className="w-4 h-4" /> Inbound
                    </span>
                  </SelectItem>
                  <SelectItem value="outbound">
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4" /> Outbound
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Outbound = industrias activas para prospección
              </p>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#ff3300] hover:bg-[#e62e00]">
                {editingIndustry ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
