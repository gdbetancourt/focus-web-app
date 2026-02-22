import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Bot,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Search,
  Clock,
  TrendingUp,
  Zap,
  Bell,
  Check,
} from "lucide-react";

export default function ScrapingAutomation() {
  const [loading, setLoading] = useState(true);
  const [apifyStatus, setApifyStatus] = useState(null);
  const [quotas, setQuotas] = useState(null);
  const [phoneStats, setPhoneStats] = useState(null);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [keywordHistory, setKeywordHistory] = useState([]);
  const [pendingPhones, setPendingPhones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  
  // Phone enrichment form
  const [enrichPhone, setEnrichPhone] = useState("");
  const [enrichingId, setEnrichingId] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [apifyRes, quotasRes, phoneRes, statusRes, historyRes, pendingRes, alertsRes] = await Promise.all([
        api.get("/scraping-automation/apify/status").catch(() => ({ data: null })),
        api.get("/scraping-automation/quotas").catch(() => ({ data: null })),
        api.get("/scraping-automation/phone-enrichment/stats").catch(() => ({ data: null })),
        api.get("/scraping-automation/status").catch(() => ({ data: null })),
        api.get("/scraping-automation/keyword-history?days=14").catch(() => ({ data: { history: [] } })),
        api.get("/scraping-automation/phone-enrichment/pending?limit=20").catch(() => ({ data: { contacts: [] } })),
        api.get("/scraping-automation/alerts?limit=20").catch(() => ({ data: { alerts: [], unread_count: 0 } })),
      ]);
      
      setApifyStatus(apifyRes.data);
      setQuotas(quotasRes.data);
      setPhoneStats(phoneRes.data);
      setAutomationStatus(statusRes.data);
      setKeywordHistory(historyRes.data?.history || []);
      setPendingPhones(pendingRes.data?.contacts || []);
      setAlerts(alertsRes.data?.alerts || []);
      setUnreadAlerts(alertsRes.data?.unread_count || 0);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading automation data");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      await api.put(`/scraping-automation/alerts/${alertId}/read`);
      setAlerts(alerts.map(a => a.id === alertId ? {...a, read: true} : a));
      setUnreadAlerts(Math.max(0, unreadAlerts - 1));
    } catch (error) {
      toast.error("Error marking alert as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put("/scraping-automation/alerts/mark-all-read");
      setAlerts(alerts.map(a => ({...a, read: true})));
      setUnreadAlerts(0);
      toast.success("All alerts marked as read");
    } catch (error) {
      toast.error("Error marking alerts as read");
    }
  };

  const handleEnrichPhone = async (contactId) => {
    if (!enrichPhone.trim()) {
      toast.error("Ingresa un número de teléfono");
      return;
    }
    
    try {
      await api.post(`/scraping-automation/phone-enrichment/enrich?contact_id=${contactId}&phone=${encodeURIComponent(enrichPhone)}`);
      toast.success("Teléfono agregado");
      setEnrichPhone("");
      setEnrichingId(null);
      loadAllData();
    } catch (error) {
      toast.error("Error agregando teléfono");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="scraping-automation-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#ff3300]/20">
            <Bot className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Scraping Automation</h1>
            <p className="text-sm text-slate-500">Monitoreo de Apify, cuotas y enriquecimiento</p>
          </div>
        </div>
        <Button onClick={loadAllData} variant="outline" className="border-[#333]">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Apify Status Alert */}
      {apifyStatus?.alerts?.length > 0 && (
        <div className="space-y-2">
          {apifyStatus.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg flex items-center gap-3 ${
                alert.type === "critical" ? "bg-red-500/20 border border-red-500/50" :
                alert.type === "error" ? "bg-red-500/20 border border-red-500/50" :
                alert.type === "warning" ? "bg-yellow-500/20 border border-yellow-500/50" :
                "bg-blue-500/20 border border-blue-500/50"
              }`}
            >
              <AlertTriangle className={`w-5 h-5 ${
                alert.type === "critical" || alert.type === "error" ? "text-red-400" :
                alert.type === "warning" ? "text-yellow-400" : "text-blue-400"
              }`} />
              <span className="text-white">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Apify Connection */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Apify</p>
                <p className="text-lg font-bold text-white mt-1">
                  {apifyStatus?.connected ? "Connected" : "Disconnected"}
                </p>
              </div>
              {apifyStatus?.connected ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
            </div>
            {apifyStatus?.plan && (
              <p className="text-xs text-slate-500 mt-2">
                ${apifyStatus.plan.remaining_usd} remaining
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active Schedules */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Active Schedules</p>
                <p className="text-3xl font-bold text-blue-400 mt-1">
                  {automationStatus?.active_schedules || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>

        {/* Queue Size */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Queue</p>
                <p className="text-3xl font-bold text-purple-400 mt-1">
                  {automationStatus?.queue_size || 0}
                </p>
              </div>
              <Search className="w-8 h-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>

        {/* Phone Coverage */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Phone Coverage</p>
                <p className="text-3xl font-bold text-green-400 mt-1">
                  {phoneStats?.coverage_percentage || 0}%
                </p>
              </div>
              <Phone className="w-8 h-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="quotas" className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="quotas">
            <TrendingUp className="w-4 h-4 mr-2" />
            Cuotas Semanales
          </TabsTrigger>
          <TabsTrigger value="phones">
            <Phone className="w-4 h-4 mr-2" />
            Enriquecimiento
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="w-4 h-4 mr-2" />
            Historial Keywords
          </TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            <Bell className="w-4 h-4 mr-2" />
            Alertas
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Quotas Tab */}
        <TabsContent value="quotas" className="space-y-4">
          {quotas && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contacts */}
              <Card className="bg-[#111] border-[#222]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm">Contactos esta semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">
                      {quotas.usage?.contacts_this_week || 0} / {quotas.quotas?.contacts_per_week}
                    </span>
                    <span className="text-white font-bold">
                      {Math.round((quotas.usage?.contacts_this_week / quotas.quotas?.contacts_per_week) * 100) || 0}%
                    </span>
                  </div>
                  <Progress 
                    value={(quotas.usage?.contacts_this_week / quotas.quotas?.contacts_per_week) * 100 || 0} 
                    className="h-2"
                  />
                </CardContent>
              </Card>

              {/* Phone Enrichment */}
              <Card className="bg-[#111] border-[#222]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm">Enriquecimiento Teléfonos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">
                      {quotas.usage?.phone_enrichments_this_week || 0} / {quotas.quotas?.phone_enrichment_per_week}
                    </span>
                    <span className="text-white font-bold">
                      {Math.round((quotas.usage?.phone_enrichments_this_week / quotas.quotas?.phone_enrichment_per_week) * 100) || 0}%
                    </span>
                  </div>
                  <Progress 
                    value={(quotas.usage?.phone_enrichments_this_week / quotas.quotas?.phone_enrichment_per_week) * 100 || 0}
                    className="h-2"
                  />
                </CardContent>
              </Card>

              {/* Decision Makers */}
              <Card className="bg-[#111] border-[#222]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm">Decision Makers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">
                      {quotas.usage?.decision_makers_this_week || 0} / {quotas.quotas?.decision_makers_per_week}
                    </span>
                    <span className="text-white font-bold">
                      {Math.round((quotas.usage?.decision_makers_this_week / quotas.quotas?.decision_makers_per_week) * 100) || 0}%
                    </span>
                  </div>
                  <Progress 
                    value={(quotas.usage?.decision_makers_this_week / quotas.quotas?.decision_makers_per_week) * 100 || 0}
                    className="h-2"
                  />
                </CardContent>
              </Card>

              {/* Companies */}
              <Card className="bg-[#111] border-[#222]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm">Empresas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">
                      {quotas.usage?.companies_this_week || 0} / {quotas.quotas?.companies_per_week}
                    </span>
                    <span className="text-white font-bold">
                      {Math.round((quotas.usage?.companies_this_week / quotas.quotas?.companies_per_week) * 100) || 0}%
                    </span>
                  </div>
                  <Progress 
                    value={(quotas.usage?.companies_this_week / quotas.quotas?.companies_per_week) * 100 || 0}
                    className="h-2"
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Phone Enrichment Tab */}
        <TabsContent value="phones" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-green-400" />
                Contactos sin teléfono ({pendingPhones.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingPhones.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Todos los contactos tienen teléfono</p>
                </div>
              ) : (
                <div className="border rounded-lg border-[#222] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#222]">
                        <TableHead className="text-slate-400">Nombre</TableHead>
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-slate-400">Empresa</TableHead>
                        <TableHead className="text-right text-slate-400">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPhones.map((contact) => (
                        <TableRow key={contact.id} className="border-[#222]">
                          <TableCell className="font-medium text-white">{contact.name}</TableCell>
                          <TableCell className="text-slate-400">{contact.email}</TableCell>
                          <TableCell className="text-slate-400">{contact.company || "-"}</TableCell>
                          <TableCell className="text-right">
                            {enrichingId === contact.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Input
                                  value={enrichPhone}
                                  onChange={(e) => setEnrichPhone(e.target.value)}
                                  placeholder="+52..."
                                  className="w-32 h-8 bg-[#0a0a0a] border-[#333]"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleEnrichPhone(contact.id)}
                                  className="bg-green-600 hover:bg-green-700 h-8"
                                >
                                  <Zap className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setEnrichingId(null); setEnrichPhone(""); }}
                                  className="h-8"
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEnrichingId(contact.id)}
                                className="border-green-500/30 text-green-400"
                              >
                                + Phone
                              </Button>
                            )}
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

        {/* Keyword History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Últimas búsquedas (14 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {keywordHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay historial de búsquedas</p>
                </div>
              ) : (
                <div className="border rounded-lg border-[#222] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#222]">
                        <TableHead className="text-slate-400">Keyword</TableHead>
                        <TableHead className="text-slate-400">Tipo</TableHead>
                        <TableHead className="text-slate-400">Resultados</TableHead>
                        <TableHead className="text-slate-400">Fecha</TableHead>
                        <TableHead className="text-right text-slate-400">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keywordHistory.map((item, idx) => {
                        const daysAgo = Math.floor(
                          (Date.now() - new Date(item.searched_at).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <TableRow key={idx} className="border-[#222]">
                            <TableCell className="font-medium text-white">{item.keyword}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                {item.search_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400">{item.results_count}</TableCell>
                            <TableCell className="text-slate-400">
                              {new Date(item.searched_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {daysAgo >= 7 ? (
                                <Badge className="bg-green-500/20 text-green-400">Ready</Badge>
                              ) : (
                                <Badge className="bg-yellow-500/20 text-yellow-400">
                                  Wait {7 - daysAgo}d
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-400" />
                Alertas del Sistema ({alerts.length})
              </CardTitle>
              {unreadAlerts > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkAllRead}
                  className="border-[#333]"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Marcar todas leídas
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay alertas</p>
                  <p className="text-xs mt-2">El sistema está funcionando correctamente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        alert.read 
                          ? 'bg-[#0a0a0a] border-[#222]' 
                          : 'bg-[#111] border-[#333]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {alert.type === 'critical' && (
                            <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                          )}
                          {alert.type === 'warning' && (
                            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                          )}
                          {alert.type === 'info' && (
                            <Bell className="w-5 h-5 text-blue-400 mt-0.5" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{alert.title}</span>
                              <Badge className={`text-xs ${
                                alert.type === 'critical' ? 'bg-red-500/20 text-red-400' :
                                alert.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {alert.category}
                              </Badge>
                              {!alert.read && (
                                <Badge className="bg-blue-500/20 text-blue-400 text-xs">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                            <p className="text-xs text-slate-500 mt-2">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!alert.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAlertRead(alert.id)}
                            className="text-slate-400"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
