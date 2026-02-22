import { useEffect, useState } from "react";
import { getDashboardStats } from "../lib/api";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { LevelProgression } from "../components/LevelProgression";
import { 
  Users, 
  Calendar, 
  Send, 
  FileText, 
  Mail, 
  MousePointer, 
  Eye,
  TrendingUp,
  ArrowUpRight,
  ArrowRightLeft,
  CheckCircle,
  Linkedin,
  Heart,
  Sparkles
} from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outreachProgress, setOutreachProgress] = useState(null);

  useEffect(() => {
    loadStats();
    loadOutreachProgress();
  }, []);

  const loadStats = async () => {
    try {
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOutreachProgress = async () => {
    try {
      const response = await api.get("/social-followers/outreach-checklist");
      setOutreachProgress(response.data);
    } catch (error) {
      console.error("Error loading outreach progress:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Contactos",
      value: stats?.total_contacts || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Webinars/Eventos",
      value: stats?.total_events || 0,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Campañas",
      value: stats?.total_campaigns || 0,
      icon: Send,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Plantillas",
      value: stats?.total_templates || 0,
      icon: FileText,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50"
    }
  ];

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen de tu automatización de marketing</p>
      </div>

      {/* Daily Outreach Progress Widget */}
      {outreachProgress && !outreachProgress.is_weekend && (
        <Card className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border-[#222] overflow-hidden" data-testid="outreach-widget">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Progreso del Día - {outreachProgress.weekday}</h3>
                  <p className="text-xs text-slate-500">Checklist de Outreach</p>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={
                  outreachProgress.completed_count === outreachProgress.total_count 
                    ? "border-green-500/30 text-green-400 bg-green-500/10" 
                    : "border-orange-500/30 text-orange-400 bg-orange-500/10"
                }
              >
                {outreachProgress.completed_count}/{outreachProgress.total_count} tareas
              </Badge>
            </div>
            
            <Progress 
              value={(outreachProgress.completed_count / outreachProgress.total_count) * 100} 
              className="h-2 mb-4"
            />
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {outreachProgress.tasks?.map((task) => (
                <div 
                  key={task.id}
                  className={`p-3 rounded-lg border transition-all ${
                    task.completed 
                      ? "bg-green-500/10 border-green-500/30" 
                      : "bg-[#0a0a0a] border-[#333]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {task.platform === "tiktok" && <Heart className={`w-4 h-4 ${task.completed ? "text-green-400" : "text-purple-400"}`} />}
                    {task.platform === "linkedin" && <Linkedin className={`w-4 h-4 ${task.completed ? "text-green-400" : "text-blue-500"}`} />}
                    {task.completed && <CheckCircle className="w-3 h-3 text-green-400" />}
                  </div>
                  <p className={`text-xs ${task.completed ? "text-green-400 line-through" : "text-slate-400"}`}>
                    {task.task.length > 25 ? task.task.substring(0, 25) + "..." : task.task}
                  </p>
                </div>
              ))}
            </div>
            
            {outreachProgress.completed_count === outreachProgress.total_count && (
              <div className="mt-4 text-center">
                <p className="text-green-400 text-sm font-medium">🎉 ¡Excelente! Completaste todas las tareas de hoy</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="stat-card" data-testid={`stat-${stat.title.toLowerCase().replace(/[\s/]/g, '-')}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} strokeWidth={1.5} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Level Progression */}
      <LevelProgression 
        totalContacts={stats?.total_contacts || 0}
        showDetails={true}
      />

      {/* Email Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="stat-card-accent lg:col-span-2">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#111111]/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold">Rendimiento de Emails</h3>
            </div>
            
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-slate-400 text-sm">Enviados</p>
                <p className="text-4xl font-bold mt-1">{stats?.total_emails_sent || 0}</p>
                <div className="flex items-center gap-1 mt-2 text-emerald-400 text-sm">
                  <Mail className="w-4 h-4" />
                  <span>Total</span>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Abiertos</p>
                <p className="text-4xl font-bold mt-1">{stats?.total_emails_opened || 0}</p>
                <div className="flex items-center gap-1 mt-2 text-blue-400 text-sm">
                  <Eye className="w-4 h-4" />
                  <span>{stats?.open_rate || 0}% tasa</span>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Clics</p>
                <p className="text-4xl font-bold mt-1">{stats?.total_emails_clicked || 0}</p>
                <div className="flex items-center gap-1 mt-2 text-orange-400 text-sm">
                  <MousePointer className="w-4 h-4" />
                  <span>{stats?.click_rate || 0}% tasa</span>
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Deals Movidos</p>
                <p className="text-4xl font-bold mt-1">{stats?.total_deal_movements || 0}</p>
                <div className="flex items-center gap-1 mt-2 text-purple-400 text-sm">
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>A Interés</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-500" />
              Campañas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recent_campaigns?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_campaigns.slice(0, 4).map((campaign, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-[#151515] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{campaign.name}</p>
                      <p className="text-xs text-slate-500">{campaign.emails_sent || 0} enviados</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        campaign.status === 'sent' ? 'badge-success' : 
                        campaign.status === 'sending' ? 'badge-warning' : 'badge-neutral'
                      }
                    >
                      {campaign.status === 'sent' ? 'Enviada' : 
                       campaign.status === 'sending' ? 'Enviando' : 'Borrador'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay campañas aún</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a 
              href="/events" 
              className="flex items-center gap-4 p-4 bg-[#0f0f0f] rounded-xl hover:bg-[#151515] transition-all group"
              data-testid="quick-action-events"
            >
              <div className="p-3 bg-purple-100 rounded-xl group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Sincronizar Webinars</p>
                <p className="text-sm text-slate-500">Desde HubSpot Cohortes</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </a>
            
            <a 
              href="/contacts" 
              className="flex items-center gap-4 p-4 bg-[#0f0f0f] rounded-xl hover:bg-[#151515] transition-all group"
              data-testid="quick-action-contacts"
            >
              <div className="p-3 bg-blue-100 rounded-xl group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Sincronizar Contactos</p>
                <p className="text-sm text-slate-500">Desde HubSpot</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </a>
            
            <a 
              href="/campaigns" 
              className="flex items-center gap-4 p-4 bg-[#0f0f0f] rounded-xl hover:bg-[#151515] transition-all group"
              data-testid="quick-action-campaigns"
            >
              <div className="p-3 bg-orange-100 rounded-xl group-hover:scale-105 transition-transform">
                <Send className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Nueva Campaña</p>
                <p className="text-sm text-slate-500">Crear y previsualizar</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Scheduler Info */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#111111]/10 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Programación Automática</h3>
              <p className="text-blue-100 mt-1 text-sm">
                Las campañas se enviarán automáticamente cada <strong>10 días hábiles</strong> (lunes a viernes).
                El envío real de correos está pendiente de configurar Gmail OAuth.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
