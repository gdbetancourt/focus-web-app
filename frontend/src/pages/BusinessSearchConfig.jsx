import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Building2,
  MapPin,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  RotateCcw,
} from "lucide-react";

export default function BusinessSearchConfig() {
  const [activeTab, setActiveTab] = useState("business-types");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Business Types state
  const [businessTypes, setBusinessTypes] = useState([]);
  const [showAddBusinessType, setShowAddBusinessType] = useState(false);
  const [editingBusinessType, setEditingBusinessType] = useState(null);
  const [businessTypeForm, setBusinessTypeForm] = useState({ category_name: "", search_keyword: "" });
  
  // Cities state
  const [cities, setCities] = useState([]);
  const [showAddCity, setShowAddCity] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [cityForm, setCityForm] = useState({ name: "", state: "" });
  
  // Queue state
  const [queueItems, setQueueItems] = useState([]);
  const [queueCounts, setQueueCounts] = useState({ pending: 0, completed: 0, failed: 0 });
  const [queueFilter, setQueueFilter] = useState("pending");
  
  // Search
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "queue") {
      loadQueue();
    }
  }, [activeTab, queueFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [btRes, citiesRes, statsRes] = await Promise.all([
        api.get("/business-search/business-types"),
        api.get("/business-search/cities"),
        api.get("/business-search/stats")
      ]);
      setBusinessTypes(btRes.data.business_types || []);
      setCities(citiesRes.data.cities || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      const res = await api.get(`/business-search/queue?status=${queueFilter}&limit=200`);
      setQueueItems(res.data.queue_items || []);
      setQueueCounts(res.data.counts || { pending: 0, completed: 0, failed: 0 });
    } catch (error) {
      console.error("Error loading queue:", error);
    }
  };

  // Business Type CRUD
  const handleSaveBusinessType = async () => {
    if (!businessTypeForm.category_name || !businessTypeForm.search_keyword) {
      toast.error("Completa todos los campos");
      return;
    }
    
    try {
      if (editingBusinessType) {
        await api.put(`/business-search/business-types/${editingBusinessType.id}`, businessTypeForm);
        toast.success("Tipo de negocio actualizado");
      } else {
        const res = await api.post("/business-search/business-types", businessTypeForm);
        toast.success(`Tipo de negocio creado. ${res.data.queue_items_created} búsquedas agregadas a la cola.`);
      }
      setShowAddBusinessType(false);
      setEditingBusinessType(null);
      setBusinessTypeForm({ category_name: "", search_keyword: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error saving");
    }
  };

  const handleDeleteBusinessType = async (id) => {
    if (!confirm("Delete this business type and pending searches?")) return;
    
    try {
      const res = await api.delete(`/business-search/business-types/${id}`);
      toast.success(`Deleted. ${res.data.queue_items_removed} searches removed.`);
      loadData();
    } catch (error) {
      toast.error("Error deleting");
    }
  };

  // City CRUD
  const handleSaveCity = async () => {
    if (!cityForm.name) {
      toast.error("City name is required");
      return;
    }
    
    try {
      if (editingCity) {
        await api.put(`/business-search/cities/${editingCity.id}`, cityForm);
        toast.success("City updated");
      } else {
        const res = await api.post("/business-search/cities", cityForm);
        toast.success(`City created. ${res.data.queue_items_created} searches added to queue.`);
      }
      setShowAddCity(false);
      setEditingCity(null);
      setCityForm({ name: "", state: "" });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error saving");
    }
  };

  const handleDeleteCity = async (id) => {
    if (!confirm("Delete this city and pending searches?")) return;
    
    try {
      const res = await api.delete(`/business-search/cities/${id}`);
      toast.success(`Deleted. ${res.data.queue_items_removed} searches removed.`);
      loadData();
    } catch (error) {
      toast.error("Error deleting");
    }
  };

  // Queue actions
  const handleRetryQueueItem = async (id) => {
    try {
      await api.post(`/business-search/queue/${id}/retry`);
      toast.success("Marcado para reintentar");
      loadQueue();
    } catch (error) {
      toast.error("Error retrying");
    }
  };

  const handleDeleteQueueItem = async (id) => {
    try {
      await api.delete(`/business-search/queue/${id}`);
      toast.success("Removed from queue");
      loadQueue();
    } catch (error) {
      toast.error("Error deleting");
    }
  };

  const handleRegenerateQueue = async () => {
    try {
      const res = await api.post("/business-search/queue/regenerate");
      if (res.data.success) {
        toast.success(`Queue regenerated. ${res.data.new_items_created} new searches added.`);
        loadQueue();
        loadData();
      } else {
        toast.error(res.data.message || "Error regenerating queue");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error regenerating queue");
    }
  };

  // Filter items
  const filteredBusinessTypes = businessTypes.filter(bt =>
    bt.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bt.search_keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCities = cities.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.state && c.state.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="business-search-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="business-search-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/20">
            <Building2 className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Business Search</h1>
            <p className="text-sm text-slate-500">Configure business types and cities for Google Maps prospecting</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex gap-4 items-center">
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="text-center px-4 py-2 bg-[#111] border border-[#222] rounded-lg">
                <p className="text-2xl font-bold text-teal-400">{stats.business_types}</p>
                <p className="text-xs text-slate-500">Types</p>
              </div>
              <div className="text-center px-4 py-2 bg-[#111] border border-[#222] rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{stats.cities}</p>
                <p className="text-xs text-slate-500">Cities</p>
              </div>
              <div className="text-center px-4 py-2 bg-[#111] border border-[#222] rounded-lg">
                <p className="text-2xl font-bold text-orange-400">{stats.queue?.pending || 0}</p>
                <p className="text-xs text-slate-500">In Queue</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-[#0a0a0a] border-[#222]"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="business-types" className="data-[state=active]:bg-teal-600">
            <Building2 className="w-4 h-4 mr-2" />
            Business Types
          </TabsTrigger>
          <TabsTrigger value="cities" className="data-[state=active]:bg-blue-600">
            <MapPin className="w-4 h-4 mr-2" />
            Cities
          </TabsTrigger>
          <TabsTrigger value="queue" className="data-[state=active]:bg-orange-600">
            <Clock className="w-4 h-4 mr-2" />
            Search Queue
            {queueCounts.pending > 0 && (
              <Badge className="ml-2 bg-orange-500">{queueCounts.pending}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Business Types Tab */}
        <TabsContent value="business-types" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingBusinessType(null);
                setBusinessTypeForm({ category_name: "", search_keyword: "" });
                setShowAddBusinessType(true);
              }}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="add-business-type-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Type
            </Button>
          </div>

          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222] hover:bg-[#0a0a0a]">
                    <TableHead className="text-slate-400">Category (for message)</TableHead>
                    <TableHead className="text-slate-400">Keyword (Google Maps)</TableHead>
                    <TableHead className="text-slate-400">Created</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinessTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                        No business types. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBusinessTypes.map((bt) => (
                      <TableRow key={bt.id} className="border-[#222] hover:bg-[#0a0a0a]">
                        <TableCell className="font-medium text-white">{bt.category_name}</TableCell>
                        <TableCell className="text-slate-400">{bt.search_keyword}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {bt.created_at?.split("T")[0]}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingBusinessType(bt);
                              setBusinessTypeForm({
                                category_name: bt.category_name,
                                search_keyword: bt.search_keyword
                              });
                              setShowAddBusinessType(true);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBusinessType(bt.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cities Tab */}
        <TabsContent value="cities" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingCity(null);
                setCityForm({ name: "", state: "" });
                setShowAddCity(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="add-city-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add City
            </Button>
          </div>

          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222] hover:bg-[#0a0a0a]">
                    <TableHead className="text-slate-400">City</TableHead>
                    <TableHead className="text-slate-400">State/Province</TableHead>
                    <TableHead className="text-slate-400">Created</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                        No cities. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCities.map((city) => (
                      <TableRow key={city.id} className="border-[#222] hover:bg-[#0a0a0a]">
                        <TableCell className="font-medium text-white">{city.name}</TableCell>
                        <TableCell className="text-slate-400">{city.state || "-"}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {city.created_at?.split("T")[0]}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCity(city);
                              setCityForm({ name: city.name, state: city.state || "" });
                              setShowAddCity(true);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCity(city.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={queueFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setQueueFilter("pending")}
                className={queueFilter === "pending" ? "bg-orange-600" : "border-[#333]"}
              >
                <Clock className="w-4 h-4 mr-1" />
                Pending ({queueCounts.pending})
              </Button>
              <Button
                variant={queueFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setQueueFilter("completed")}
                className={queueFilter === "completed" ? "bg-green-600" : "border-[#333]"}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Completed ({queueCounts.completed})
              </Button>
              <Button
                variant={queueFilter === "failed" ? "default" : "outline"}
                size="sm"
                onClick={() => setQueueFilter("failed")}
                className={queueFilter === "failed" ? "bg-red-600" : "border-[#333]"}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Failed ({queueCounts.failed})
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateQueue}
                className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
                title="Generate queue items for all business type + city combinations"
              >
                <Plus className="w-4 h-4 mr-1" />
                Regenerate Queue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadQueue}
                className="border-[#333]"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222] hover:bg-[#0a0a0a]">
                    <TableHead className="text-slate-400">Search</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">City</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Results</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                        No items in queue with this status.
                      </TableCell>
                    </TableRow>
                  ) : (
                    queueItems.map((item) => (
                      <TableRow key={item.id} className="border-[#222] hover:bg-[#0a0a0a]">
                        <TableCell className="font-medium text-white">{item.search_query}</TableCell>
                        <TableCell className="text-slate-400">{item.business_type_name}</TableCell>
                        <TableCell className="text-slate-400">{item.city_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.status === "completed"
                                ? "border-green-500/30 text-green-400"
                                : item.status === "failed"
                                ? "border-red-500/30 text-red-400"
                                : "border-orange-500/30 text-orange-400"
                            }
                          >
                            {item.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                            {item.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                            {item.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {item.results_count !== null && item.results_count !== undefined
                            ? item.results_count
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.status === "failed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetryQueueItem(item.id)}
                              className="text-orange-400 hover:text-orange-300"
                              title="Retry"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteQueueItem(item.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Business Type Dialog */}
      <Dialog open={showAddBusinessType} onOpenChange={setShowAddBusinessType}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingBusinessType ? "Edit Business Type" : "Add Business Type"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              When creating a business type, automatic searches will be generated combined with all existing cities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Category name (for message)
              </label>
              <Input
                placeholder="e.g: pharmacy"
                value={businessTypeForm.category_name}
                onChange={(e) => setBusinessTypeForm({ ...businessTypeForm, category_name: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
              <p className="text-xs text-slate-500 mt-1">
                Will be used in messages like: "Hello, am I reaching the <strong>pharmacy</strong>?"
              </p>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Search keyword (Google Maps)
              </label>
              <Input
                placeholder="e.g: pharmacies"
                value={businessTypeForm.search_keyword}
                onChange={(e) => setBusinessTypeForm({ ...businessTypeForm, search_keyword: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
              <p className="text-xs text-slate-500 mt-1">
                Will be used for Google Maps search: "<strong>pharmacies</strong> in Mexico City"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBusinessType(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={handleSaveBusinessType} className="bg-teal-600 hover:bg-teal-700">
              {editingBusinessType ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit City Dialog */}
      <Dialog open={showAddCity} onOpenChange={setShowAddCity}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCity ? "Edit City" : "Add City"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              When creating a city, automatic searches will be generated combined with all existing business types.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">City name</label>
              <Input
                placeholder="e.g: Mexico City"
                value={cityForm.name}
                onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">State/Province (optional)</label>
              <Input
                placeholder="e.g: CDMX"
                value={cityForm.state}
                onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCity(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={handleSaveCity} className="bg-blue-600 hover:bg-blue-700">
              {editingCity ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
