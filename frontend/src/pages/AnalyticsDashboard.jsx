import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { LevelProgression } from "../components/LevelProgression";
import {
  BarChart3,
  TrendingUp,
  Users,
  Mail,
  Eye,
  MousePointer,
  Calendar,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({
    emails: { sent: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 },
    contacts: { total: 0, byStage: {}, newThisMonth: 0 },
    content: { blogs: 0, testimonials: 0, events: 0 },
    pipeline: { stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0 }
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Load multiple analytics endpoints in parallel
      const [emailRes, contactsRes, contentRes] = await Promise.all([
        api.get('/newsletters/analytics/summary').catch(() => ({ data: {} })),
        api.get('/contacts/stats').catch(() => ({ data: {} })),
        api.get('/content-flow/stats').catch(() => ({ data: {} })),
      ]);

      setStats({
        emails: {
          sent: emailRes.data?.total_sent || 0,
          opened: emailRes.data?.total_opened || 0,
          clicked: emailRes.data?.total_clicked || 0,
          openRate: emailRes.data?.open_rate || 0,
          clickRate: emailRes.data?.click_rate || 0,
        },
        contacts: {
          total: contactsRes.data?.total || 0,
          byStage: contactsRes.data?.by_stage || {},
          newThisMonth: contactsRes.data?.new_this_month || 0,
        },
        content: {
          blogs: contentRes.data?.total_blogs || 0,
          testimonials: contentRes.data?.total_testimonials || 0,
          events: contentRes.data?.total_events || 0,
        },
        pipeline: contactsRes.data?.by_stage || {}
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "blue" }) => {
    const colorClasses = {
      blue: "text-blue-400 bg-blue-500/20",
      green: "text-green-400 bg-green-500/20",
      orange: "text-orange-400 bg-orange-500/20",
      purple: "text-purple-400 bg-purple-500/20",
      pink: "text-pink-400 bg-pink-500/20",
    };

    return (
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">{title}</p>
              <p className="text-3xl font-bold text-white mt-1">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
              )}
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-3">
              {trend > 0 ? (
                <ArrowUp className="w-4 h-4 text-green-400" />
              ) : trend < 0 ? (
                <ArrowDown className="w-4 h-4 text-red-400" />
              ) : (
                <Minus className="w-4 h-4 text-slate-400" />
              )}
              <span className={`text-sm ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {Math.abs(trend)}% vs mes anterior
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-blue-500/20">
          <BarChart3 className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-slate-500">Resumen de métricas de marketing y ventas</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contactos"
          value={stats.contacts.total}
          subtitle="En el CRM"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Emails Enviados"
          value={stats.emails.sent}
          subtitle={`${stats.emails.openRate}% abiertos`}
          icon={Mail}
          color="green"
        />
        <StatCard
          title="Tasa de Apertura"
          value={`${stats.emails.openRate}%`}
          subtitle="Promedio"
          icon={Eye}
          color="purple"
        />
        <StatCard
          title="Tasa de Click"
          value={`${stats.emails.clickRate}%`}
          subtitle="En emails"
          icon={MousePointer}
          color="orange"
        />
      </div>

      {/* Level Progression */}
      <LevelProgression 
        totalContacts={stats.contacts.total}
        showDetails={true}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="overview" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
            Resumen
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            Contenido
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Email Performance */}
            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-green-400" />
                  Email Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Enviados</span>
                    <span className="text-white font-bold">{stats.emails.sent.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Abiertos</span>
                    <span className="text-white font-bold">{stats.emails.opened.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Clicks</span>
                    <span className="text-white font-bold">{stats.emails.clicked.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Growth */}
            <Card className="bg-[#111] border-[#222]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Crecimiento de Contactos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-white">{stats.contacts.total.toLocaleString()}</p>
                  <p className="text-slate-500 mt-2">Contactos totales</p>
                  <Badge className="mt-4 bg-green-500/20 text-green-400">
                    +{stats.contacts.newThisMonth} este mes
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-6">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white">Pipeline de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { stage: "1. Prospecting", key: "1", color: "bg-blue-500" },
                  { stage: "2. Nurturing", key: "2", color: "bg-purple-500" },
                  { stage: "3. Closing", key: "3", color: "bg-orange-500" },
                  { stage: "4. Delivery", key: "4", color: "bg-green-500" },
                  { stage: "5. Referrals", key: "5", color: "bg-pink-500" },
                ].map(({ stage, key, color }) => {
                  const count = stats.pipeline[key] || 0;
                  const total = stats.contacts.total || 1;
                  const percentage = Math.round((count / total) * 100);
                  
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">{stage}</span>
                        <span className="text-white font-bold">{count.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${color} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Blog Posts"
              value={stats.content.blogs}
              icon={Calendar}
              color="purple"
            />
            <StatCard
              title="Testimonios"
              value={stats.content.testimonials}
              icon={Users}
              color="green"
            />
            <StatCard
              title="Eventos"
              value={stats.content.events}
              icon={Calendar}
              color="orange"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
