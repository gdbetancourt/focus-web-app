import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import api from "../lib/api";
import { 
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Building2,
  FileText,
  Key,
  Zap,
  RefreshCw,
  Star,
  Grid3X3,
  Layers
} from "lucide-react";

export default function BuyerPersonasDB() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");
  
  // Dialog states
  const [editingPersona, setEditingPersona] = useState(null);
  const [deletingPersona, setDeletingPersona] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    descripcion: "",
    keywords: ""
  });

  // Helper to parse keywords (can be string or array)
  const parseKeywords = (keywords) => {
    if (!keywords) return [];
    if (Array.isArray(keywords)) return keywords;
    if (typeof keywords === 'string') return keywords.split(';').map(k => k.trim()).filter(k => k);
    return [];
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      const response = await api.get("/buyer-personas-db/");
      setPersonas(response.data);
    } catch (error) {
      console.error("Error loading buyer personas:", error);
      toast.error("Error al cargar buyer personas");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMatrix = async () => {
    setGenerating(true);
    try {
      const response = await api.post("/buyer-personas-db/generate-matrix");
      if (response.data.success) {
        toast.success(`Generados ${response.data.count} buyer personas (${response.data.active_sectors} sectores activos)`);
        loadPersonas();
      }
    } catch (error) {
      console.error("Error generating matrix:", error);
      toast.error("Error al generar matriz");
    } finally {
      setGenerating(false);
    }
  };

  const openEditDialog = (persona) => {
    setFormData({
      name: persona.name || "",
      descripcion: persona.descripcion || "",
      keywords: persona.keywords || ""
    });
    setEditingPersona(persona);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    
    setSaving(true);
    try {
      await api.put(`/buyer-personas-db/${editingPersona.id}`, formData);
      toast.success("Buyer persona actualizado");
      setEditingPersona(null);
      loadPersonas();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPersona) return;
    
    try {
      await api.delete(`/buyer-personas-db/${deletingPersona.id}`);
      toast.success("Buyer persona eliminado");
      setDeletingPersona(null);
      loadPersonas();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const filteredPersonas = personas.filter(p => {
    const search = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(search) ||
      p.sector?.toLowerCase().includes(search) ||
      p.area?.toLowerCase().includes(search) ||
      p.keywords?.toLowerCase().includes(search)
    );
  });

  // Group by sector
  const groupedBySector = filteredPersonas.reduce((acc, persona) => {
    const sector = persona.sector || "Sin sector";
    if (!acc[sector]) acc[sector] = [];
    acc[sector].push(persona);
    return acc;
  }, {});

  // Group by area
  const groupedByArea = filteredPersonas.reduce((acc, persona) => {
    const area = persona.area || "Sin área";
    if (!acc[area]) acc[area] = [];
    acc[area].push(persona);
    return acc;
  }, {});

  // Separate special personas
  const specialPersonas = filteredPersonas.filter(p => p.is_special);
  const activePersonas = filteredPersonas.filter(p => p.is_active_sector && !p.is_special);
  const inactivePersonas = filteredPersonas.filter(p => !p.is_active_sector && !p.is_special);

  // Get unique sectors and areas
  const uniqueSectors = [...new Set(personas.map(p => p.sector).filter(Boolean))];
  const uniqueAreas = [...new Set(personas.map(p => p.area).filter(Boolean))];

  // Stats
  const totalPersonas = personas.length;
  const activeCount = personas.filter(p => p.is_active_sector).length;
  const withKeywords = personas.filter(p => p.keywords).length;

  return (
    <div className="space-y-6" data-testid="buyer-personas-db-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Buyer Personas</h1>
          <p className="text-slate-500 mt-1">
            Matriz de clasificación: {uniqueSectors.length} sectores × {uniqueAreas.length} áreas
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateMatrix}
            disabled={generating}
            className="btn-accent"
          >
            <Zap className={`w-4 h-4 mr-2 ${generating ? 'animate-pulse' : ''}`} />
            {generating ? "Generando..." : "Regenerar Matriz"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalPersonas}</p>
                <p className="text-xs text-slate-500">Total Personas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
                <p className="text-xs text-emerald-600">En Sectores Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Grid3X3 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{uniqueAreas.length}</p>
                <p className="text-xs text-slate-500">Áreas Funcionales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{withKeywords}</p>
                <p className="text-xs text-slate-500">Con Keywords</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, sector, área o keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" />
            Por Sector
          </TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Por Área
          </TabsTrigger>
          <TabsTrigger value="special" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Especiales
          </TabsTrigger>
        </TabsList>

        {/* By Sector Tab */}
        <TabsContent value="matrix" className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Sectors */}
              <Accordion type="multiple" defaultValue={Object.keys(groupedBySector).slice(0, 3)} className="space-y-2">
                {Object.entries(groupedBySector)
                  .filter(([sector]) => sector !== "General" && sector !== "Salud (Externos)" && sector !== "Otros Sectores")
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([sector, sectorPersonas]) => (
                    <AccordionItem key={sector} value={sector} className="border rounded-lg overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 bg-[#0f0f0f] hover:bg-[#151515]">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold">{sector}</span>
                          <Badge variant="secondary" className="ml-2">
                            {sectorPersonas.length} personas
                          </Badge>
                          {sectorPersonas[0]?.is_active_sector && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              Activo
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[180px]">Nombre</TableHead>
                              <TableHead className="w-[180px]">Área</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="w-[200px]">Keywords</TableHead>
                              <TableHead className="w-[80px]">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sectorPersonas.map((persona) => (
                              <TableRow key={persona.id}>
                                <TableCell className="font-semibold text-blue-700">
                                  {persona.display_name || persona.persona_name || persona.name}
                                </TableCell>
                                <TableCell className="font-medium text-slate-300">
                                  {persona.area}
                                </TableCell>
                                <TableCell className="text-sm text-slate-300 max-w-md">
                                  <p className="line-clamp-2">{persona.descripcion || "-"}</p>
                                </TableCell>
                                <TableCell>
                                  {persona.keywords ? (
                                    <div className="flex flex-wrap gap-1">
                                      {parseKeywords(persona.keywords).slice(0, 2).map((kw, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          {kw.trim()}
                                        </Badge>
                                      ))}
                                      {parseKeywords(persona.keywords).length > 2 && (
                                        <Badge variant="outline" className="text-xs">
                                          +{parseKeywords(persona.keywords).length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(persona)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}

                {/* Otros Sectores */}
                {groupedBySector["Otros Sectores"] && (
                  <AccordionItem value="otros-sectores" className="border rounded-lg overflow-hidden border-[#333333]">
                    <AccordionTrigger className="px-4 py-3 bg-[#151515] hover:bg-slate-200">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-slate-300">Otros Sectores</span>
                        <Badge variant="secondary" className="ml-2 bg-slate-200">
                          {groupedBySector["Otros Sectores"].length} personas
                        </Badge>
                        <Badge className="bg-slate-200 text-slate-300 text-xs">
                          Inactivos
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Nombre</TableHead>
                            <TableHead className="w-[180px]">Área</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-[200px]">Keywords</TableHead>
                            <TableHead className="w-[80px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedBySector["Otros Sectores"].map((persona) => (
                            <TableRow key={persona.id} className="bg-[#0f0f0f]/50">
                              <TableCell className="font-semibold text-slate-500">
                                {persona.display_name || persona.persona_name || persona.name}
                              </TableCell>
                              <TableCell className="font-medium text-slate-300">
                                {persona.area}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500 max-w-md">
                                <p className="line-clamp-2">{persona.descripcion || "-"}</p>
                              </TableCell>
                              <TableCell>
                                {persona.keywords ? (
                                  <div className="flex flex-wrap gap-1">
                                    {parseKeywords(persona.keywords).slice(0, 2).map((kw, i) => (
                                      <Badge key={i} variant="outline" className="text-xs bg-[#151515]">
                                        {kw.trim()}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(persona)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          )}
        </TabsContent>

        {/* By Area Tab */}
        <TabsContent value="areas" className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={Object.keys(groupedByArea).slice(0, 2)} className="space-y-2">
              {Object.entries(groupedByArea)
                .filter(([area]) => area !== "Sin Clasificar" && area !== "Médicos Especialistas")
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([area, areaPersonas]) => (
                  <AccordionItem key={area} value={area} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 bg-[#0f0f0f] hover:bg-[#151515]">
                      <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold">{area}</span>
                        <Badge variant="secondary" className="ml-2">
                          {areaPersonas.length} sectores
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Nombre</TableHead>
                            <TableHead className="w-[150px]">Sector</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-[80px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {areaPersonas.map((persona) => (
                            <TableRow key={persona.id} className={!persona.is_active_sector ? "bg-[#0f0f0f]/50" : ""}>
                              <TableCell className="font-semibold text-blue-700">
                                {persona.display_name || persona.persona_name || persona.name}
                              </TableCell>
                              <TableCell className="font-medium">
                                {persona.sector}
                              </TableCell>
                              <TableCell>
                                {persona.is_active_sector ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                    Activo
                                  </Badge>
                                ) : (
                                  <Badge className="bg-[#151515] text-slate-500 text-xs">
                                    Inactivo
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-slate-300 max-w-md">
                                <p className="line-clamp-2">{persona.descripcion || "-"}</p>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(persona)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          )}
        </TabsContent>

        {/* Special Personas Tab */}
        <TabsContent value="special" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Ramona */}
            {filteredPersonas.find(p => p.code === "ramona_medicos") && (
              <Card className="stat-card border-pink-200 bg-pink-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="w-5 h-5 text-pink-500" />
                    Ramona - Médicos Especialistas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 mb-4">
                    {filteredPersonas.find(p => p.code === "ramona_medicos")?.descripcion}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Keywords</Label>
                    <div className="flex flex-wrap gap-1">
                      {filteredPersonas.find(p => p.code === "ramona_medicos")?.keywords?.split(";").slice(0, 6).map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-pink-50 border-pink-200">
                          {kw.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => openEditDialog(filteredPersonas.find(p => p.code === "ramona_medicos"))}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Mateo */}
            {filteredPersonas.find(p => p.code === "mateo_residual") && (
              <Card className="stat-card border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="w-5 h-5 text-amber-500" />
                    Mateo - Sin Clasificar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 mb-4">
                    {filteredPersonas.find(p => p.code === "mateo_residual")?.descripcion}
                  </p>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Keywords</Label>
                    <div className="flex flex-wrap gap-1">
                      {filteredPersonas.find(p => p.code === "mateo_residual")?.keywords?.split(";").slice(0, 6).map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-amber-50 border-amber-200">
                          {kw.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => openEditDialog(filteredPersonas.find(p => p.code === "mateo_residual"))}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info about special personas */}
          <Card className="mt-4 border-blue-200 bg-blue-50/30">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="p-2 bg-blue-100 rounded-lg h-fit">
                  <Star className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Buyer Personas Especiales</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    <strong>Ramona</strong> captura médicos especialistas que no son empleados corporativos.
                    Estos contactos son importantes para relaciones con el sector salud pero no toman decisiones de compra.
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    <strong>Mateo</strong> es el buyer persona residual para contactos que no encajan 
                    en ninguna otra categoría (consultores, emprendedores, asesores, etc.).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingPersona} onOpenChange={() => setEditingPersona(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Buyer Persona</DialogTitle>
            <DialogDescription>
              Modifica la descripción y keywords para mejorar la clasificación con IA
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {editingPersona && (
              <div className="p-3 bg-[#0f0f0f] rounded-lg mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={editingPersona.is_active_sector ? "bg-emerald-100 text-emerald-700" : "bg-[#151515] text-slate-300"}>
                    {editingPersona.is_active_sector ? "Sector Activo" : "Sector Inactivo"}
                  </Badge>
                  {editingPersona.is_special && (
                    <Badge className="bg-amber-100 text-amber-700">
                      <Star className="w-3 h-3 mr-1" />
                      Especial
                    </Badge>
                  )}
                </div>
                <p className="text-sm">
                  <strong>Sector:</strong> {editingPersona.sector} | <strong>Área:</strong> {editingPersona.area}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
                placeholder="Descripción detallada del buyer persona..."
              />
              <p className="text-xs text-slate-500">
                Esta descripción ayuda a la IA a entender mejor el perfil del buyer persona
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Keywords (separadas por punto y coma)
              </Label>
              <Textarea
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                rows={3}
                placeholder="Director de Marketing; Marketing Director; CMO; Head of Marketing"
              />
              <p className="text-xs text-slate-500">
                La IA usa estas palabras clave para identificar contactos por su cargo
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPersona(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingPersona} onOpenChange={() => setDeletingPersona(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar buyer persona?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{deletingPersona?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
