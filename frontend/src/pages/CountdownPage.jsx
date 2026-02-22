import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Timer,
  Plus,
  Trash2,
  Edit,
  Eye,
  Copy,
  ExternalLink,
  Calendar,
  Globe,
  Home,
  Rocket,
  Tag,
  Megaphone,
  RefreshCw,
} from "lucide-react";

export default function CountdownPage() {
  const [countdowns, setCountdowns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCountdown, setEditingCountdown] = useState(null);
  
  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    target_date: "",
    type: "event",
    style: "default",
    cta_text: "Regístrate Ahora",
    cta_url: "",
    is_public: true,
    show_on_homepage: false,
    weekly_reset: false  // Reset every Monday
  });

  // Calculate next Monday at 00:00
  const getNextMonday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  };

  useEffect(() => {
    loadCountdowns();
  }, []);

  // Live countdown update
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => prev.map(c => {
        if (!c.target_date && !c.weekly_reset) return c;
        
        let target;
        if (c.weekly_reset) {
          // For weekly reset countdowns, always target next Monday
          target = getNextMonday();
        } else {
          target = new Date(c.target_date);
        }
        
        const now = new Date();
        const delta = target - now;
        
        if (delta < 0 && !c.weekly_reset) {
          return { ...c, time_remaining: { expired: true } };
        }
        
        return {
          ...c,
          time_remaining: {
            days: Math.floor(delta / (1000 * 60 * 60 * 24)),
            hours: Math.floor((delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((delta % (1000 * 60)) / 1000),
            expired: false
          }
        };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadCountdowns = async () => {
    try {
      const response = await api.get("/countdown/countdowns");
      if (response.data.success) {
        setCountdowns(response.data.countdowns);
      }
    } catch (error) {
      console.error("Error loading countdowns:", error);
      toast.error("Error cargando countdowns");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.target_date) {
      toast.error("Título y fecha son requeridos");
      return;
    }

    setLoading(true);
    try {
      if (editingCountdown) {
        await api.put(`/countdown/countdowns/${editingCountdown.id}`, form);
        toast.success("Countdown actualizado");
      } else {
        await api.post("/countdown/countdowns", form);
        toast.success("Countdown creado");
      }
      loadCountdowns();
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error saving countdown:", error);
      toast.error("Error guardando countdown");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      target_date: "",
      type: "event",
      style: "default",
      cta_text: "Regístrate Ahora",
      cta_url: "",
      is_public: true,
      show_on_homepage: false,
      weekly_reset: false
    });
    setEditingCountdown(null);
  };

  const editCountdown = (countdown) => {
    setEditingCountdown(countdown);
    setForm({
      title: countdown.title,
      description: countdown.description || "",
      target_date: countdown.target_date?.slice(0, 16) || "",
      type: countdown.type || "event",
      style: countdown.style || "default",
      cta_text: countdown.cta_text || "Regístrate Ahora",
      cta_url: countdown.cta_url || "",
      is_public: countdown.is_public ?? true,
      show_on_homepage: countdown.show_on_homepage ?? false,
      weekly_reset: countdown.weekly_reset ?? false
    });
    setShowCreateDialog(true);
  };

  const deleteCountdown = async (id) => {
    if (!confirm("¿Eliminar este countdown?")) return;
    
    try {
      await api.delete(`/countdown/countdowns/${id}`);
      toast.success("Countdown eliminado");
      loadCountdowns();
    } catch (error) {
      toast.error("Error eliminando countdown");
    }
  };

  const toggleActive = async (countdown) => {
    try {
      await api.put(`/countdown/countdowns/${countdown.id}`, {
        is_active: !countdown.is_active
      });
      toast.success(countdown.is_active ? "Countdown desactivado" : "Countdown activado");
      loadCountdowns();
    } catch (error) {
      toast.error("Error actualizando countdown");
    }
  };

  const toggleHomepage = async (countdown) => {
    try {
      // First disable all other homepage countdowns
      for (const c of countdowns) {
        if (c.show_on_homepage && c.id !== countdown.id) {
          await api.put(`/countdown/countdowns/${c.id}`, { show_on_homepage: false });
        }
      }
      
      await api.put(`/countdown/countdowns/${countdown.id}`, {
        show_on_homepage: !countdown.show_on_homepage
      });
      toast.success(countdown.show_on_homepage ? "Removido de homepage" : "Mostrado en homepage");
      loadCountdowns();
    } catch (error) {
      toast.error("Error actualizando countdown");
    }
  };

  const copyPublicLink = (countdown) => {
    const url = `${window.location.origin}/countdown/${countdown.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado al portapapeles");
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "event": return <Calendar className="h-4 w-4" />;
      case "launch": return <Rocket className="h-4 w-4" />;
      case "promotion": return <Tag className="h-4 w-4" />;
      default: return <Timer className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      event: "Evento",
      launch: "Lanzamiento",
      promotion: "Promoción",
      custom: "Personalizado"
    };
    return labels[type] || type;
  };

  const formatTimeUnit = (value) => {
    return String(value).padStart(2, '0');
  };

  return (
    <div className="space-y-6 p-6" data-testid="countdown-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="h-6 w-6 text-orange-500" />
            Hero Countdown
          </h1>
          <p className="text-muted-foreground">
            Crea contadores regresivos para eventos y lanzamientos
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="create-countdown-btn">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Countdown
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingCountdown ? "Editar Countdown" : "Nuevo Countdown"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Webinar: Comunicación Ejecutiva"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Aprende las técnicas más efectivas..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha y Hora *</Label>
                  <Input
                    type="datetime-local"
                    value={form.target_date}
                    onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event">Evento</SelectItem>
                      <SelectItem value="launch">Lanzamiento</SelectItem>
                      <SelectItem value="promotion">Promoción</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Texto del Botón</Label>
                  <Input
                    value={form.cta_text}
                    onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                    placeholder="Regístrate Ahora"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL del Botón</Label>
                  <Input
                    value={form.cta_url}
                    onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_public}
                    onCheckedChange={(v) => setForm({ ...form, is_public: v })}
                  />
                  <Label>Público</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.show_on_homepage}
                    onCheckedChange={(v) => setForm({ ...form, show_on_homepage: v })}
                  />
                  <Label>Mostrar en Homepage</Label>
                </div>
              </div>

              {/* Weekly Reset Option */}
              <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <Switch
                  checked={form.weekly_reset}
                  onCheckedChange={(v) => setForm({ ...form, weekly_reset: v })}
                />
                <div>
                  <Label className="text-orange-400">Reset semanal (Lunes)</Label>
                  <p className="text-xs text-muted-foreground">
                    El countdown se reinicia automáticamente cada lunes a medianoche
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : (editingCountdown ? "Actualizar" : "Crear")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Countdowns Grid */}
      {countdowns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Timer className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No tienes countdowns aún</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear tu primer countdown
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {countdowns.map((countdown) => (
            <Card 
              key={countdown.id} 
              className={`relative overflow-hidden ${!countdown.is_active ? 'opacity-60' : ''}`}
            >
              {countdown.show_on_homepage && (
                <Badge className="absolute top-2 right-2 bg-green-500">
                  <Home className="h-3 w-3 mr-1" />
                  Homepage
                </Badge>
              )}
              {countdown.weekly_reset && (
                <Badge className="absolute top-2 left-2 bg-orange-500">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Semanal
                </Badge>
              )}
              <CardHeader>
                <div className="flex items-start gap-2">
                  {getTypeIcon(countdown.type)}
                  <div>
                    <CardTitle className="text-lg">{countdown.title}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {countdown.description || getTypeLabel(countdown.type)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Countdown Display */}
                {countdown.time_remaining?.expired ? (
                  <div className="text-center py-4">
                    <Badge variant="destructive" className="text-lg px-4 py-2">
                      EXPIRADO
                    </Badge>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-2xl font-bold">
                        {formatTimeUnit(countdown.time_remaining?.days || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Días</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-2xl font-bold">
                        {formatTimeUnit(countdown.time_remaining?.hours || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Horas</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-2xl font-bold">
                        {formatTimeUnit(countdown.time_remaining?.minutes || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Min</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-2xl font-bold text-primary">
                        {formatTimeUnit(countdown.time_remaining?.seconds || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Seg</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {countdown.weekly_reset 
                      ? "Próximo lunes a medianoche"
                      : new Date(countdown.target_date).toLocaleDateString('es-MX', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                    }
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => editCountdown(countdown)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                {countdown.is_public && (
                  <Button variant="outline" size="sm" onClick={() => copyPublicLink(countdown)}>
                    <Copy className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => toggleHomepage(countdown)}
                >
                  <Home className="h-4 w-4 mr-1" />
                  {countdown.show_on_homepage ? "Quitar" : "Homepage"}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => toggleActive(countdown)}
                >
                  {countdown.is_active ? "Desactivar" : "Activar"}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => deleteCountdown(countdown.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
