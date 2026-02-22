import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import api from "../lib/api";
import { 
  Compass,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Sparkles,
  Globe,
  FileText,
  BookOpen,
  Users,
  RefreshCw
} from "lucide-react";

export default function ThematicAxes() {
  const [axes, setAxes] = useState([]);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [editingAxis, setEditingAxis] = useState(null);
  const [creatingAxis, setCreatingAxis] = useState(false);
  const [deletingAxis, setDeletingAxis] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    description_en: "",
    hero_title: "",
    hero_title_en: "",
    hero_subtitle: "",
    hero_subtitle_en: "",
    buyer_personas: [],
    key_ideas: ["", "", ""],
    pdf_url: "",
    pdf_url_en: ""
  });

  // Language toggle for editing
  const [editLang, setEditLang] = useState("es");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [axesRes, bpRes] = await Promise.all([
        api.get("/thematic-axes/"),
        api.get("/buyer-personas-db/")
      ]);
      setAxes(axesRes.data || []);
      setBuyerPersonas(bpRes.data?.buyer_personas || bpRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const seedAxes = async () => {
    try {
      await api.post("/thematic-axes/seed");
      toast.success("Ejes temáticos iniciales creados");
      loadData();
    } catch (error) {
      toast.error("Error al crear ejes iniciales");
    }
  };

  const openCreateDialog = () => {
    setFormData({
      name: "",
      name_en: "",
      description: "",
      description_en: "",
      hero_title: "",
      hero_title_en: "",
      hero_subtitle: "",
      hero_subtitle_en: "",
      buyer_personas: [],
      key_ideas: ["", "", ""],
      pdf_url: "",
      pdf_url_en: ""
    });
    setEditLang("es");
    setCreatingAxis(true);
  };

  const openEditDialog = (axis) => {
    setFormData({
      name: axis.name || "",
      name_en: axis.name_en || "",
      description: axis.description || "",
      description_en: axis.description_en || "",
      hero_title: axis.hero_title || axis.headline || "",
      hero_title_en: axis.hero_title_en || "",
      hero_subtitle: axis.hero_subtitle || axis.subheadline || "",
      hero_subtitle_en: axis.hero_subtitle_en || "",
      buyer_personas: axis.buyer_personas || [],
      key_ideas: axis.key_ideas || ["", "", ""],
      pdf_url: axis.pdf_url || "",
      pdf_url_en: axis.pdf_url_en || ""
    });
    setEditLang("es");
    setEditingAxis(axis);
  };

  const toggleBuyerPersona = (bpId) => {
    setFormData(prev => {
      const current = prev.buyer_personas || [];
      if (current.includes(bpId)) {
        return { ...prev, buyer_personas: current.filter(id => id !== bpId) };
      } else {
        return { ...prev, buyer_personas: [...current, bpId] };
      }
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.hero_title.trim()) {
      toast.error("El título Hero es requerido");
      return;
    }
    if (!formData.hero_subtitle.trim()) {
      toast.error("El subtítulo Hero es requerido");
      return;
    }
    
    setSaving(true);
    try {
      if (editingAxis) {
        // Update all fields in one call
        await api.put(`/thematic-axes/${editingAxis.id}`, {
          name: formData.name,
          description: formData.description,
          hero_title: formData.hero_title,
          hero_subtitle: formData.hero_subtitle,
          buyer_personas: formData.buyer_personas
        });
        toast.success("Eje temático actualizado");
      } else {
        await api.post("/thematic-axes/", {
          name: formData.name,
          description: formData.description,
          hero_title: formData.hero_title,
          hero_subtitle: formData.hero_subtitle,
          buyer_personas: formData.buyer_personas
        });
        toast.success("Eje temático creado");
      }
      
      setEditingAxis(null);
      setCreatingAxis(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAxis) return;
    
    try {
      await api.delete(`/thematic-axes/${deletingAxis.id}`);
      toast.success("Eje temático eliminado");
      setDeletingAxis(null);
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  // Get buyer persona names for display
  const getBuyerPersonaNames = (bpIds) => {
    if (!bpIds || bpIds.length === 0) return null;
    return bpIds.map(id => {
      const bp = buyerPersonas.find(p => (p.id || p.code) === id);
      return bp ? bp.display_name || bp.name : id;
    }).filter(Boolean);
  };

  return (
    <div className="space-y-6" data-testid="thematic-axes-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ejes Temáticos</h1>
          <p className="text-slate-500 mt-1">
            {axes.length} tema{axes.length !== 1 ? 's' : ''} • Define los temas para tus webinars y newsletters
          </p>
        </div>
        <div className="flex gap-2">
          {axes.length === 0 && (
            <Button 
              onClick={seedAxes}
              variant="outline"
              className="border-[#333]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Crear Iniciales
            </Button>
          )}
          <Button 
            onClick={openCreateDialog}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
            data-testid="create-axis-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Tema
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-400">¿Cómo funcionan los ejes temáticos?</h3>
              <p className="text-sm text-slate-400 mt-1">
                Cada eje temático tiene: título/subtítulo para el Hero del website, 
                buyer personas asociados (quiénes reciben ese newsletter), 
                y se usa para generar eventos y contenido relacionado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Axes List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
        </div>
      ) : axes.length > 0 ? (
        <div className="space-y-3">
          {axes.map((axis, index) => {
            const bpNames = getBuyerPersonaNames(axis.buyer_personas);
            return (
              <Card 
                key={axis.id} 
                className="bg-[#111] border-[#222] hover:border-[#333] transition-all"
                data-testid={`axis-card-${axis.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl">
                      <BookOpen className="w-6 h-6 text-purple-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-white">{axis.name}</h3>
                      {axis.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{axis.description}</p>
                      )}
                      
                      {/* Hero Info */}
                      {(axis.hero_title || axis.headline) && (
                        <div className="mt-2 p-2 bg-[#0a0a0a] rounded text-xs">
                          <span className="text-slate-500">Hero: </span>
                          <span className="text-white">{axis.hero_title || axis.headline}</span>
                          {(axis.hero_subtitle || axis.subheadline) && (
                            <span className="text-[#ff3300]"> {axis.hero_subtitle || axis.subheadline}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Buyer Personas */}
                      {bpNames && bpNames.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Users className="w-3 h-3 text-slate-500 mt-0.5" />
                          {bpNames.map((name, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-slate-600 text-slate-400">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <Badge variant="secondary" className="shrink-0 bg-[#222]">
                      #{index + 1}
                    </Badge>
                    
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(axis)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingAxis(axis)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-12 text-center">
            <Compass className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay ejes temáticos</h3>
            <p className="text-slate-500 mb-4">Agrega temas para tus webinars y newsletters</p>
            <div className="flex justify-center gap-2">
              <Button onClick={seedAxes} variant="outline" className="border-[#333]">
                Crear Iniciales
              </Button>
              <Button onClick={openCreateDialog} className="bg-[#ff3300] hover:bg-[#cc2900]">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Tema
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={creatingAxis || !!editingAxis} onOpenChange={(open) => {
        if (!open) {
          setCreatingAxis(false);
          setEditingAxis(null);
        }
      }}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingAxis ? "Editar Eje Temático" : "Nuevo Eje Temático"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingAxis ? "Modifica el tema y sus propiedades" : "Agrega un nuevo tema para webinars y newsletters"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Language Tabs */}
            <Tabs value={editLang} onValueChange={setEditLang} className="w-full">
              <TabsList className="grid grid-cols-2 bg-[#0a0a0a]">
                <TabsTrigger value="es" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                  🇪🇸 Español
                </TabsTrigger>
                <TabsTrigger value="en" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                  🇺🇸 English
                </TabsTrigger>
              </TabsList>
              
              {/* Spanish Content */}
              <TabsContent value="es" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Nombre del tema *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Inteligencia Artificial"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-[#0a0a0a] border-[#333]"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">Descripción</Label>
                  <Textarea
                    id="description"
                    placeholder="Breve descripción del tema..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                
                {/* Hero Section Fields - Spanish */}
                <div className="border-t border-[#222] pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 mb-3">Hero del Website *</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="hero_title" className="text-slate-300">Título Hero *</Label>
                      <Input
                        id="hero_title"
                        placeholder="Ej: Domina la IA"
                        value={formData.hero_title}
                        onChange={(e) => setFormData(prev => ({ ...prev, hero_title: e.target.value }))}
                        className="bg-[#0a0a0a] border-[#333]"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="hero_subtitle" className="text-slate-300">Subtítulo Hero *</Label>
                      <Input
                        id="hero_subtitle"
                        placeholder="Ej: en tu negocio"
                        value={formData.hero_subtitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, hero_subtitle: e.target.value }))}
                        className="bg-[#0a0a0a] border-[#333]"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                {/* PDF Spanish */}
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF en Español
                  </Label>
                  <Input
                    placeholder="URL del PDF en español..."
                    value={formData.pdf_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, pdf_url: e.target.value }))}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
              </TabsContent>
              
              {/* English Content */}
              <TabsContent value="en" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name_en" className="text-slate-300">Topic Name</Label>
                  <Input
                    id="name_en"
                    placeholder="e.g. Artificial Intelligence"
                    value={formData.name_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description_en" className="text-slate-300">Description</Label>
                  <Textarea
                    id="description_en"
                    placeholder="Brief description..."
                    value={formData.description_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, description_en: e.target.value }))}
                    rows={2}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                
                {/* Hero Section Fields - English */}
                <div className="border-t border-[#222] pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 mb-3">Website Hero</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="hero_title_en" className="text-slate-300">Hero Title</Label>
                      <Input
                        id="hero_title_en"
                        placeholder="e.g. Master AI"
                        value={formData.hero_title_en}
                        onChange={(e) => setFormData(prev => ({ ...prev, hero_title_en: e.target.value }))}
                        className="bg-[#0a0a0a] border-[#333]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="hero_subtitle_en" className="text-slate-300">Hero Subtitle</Label>
                      <Input
                        id="hero_subtitle_en"
                        placeholder="e.g. in your business"
                        value={formData.hero_subtitle_en}
                        onChange={(e) => setFormData(prev => ({ ...prev, hero_subtitle_en: e.target.value }))}
                        className="bg-[#0a0a0a] border-[#333]"
                      />
                    </div>
                  </div>
                </div>
                
                {/* PDF English */}
                <div className="space-y-2">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF in English
                  </Label>
                  <Input
                    placeholder="English PDF URL..."
                    value={formData.pdf_url_en}
                    onChange={(e) => setFormData(prev => ({ ...prev, pdf_url_en: e.target.value }))}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            {/* Buyer Personas (shared between languages) */}
            <div className="border-t border-[#222] pt-4 mt-4">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">
                <Users className="w-4 h-4 inline mr-2" />
                Buyer Personas (reciben newsletter de este tema)
              </h4>
              
              {buyerPersonas.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {buyerPersonas.map(bp => {
                    const bpKey = bp.id || bp.code;
                    return (
                      <div 
                        key={bpKey} 
                        className="flex items-center gap-2 p-2 bg-[#0a0a0a] rounded cursor-pointer hover:bg-[#1a1a1a]"
                        onClick={() => toggleBuyerPersona(bpKey)}
                      >
                        <Checkbox 
                          checked={formData.buyer_personas?.includes(bpKey)}
                          onCheckedChange={() => {}}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-slate-300">{bp.display_name || bp.name}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No hay buyer personas configurados</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreatingAxis(false);
              setEditingAxis(null);
            }} className="border-[#333]">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !formData.name.trim() || !formData.hero_title.trim() || !formData.hero_subtitle.trim()}
              className="bg-[#ff3300] hover:bg-[#cc2900]"
            >
              {saving ? "Guardando..." : (editingAxis ? "Actualizar" : "Crear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAxis} onOpenChange={() => setDeletingAxis(null)}>
        <AlertDialogContent className="bg-[#111] border-[#222]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar eje temático?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción no se puede deshacer. Se eliminará "{deletingAxis?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#333]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
