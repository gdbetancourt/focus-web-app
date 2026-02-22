import React, { useState, useEffect } from "react";
import { 
  Stethoscope, Plus, Trash2, Edit2, Save, X, Upload, 
  Loader2, Search, Merge, AlertCircle, Check 
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import api from "../lib/api";

export default function MedicalSpecialties() {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  
  // Form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Merge state
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [mergeTarget, setMergeTarget] = useState(null);

  useEffect(() => {
    loadSpecialties();
  }, []);

  const loadSpecialties = async () => {
    try {
      const res = await api.get("/medical/specialties");
      setSpecialties(res.data.specialties || []);
    } catch (error) {
      console.error("Error loading specialties:", error);
      toast.error("Failed to load specialties");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post("/medical/specialties", {
        name: newName.trim(),
        description: newDescription.trim() || null
      });
      toast.success("Specialty created");
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      loadSpecialties();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create specialty");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkText.trim()) return;
    setSaving(true);
    try {
      const names = bulkText.split("\n").map(s => s.trim()).filter(Boolean);
      const res = await api.post("/medical/specialties/bulk", { specialties: names });
      toast.success(`Created ${res.data.created_count} specialties, ${res.data.skipped_count} skipped`);
      setBulkOpen(false);
      setBulkText("");
      loadSpecialties();
    } catch (error) {
      toast.error("Failed to create specialties");
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = async () => {
    setSaving(true);
    try {
      const res = await api.post("/medical/specialties/initialize");
      toast.success(res.data.message);
      loadSpecialties();
    } catch (error) {
      toast.error("Failed to initialize specialties");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/medical/specialties/${deleteId}`);
      toast.success("Specialty deleted");
      loadSpecialties();
    } catch (error) {
      toast.error("Failed to delete specialty");
    } finally {
      setDeleteId(null);
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget || selectedForMerge.length === 0) return;
    setSaving(true);
    try {
      const sourceIds = selectedForMerge.filter(id => id !== mergeTarget);
      await api.post("/medical/specialties/merge", {
        source_ids: sourceIds,
        target_id: mergeTarget
      });
      toast.success("Specialties merged successfully");
      setMergeOpen(false);
      setSelectedForMerge([]);
      setMergeTarget(null);
      loadSpecialties();
    } catch (error) {
      toast.error("Failed to merge specialties");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectForMerge = (id) => {
    setSelectedForMerge(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredSpecialties = specialties.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8" data-testid="medical-specialties-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-[#ff3300]" />
            Medical Specialties
          </h1>
          <p className="text-slate-400 mt-1">
            Manage the list of medical specialties used across the platform
          </p>
        </div>
        <div className="flex gap-2">
          {specialties.length === 0 && (
            <Button 
              onClick={handleInitialize}
              variant="outline"
              className="border-slate-700 text-slate-300"
              disabled={saving}
            >
              <Upload className="w-4 h-4 mr-2" />
              Load Default List
            </Button>
          )}
          <Button 
            onClick={() => setBulkOpen(true)}
            variant="outline"
            className="border-slate-700 text-slate-300"
          >
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          {selectedForMerge.length >= 2 && (
            <Button 
              onClick={() => setMergeOpen(true)}
              variant="outline"
              className="border-amber-600 text-amber-400"
            >
              <Merge className="w-4 h-4 mr-2" />
              Merge ({selectedForMerge.length})
            </Button>
          )}
          <Button 
            onClick={() => setCreateOpen(true)}
            className="bg-[#ff3300] hover:bg-[#ff3300]/80"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Specialty
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search specialties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900/50 border-slate-800"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Badge className="bg-slate-800 text-slate-300">
          {specialties.length} Total Specialties
        </Badge>
        {selectedForMerge.length > 0 && (
          <Badge className="bg-amber-500/20 text-amber-400">
            {selectedForMerge.length} Selected for Merge
          </Badge>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading specialties...</p>
        </div>
      ) : filteredSpecialties.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Stethoscope className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Specialties Found</h3>
          <p className="text-slate-400 mb-4">
            {searchTerm ? "Try a different search term" : "Start by loading the default list or adding your own"}
          </p>
          {!searchTerm && (
            <Button onClick={handleInitialize} className="bg-[#ff3300] hover:bg-[#ff3300]/80">
              <Upload className="w-4 h-4 mr-2" />
              Load Default List
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredSpecialties.map(specialty => (
            <div
              key={specialty.id}
              className={`bg-slate-900/50 border rounded-lg p-4 hover:border-slate-600 transition-colors ${
                selectedForMerge.includes(specialty.id) 
                  ? "border-amber-500 ring-1 ring-amber-500/50" 
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedForMerge.includes(specialty.id)}
                    onCheckedChange={() => toggleSelectForMerge(specialty.id)}
                    className="border-slate-600"
                  />
                  <div>
                    <h3 className="font-medium text-white text-sm">{specialty.name}</h3>
                    {specialty.description && (
                      <p className="text-xs text-slate-500 mt-1">{specialty.description}</p>
                    )}
                    <Badge className="mt-2 text-[10px] bg-slate-800 text-slate-400">
                      {specialty.source || "manual"}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(specialty.id)}
                  className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle>Add Medical Specialty</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Name *</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Cardiology"
                className="bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description (optional)</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description..."
                className="bg-slate-900 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()} className="bg-[#ff3300]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle>Bulk Import Specialties</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-400">
              Paste a list of specialties, one per line. Duplicates will be skipped.
            </p>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Cardiology
Neurology
Oncology
..."
              className="bg-slate-900 border-slate-700 min-h-[200px] font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleBulkCreate} disabled={saving || !bulkText.trim()} className="bg-[#ff3300]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-amber-400" />
              Merge Specialties
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-400">
              Select which specialty to keep. The others will be merged into it and deleted.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedForMerge.map(id => {
                const spec = specialties.find(s => s.id === id);
                if (!spec) return null;
                return (
                  <div
                    key={id}
                    onClick={() => setMergeTarget(id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      mergeTarget === id 
                        ? "border-[#ff3300] bg-[#ff3300]/10" 
                        : "border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">{spec.name}</span>
                      {mergeTarget === id && (
                        <Badge className="bg-[#ff3300]/20 text-[#ff3300]">Keep this one</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button 
              onClick={handleMerge} 
              disabled={saving || !mergeTarget} 
              className="bg-amber-600 hover:bg-amber-700"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Merge {selectedForMerge.length} into 1
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0f0f0f] border-[#222]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Specialty?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The specialty will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
