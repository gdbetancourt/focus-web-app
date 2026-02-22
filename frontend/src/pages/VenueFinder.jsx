import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
import { toast } from "sonner";
import api from "../lib/api";
import {
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Users,
  DollarSign,
  Star,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const VENUE_TYPES = [
  { id: "hotel", name: "Hotel" },
  { id: "conference_center", name: "Conference Center" },
  { id: "restaurant", name: "Restaurant" },
  { id: "coworking", name: "Coworking" },
  { id: "auditorium", name: "Auditorium" },
  { id: "university", name: "University" },
  { id: "hospital", name: "Hospital/Clinic" },
  { id: "other", name: "Other" },
];

const VENUE_STATUSES = [
  { id: "researching", name: "Researching", color: "bg-blue-500/20 text-blue-400" },
  { id: "contacted", name: "Contacted", color: "bg-yellow-500/20 text-yellow-400" },
  { id: "quoted", name: "Quoted", color: "bg-purple-500/20 text-purple-400" },
  { id: "approved", name: "Approved", color: "bg-green-500/20 text-green-400" },
  { id: "rejected", name: "Rejected", color: "bg-red-500/20 text-red-400" },
];

export default function VenueFinder() {
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("_all");
  const [statusFilter, setStatusFilter] = useState("_all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "hotel",
    address: "",
    city: "",
    capacity: "",
    price_range: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    website: "",
    status: "researching",
    rating: "",
    notes: "",
  });

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    setLoading(true);
    try {
      const res = await api.get("/venues/");
      setVenues(res.data.venues || []);
    } catch (error) {
      console.error("Error loading venues:", error);
      // Initialize with empty array if endpoint doesn't exist yet
      setVenues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      if (editingVenue) {
        await api.put(`/venues/${editingVenue.id}`, formData);
        toast.success("Venue updated");
      } else {
        await api.post("/venues/", formData);
        toast.success("Venue added");
      }
      setShowDialog(false);
      resetForm();
      loadVenues();
    } catch (error) {
      console.error("Error saving venue:", error);
      toast.error("Error saving venue");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this venue?")) return;
    try {
      await api.delete(`/venues/${id}`);
      toast.success("Venue deleted");
      loadVenues();
    } catch (error) {
      toast.error("Error deleting");
    }
  };

  const handleEdit = (venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name || "",
      type: venue.type || "hotel",
      address: venue.address || "",
      city: venue.city || "",
      capacity: venue.capacity || "",
      price_range: venue.price_range || "",
      contact_name: venue.contact_name || "",
      contact_phone: venue.contact_phone || "",
      contact_email: venue.contact_email || "",
      website: venue.website || "",
      status: venue.status || "researching",
      rating: venue.rating || "",
      notes: venue.notes || "",
    });
    setShowDialog(true);
  };

  const handleStatusChange = async (venueId, newStatus) => {
    try {
      await api.put(`/venues/${venueId}`, { status: newStatus });
      setVenues(venues.map(v => v.id === venueId ? { ...v, status: newStatus } : v));
      toast.success("Status updated");
    } catch (error) {
      toast.error("Error updating status");
    }
  };

  const resetForm = () => {
    setEditingVenue(null);
    setFormData({
      name: "",
      type: "hotel",
      address: "",
      city: "",
      capacity: "",
      price_range: "",
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      website: "",
      status: "researching",
      rating: "",
      notes: "",
    });
  };

  const filteredVenues = venues.filter((venue) => {
    const matchesSearch = venue.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "_all" || venue.type === typeFilter;
    const matchesStatus = statusFilter === "_all" || venue.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: venues.length,
    researching: venues.filter(v => v.status === "researching").length,
    contacted: venues.filter(v => v.status === "contacted").length,
    approved: venues.filter(v => v.status === "approved").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="venue-finder-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#ff3300]/20">
            <MapPin className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Venue Finder</h1>
            <p className="text-sm text-slate-500">Busca y gestiona sedes para eventos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadVenues} variant="outline" className="border-[#333]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => { resetForm(); setShowDialog(true); }}
            className="bg-[#ff3300] hover:bg-[#ff3300]/80"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Venue
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-500">Total Venues</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.researching}</p>
            <p className="text-xs text-slate-500">Investigando</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.contacted}</p>
            <p className="text-xs text-slate-500">Contactados</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
            <p className="text-xs text-slate-500">Aprobados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Buscar por nombre, ciudad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#111] border-[#333]"
            />
          </div>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-[#111] border-[#333]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los tipos</SelectItem>
            {VENUE_TYPES.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-[#111] border-[#333]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos los estados</SelectItem>
            {VENUE_STATUSES.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Venues Table */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-0">
          {filteredVenues.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-xl font-bold text-white mb-2">No hay venues</h3>
              <p className="text-slate-400 mb-4">Agrega tu primer venue para comenzar</p>
              <Button
                onClick={() => { resetForm(); setShowDialog(true); }}
                className="bg-[#ff3300] hover:bg-[#ff3300]/80"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Venue
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#222]">
                  <TableHead className="text-slate-400">Venue</TableHead>
                  <TableHead className="text-slate-400">Tipo</TableHead>
                  <TableHead className="text-slate-400">Ciudad</TableHead>
                  <TableHead className="text-slate-400">Capacidad</TableHead>
                  <TableHead className="text-slate-400">Precio</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVenues.map((venue) => {
                  const typeInfo = VENUE_TYPES.find(t => t.id === venue.type);
                  const statusInfo = VENUE_STATUSES.find(s => s.id === venue.status);
                  return (
                    <TableRow key={venue.id} className="border-[#222]">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{venue.name}</p>
                          <p className="text-xs text-slate-500">{venue.address}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[#333] text-slate-400">
                          {typeInfo?.name || venue.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{venue.city || "-"}</TableCell>
                      <TableCell className="text-slate-400">
                        {venue.capacity ? (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {venue.capacity}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-slate-400">{venue.price_range || "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={venue.status}
                          onValueChange={(val) => handleStatusChange(venue.id, val)}
                        >
                          <SelectTrigger className="w-[130px] h-7 text-xs bg-transparent border-0 p-0">
                            <Badge className={statusInfo?.color || "bg-slate-500/20 text-slate-400"}>
                              {statusInfo?.name || venue.status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {VENUE_STATUSES.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {venue.website && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(venue.website, '_blank')}
                              className="text-slate-400 h-8 w-8 p-0"
                            >
                              <Globe className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(venue)}
                            className="text-slate-400 h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(venue.id)}
                            className="text-red-400 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#111] border-[#222] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingVenue ? "Editar Venue" : "Nuevo Venue"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre del venue"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle, número, colonia..."
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ciudad"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacidad</Label>
                <Input
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="ej: 50-100"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Rango de Precios</Label>
                <Input
                  value={formData.price_range}
                  onChange={(e) => setFormData({ ...formData, price_range: e.target.value })}
                  placeholder="ej: $5,000-$10,000"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>

            <div className="border-t border-[#222] pt-4 mt-4">
              <p className="text-sm font-medium text-slate-400 mb-3">Información de Contacto</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Contacto</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Nombre"
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+52..."
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="email@venue.com"
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sitio Web</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_STATUSES.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                className="bg-[#0a0a0a] border-[#333]"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-[#ff3300] hover:bg-[#ff3300]/80">
              {editingVenue ? "Guardar Cambios" : "Agregar Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
