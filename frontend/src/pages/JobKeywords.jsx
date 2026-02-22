import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tag,
  Plus,
  Trash2,
  RefreshCw,
  GripVertical,
  Search,
  Users,
  FileText,
  ArrowUpDown,
  Zap,
  Play
} from "lucide-react";
import api from "../lib/api";

export default function JobKeywords() {
  const [keywords, setKeywords] = useState([]);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("all");
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  
  // Form states
  const [newKeyword, setNewKeyword] = useState("");
  const [newPersonaId, setNewPersonaId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkPersonaId, setBulkPersonaId] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Drag and drop for priority
  const [draggingIndex, setDraggingIndex] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [keywordsRes, personasRes, prioritiesRes] = await Promise.all([
        api.get("/job-keywords/"),
        api.get("/buyer-personas-db/"),
        api.get("/job-keywords/priorities")
      ]);
      
      setKeywords(keywordsRes.data.keywords || []);
      
      // Handle personas - API returns array directly, add id from code if missing
      const personasData = Array.isArray(personasRes.data) 
        ? personasRes.data 
        : (personasRes.data.personas || []);
      const personasWithId = personasData.map(p => ({
        ...p,
        id: p.id || p.code || p.name.toLowerCase()
      }));
      setBuyerPersonas(personasWithId);
      
      setPriorities(prioritiesRes.data.priorities || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword || !newPersonaId) {
      toast.error("Keyword and Buyer Persona are required");
      return;
    }
    
    const persona = buyerPersonas.find(p => p.id === newPersonaId);
    
    setSaving(true);
    try {
      await api.post("/job-keywords/", {
        keyword: newKeyword.trim().toLowerCase(),
        buyer_persona_id: newPersonaId,
        buyer_persona_name: persona?.name || ""
      });
      toast.success("Keyword added");
      setNewKeyword("");
      setAddDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error adding keyword");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText || !bulkPersonaId) {
      toast.error("Keywords and Buyer Persona are required");
      return;
    }
    
    const persona = buyerPersonas.find(p => p.id === bulkPersonaId);
    
    setSaving(true);
    try {
      const res = await api.post("/job-keywords/bulk", {
        keywords: bulkText,
        buyer_persona_id: bulkPersonaId,
        buyer_persona_name: persona?.name || ""
      });
      const { created, skipped, replaced } = res.data;
      let message = `Created: ${created}`;
      if (replaced > 0) message += `, Replaced: ${replaced}`;
      if (skipped > 0) message += `, Skipped: ${skipped}`;
      toast.success(message);
      setBulkText("");
      setBulkDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error adding keywords");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKeyword = async (keywordId) => {
    if (!confirm("Delete this keyword?")) return;
    
    try {
      await api.delete(`/job-keywords/${keywordId}`);
      toast.success("Keyword deleted");
      loadData();
    } catch (error) {
      toast.error("Error deleting keyword");
    }
  };

  const handleReclassifyAll = async () => {
    setReclassifying(true);
    try {
      const res = await api.post("/job-keywords/reclassify-all-contacts");
      toast.success(`Reclassified ${res.data.total_contacts} contacts: ${res.data.updated_with_persona} with persona, ${res.data.assigned_mateo} catch-all (Mateo)`);
      setReclassifyDialogOpen(false);
    } catch (error) {
      toast.error("Error reclassifying contacts");
    } finally {
      setReclassifying(false);
    }
  };

  // Reclassify contacts by single keyword
  const handleReclassifyByKeyword = async (keywordId, keywordText) => {
    try {
      const res = await api.post(`/job-keywords/reclassify-by-keyword/${keywordId}`);
      toast.success(`Keyword "${keywordText}": ${res.data.contacts_matched} matched, ${res.data.contacts_updated} updated to ${res.data.buyer_persona}`);
    } catch (error) {
      toast.error("Error reclassifying by keyword");
    }
  };

  // Reclassify contacts by buyer persona (all keywords)
  const handleReclassifyByPersona = async (personaId, personaName) => {
    try {
      const res = await api.post(`/job-keywords/reclassify-by-persona/${personaId}`);
      toast.success(`${personaName}: ${res.data.contacts_matched} matched with ${res.data.keywords_count} keywords, ${res.data.contacts_updated} updated`);
      loadData(); // Refresh to update keyword counts
    } catch (error) {
      toast.error("Error reclassifying by persona");
    }
  };

  // Drag and drop handlers for priority
  const handleDragStart = (index) => {
    setDraggingIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;
    
    const newPriorities = [...priorities];
    const draggedItem = newPriorities[draggingIndex];
    newPriorities.splice(draggingIndex, 1);
    newPriorities.splice(index, 0, draggedItem);
    
    // Update priority values
    newPriorities.forEach((p, i) => {
      p.priority = i + 1;
    });
    
    setPriorities(newPriorities);
    setDraggingIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggingIndex(null);
    
    // Save new priorities
    try {
      await api.put("/job-keywords/priorities", priorities.map((p, i) => ({
        buyer_persona_id: p.buyer_persona_id,
        priority: i + 1
      })));
      toast.success("Priorities updated");
    } catch (error) {
      toast.error("Error saving priorities");
    }
  };

  // Filter keywords
  const filteredKeywords = keywords.filter(kw => {
    const matchesSearch = kw.keyword.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPersona = selectedPersona === "all" || kw.buyer_persona_id === selectedPersona;
    return matchesSearch && matchesPersona;
  });

  // Group keywords by buyer persona
  const keywordsByPersona = {};
  keywords.forEach(kw => {
    const personaName = kw.buyer_persona_name || "Unknown";
    if (!keywordsByPersona[personaName]) {
      keywordsByPersona[personaName] = [];
    }
    keywordsByPersona[personaName].push(kw);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="job-keywords-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <Tag className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Job Title Keywords (Cargos)</h1>
            <p className="text-slate-500">Keywords to auto-classify contacts to Buyer Personas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setReclassifyDialogOpen(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Zap className="w-4 h-4 mr-2" />
            Reclassify All
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setBulkDialogOpen(true)}
            className="border-[#333]"
          >
            <FileText className="w-4 h-4 mr-2" />
            Bulk Add
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Keyword
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Tag className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{keywords.length}</p>
              <p className="text-xs text-slate-500">Total Keywords</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{buyerPersonas.length}</p>
              <p className="text-xs text-slate-500">Buyer Personas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <ArrowUpDown className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{priorities.length}</p>
              <p className="text-xs text-slate-500">Priority Levels</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Order Panel */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="border-b border-[#222]">
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-green-400" />
              Buyer Persona Priority
            </CardTitle>
            <p className="text-xs text-slate-500">Drag to reorder. Higher = more priority when keywords match multiple personas.</p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {priorities.map((priority, index) => (
                <div
                  key={priority.buyer_persona_id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                    draggingIndex === index 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-[#222] bg-[#0a0a0a] hover:border-[#333]'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-slate-500" />
                  <Badge className="bg-green-500/20 text-green-400 min-w-[24px] justify-center">
                    {index + 1}
                  </Badge>
                  <span className="text-white text-sm flex-1">{priority.buyer_persona_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {keywordsByPersona[priority.buyer_persona_name]?.length || 0} keywords
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReclassifyByPersona(priority.buyer_persona_id, priority.buyer_persona_name);
                    }}
                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10 ml-1"
                    title={`Reclassify all contacts with ${priority.buyer_persona_name}'s keywords`}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Keywords List */}
        <div className="lg:col-span-2">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="border-b border-[#222]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-orange-400" />
                  Keywords List
                </CardTitle>
                <Badge variant="secondary">{filteredKeywords.length} keywords</Badge>
              </div>
              <div className="flex gap-2 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger className="w-[200px] bg-[#0a0a0a] border-[#333]">
                    <SelectValue placeholder="Filter by persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Personas</SelectItem>
                    {buyerPersonas.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222]">
                      <TableHead>Keyword</TableHead>
                      <TableHead>Buyer Persona</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeywords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                          No keywords found. Add some keywords to start auto-classifying contacts.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredKeywords.map(kw => (
                        <TableRow key={kw.id} className="border-[#222]">
                          <TableCell className="font-mono text-sm text-white">{kw.keyword}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-500/20 text-blue-400">
                              {kw.buyer_persona_name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReclassifyByKeyword(kw.id, kw.keyword)}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                title="Reclassify contacts with this keyword"
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteKeyword(kw.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                title="Delete keyword"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Keyword Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle>Add Keyword</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400 mb-1 block">Keyword *</Label>
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="e.g., director de marketing"
                className="bg-[#1a1a1a] border-[#333]"
              />
              <p className="text-xs text-slate-500 mt-1">Enter the job title keyword as it appears in LinkedIn</p>
            </div>
            <div>
              <Label className="text-slate-400 mb-1 block">Buyer Persona *</Label>
              <Select value={newPersonaId} onValueChange={setNewPersonaId}>
                <SelectTrigger className="bg-[#1a1a1a] border-[#333]">
                  <SelectValue placeholder="Select buyer persona" />
                </SelectTrigger>
                <SelectContent>
                  {buyerPersonas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={handleAddKeyword} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Keyword
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Add Keywords</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-400 mb-1 block">Keywords *</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Enter keywords separated by commas or new lines:
director de marketing
gerente comercial
head of sales
marketing manager"
                className="bg-[#1a1a1a] border-[#333] min-h-[150px] font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Separate keywords with commas, semicolons, or new lines</p>
            </div>
            <div>
              <Label className="text-slate-400 mb-1 block">Buyer Persona *</Label>
              <Select value={bulkPersonaId} onValueChange={setBulkPersonaId}>
                <SelectTrigger className="bg-[#1a1a1a] border-[#333]">
                  <SelectValue placeholder="Select buyer persona for all keywords" />
                </SelectTrigger>
                <SelectContent>
                  {buyerPersonas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={handleBulkAdd} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Keywords
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reclassify Dialog */}
      <Dialog open={reclassifyDialogOpen} onOpenChange={setReclassifyDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Reclassify All Contacts
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400">
              This will reclassify <strong>all contacts in all 5 stages</strong> based on their job titles 
              and the current keyword configuration.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Contacts with matching keywords → Assigned highest priority buyer persona
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Contacts without job title or no matches → Assigned to <strong>Mateo</strong> (catch-all)
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReclassifyDialogOpen(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button 
              onClick={handleReclassifyAll} 
              disabled={reclassifying} 
              className="bg-amber-600 hover:bg-amber-700"
            >
              {reclassifying ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Reclassify All Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
