import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import api from "../lib/api";
import {
  BookOpen,
  Building2,
  Users,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Mail,
  Mic,
  PenTool,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  Send,
} from "lucide-react";

const PUBLISHER_TYPES = [
  { id: "magazine", name: "Revista", icon: BookOpen },
  { id: "blog", name: "Blog", icon: PenTool },
  { id: "newspaper", name: "Periódico", icon: FileText },
  { id: "podcast", name: "Podcast", icon: Mic },
  { id: "publisher", name: "Editorial", icon: Building2 },
];

const OPPORTUNITY_TYPES = [
  { id: "guest_article", name: "Artículo Invitado" },
  { id: "interview", name: "Entrevista" },
  { id: "podcast", name: "Podcast" },
  { id: "book_review", name: "Reseña de Libro" },
  { id: "collaboration", name: "Colaboración" },
];

const STATUSES = [
  { id: "idea", name: "Idea", color: "bg-slate-500/20 text-slate-400", icon: Clock },
  { id: "pitched", name: "Propuesto", color: "bg-blue-500/20 text-blue-400", icon: Send },
  { id: "negotiating", name: "Negociando", color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  { id: "accepted", name: "Aceptado", color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  { id: "published", name: "Publicado", color: "bg-purple-500/20 text-purple-400", icon: Star },
  { id: "rejected", name: "Rechazado", color: "bg-red-500/20 text-red-400", icon: XCircle },
];

export default function EditorialRelations() {
  const [loading, setLoading] = useState(true);
  const [publishers, setPublishers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Dialogs
  const [showPublisherDialog, setShowPublisherDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showOpportunityDialog, setShowOpportunityDialog] = useState(false);
  
  // Forms
  const [newPublisher, setNewPublisher] = useState({
    name: "", type: "magazine", website: "", industry: "", audience_size: "medium", notes: ""
  });
  const [newContact, setNewContact] = useState({
    publisher_id: "", name: "", role: "", email: "", phone: "", linkedin_url: "", notes: ""
  });
  const [newOpportunity, setNewOpportunity] = useState({
    publisher_id: "", contact_id: "", type: "guest_article", title: "", description: "", deadline: "", status: "idea", notes: ""
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [pubRes, conRes, oppRes, statsRes] = await Promise.all([
        api.get("/editorial/publishers"),
        api.get("/editorial/contacts"),
        api.get("/editorial/opportunities"),
        api.get("/editorial/stats")
      ]);
      setPublishers(pubRes.data.publishers || []);
      setContacts(conRes.data.contacts || []);
      setOpportunities(oppRes.data.opportunities || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPublisher = async () => {
    if (!newPublisher.name.trim()) {
      toast.error("Ingresa el nombre");
      return;
    }
    try {
      await api.post("/editorial/publishers", newPublisher);
      toast.success("Publisher agregado");
      setShowPublisherDialog(false);
      setNewPublisher({ name: "", type: "magazine", website: "", industry: "", audience_size: "medium", notes: "" });
      loadAllData();
    } catch (error) {
      toast.error("Error agregando publisher");
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast.error("Ingresa el nombre");
      return;
    }
    try {
      await api.post("/editorial/contacts", newContact);
      toast.success("Contacto agregado");
      setShowContactDialog(false);
      setNewContact({ publisher_id: "", name: "", role: "", email: "", phone: "", linkedin_url: "", notes: "" });
      loadAllData();
    } catch (error) {
      toast.error("Error agregando contacto");
    }
  };

  const handleAddOpportunity = async () => {
    if (!newOpportunity.title.trim()) {
      toast.error("Ingresa el título");
      return;
    }
    try {
      await api.post("/editorial/opportunities", newOpportunity);
      toast.success("Oportunidad creada");
      setShowOpportunityDialog(false);
      setNewOpportunity({ publisher_id: "", contact_id: "", type: "guest_article", title: "", description: "", deadline: "", status: "idea", notes: "" });
      loadAllData();
    } catch (error) {
      toast.error("Error creando oportunidad");
    }
  };

  const handleUpdateStatus = async (oppId, newStatus) => {
    try {
      await api.put(`/editorial/opportunities/${oppId}/status`, { status: newStatus });
      toast.success("Estado actualizado");
      loadAllData();
    } catch (error) {
      toast.error("Error actualizando estado");
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    try {
      await api.delete(`/editorial/${type}/${id}`);
      toast.success("Eliminado");
      loadAllData();
    } catch (error) {
      toast.error("Error eliminando");
    }
  };

  const getStatusBadge = (status) => {
    const s = STATUSES.find(st => st.id === status);
    if (!s) return <Badge>{status}</Badge>;
    return <Badge className={s.color}>{s.name}</Badge>;
  };

  const getPublisherName = (publisherId) => {
    const pub = publishers.find(p => p.id === publisherId);
    return pub?.name || "-";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="editorial-relations-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <BookOpen className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Editorial Relations</h1>
            <p className="text-sm text-slate-500">Gestiona relaciones con medios y editoriales</p>
          </div>
        </div>
        <Button onClick={loadAllData} variant="outline" className="border-[#333]">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats?.publishers || 0}</p>
            <p className="text-xs text-slate-500">Publishers</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats?.contacts || 0}</p>
            <p className="text-xs text-slate-500">Contactos</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats?.total_opportunities || 0}</p>
            <p className="text-xs text-slate-500">Oportunidades</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{stats?.by_status?.published || 0}</p>
            <p className="text-xs text-slate-500">Publicados</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats?.success_rate || 0}%</p>
            <p className="text-xs text-slate-500">Éxito</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="opportunities">
            <FileText className="w-4 h-4 mr-2" />
            Oportunidades
          </TabsTrigger>
          <TabsTrigger value="publishers">
            <Building2 className="w-4 h-4 mr-2" />
            Publishers
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="w-4 h-4 mr-2" />
            Contactos
          </TabsTrigger>
        </TabsList>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Pipeline de Oportunidades</CardTitle>
              <Button onClick={() => setShowOpportunityDialog(true)} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                Nueva
              </Button>
            </CardHeader>
            <CardContent>
              {opportunities.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay oportunidades</p>
                </div>
              ) : (
                <div className="border rounded-lg border-[#222] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#222]">
                        <TableHead className="text-slate-400">Título</TableHead>
                        <TableHead className="text-slate-400">Tipo</TableHead>
                        <TableHead className="text-slate-400">Publisher</TableHead>
                        <TableHead className="text-slate-400">Estado</TableHead>
                        <TableHead className="text-slate-400">Deadline</TableHead>
                        <TableHead className="text-right text-slate-400">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opportunities.map((opp) => (
                        <TableRow key={opp.id} className="border-[#222]">
                          <TableCell className="font-medium text-white">{opp.title}</TableCell>
                          <TableCell className="text-slate-400">
                            {OPPORTUNITY_TYPES.find(t => t.id === opp.type)?.name || opp.type}
                          </TableCell>
                          <TableCell className="text-slate-400">{getPublisherName(opp.publisher_id)}</TableCell>
                          <TableCell>
                            <Select value={opp.status} onValueChange={(v) => handleUpdateStatus(opp.id, v)}>
                              <SelectTrigger className="w-32 h-8 bg-transparent border-none">
                                {getStatusBadge(opp.status)}
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-slate-400">{opp.deadline || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete("opportunities", opp.id)}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Publishers Tab */}
        <TabsContent value="publishers" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Publishers & Medios</CardTitle>
              <Button onClick={() => setShowPublisherDialog(true)} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              {publishers.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay publishers</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publishers.map((pub) => (
                    <Card key={pub.id} className="bg-[#0a0a0a] border-[#222]">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-white">{pub.name}</h4>
                            <p className="text-sm text-slate-500">
                              {PUBLISHER_TYPES.find(t => t.id === pub.type)?.name || pub.type}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete("publishers", pub.id)}
                            className="text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {pub.website && (
                          <a href={pub.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-2">
                            <ExternalLink className="w-3 h-3" />
                            {pub.website}
                          </a>
                        )}
                        <div className="flex gap-4 mt-3 text-xs text-slate-500">
                          <span>{pub.contact_count || 0} contactos</span>
                          <span>{pub.opportunity_count || 0} oportunidades</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Contactos Editoriales</CardTitle>
              <Button onClick={() => setShowContactDialog(true)} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay contactos</p>
                </div>
              ) : (
                <div className="border rounded-lg border-[#222] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#222]">
                        <TableHead className="text-slate-400">Nombre</TableHead>
                        <TableHead className="text-slate-400">Rol</TableHead>
                        <TableHead className="text-slate-400">Publisher</TableHead>
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-right text-slate-400">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id} className="border-[#222]">
                          <TableCell className="font-medium text-white">{contact.name}</TableCell>
                          <TableCell className="text-slate-400">{contact.role || "-"}</TableCell>
                          <TableCell className="text-slate-400">{getPublisherName(contact.publisher_id)}</TableCell>
                          <TableCell>
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="text-blue-400 hover:underline flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </a>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete("contacts", contact.id)}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Publisher Dialog */}
      <Dialog open={showPublisherDialog} onOpenChange={setShowPublisherDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Publisher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input 
                  value={newPublisher.name}
                  onChange={(e) => setNewPublisher({...newPublisher, name: e.target.value})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newPublisher.type} onValueChange={(v) => setNewPublisher({...newPublisher, type: v})}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLISHER_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sitio Web</Label>
              <Input 
                value={newPublisher.website}
                onChange={(e) => setNewPublisher({...newPublisher, website: e.target.value})}
                placeholder="https://..."
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industria</Label>
                <Input 
                  value={newPublisher.industry}
                  onChange={(e) => setNewPublisher({...newPublisher, industry: e.target.value})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Audiencia</Label>
                <Select value={newPublisher.audience_size} onValueChange={(v) => setNewPublisher({...newPublisher, audience_size: v})}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Pequeña</SelectItem>
                    <SelectItem value="medium">Mediana</SelectItem>
                    <SelectItem value="large">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublisherDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddPublisher} className="bg-amber-600 hover:bg-amber-700">Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Contacto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Publisher</Label>
              <Select value={newContact.publisher_id} onValueChange={(v) => setNewContact({...newContact, publisher_id: v})}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {publishers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input 
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Input 
                  value={newContact.role}
                  onChange={(e) => setNewContact({...newContact, role: e.target.value})}
                  placeholder="Editor, Productor..."
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input 
                  value={newContact.phone}
                  onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddContact} className="bg-amber-600 hover:bg-amber-700">Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Opportunity Dialog */}
      <Dialog open={showOpportunityDialog} onOpenChange={setShowOpportunityDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva Oportunidad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input 
                value={newOpportunity.title}
                onChange={(e) => setNewOpportunity({...newOpportunity, title: e.target.value})}
                placeholder="Artículo sobre liderazgo..."
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newOpportunity.type} onValueChange={(v) => setNewOpportunity({...newOpportunity, type: v})}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Publisher</Label>
                <Select value={newOpportunity.publisher_id} onValueChange={(v) => setNewOpportunity({...newOpportunity, publisher_id: v})}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {publishers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={newOpportunity.status} onValueChange={(v) => setNewOpportunity({...newOpportunity, status: v})}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input 
                  type="date"
                  value={newOpportunity.deadline}
                  onChange={(e) => setNewOpportunity({...newOpportunity, deadline: e.target.value})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea 
                value={newOpportunity.description}
                onChange={(e) => setNewOpportunity({...newOpportunity, description: e.target.value})}
                className="bg-[#0a0a0a] border-[#333]"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpportunityDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddOpportunity} className="bg-amber-600 hover:bg-amber-700">Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
