import { useState, useEffect } from "react";
import { Medal, Plus, Edit2, Trash2, Loader2, GripVertical } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import api from "../lib/api";

export default function NivelesPage() {
  const [niveles, setNiveles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNivel, setEditingNivel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    certification_name: "",
    advancement_es: "",
    advancement_en: ""
  });

  const loadNiveles = async () => {
    try {
      setLoading(true);
      const res = await api.get("/website-config/niveles");
      setNiveles(res.data.niveles || []);
    } catch (error) {
      toast.error("Error loading niveles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNiveles();
  }, []);

  const handleSubmit = async () => {
    if (!formData.certification_name || !formData.advancement_es || !formData.advancement_en) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    setSaving(true);
    try {
      if (editingNivel) {
        await api.put(`/website-config/niveles/${editingNivel.id}`, formData);
        toast.success("Nivel actualizado");
      } else {
        await api.post("/website-config/niveles", formData);
        toast.success("Nivel creado");
      }
      setDialogOpen(false);
      resetForm();
      loadNiveles();
    } catch (error) {
      toast.error("Error guardando nivel");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (nivel) => {
    setEditingNivel(nivel);
    setFormData({
      certification_name: nivel.certification_name || nivel.name || "",
      advancement_es: nivel.advancement_es || "",
      advancement_en: nivel.advancement_en || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este nivel de certificación?")) return;
    try {
      await api.delete(`/website-config/niveles/${id}`);
      toast.success("Nivel eliminado");
      loadNiveles();
    } catch (error) {
      toast.error("Error eliminando nivel");
    }
  };

  const handleSeed = async () => {
    try {
      const res = await api.post("/website-config/niveles/seed");
      toast.success(res.data.message);
      loadNiveles();
    } catch (error) {
      toast.error("Error seeding niveles");
    }
  };

  const resetForm = () => {
    setEditingNivel(null);
    setFormData({ certification_name: "", advancement_es: "", advancement_en: "" });
  };

  const getLevelColor = (order) => {
    const colors = {
      1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      2: "bg-green-500/20 text-green-400 border-green-500/30",
      3: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      4: "bg-purple-500/20 text-purple-400 border-purple-500/30"
    };
    return colors[order] || "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  return (
    <div className="space-y-6" data-testid="niveles-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20">
            <Medal className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Niveles</h1>
            <p className="text-slate-500">Niveles de certificación y avance</p>
          </div>
        </div>
        <div className="flex gap-2">
          {niveles.length === 0 && (
            <Button variant="outline" onClick={handleSeed}>
              Seed Initial Data
            </Button>
          )}
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="add-nivel-btn">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Nivel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-white">{niveles.length}</div>
          <div className="text-sm text-slate-400">Niveles configurados</div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
      ) : niveles.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <Medal className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-2">No hay niveles configurados</h3>
            <p className="text-slate-400 mb-4">Click "Seed Initial Data" para agregar niveles predeterminados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {niveles.map((nivel, index) => (
            <Card key={nivel.id} className="stat-card hover:border-yellow-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <GripVertical className="w-4 h-4" />
                      <span className="text-lg font-bold text-slate-600">{nivel.order || index + 1}</span>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getLevelColor(nivel.order)}`}>
                      <Medal className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getLevelColor(nivel.order)}>
                          {nivel.certification_name || nivel.name}
                        </Badge>
                        <span className="text-xs text-slate-500">(Certificación)</span>
                      </div>
                      <div className="text-white font-medium">
                        {nivel.advancement_es || "Sin configurar"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {nivel.advancement_en || "Not configured"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(nivel)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDelete(nivel.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#0f0f0f] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingNivel ? "Editar Nivel" : "Agregar Nivel"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure los nombres del nivel para certificación y avance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Nombre de Certificación *</Label>
              <Input
                value={formData.certification_name}
                onChange={(e) => setFormData(prev => ({ ...prev, certification_name: e.target.value }))}
                placeholder="ej: Commitment, Mastery, Performance, Results"
                className="mt-1 bg-[#111] border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">Se usa en la expedición de certificados</p>
            </div>
            <div>
              <Label className="text-slate-400">Nivel de Avance (Español) *</Label>
              <Input
                value={formData.advancement_es}
                onChange={(e) => setFormData(prev => ({ ...prev, advancement_es: e.target.value }))}
                placeholder="ej: de Aspirante a Aprendiz"
                className="mt-1 bg-[#111] border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">Se usa en eventos, blogs y LMS en español</p>
            </div>
            <div>
              <Label className="text-slate-400">Nivel de Avance (Inglés) *</Label>
              <Input
                value={formData.advancement_en}
                onChange={(e) => setFormData(prev => ({ ...prev, advancement_en: e.target.value }))}
                placeholder="ej: from Aspirant to Apprentice"
                className="mt-1 bg-[#111] border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">Se usa en eventos, blogs y LMS en inglés</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingNivel ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
