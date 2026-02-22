import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import api from "../lib/api";
import { 
  BarChart3,
  Users,
  TrendingUp,
  Calendar,
  Target,
  ChevronRight,
  RefreshCw,
  Eye,
  Sparkles
} from "lucide-react";

export default function EventStats() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventContacts, setEventContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await api.get("/hubspot/events/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  };

  const loadEventContacts = async (eventId) => {
    setLoadingContacts(true);
    try {
      const response = await api.get(`/hubspot/events/${eventId}/contacts`);
      setEventContacts(response.data.contacts || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Error al cargar contactos");
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleViewContacts = (event) => {
    setSelectedEvent(event);
    loadEventContacts(event.event_id);
  };

  // Color palette for areas
  const areaColors = {
    "Marketing": "bg-purple-100 text-purple-800",
    "Comercial": "bg-blue-100 text-blue-800",
    "RRHH": "bg-green-100 text-green-800",
    "Finanzas": "bg-amber-100 text-amber-800",
    "Tecnología": "bg-cyan-100 text-cyan-800",
    "Operaciones": "bg-orange-100 text-orange-800",
    "Dirección General": "bg-red-100 text-red-800",
    "Otras Direcciones": "bg-[#151515] text-white"
  };

  const getAreaColor = (area) => {
    return areaColors[area] || "bg-[#151515] text-slate-200";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500">Cargando estadísticas...</span>
      </div>
    );
  }

  if (!stats || stats.events.length === 0) {
    return (
      <div className="space-y-6" data-testid="event-stats-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Efectividad por Evento</h1>
            <p className="text-slate-500 mt-1">Analiza el impacto de cada webinar en la captación de leads</p>
          </div>
        </div>
        
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-bold text-slate-200 mb-2">Sin datos de eventos</h3>
            <p className="text-slate-500 mb-4">
              Aún no hay contactos importados asociados a eventos de LinkedIn.
            </p>
            <Button onClick={() => window.location.href = '/import-csv'}>
              Importar Contactos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="event-stats-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Efectividad por Evento</h1>
          <p className="text-slate-500 mt-1">Analiza el impacto de cada webinar en la captación de leads</p>
        </div>
        <Button variant="outline" onClick={loadStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Eventos con Contactos</p>
                <p className="text-3xl font-bold text-blue-900">{stats.summary.total_events_with_contacts}</p>
              </div>
              <Calendar className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Contactos</p>
                <p className="text-3xl font-bold text-green-900">{stats.summary.total_contacts_from_events}</p>
              </div>
              <Users className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Clasificados</p>
                <p className="text-3xl font-bold text-purple-900">{stats.summary.total_classified}</p>
              </div>
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Tasa Clasificación</p>
                <p className="text-3xl font-bold text-amber-900">{stats.summary.overall_classification_rate}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Detalle por Evento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.events.map((event) => (
              <div 
                key={event.event_id} 
                className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Event Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg">{event.event_name}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <Badge variant="outline" className="bg-[#0f0f0f]">
                        <Users className="w-3 h-3 mr-1" />
                        {event.total_contacts} contactos
                      </Badge>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {event.classified_contacts} clasificados
                      </Badge>
                    </div>
                  </div>

                  {/* Classification Rate */}
                  <div className="w-full lg:w-48">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-500">Tasa de clasificación</span>
                      <span className="font-semibold text-white">{event.classification_rate}%</span>
                    </div>
                    <Progress value={event.classification_rate} className="h-2" />
                  </div>

                  {/* View Button */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewContacts(event)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Ver Contactos
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {/* Top Areas */}
                {event.top_areas && event.top_areas.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-slate-500 mb-2">Distribución por Área Funcional:</p>
                    <div className="flex flex-wrap gap-2">
                      {event.top_areas.map((area, idx) => (
                        <Badge 
                          key={idx} 
                          className={`${getAreaColor(area.area)} hover:opacity-80`}
                        >
                          {area.area}: {area.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contacts Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contactos de: {selectedEvent?.event_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingContacts ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-500">Cargando contactos...</span>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Buyer Persona</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventContacts.map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {contact.firstname} {contact.lastname}
                      </TableCell>
                      <TableCell className="text-slate-300">{contact.email}</TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>{contact.jobtitle || '-'}</TableCell>
                      <TableCell>
                        {contact.buyer_persona_display_name ? (
                          <Badge className={getAreaColor(contact.classified_area)}>
                            {contact.buyer_persona_display_name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">Sin clasificar</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {eventContacts.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No hay contactos en este evento
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
