import React, { useState, useEffect, useRef } from "react";
import { 
  Building2, Plus, Trash2, Edit2, Save, X, Upload, 
  Loader2, Search, Globe, Calendar, AlertCircle, 
  CheckCircle2, RefreshCw, FileText, Image, Clock
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
import { toast } from "sonner";
import api from "../lib/api";

export default function MedicalSocietiesPage() {
  const [societies, setSocieties] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [trafficLight, setTrafficLight] = useState({ status: "red", total: 0, ok: 0 });
  
  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editSociety, setEditSociety] = useState(null);
  const [uploadSociety, setUploadSociety] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    website: "",
    specialties: [],
    scrape_frequency: "monthly",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  
  // Upload state
  const [uploadType, setUploadType] = useState("text");
  const [uploadText, setUploadText] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [societiesRes, specialtiesRes] = await Promise.all([
        api.get("/medical/societies"),
        api.get("/medical/specialties")
      ]);
      setSocieties(societiesRes.data.societies || []);
      setSpecialties(specialtiesRes.data.specialties || []);
      setTrafficLight({
        status: societiesRes.data.traffic_light,
        total: societiesRes.data.count,
        ok: societiesRes.data.stats?.scraped || 0
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.website.trim()) {
      toast.error("Name and website are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/medical/societies", formData);
      toast.success("Medical society created");
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create society");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editSociety) return;
    setSaving(true);
    try {
      await api.put(`/medical/societies/${editSociety.id}`, formData);
      toast.success("Medical society updated");
      setEditSociety(null);
      resetForm();
      loadData();
    } catch (error) {
      toast.error("Failed to update society");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/medical/societies/${deleteId}`);
      toast.success("Medical society deleted");
      loadData();
    } catch (error) {
      toast.error("Failed to delete society");
    } finally {
      setDeleteId(null);
    }
  };

  const handleScrape = async (societyId) => {
    try {
      await api.post(`/medical/societies/${societyId}/scrape`);
      toast.success("Scraping started in background");
      // Update status locally
      setSocieties(prev => prev.map(s => 
        s.id === societyId ? { ...s, last_scrape_status: "scraping" } : s
      ));
    } catch (error) {
      toast.error("Failed to start scraping");
    }
  };

  const handleUpload = async () => {
    if (!uploadSociety) return;
    setSaving(true);
    try {
      const formDataObj = new FormData();
      if (uploadType === "text") {
        formDataObj.append("text_content", uploadText);
      } else if (uploadFile) {
        formDataObj.append("file", uploadFile);
      }
      
      await api.post(`/medical/societies/${uploadSociety.id}/upload-manual`, formDataObj, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      toast.success("Manual information uploaded");
      setUploadSociety(null);
      setUploadText("");
      setUploadFile(null);
      loadData();
    } catch (error) {
      toast.error("Failed to upload information");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      website: "",
      specialties: [],
      scrape_frequency: "monthly",
      notes: ""
    });
  };

  const openEdit = (society) => {
    setFormData({
      name: society.name,
      website: society.website,
      specialties: society.specialties || [],
      scrape_frequency: society.scrape_frequency || "monthly",
      notes: society.notes || ""
    });
    setEditSociety(society);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />Scraped</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "scraping":
        return <Badge className="bg-blue-500/20 text-blue-400"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scraping</Badge>;
      case "manual":
        return <Badge className="bg-purple-500/20 text-purple-400"><FileText className="w-3 h-3 mr-1" />Manual</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const filteredSocieties = societies.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8" data-testid="medical-societies-page">
      {/* Header with Traffic Light */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Building2 className="w-8 h-8 text-[#ff3300]" />
              Medical Societies
            </h1>
            <p className="text-slate-400 mt-1">
              Track medical societies and scrape their event calendars
            </p>
          </div>
          {/* Traffic Light */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            trafficLight.status === "green" ? "bg-green-500/10" : "bg-red-500/10"
          }`}>
            <div className={`w-4 h-4 rounded-full ${
              trafficLight.status === "green" ? "bg-green-500" : "bg-red-500"
            }`} />
            <span className={`text-sm font-medium ${
              trafficLight.status === "green" ? "text-green-400" : "text-red-400"
            }`}>
              {trafficLight.ok}/{trafficLight.total} websites scraped
            </span>
          </div>
        </div>
        <Button 
          onClick={() => setCreateOpen(true)}
          className="bg-[#ff3300] hover:bg-[#ff3300]/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Society
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search societies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900/50 border-slate-800"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading societies...</p>
        </div>
      ) : filteredSocieties.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Medical Societies</h3>
          <p className="text-slate-400 mb-4">Add medical societies to start tracking their events</p>
          <Button onClick={() => setCreateOpen(true)} className="bg-[#ff3300]">
            <Plus className="w-4 h-4 mr-2" />
            Add First Society
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSocieties.map(society => (
            <div
              key={society.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{society.name}</h3>
                    {getStatusBadge(society.last_scrape_status)}
                  </div>
                  
                  <a 
                    href={society.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-1"
                  >
                    <Globe className="w-3 h-3" />
                    {society.website}
                  </a>
                  
                  {/* Specialties */}
                  {society.specialties && society.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {society.specialties.map((specId, idx) => {
                        const spec = specialties.find(s => s.id === specId || s.name === specId);
                        return (
                          <Badge key={idx} variant="outline" className="text-xs border-slate-700 text-slate-400">
                            {spec?.name || specId}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Last scrape info */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Frequency: {society.scrape_frequency}
                    </span>
                    {society.last_scrape_date && (
                      <span>
                        Last scraped: {new Date(society.last_scrape_date).toLocaleDateString()}
                      </span>
                    )}
                    {society.events_found > 0 && (
                      <span className="text-green-400">
                        {society.events_found} events found
                      </span>
                    )}
                  </div>
                  
                  {/* Error message */}
                  {society.last_scrape_status === "failed" && society.last_scrape_error && (
                    <p className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">
                      Error: {society.last_scrape_error}
                    </p>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {society.last_scrape_status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadSociety(society)}
                      className="border-purple-600 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Upload Manual
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScrape(society.id)}
                    disabled={society.last_scrape_status === "scraping"}
                    className="border-slate-700 text-slate-400"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${society.last_scrape_status === "scraping" ? "animate-spin" : ""}`} />
                    Scrape
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(society)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(society.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen || !!editSociety} onOpenChange={(open) => {
        if (!open) {
          setCreateOpen(false);
          setEditSociety(null);
          resetForm();
        }
      }}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSociety ? "Edit" : "Add"} Medical Society</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., American College of Cardiology"
                className="bg-slate-900 border-slate-700 mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400">Website *</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://www.acc.org"
                className="bg-slate-900 border-slate-700 mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400">Specialties</Label>
              <Select
                value={formData.specialties[0] || ""}
                onValueChange={(v) => {
                  if (v && !formData.specialties.includes(v)) {
                    setFormData(prev => ({ ...prev, specialties: [...prev.specialties, v] }));
                  }
                }}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-1">
                  <SelectValue placeholder="Add specialty..." />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.specialties.map((specId, idx) => {
                    const spec = specialties.find(s => s.id === specId);
                    return (
                      <Badge 
                        key={idx} 
                        className="bg-slate-800 text-slate-300 cursor-pointer hover:bg-red-500/20 hover:text-red-400"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          specialties: prev.specialties.filter((_, i) => i !== idx)
                        }))}
                      >
                        {spec?.name || specId}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <Label className="text-slate-400">Scrape Frequency</Label>
              <Select
                value={formData.scrape_frequency}
                onValueChange={(v) => setFormData(prev => ({ ...prev, scrape_frequency: v }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                className="bg-slate-900 border-slate-700 mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditSociety(null); resetForm(); }} className="border-slate-700">
              Cancel
            </Button>
            <Button onClick={editSociety ? handleUpdate : handleCreate} disabled={saving} className="bg-[#ff3300]">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editSociety ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Manual Dialog */}
      <Dialog open={!!uploadSociety} onOpenChange={(open) => !open && setUploadSociety(null)}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle>Upload Manual Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-400">
              Since automatic scraping failed, you can manually upload the event information.
            </p>
            
            <div className="flex gap-2">
              <Button
                variant={uploadType === "text" ? "default" : "outline"}
                onClick={() => setUploadType("text")}
                className={uploadType === "text" ? "bg-[#ff3300]" : "border-slate-700"}
                size="sm"
              >
                <FileText className="w-4 h-4 mr-1" />
                Text
              </Button>
              <Button
                variant={uploadType === "pdf" ? "default" : "outline"}
                onClick={() => setUploadType("pdf")}
                className={uploadType === "pdf" ? "bg-[#ff3300]" : "border-slate-700"}
                size="sm"
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                variant={uploadType === "image" ? "default" : "outline"}
                onClick={() => setUploadType("image")}
                className={uploadType === "image" ? "bg-[#ff3300]" : "border-slate-700"}
                size="sm"
              >
                <Image className="w-4 h-4 mr-1" />
                Image
              </Button>
            </div>

            {uploadType === "text" ? (
              <Textarea
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                placeholder="Paste event information here..."
                className="bg-slate-900 border-slate-700 min-h-[200px]"
              />
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadType === "pdf" ? ".pdf" : "image/*"}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-dashed border-slate-700 h-32"
                >
                  {uploadFile ? (
                    <span className="text-white">{uploadFile.name}</span>
                  ) : (
                    <span className="text-slate-400">
                      Click to upload {uploadType === "pdf" ? "PDF" : "image"}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadSociety(null)} className="border-slate-700">
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={saving || (uploadType === "text" ? !uploadText.trim() : !uploadFile)} 
              className="bg-[#ff3300]"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0f0f0f] border-[#222]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Medical Society?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the society and all associated scraping history.
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
