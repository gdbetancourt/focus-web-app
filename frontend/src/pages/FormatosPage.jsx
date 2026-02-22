import { useState, useEffect } from "react";
import { Award, Plus, Edit2, Trash2, Loader2, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import api from "../lib/api";

export default function FormatosPage() {
  const [formatos, setFormatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFormato, setEditingFormato] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_range: ""
  });

  const loadFormatos = async () => {
    try {
      setLoading(true);
      const res = await api.get("/website-config/formatos");
      setFormatos(res.data.formatos || []);
    } catch (error) {
      toast.error("Error loading formatos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormatos();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingFormato) {
        await api.put(`/website-config/formatos/${editingFormato.id}`, formData);
        toast.success("Formato updated");
      } else {
        await api.post("/website-config/formatos", formData);
        toast.success("Formato created");
      }
      setDialogOpen(false);
      resetForm();
      loadFormatos();
    } catch (error) {
      toast.error("Error saving formato");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (formato) => {
    setEditingFormato(formato);
    setFormData({
      name: formato.name || "",
      description: formato.description || "",
      duration_range: formato.duration_range || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this formato?")) return;
    try {
      await api.delete(`/website-config/formatos/${id}`);
      toast.success("Formato deleted");
      loadFormatos();
    } catch (error) {
      toast.error("Error deleting formato");
    }
  };

  const handleSeed = async () => {
    try {
      const res = await api.post("/website-config/formatos/seed");
      toast.success(res.data.message);
      loadFormatos();
    } catch (error) {
      toast.error("Error seeding formatos");
    }
  };

  const resetForm = () => {
    setEditingFormato(null);
    setFormData({ name: "", description: "", duration_range: "" });
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="formatos-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Award className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Formatos</h1>
            <p className="text-slate-500">Training formats and delivery methods</p>
          </div>
        </div>
        <div className="flex gap-2">
          {formatos.length === 0 && (
            <Button variant="outline" onClick={handleSeed}>
              Seed Initial Data
            </Button>
          )}
          <Button onClick={openNewDialog} data-testid="add-formato-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Formato
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-white">{formatos.length}</div>
          <div className="text-sm text-slate-400">Total Formatos</div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
      ) : formatos.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <Award className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-2">No Formatos</h3>
            <p className="text-slate-400 mb-4">Click "Seed Initial Data" to add default formatos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {formatos.map(formato => (
            <Card key={formato.id} className="stat-card hover:border-purple-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Award className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">{formato.name}</div>
                      {formato.description && (
                        <div className="text-sm text-slate-400">{formato.description}</div>
                      )}
                      {formato.duration_range && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Clock className="w-3 h-3" />
                          {formato.duration_range}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(formato)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDelete(formato.id)}
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
              {editingFormato ? "Edit Formato" : "Add Formato"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Masterclass"
                className="mt-1 bg-[#111] border-slate-700"
              />
            </div>
            <div>
              <Label className="text-slate-400">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this format"
                className="mt-1 bg-[#111] border-slate-700"
                rows={2}
              />
            </div>
            <div>
              <Label className="text-slate-400">Duration Range</Label>
              <Input
                value={formData.duration_range}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_range: e.target.value }))}
                placeholder="e.g., 2-4 hours, 1 day, 3 months"
                className="mt-1 bg-[#111] border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingFormato ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
