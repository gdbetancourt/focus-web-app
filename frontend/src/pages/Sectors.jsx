import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import api from "../lib/api";
import { 
  Factory,
  RefreshCw,
  Search,
  Building2,
  Globe,
  CheckCircle,
  XCircle,
  Zap
} from "lucide-react";

export default function Sectors() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  
  // Companies dialog
  const [viewingCompanies, setViewingCompanies] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const sectorsRes = await api.get("/buyer-personas-db/active-sectors");
      setSectors(sectorsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar sectores");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (sector, newValue) => {
    const sectorCode = sector.code || sector.hubspot_value;
    try {
      await api.put(`/buyer-personas-db/active-sectors/${sectorCode}?is_active=${newValue}`);
      
      // Update local state
      setSectors(prev => prev.map(s => 
        (s.code || s.hubspot_value) === sectorCode 
          ? { ...s, is_active: newValue }
          : s
      ));
      
      toast.success(`Sector ${newValue ? 'activado' : 'desactivado'}`);
    } catch (error) {
      console.error("Error toggling sector:", error);
      toast.error("Error al cambiar estado del sector");
    }
  };

  const handleSyncSectors = async () => {
    setSyncing(true);
    try {
      const response = await api.post("/buyer-personas-db/sync-sectors-from-hubspot");
      toast.success(response.data.message);
      loadData();
    } catch (error) {
      toast.error("Error al sincronizar sectores");
    } finally {
      setSyncing(false);
    }
  };

  const handleViewCompanies = async (item) => {
    const industryValue = item.hubspot_value || item.code;
    setViewingCompanies(item);
    setLoadingCompanies(true);
    
    try {
      const response = await api.get(`/hubspot/industries/${industryValue}/companies`);
      setCompanies(response.data);
    } catch (error) {
      toast.error("Error al cargar empresas");
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Get display name
  const getDisplayName = (item) => {
    return item.custom_name || item.name || item.hubspot_label || item.hubspot_value || item.code;
  };

  // Filter sectors
  const filteredSectors = sectors.filter(s => {
    const search = searchTerm.toLowerCase();
    const name = getDisplayName(s).toLowerCase();
    const code = (s.code || s.hubspot_value || "").toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  // Stats
  const totalSectors = sectors.length;
  const activeSectors = sectors.filter(s => s.is_active).length;
  const inactiveSectors = totalSectors - activeSectors;
  const totalCompanies = sectors.reduce((sum, s) => sum + (s.company_count || 0), 0);

  return (
    <div className="space-y-6" data-testid="sectors-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Sectores</h1>
          <p className="text-slate-500 mt-1">
            Gestiona los sectores activos para la clasificación de Buyer Personas
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleSyncSectors}
            disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? "Sincronizando..." : "Sincronizar desde HubSpot"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Factory className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalSectors}</p>
                <p className="text-xs text-slate-500">Total Sectores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{activeSectors}</p>
                <p className="text-xs text-emerald-600">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card border-[#222222] bg-[#0f0f0f]/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#151515] rounded-lg">
                <XCircle className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-300">{inactiveSectors}</p>
                <p className="text-xs text-slate-500">Inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalCompanies}</p>
                <p className="text-xs text-slate-500">Empresas Clasificadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar sectores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Sectors Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-white">Sectores Activos ({activeSectors})</h2>
        </div>
        
        {loading ? (
          <Card className="stat-card">
            <CardContent className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#222222] border-t-slate-600 rounded-full mx-auto" />
              <p className="text-slate-500 mt-4">Cargando sectores...</p>
            </CardContent>
          </Card>
        ) : filteredSectors.filter(s => s.is_active).length === 0 ? (
          <Card className="stat-card border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-6 text-center">
              <p className="text-emerald-700">No hay sectores activos que coincidan con la búsqueda</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="stat-card overflow-hidden border-emerald-200">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-emerald-50">
                  <TableHead className="font-semibold w-20">Estado</TableHead>
                  <TableHead className="font-semibold">Sector</TableHead>
                  <TableHead className="font-semibold">Código</TableHead>
                  <TableHead className="font-semibold text-center">Empresas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSectors.filter(s => s.is_active).map((sector) => (
                  <TableRow 
                    key={sector.code || sector.hubspot_value} 
                    className="table-row-hover bg-emerald-50/30"
                  >
                    <TableCell>
                      <Switch
                        checked={sector.is_active}
                        onCheckedChange={(checked) => handleToggleActive(sector, checked)}
                        data-testid={`toggle-${sector.code || sector.hubspot_value}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getDisplayName(sector)}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          Activo
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-[#151515] px-2 py-1 rounded">
                        {sector.code || sector.hubspot_value}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      {sector.company_count > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewCompanies(sector)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {sector.company_count}
                        </Button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Inactive Sectors Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-slate-400" />
          <h2 className="text-xl font-bold text-slate-300">Sectores Inactivos ({inactiveSectors})</h2>
        </div>
        
        {filteredSectors.filter(s => !s.is_active).length === 0 ? (
          <Card className="stat-card">
            <CardContent className="p-6 text-center">
              <p className="text-slate-500">No hay sectores inactivos que coincidan con la búsqueda</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="stat-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-[#0f0f0f]">
                  <TableHead className="font-semibold w-20">Activar</TableHead>
                  <TableHead className="font-semibold">Sector</TableHead>
                  <TableHead className="font-semibold">Código</TableHead>
                  <TableHead className="font-semibold text-center">Empresas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSectors.filter(s => !s.is_active).map((sector) => (
                  <TableRow 
                    key={sector.code || sector.hubspot_value} 
                    className="table-row-hover"
                  >
                    <TableCell>
                      <Switch
                        checked={sector.is_active}
                        onCheckedChange={(checked) => handleToggleActive(sector, checked)}
                        data-testid={`toggle-${sector.code || sector.hubspot_value}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-300">{getDisplayName(sector)}</span>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-[#151515] px-2 py-1 rounded">
                        {sector.code || sector.hubspot_value}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      {sector.company_count > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewCompanies(sector)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {sector.company_count}
                        </Button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Info box */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="p-2 bg-blue-100 rounded-lg h-fit">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">¿Cómo funciona?</h3>
              <p className="text-sm text-blue-700 mt-1">
                La clasificación de contactos combina <strong>Área Funcional</strong> (detectada por cargo) + <strong>Sector</strong> (industria de la empresa).
              </p>
              <p className="text-sm text-blue-700 mt-2">
                • Un contacto de RRHH en una empresa de Retail = "Direcciones de RRHH - Retail"<br/>
                • Un contacto de Marketing en una empresa Farmacéutica = "Direcciones de Marketing - Farma"<br/>
                • Contactos de sectores inactivos se clasifican como "Direcciones de [Área] - Otros Sectores"
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies Dialog */}
      <Dialog open={!!viewingCompanies} onOpenChange={() => setViewingCompanies(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5" />
              Empresas en "{getDisplayName(viewingCompanies || {})}"
            </DialogTitle>
          </DialogHeader>
          
          {loadingCompanies ? (
            <div className="py-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#222222] border-t-slate-600 rounded-full mx-auto" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Dominio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.slice(0, 100).map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        {company.domain ? (
                          <a 
                            href={`https://${company.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Globe className="w-3 h-3" />
                            {company.domain}
                          </a>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {companies.length > 100 && (
                <p className="text-center text-slate-500 py-3 text-sm">
                  Mostrando 100 de {companies.length} empresas
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
