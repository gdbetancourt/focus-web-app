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
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Heart,
  Instagram,
  Twitter,
  Linkedin,
  Users,
  Plus,
  RefreshCw,
  CheckCircle,
  MessageCircle,
  History,
  Trash2,
  ExternalLink,
  Star,
  TrendingUp,
} from "lucide-react";

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-400" },
  { id: "twitter", name: "X/Twitter", icon: Twitter, color: "text-blue-400" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "text-blue-500" },
  { id: "tiktok", name: "TikTok", icon: Heart, color: "text-purple-400" },
];

const MESSAGE_TYPES = [
  { id: "dm", name: "Mensaje Directo" },
  { id: "comment", name: "Comentario" },
  { id: "mention", name: "Mención" },
  { id: "email", name: "Email" },
];

export default function SocialFollowers() {
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [outreachChecklist, setOutreachChecklist] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [selectedFollower, setSelectedFollower] = useState(null);
  
  // Form state
  const [newFollower, setNewFollower] = useState({
    platform: "instagram",
    username: "",
    name: "",
    bio: "",
    followers_count: "",
    engagement_score: 5,
    notes: "",
    priority: 5
  });
  
  const [contactLog, setContactLog] = useState({
    message_type: "dm",
    message_preview: "",
    notes: ""
  });
  
  // Filters
  const [platformFilter, setPlatformFilter] = useState("_all");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [followersRes, checklistRes, historyRes, statsRes, outreachRes] = await Promise.all([
        api.get("/social-followers/"),
        api.get("/social-followers/daily-checklist"),
        api.get("/social-followers/history?days=14"),
        api.get("/social-followers/stats"),
        api.get("/social-followers/outreach-checklist")
      ]);
      
      setFollowers(followersRes.data.followers || []);
      setChecklist(checklistRes.data.checklist || []);
      setHistory(historyRes.data.logs || []);
      setStats(statsRes.data);
      setOutreachChecklist(outreachRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const toggleOutreachTask = async (taskId) => {
    try {
      const res = await api.post(`/social-followers/outreach-checklist/${taskId}/toggle`);
      if (res.data.success) {
        toast.success(res.data.message);
        // Refresh outreach checklist
        const outreachRes = await api.get("/social-followers/outreach-checklist");
        setOutreachChecklist(outreachRes.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error actualizando tarea");
    }
  };

  const handleAddFollower = async () => {
    if (!newFollower.username.trim()) {
      toast.error("Ingresa el username");
      return;
    }
    
    try {
      await api.post("/social-followers/", {
        ...newFollower,
        followers_count: newFollower.followers_count ? parseInt(newFollower.followers_count) : null
      });
      toast.success("Seguidor agregado");
      setShowAddDialog(false);
      setNewFollower({
        platform: "instagram",
        username: "",
        name: "",
        bio: "",
        followers_count: "",
        engagement_score: 5,
        notes: "",
        priority: 5
      });
      loadAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error agregando seguidor");
    }
  };

  const handleLogContact = async () => {
    if (!selectedFollower) return;
    
    try {
      await api.post(`/social-followers/${selectedFollower.id}/contact`, contactLog);
      toast.success("Contacto registrado");
      setShowContactDialog(false);
      setSelectedFollower(null);
      setContactLog({ message_type: "dm", message_preview: "", notes: "" });
      loadAllData();
    } catch (error) {
      toast.error("Error registrando contacto");
    }
  };

  const handleMarkConverted = async (followerId) => {
    try {
      await api.post(`/social-followers/${followerId}/convert`);
      toast.success("Marcado como convertido");
      loadAllData();
    } catch (error) {
      toast.error("Error actualizando");
    }
  };

  const handleDelete = async (followerId) => {
    if (!confirm("¿Eliminar este seguidor?")) return;
    
    try {
      await api.delete(`/social-followers/${followerId}`);
      toast.success("Eliminado");
      loadAllData();
    } catch (error) {
      toast.error("Error eliminando");
    }
  };

  const openContactDialog = (follower) => {
    setSelectedFollower(follower);
    setShowContactDialog(true);
  };

  const getPlatformIcon = (platform) => {
    const p = PLATFORMS.find(pl => pl.id === platform);
    if (!p) return <Heart className="w-4 h-4" />;
    const Icon = p.icon;
    return <Icon className={`w-4 h-4 ${p.color}`} />;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-400",
      contacted: "bg-blue-500/20 text-blue-400",
      converted: "bg-green-500/20 text-green-400",
      ignored: "bg-slate-500/20 text-slate-400"
    };
    const labels = {
      pending: "Pendiente",
      contacted: "Contactado",
      converted: "Convertido",
      ignored: "Ignorado"
    };
    return <Badge className={styles[status] || styles.pending}>{labels[status] || status}</Badge>;
  };

  const filteredFollowers = platformFilter === "_all" 
    ? followers 
    : followers.filter(f => f.platform === platformFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="social-followers-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Heart className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Social Media Followers</h1>
            <p className="text-sm text-slate-500">Checklist diario para contactar seguidores</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAllData} variant="outline" className="border-[#333]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="bg-pink-600 hover:bg-pink-700">
            <Plus className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
            <p className="text-xs text-slate-500">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats?.by_status?.pending || 0}</p>
            <p className="text-xs text-slate-500">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats?.by_status?.contacted || 0}</p>
            <p className="text-xs text-slate-500">Contactados</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats?.by_status?.converted || 0}</p>
            <p className="text-xs text-slate-500">Convertidos</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{stats?.contacts_today || 0}</p>
            <p className="text-xs text-slate-500">Hoy</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="outreach" className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="outreach">
            <TrendingUp className="w-4 h-4 mr-2" />
            Outreach Diario
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <CheckCircle className="w-4 h-4 mr-2" />
            Seguidores
          </TabsTrigger>
          <TabsTrigger value="all">
            <Users className="w-4 h-4 mr-2" />
            Todos
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Outreach Checklist Tab */}
        <TabsContent value="outreach" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                  Checklist de Outreach - {outreachChecklist?.weekday || ""}
                </div>
                {outreachChecklist && !outreachChecklist.is_weekend && (
                  <Badge variant="outline" className={outreachChecklist.completed_count === outreachChecklist.total_count ? "border-green-500/30 text-green-400" : "border-orange-500/30 text-orange-400"}>
                    {outreachChecklist.completed_count}/{outreachChecklist.total_count} completadas
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outreachChecklist?.is_weekend ? (
                <div className="text-center py-8 text-slate-500">
                  <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg">{outreachChecklist.message}</p>
                  <p className="text-sm mt-2">Disfruta tu fin de semana! 🎉</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {outreachChecklist?.tasks?.map((task) => (
                    <div 
                      key={task.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                        task.completed 
                          ? "bg-green-500/10 border-green-500/30" 
                          : "bg-[#0a0a0a] border-[#222] hover:border-orange-500/30"
                      }`}
                      onClick={() => toggleOutreachTask(task.id)}
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox 
                          checked={task.completed}
                          onCheckedChange={() => toggleOutreachTask(task.id)}
                          className={task.completed ? "border-green-500 data-[state=checked]:bg-green-500" : ""}
                        />
                        <div className="flex items-center gap-2">
                          {task.platform === "tiktok" && <Heart className="w-4 h-4 text-purple-400" />}
                          {task.platform === "linkedin" && <Linkedin className="w-4 h-4 text-blue-500" />}
                          <span className={`font-medium ${task.completed ? "text-green-400 line-through" : "text-white"}`}>
                            {task.task}
                          </span>
                        </div>
                      </div>
                      {task.completed && task.completed_at && (
                        <span className="text-xs text-slate-500">
                          {new Date(task.completed_at).toLocaleTimeString("es-MX", {hour: "2-digit", minute: "2-digit"})}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Contactar Hoy ({checklist.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checklist.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay seguidores pendientes de contactar</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Seguidor
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {checklist.map((follower) => (
                    <div 
                      key={follower.id}
                      className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(follower.platform)}
                          <span className="font-medium text-white">@{follower.username}</span>
                        </div>
                        {follower.name && (
                          <span className="text-slate-400 text-sm">{follower.name}</span>
                        )}
                        {follower.engagement_score && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs text-yellow-400">{follower.engagement_score}</span>
                          </div>
                        )}
                        {getStatusBadge(follower.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        {follower.profile_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(follower.profile_url, "_blank")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => openContactDialog(follower)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Contactar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Followers Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Todos los Seguidores</CardTitle>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-40 bg-[#0a0a0a] border-[#333]">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {filteredFollowers.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay seguidores registrados</p>
                </div>
              ) : (
                <div className="border rounded-lg border-[#222] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#222]">
                        <TableHead className="text-slate-400">Usuario</TableHead>
                        <TableHead className="text-slate-400">Nombre</TableHead>
                        <TableHead className="text-slate-400 text-center">Score</TableHead>
                        <TableHead className="text-slate-400 text-center">Contactos</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-right text-slate-400">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFollowers.map((follower) => (
                        <TableRow key={follower.id} className="border-[#222]">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getPlatformIcon(follower.platform)}
                              <span className="font-medium text-white">@{follower.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-400">{follower.name || "-"}</TableCell>
                          <TableCell className="text-center">
                            {follower.engagement_score && (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-3 h-3 text-yellow-400" />
                                <span className="text-yellow-400">{follower.engagement_score}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-slate-400">
                            {follower.contact_count || 0}
                          </TableCell>
                          <TableCell>{getStatusBadge(follower.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openContactDialog(follower)}
                                title="Registrar contacto"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              {follower.status !== "converted" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkConverted(follower.id)}
                                  className="text-green-400"
                                  title="Marcar como convertido"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(follower.id)}
                                className="text-red-400"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Historial de Contactos (14 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay historial de contactos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#222]"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                          {MESSAGE_TYPES.find(m => m.id === log.message_type)?.name || log.message_type}
                        </Badge>
                        <span className="text-slate-400 text-sm">
                          {new Date(log.contacted_at).toLocaleDateString()} {new Date(log.contacted_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      {log.message_preview && (
                        <span className="text-sm text-slate-500 truncate max-w-xs">
                          {log.message_preview}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Follower Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Seguidor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select 
                  value={newFollower.platform} 
                  onValueChange={(v) => setNewFollower({...newFollower, platform: v})}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input 
                  value={newFollower.username}
                  onChange={(e) => setNewFollower({...newFollower, username: e.target.value})}
                  placeholder="@username"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input 
                value={newFollower.name}
                onChange={(e) => setNewFollower({...newFollower, name: e.target.value})}
                placeholder="Nombre completo (opcional)"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seguidores</Label>
                <Input 
                  type="number"
                  value={newFollower.followers_count}
                  onChange={(e) => setNewFollower({...newFollower, followers_count: e.target.value})}
                  placeholder="Número de seguidores"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Engagement Score (1-10)</Label>
                <Input 
                  type="number"
                  min="1"
                  max="10"
                  value={newFollower.engagement_score}
                  onChange={(e) => setNewFollower({...newFollower, engagement_score: parseInt(e.target.value) || 5})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea 
                value={newFollower.notes}
                onChange={(e) => setNewFollower({...newFollower, notes: e.target.value})}
                placeholder="Notas adicionales..."
                className="bg-[#0a0a0a] border-[#333]"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddFollower} className="bg-pink-600 hover:bg-pink-700">
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              Registrar Contacto - @{selectedFollower?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Mensaje</Label>
              <Select 
                value={contactLog.message_type} 
                onValueChange={(v) => setContactLog({...contactLog, message_type: v})}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_TYPES.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Preview del Mensaje (opcional)</Label>
              <Textarea 
                value={contactLog.message_preview}
                onChange={(e) => setContactLog({...contactLog, message_preview: e.target.value})}
                placeholder="Primeras líneas del mensaje enviado..."
                className="bg-[#0a0a0a] border-[#333]"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea 
                value={contactLog.notes}
                onChange={(e) => setContactLog({...contactLog, notes: e.target.value})}
                placeholder="Notas sobre la interacción..."
                className="bg-[#0a0a0a] border-[#333]"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLogContact} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Registrar Contacto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
