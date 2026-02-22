import { useState, useEffect } from "react";
import { Newspaper, Plus, Search, Globe, Trash2, Edit2, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import api from "../../lib/api";

export default function MediaCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    website: ""
  });

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get("/media-companies");
      setCompanies(res.data.companies || []);
    } catch (error) {
      console.error("Error loading media companies:", error);
      toast.error("Error loading media companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const filteredCompanies = companies.filter(c => {
    if (!search) return true;
    return c.name?.toLowerCase().includes(search.toLowerCase()) ||
           c.website?.toLowerCase().includes(search.toLowerCase());
  });

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingCompany) {
        await api.put(`/media-companies/${editingCompany.id}`, formData);
        toast.success("Company updated");
      } else {
        await api.post("/media-companies", formData);
        toast.success("Company created");
      }
      setDialogOpen(false);
      resetForm();
      loadCompanies();
    } catch (error) {
      toast.error("Error saving company");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || "",
      website: company.website || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this media company?")) return;
    try {
      await api.delete(`/media-companies/${id}`);
      toast.success("Company deleted");
      loadCompanies();
    } catch (error) {
      toast.error("Error deleting company");
    }
  };

  const resetForm = () => {
    setEditingCompany(null);
    setFormData({ name: "", website: "" });
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="media-companies-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
            <Newspaper className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Media Companies</h1>
            <p className="text-slate-500">Media outlets, publications, and news organizations</p>
          </div>
        </div>
        <Button onClick={openNewDialog} data-testid="add-media-company-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Media Company
        </Button>
      </div>

      {/* Stats */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-white">{companies.length}</div>
          <div className="text-sm text-slate-400">Total Media Companies</div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search by name or website..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="search-media-companies"
        />
      </div>

      {/* Companies List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-500 mt-2">Loading...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <Newspaper className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-2">No Media Companies</h3>
            <p className="text-slate-400 mb-4">Add media outlets to your database</p>
            <Button onClick={openNewDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredCompanies.map(company => (
            <Card key={company.id} className="stat-card hover:border-blue-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Newspaper className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-white font-medium">{company.name}</div>
                      {company.website && (
                        <a 
                          href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" />
                          {company.website}
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(company)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleDelete(company.id)} 
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-[#0f0f0f] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCompany ? "Edit Media Company" : "Add Media Company"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Forbes, CNN, El País"
                className="mt-1 bg-[#111] border-slate-700"
              />
            </div>
            <div>
              <Label className="text-slate-400">Website</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="e.g., forbes.com"
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
              {editingCompany ? "Save Changes" : "Add Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
