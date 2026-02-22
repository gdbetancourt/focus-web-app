import { useState, useEffect } from "react";
import { BookOpen, Plus, Edit2, Trash2, Loader2, Target, Brain, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import api from "../lib/api";

export default function ProgramasPage() {
  const [programas, setProgramas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    objetivo_resultados: "",
    objetivo_comportamiento: "",
    objetivo_aprendizaje: "",
    objetivo_experiencia: ""
  });

  const loadProgramas = async () => {
    try {
      setLoading(true);
      const res = await api.get("/website-config/programas");
      setProgramas(res.data.programas || []);
    } catch (error) {
      toast.error("Error loading programas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgramas();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingPrograma) {
        await api.put(`/website-config/programas/${editingPrograma.id}`, formData);
        toast.success("Programa updated");
      } else {
        await api.post("/website-config/programas", formData);
        toast.success("Programa created");
      }
      setDialogOpen(false);
      resetForm();
      loadProgramas();
    } catch (error) {
      toast.error("Error saving programa");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (programa) => {
    setEditingPrograma(programa);
    setFormData({
      name: programa.name || "",
      description: programa.description || "",
      objetivo_resultados: programa.objetivo_resultados || "",
      objetivo_comportamiento: programa.objetivo_comportamiento || "",
      objetivo_aprendizaje: programa.objetivo_aprendizaje || "",
      objetivo_experiencia: programa.objetivo_experiencia || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this programa?")) return;
    try {
      await api.delete(`/website-config/programas/${id}`);
      toast.success("Programa deleted");
      loadProgramas();
    } catch (error) {
      toast.error("Error deleting programa");
    }
  };

  const resetForm = () => {
    setEditingPrograma(null);
    setFormData({
      name: "", description: "", objetivo_resultados: "",
      objetivo_comportamiento: "", objetivo_aprendizaje: "", objetivo_experiencia: ""
    });
  };

  return (
    <div className="space-y-6" data-testid="programas-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <BookOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Programas</h1>
            <p className="text-slate-500">Training programs with objectives</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="add-programa-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Programa
        </Button>
      </div>

      {/* Stats */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-white">{programas.length}</div>
          <div className="text-sm text-slate-400">Total Programas</div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
      ) : programas.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-2">No Programas</h3>
            <p className="text-slate-400">Create your first training program</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {programas.map(programa => (
            <Card key={programa.id} className="stat-card hover:border-blue-500/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-lg">{programa.name}</div>
                      {programa.description && (
                        <div className="text-sm text-slate-400">{programa.description}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(programa)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDelete(programa.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Objectives Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {programa.objetivo_resultados && (
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400 font-medium">Results</span>
                      </div>
                      <p className="text-xs text-slate-300">{programa.objetivo_resultados}</p>
                    </div>
                  )}
                  {programa.objetivo_comportamiento && (
                    <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-orange-400" />
                        <span className="text-xs text-orange-400 font-medium">Behavior</span>
                      </div>
                      <p className="text-xs text-slate-300">{programa.objetivo_comportamiento}</p>
                    </div>
                  )}
                  {programa.objetivo_aprendizaje && (
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-blue-400 font-medium">Learning</span>
                      </div>
                      <p className="text-xs text-slate-300">{programa.objetivo_aprendizaje}</p>
                    </div>
                  )}
                  {programa.objetivo_experiencia && (
                    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-purple-400 font-medium">Experience</span>
                      </div>
                      <p className="text-xs text-slate-300">{programa.objetivo_experiencia}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl bg-[#0f0f0f] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingPrograma ? "Edit Programa" : "Add Programa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-slate-400">Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Program name"
                  className="mt-1 bg-[#111] border-slate-700"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-400">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Program description"
                  className="mt-1 bg-[#111] border-slate-700"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-slate-400">Objetivo en Resultados</Label>
                <Textarea
                  value={formData.objetivo_resultados}
                  onChange={(e) => setFormData(prev => ({ ...prev, objetivo_resultados: e.target.value }))}
                  placeholder="What business results will participants achieve?"
                  className="mt-1 bg-[#111] border-slate-700"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-slate-400">Objetivo en Comportamiento</Label>
                <Textarea
                  value={formData.objetivo_comportamiento}
                  onChange={(e) => setFormData(prev => ({ ...prev, objetivo_comportamiento: e.target.value }))}
                  placeholder="What behaviors will change?"
                  className="mt-1 bg-[#111] border-slate-700"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-slate-400">Objetivo en Aprendizaje</Label>
                <Textarea
                  value={formData.objetivo_aprendizaje}
                  onChange={(e) => setFormData(prev => ({ ...prev, objetivo_aprendizaje: e.target.value }))}
                  placeholder="What will participants learn?"
                  className="mt-1 bg-[#111] border-slate-700"
                  rows={2}
                />
              </div>
              <div>
                <Label className="text-slate-400">Objetivo en Experiencia</Label>
                <Textarea
                  value={formData.objetivo_experiencia}
                  onChange={(e) => setFormData(prev => ({ ...prev, objetivo_experiencia: e.target.value }))}
                  placeholder="What experience will participants have?"
                  className="mt-1 bg-[#111] border-slate-700"
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPrograma ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
