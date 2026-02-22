import { useState, useEffect } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
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
  Mail,
  Plus,
  RefreshCw,
  Send,
  Edit2,
  Trash2,
  Users,
  FileText,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserPlus,
} from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-500/20 text-slate-400",
  scheduled: "bg-blue-500/20 text-blue-400",
  sending: "bg-yellow-500/20 text-yellow-400",
  sent: "bg-green-500/20 text-green-400",
};

export default function NewslettersPage() {
  const [loading, setLoading] = useState(true);
  const [newsletters, setNewsletters] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState({});
  const [thematicAreas, setThematicAreas] = useState([]);
  const [activeTab, setActiveTab] = useState("newsletters");
  
  // Newsletter dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    content_html: "",
    thematic_area: "",
  });
  
  // Subscriber dialog
  const [subscriberDialogOpen, setSubscriberDialogOpen] = useState(false);
  const [subscriberForm, setSubscriberForm] = useState({
    email: "",
    name: "",
    thematic_areas: [],
  });
  
  // Send dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  // Auto newsletter configs
  const [autoConfigs, setAutoConfigs] = useState([]);
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoForm, setAutoForm] = useState({
    thematic_axis_id: "",
    frequency: "weekly",
    day_of_week: 1,
    hour: 9,
    enabled: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nlRes, subRes, axesRes, autoRes] = await Promise.all([
        api.get("/newsletters"),
        api.get("/newsletters/subscribers/list"),
        api.get("/thematic-axes/").catch(() => ({ data: { thematic_axes: [] } })),
        api.get("/newsletters/auto-config").catch(() => ({ data: { configs: [] } })),
      ]);
      setNewsletters(nlRes.data.newsletters || []);
      setSubscribers(subRes.data.subscribers || []);
      setThematicAreas(axesRes.data.thematic_axes || axesRes.data || []);
      setAutoConfigs(autoRes.data.configs || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      subject: "",
      content_html: "",
      thematic_area: "",
    });
  };

  const openEditDialog = (newsletter) => {
    setEditingId(newsletter.id);
    setFormData({
      name: newsletter.name || "",
      subject: newsletter.subject || "",
      content_html: newsletter.content_html || "",
      thematic_area: newsletter.thematic_area || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.subject.trim()) {
      toast.error("Nombre y asunto son requeridos");
      return;
    }
    
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/newsletters/${editingId}`, formData);
        toast.success("Newsletter actualizado");
      } else {
        await api.post("/newsletters", formData);
        toast.success("Newsletter creado");
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este newsletter?")) return;
    try {
      await api.delete(`/newsletters/${id}`);
      toast.success("Newsletter eliminado");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const openSendDialog = (newsletter) => {
    setSendingNewsletter(newsletter);
    setTestEmail("");
    setSendDialogOpen(true);
  };

  const handleSend = async (isTest = false) => {
    if (!sendingNewsletter) return;
    
    setSending(true);
    try {
      const payload = isTest ? { test_email: testEmail } : {};
      const res = await api.post(`/newsletters/${sendingNewsletter.id}/send`, payload);
      
      if (res.data.success) {
        if (isTest) {
          toast.success(`Email de prueba enviado a ${testEmail}`);
        } else {
          toast.success(`Enviando a ${res.data.recipient_count} suscriptores`);
          setSendDialogOpen(false);
          loadData();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const handleAddSubscriber = async () => {
    if (!subscriberForm.email.trim()) {
      toast.error("Email es requerido");
      return;
    }
    
    try {
      await api.post("/newsletters/subscribers", subscriberForm);
      toast.success("Suscriptor agregado");
      setSubscriberDialogOpen(false);
      setSubscriberForm({ email: "", name: "", thematic_areas: [] });
      loadData();
    } catch (error) {
      toast.error("Error al agregar suscriptor");
    }
  };

  const handleRemoveSubscriber = async (id) => {
    if (!confirm("¿Eliminar este suscriptor?")) return;
    try {
      await api.delete(`/newsletters/subscribers/${id}`);
      toast.success("Suscriptor eliminado");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleSaveAutoConfig = async () => {
    if (!autoForm.thematic_axis_id) {
      toast.error("Selecciona un eje temático");
      return;
    }
    
    try {
      await api.post("/newsletters/auto-config", autoForm);
      toast.success("Configuración guardada");
      setAutoDialogOpen(false);
      setAutoForm({
        thematic_axis_id: "",
        frequency: "weekly",
        day_of_week: 1,
        hour: 9,
        enabled: true,
      });
      loadData();
    } catch (error) {
      toast.error("Error al guardar configuración");
    }
  };

  const handleDeleteAutoConfig = async (id) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      await api.delete(`/newsletters/auto-config/${id}`);
      toast.success("Configuración eliminada");
      loadData();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const DAYS_OF_WEEK = [
    { value: 0, label: "Lunes" },
    { value: 1, label: "Martes" },
    { value: 2, label: "Miércoles" },
    { value: 3, label: "Jueves" },
    { value: 4, label: "Viernes" },
    { value: 5, label: "Sábado" },
    { value: 6, label: "Domingo" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="newsletters-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#ff3300]/20">
            <Mail className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Newsletters</h1>
            <p className="text-sm text-slate-500">Gestiona tus newsletters y suscriptores</p>
          </div>
        </div>
        <Button onClick={loadData} variant="outline" className="border-[#333]">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold text-white">{stats.total_newsletters || 0}</p>
            <p className="text-xs text-slate-500">Newsletters</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold text-white">{stats.total_subscribers || 0}</p>
            <p className="text-xs text-slate-500">Suscriptores</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <Send className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold text-white">{stats.sent_newsletters || 0}</p>
            <p className="text-xs text-slate-500">Enviados</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <Mail className="w-6 h-6 mx-auto mb-2 text-[#ff3300]" />
            <p className="text-2xl font-bold text-white">{stats.total_emails_sent || 0}</p>
            <p className="text-xs text-slate-500">Emails Enviados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
          <TabsTrigger value="subscribers">Suscriptores</TabsTrigger>
          <TabsTrigger value="automatic">Automáticos</TabsTrigger>
        </TabsList>

        {/* Newsletters Tab */}
        <TabsContent value="newsletters" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => { resetForm(); setDialogOpen(true); }}
              className="bg-[#ff3300] hover:bg-[#ff3300]/80"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Newsletter
            </Button>
          </div>

          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              {newsletters.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-bold text-white mb-2">No hay newsletters</h3>
                  <p className="text-slate-400 mb-4">Crea tu primer newsletter</p>
                  <Button
                    onClick={() => { resetForm(); setDialogOpen(true); }}
                    className="bg-[#ff3300] hover:bg-[#ff3300]/80"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Newsletter
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222]">
                      <TableHead className="text-slate-400">Newsletter</TableHead>
                      <TableHead className="text-slate-400">Área</TableHead>
                      <TableHead className="text-slate-400">Estado</TableHead>
                      <TableHead className="text-slate-400">Enviados</TableHead>
                      <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newsletters.map((nl) => (
                      <TableRow key={nl.id} className="border-[#222]">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{nl.name}</p>
                            <p className="text-xs text-slate-500">{nl.subject}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {nl.thematic_area ? (
                            <Badge variant="outline" className="border-[#333]">
                              {thematicAreas.find(a => a.id === nl.thematic_area)?.name || nl.thematic_area}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[nl.status] || STATUS_COLORS.draft}>
                            {nl.status === "draft" && <FileText className="w-3 h-3 mr-1" />}
                            {nl.status === "sending" && <Clock className="w-3 h-3 mr-1" />}
                            {nl.status === "sent" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {nl.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {nl.sent_count || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {nl.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openSendDialog(nl)}
                                className="text-green-400 h-8 w-8 p-0"
                                title="Enviar"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(nl)}
                              className="text-slate-400 h-8 w-8 p-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(nl.id)}
                              className="text-red-400 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setSubscriberDialogOpen(true)}
              className="bg-[#ff3300] hover:bg-[#ff3300]/80"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Agregar Suscriptor
            </Button>
          </div>

          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              {subscribers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-bold text-white mb-2">No hay suscriptores</h3>
                  <p className="text-slate-400">Agrega suscriptores para enviar newsletters</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222]">
                      <TableHead className="text-slate-400">Email</TableHead>
                      <TableHead className="text-slate-400">Nombre</TableHead>
                      <TableHead className="text-slate-400">Áreas</TableHead>
                      <TableHead className="text-slate-400">Suscrito</TableHead>
                      <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map((sub) => (
                      <TableRow key={sub.id} className="border-[#222]">
                        <TableCell className="text-white">{sub.email}</TableCell>
                        <TableCell className="text-slate-400">{sub.name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(sub.thematic_areas || []).map(area => (
                              <Badge key={area} variant="outline" className="border-[#333] text-xs">
                                {thematicAreas.find(a => a.id === area)?.name || area}
                              </Badge>
                            ))}
                            {(!sub.thematic_areas || sub.thematic_areas.length === 0) && (
                              <span className="text-slate-500 text-sm">Todas</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSubscriber(sub.id)}
                            className="text-red-400 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automatic Newsletters Tab */}
        <TabsContent value="automatic" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setAutoDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Configuración
            </Button>
          </div>

          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Newsletters Automáticos por Eje Temático
              </CardTitle>
            </CardHeader>
            <CardContent>
              {autoConfigs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No hay configuraciones de newsletters automáticos</p>
                  <p className="text-sm mt-1">Configura envíos periódicos basados en ejes temáticos</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#222]">
                      <TableHead className="text-slate-400">Eje Temático</TableHead>
                      <TableHead className="text-slate-400">Frecuencia</TableHead>
                      <TableHead className="text-slate-400">Día/Hora</TableHead>
                      <TableHead className="text-slate-400">Estado</TableHead>
                      <TableHead className="text-slate-400">Último Envío</TableHead>
                      <TableHead className="text-right text-slate-400">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {autoConfigs.map((config) => (
                      <TableRow key={config.id} className="border-[#222]">
                        <TableCell className="text-white font-medium">
                          {config.thematic_axis_name || config.thematic_axis_id}
                        </TableCell>
                        <TableCell className="text-slate-300 capitalize">
                          {config.frequency === "weekly" ? "Semanal" : 
                           config.frequency === "biweekly" ? "Quincenal" : "Mensual"}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {DAYS_OF_WEEK.find(d => d.value === config.day_of_week)?.label || "Lunes"} - {config.hour}:00
                        </TableCell>
                        <TableCell>
                          <Badge className={config.enabled ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"}>
                            {config.enabled ? "Activo" : "Pausado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {config.last_sent ? new Date(config.last_sent).toLocaleDateString() : "Nunca"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAutoConfig(config.id)}
                            className="text-red-400 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto Newsletter Config Dialog */}
      <Dialog open={autoDialogOpen} onOpenChange={setAutoDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Configurar Newsletter Automático</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Eje Temático</Label>
              <Select 
                value={autoForm.thematic_axis_id} 
                onValueChange={(v) => setAutoForm({ ...autoForm, thematic_axis_id: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Seleccionar eje temático" />
                </SelectTrigger>
                <SelectContent>
                  {thematicAreas.map((axis) => (
                    <SelectItem key={axis.id} value={axis.id}>{axis.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">Frecuencia</Label>
              <Select 
                value={autoForm.frequency} 
                onValueChange={(v) => setAutoForm({ ...autoForm, frequency: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">Día de la semana</Label>
                <Select 
                  value={String(autoForm.day_of_week)} 
                  onValueChange={(v) => setAutoForm({ ...autoForm, day_of_week: parseInt(v) })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Hora (24h)</Label>
                <Select 
                  value={String(autoForm.hour)} 
                  onValueChange={(v) => setAutoForm({ ...autoForm, hour: parseInt(v) })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAutoConfig} className="bg-purple-600 hover:bg-purple-700">
              Guardar Configuración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newsletter Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? "Editar Newsletter" : "Nuevo Newsletter"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Newsletter mensual"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Área Temática</Label>
                <Select
                  value={formData.thematic_area}
                  onValueChange={(v) => setFormData({ ...formData, thematic_area: v })}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue placeholder="Todas las áreas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las áreas</SelectItem>
                    {thematicAreas.map(area => (
                      <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Asunto *</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="El asunto del email"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <Label>Contenido HTML</Label>
              <Textarea
                value={formData.content_html}
                onChange={(e) => setFormData({ ...formData, content_html: e.target.value })}
                placeholder="<h1>Tu contenido aquí...</h1>"
                className="bg-[#0a0a0a] border-[#333] min-h-[200px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#ff3300]">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscriber Dialog */}
      <Dialog open={subscriberDialogOpen} onOpenChange={setSubscriberDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Suscriptor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                value={subscriberForm.email}
                onChange={(e) => setSubscriberForm({ ...subscriberForm, email: e.target.value })}
                placeholder="email@ejemplo.com"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={subscriberForm.name}
                onChange={(e) => setSubscriberForm({ ...subscriberForm, name: e.target.value })}
                placeholder="Nombre del suscriptor"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscriberDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSubscriber} className="bg-[#ff3300]">
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-[#ff3300]" />
              Enviar Newsletter
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <p className="font-medium text-white">{sendingNewsletter?.name}</p>
              <p className="text-sm text-slate-500">{sendingNewsletter?.subject}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Enviar prueba (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-[#0a0a0a] border-[#333]"
                />
                <Button
                  variant="outline"
                  onClick={() => handleSend(true)}
                  disabled={!testEmail || sending}
                  className="border-[#333]"
                >
                  Probar
                </Button>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Confirmar envío</span>
              </div>
              <p className="text-sm text-yellow-400/80 mt-1">
                Se enviará a todos los suscriptores del área seleccionada.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleSend(false)}
              disabled={sending}
              className="bg-green-600 hover:bg-green-700"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar a Todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
