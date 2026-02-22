import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Mail,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";

export default function EmailMetricsDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/newsletters/stats/dashboard?days=${period}`);
      setDashboard(res.data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Error cargando métricas");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return "-";
    const date = new Date(isoDate);
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="metrics-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  const summary = dashboard?.summary || {};
  const newsletters = dashboard?.recent_newsletters || [];
  const dailyActivity = dashboard?.daily_activity || [];
  const byArea = dashboard?.by_thematic_area || {};

  // Calculate max for chart scaling
  const maxActivity = Math.max(...dailyActivity.map(d => Math.max(d.opens, d.clicks)), 1);

  return (
    <div className="space-y-6" data-testid="email-metrics-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#ff3300]/20">
            <BarChart3 className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Metrics Dashboard</h1>
            <p className="text-sm text-slate-500">Rendimiento de tus campañas de email</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-[#111] border-[#333]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadDashboard} variant="outline" className="border-[#333]">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Mail className="w-8 h-8 text-blue-500" />
              <Badge className="bg-blue-500/20 text-blue-400">Enviados</Badge>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{summary.total_sent || 0}</p>
            <p className="text-xs text-slate-500">emails totales</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Eye className="w-8 h-8 text-green-500" />
              <Badge className="bg-green-500/20 text-green-400">{summary.open_rate || 0}%</Badge>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{summary.total_opens || 0}</p>
            <p className="text-xs text-slate-500">aperturas</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <MousePointer className="w-8 h-8 text-purple-500" />
              <Badge className="bg-purple-500/20 text-purple-400">{summary.click_rate || 0}%</Badge>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{summary.total_clicks || 0}</p>
            <p className="text-xs text-slate-500">clics</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Users className="w-8 h-8 text-yellow-500" />
              <ArrowUpRight className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">+{summary.new_subscribers || 0}</p>
            <p className="text-xs text-slate-500">nuevos suscriptores</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingDown className="w-8 h-8 text-red-500" />
              <ArrowDownRight className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{summary.unsubscribes || 0}</p>
            <p className="text-xs text-slate-500">bajas</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Activity className="w-5 h-5" />
            Actividad Diaria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyActivity.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay actividad en este período</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Simple bar chart */}
              <div className="flex items-end gap-2 h-40">
                {dailyActivity.map((day, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col gap-1">
                      {/* Opens bar */}
                      <div
                        className="w-full bg-green-500/60 rounded-t transition-all"
                        style={{ height: `${(day.opens / maxActivity) * 100}px` }}
                        title={`${day.opens} aperturas`}
                      />
                      {/* Clicks bar */}
                      <div
                        className="w-full bg-purple-500/60 rounded-b transition-all"
                        style={{ height: `${(day.clicks / maxActivity) * 50}px` }}
                        title={`${day.clicks} clics`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 rotate-0">
                      {new Date(day.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500/60 rounded" />
                  <span>Aperturas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500/60 rounded" />
                  <span>Clics</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Newsletters Performance */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5" />
              Newsletters Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {newsletters.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay newsletters enviados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {newsletters.slice(0, 5).map((nl) => (
                  <div
                    key={nl.id}
                    className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{nl.name}</p>
                        <p className="text-xs text-slate-500">{formatDate(nl.sent_at)}</p>
                      </div>
                      <Badge
                        className={`ml-2 ${
                          nl.open_rate >= 30
                            ? "bg-green-500/20 text-green-400"
                            : nl.open_rate >= 15
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {nl.open_rate}% aperturas
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {nl.sent_count} enviados
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {nl.open_count} abiertos
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        {nl.click_count} clics
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance by Thematic Area */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5" />
              Por Área Temática
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byArea).length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay datos por área temática</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(byArea).map(([area, stats]) => {
                  const openRate = stats.sent > 0 ? Math.round((stats.opens / stats.sent) * 100) : 0;
                  return (
                    <div key={area} className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white capitalize">{area}</span>
                        <Badge
                          className={`${
                            openRate >= 30
                              ? "bg-green-500/20 text-green-400"
                              : openRate >= 15
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {openRate}% apertura
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{stats.sent} enviados</span>
                        <span>{stats.opens} abiertos</span>
                        <span>{stats.clicks} clics</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
                          style={{ width: `${openRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card className="bg-gradient-to-r from-[#ff3300]/10 to-[#ff3300]/5 border-[#ff3300]/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[#ff3300] mt-0.5" />
            <div>
              <p className="font-medium text-white">Consejos para mejorar tus métricas</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-400">
                <li>• <strong>Open rate bajo?</strong> Prueba diferentes líneas de asunto (A/B testing)</li>
                <li>• <strong>Click rate bajo?</strong> Añade CTAs claros y botones visibles</li>
                <li>• <strong>Muchas bajas?</strong> Segmenta mejor tu audiencia por área temática</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
