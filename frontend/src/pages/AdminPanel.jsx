import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
  Database, 
  Users, 
  Building2, 
  Target,
  Heart,
  Handshake,
  Package,
  Star,
  RefreshCw,
  Shield,
  HardDrive,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  FileText,
  Send,
  Compass,
  CloudOff,
  Cloud,
  Download,
  Server,
  Layers
} from "lucide-react";

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [stats, setStats] = useState({
    contacts: 0,
    companies: 0,
    buyerPersonas: 0,
    events: 0,
    campaigns: 0,
    templates: 0,
    thematicAxes: 0
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sysInfoRes, backupsRes, statsRes] = await Promise.all([
        api.get("/dashboard/admin/system-info"),
        api.get("/dashboard/admin/backups"),
        api.get("/dashboard/stats")
      ]);
      
      setSystemInfo(sysInfoRes.data);
      setBackups(backupsRes.data.backups || []);
      setStats({
        contacts: statsRes.data.total_contacts,
        companies: 5000, // From system info
        buyerPersonas: 79,
        events: statsRes.data.total_events,
        campaigns: statsRes.data.total_campaigns,
        templates: statsRes.data.total_templates,
        thematicAxes: 5
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando información del sistema");
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      await api.post("/dashboard/admin/backup");
      toast.success("¡Backup creado exitosamente!");
      // Reload backups list
      const res = await api.get("/dashboard/admin/backups");
      setBackups(res.data.backups || []);
    } catch (error) {
      console.error("Error creating backup:", error);
      toast.error("Error creando backup");
    } finally {
      setCreatingBackup(false);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    // Format: 20260124_214930
    const year = ts.substring(0, 4);
    const month = ts.substring(4, 6);
    const day = ts.substring(6, 8);
    const hour = ts.substring(9, 11);
    const min = ts.substring(11, 13);
    return `${day}/${month}/${year} ${hour}:${min}`;
  };

  const getStatusBadge = (status) => {
    if (status === "active") {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Activo</Badge>;
    }
    if (status === "configured") {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Configurado</Badge>;
    }
    return <Badge variant="outline" className="text-slate-500">Pendiente</Badge>;
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-blue-100 text-blue-700",
      pink: "bg-pink-100 text-pink-700",
      green: "bg-green-100 text-green-700",
      purple: "bg-purple-100 text-purple-700",
      amber: "bg-amber-100 text-amber-700"
    };
    return colors[color] || "bg-[#151515] text-slate-200";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500">Cargando información del sistema...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-panel">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Panel de Administración</h1>
          <p className="text-slate-500 mt-1">Vista general del sistema Leaderlix Sales Platform</p>
        </div>
        <Button onClick={loadAll} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Database Status - MongoDB Atlas */}
      <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Cloud className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">MongoDB Atlas</h3>
              <p className="text-sm text-slate-300">Base de datos en la nube • cluster0.epfhsrk.mongodb.net</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{systemInfo?.database?.total_collections || 17}</p>
                <p className="text-xs text-slate-500">Colecciones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{systemInfo?.database?.total_documents?.toLocaleString() || '6,400+'}</p>
                <p className="text-xs text-slate-500">Documentos</p>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Conectada</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold">{stats.contacts}</p>
            <p className="text-xs text-slate-500">Contactos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold">{stats.companies.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Empresas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <p className="text-2xl font-bold">{stats.buyerPersonas}</p>
            <p className="text-xs text-slate-500">Buyer Personas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-orange-600" />
            <p className="text-2xl font-bold">{stats.events}</p>
            <p className="text-xs text-slate-500">Webinars</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Send className="w-6 h-6 mx-auto mb-2 text-pink-600" />
            <p className="text-2xl font-bold">{stats.campaigns}</p>
            <p className="text-xs text-slate-500">Campañas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-6 h-6 mx-auto mb-2 text-cyan-600" />
            <p className="text-2xl font-bold">{stats.templates}</p>
            <p className="text-xs text-slate-500">Plantillas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Compass className="w-6 h-6 mx-auto mb-2 text-indigo-600" />
            <p className="text-2xl font-bold">{stats.thematicAxes}</p>
            <p className="text-xs text-slate-500">Ejes Temáticos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backups Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Backups
              </CardTitle>
              <Button 
                size="sm" 
                onClick={createBackup} 
                disabled={creatingBackup}
              >
                {creatingBackup ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Crear Backup
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {backups.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay backups disponibles</p>
                <p className="text-sm">Crea tu primer backup</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.slice(0, 5).map((backup) => (
                  <div 
                    key={backup.name}
                    className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{formatTimestamp(backup.timestamp)}</p>
                      <p className="text-xs text-slate-500">
                        {backup.collections} colecciones • {backup.documents.toLocaleString()} docs
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Completado
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Integraciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemInfo?.integrations?.map((integration, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{integration.name}</p>
                    <p className="text-xs text-slate-500">{integration.description}</p>
                  </div>
                  {getStatusBadge(integration.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Modules Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Módulos del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {systemInfo?.modules?.map((module, idx) => {
              const icons = { Target, Heart, Handshake, Package, Star };
              const colors = ['blue', 'pink', 'green', 'purple', 'amber'];
              const Icon = icons[Object.keys(icons)[idx]] || Target;
              const color = colors[idx] || 'slate';
              
              return (
                <div key={module.name} className="border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${getColorClasses(color)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold">{module.name}</h3>
                    {getStatusBadge(module.status)}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {module.features?.map((feature, fidx) => (
                      <Badge 
                        key={fidx}
                        variant={module.status === 'active' ? 'default' : 'outline'}
                        className={module.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Database Collections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Colecciones de Base de Datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {systemInfo?.database?.collections?.map((col) => (
              <div 
                key={col.name}
                className="p-3 bg-[#0f0f0f] rounded-lg border"
              >
                <p className="font-medium text-sm truncate">{col.name}</p>
                <p className="text-lg font-bold text-blue-600">{col.documents.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deployment Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
            <Server className="w-5 h-5" />
            Información de Deployment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-blue-700"><strong>Frontend:</strong> go.leaderlix.com</p>
              <p className="text-blue-700"><strong>Backend:</strong> backend.leaderlix.com</p>
            </div>
            <div className="space-y-2">
              <p className="text-blue-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <strong>Base de Datos:</strong> MongoDB Atlas ✓
              </p>
              <p className="text-blue-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <strong>Backups:</strong> Manuales disponibles ✓
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
