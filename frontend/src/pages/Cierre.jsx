import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import api from "../lib/api";
import ContactSheet from "../components/ContactSheet";
import { 
  Handshake,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  Calendar,
  ArrowRight,
  Filter,
  Pencil
} from "lucide-react";

export default function Cierre() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    nuevo: 0,
    en_proceso: 0,
    propuesta_enviada: 0,
    ganado: 0,
    perdido: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContact, setSelectedContact] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Edit contact state
  const [editSheetContact, setEditSheetContact] = useState(null);
  const [showEditSheet, setShowEditSheet] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const response = await api.get("/hubspot/cierre/contacts");
      setContacts(response.data.contacts || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error("Error loading cierre contacts:", error);
      toast.error("Error cargando contactos de Cierre");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (contactId, newStatus) => {
    setUpdatingStatus(true);
    try {
      await api.put(`/hubspot/cierre/contact/${contactId}/status`, { status: newStatus });
      toast.success(`Status actualizado a "${getStatusLabel(newStatus)}"`);
      loadContacts();
      setSelectedContact(null);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error actualizando status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      nuevo: "Nuevo",
      en_proceso: "En Proceso",
      propuesta_enviada: "Propuesta Enviada",
      ganado: "Ganado",
      perdido: "Perdido"
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const styles = {
      nuevo: "bg-blue-100 text-blue-700",
      en_proceso: "bg-amber-100 text-amber-700",
      propuesta_enviada: "bg-purple-100 text-purple-700",
      ganado: "bg-green-100 text-green-700",
      perdido: "bg-red-100 text-red-700"
    };
    return (
      <Badge className={`${styles[status] || "bg-[#151515]"} hover:opacity-80`}>
        {getStatusLabel(status)}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric'
    });
  };

  const filteredContacts = statusFilter === "all" 
    ? contacts 
    : contacts.filter(c => c.cierre_status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500">Cargando contactos de Cierre...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cierre-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Cierre</h1>
          <p className="text-slate-500 mt-1">Prospectos que solicitaron propuesta</p>
        </div>
        <Button onClick={loadContacts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-[#222222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Nuevos</p>
                <p className="text-2xl font-bold text-blue-900">{stats.nuevo}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">En Proceso</p>
                <p className="text-2xl font-bold text-amber-900">{stats.en_proceso}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Propuesta</p>
                <p className="text-2xl font-bold text-purple-900">{stats.propuesta_enviada}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Ganados</p>
                <p className="text-2xl font-bold text-green-900">{stats.ganado}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Perdidos</p>
                <p className="text-2xl font-bold text-red-900">{stats.perdido}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Handshake className="w-5 h-5" />
              Prospectos en Cierre
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="nuevo">Nuevos</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="propuesta_enviada">Propuesta Enviada</SelectItem>
                  <SelectItem value="ganado">Ganados</SelectItem>
                  <SelectItem value="perdido">Perdidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Handshake className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No hay prospectos en Cierre</h3>
              <p className="text-sm">Los contactos aparecerán aquí cuando los muevas desde Nurturing</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead>Fecha Movimiento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contact.firstname} {contact.lastname}</p>
                          <p className="text-sm text-slate-500">{contact.email}</p>
                          {contact.jobtitle && (
                            <p className="text-xs text-slate-400">{contact.jobtitle}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{contact.company || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{contact.cierre_reason || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Calendar className="w-4 h-4" />
                          {formatDate(contact.moved_to_cierre_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(contact.cierre_status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditSheetContact(contact);
                              setShowEditSheet(true);
                            }}
                            className="text-orange-600 hover:text-orange-700"
                            title="Editar contacto"
                            data-testid={`edit-contact-${contact.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedContact(contact)}
                          >
                            Cambiar Status
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

      {/* Status Update Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Status</DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-4">
              <div className="p-4 bg-[#0f0f0f] rounded-lg">
                <p className="font-medium">{selectedContact.firstname} {selectedContact.lastname}</p>
                <p className="text-sm text-slate-500">{selectedContact.company}</p>
                <p className="text-sm text-slate-500">{selectedContact.email}</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Seleccionar nuevo status:</p>
                <div className="grid grid-cols-2 gap-2">
                  {["nuevo", "en_proceso", "propuesta_enviada", "ganado", "perdido"].map((status) => (
                    <Button
                      key={status}
                      variant={selectedContact.cierre_status === status ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => updateStatus(selectedContact.id, status)}
                      disabled={updatingStatus || selectedContact.cierre_status === status}
                    >
                      {status === "nuevo" && <Clock className="w-4 h-4 mr-2" />}
                      {status === "en_proceso" && <TrendingUp className="w-4 h-4 mr-2" />}
                      {status === "propuesta_enviada" && <FileText className="w-4 h-4 mr-2" />}
                      {status === "ganado" && <CheckCircle className="w-4 h-4 mr-2" />}
                      {status === "perdido" && <XCircle className="w-4 h-4 mr-2" />}
                      {getStatusLabel(status)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedContact(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Sheet for full editing */}
      {editSheetContact && (
        <ContactSheet
          contact={editSheetContact}
          isOpen={showEditSheet}
          onClose={() => {
            setShowEditSheet(false);
            setEditSheetContact(null);
          }}
          onSave={(updatedContact) => {
            setContacts(prev => prev.map(c => 
              c.id === updatedContact.id ? { ...c, ...updatedContact } : c
            ));
            setShowEditSheet(false);
            setEditSheetContact(null);
            toast.success("Contacto actualizado");
          }}
        />
      )}
    </div>
  );
}
