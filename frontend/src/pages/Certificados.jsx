import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import { toast } from "sonner";
import api from "../lib/api";
import { 
  Award,
  Plus,
  Search,
  Download,
  RefreshCw,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  GraduationCap,
  Building2,
  Mail,
  Send
} from "lucide-react";

export default function Certificados() {
  const [programs, setPrograms] = useState([]);
  const [levels, setLevels] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [stage4Contacts, setStage4Contacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCert, setShowNewCert] = useState(false);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Form state
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contact, setContact] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [hours, setHours] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [programsRes, levelsRes, certsRes, contactsRes] = await Promise.all([
        api.get("/certificados/catalog/programs"),
        api.get("/certificados/catalog/levels"),
        api.get("/certificados/list"),
        api.get("/certificados/contacts-stage-4")
      ]);
      setPrograms(programsRes.data.programs || []);
      setLevels(levelsRes.data.levels || []);
      setCertificates(certsRes.data.certificates || []);
      setStage4Contacts(contactsRes.data.contacts || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contactId) => {
    setSelectedContactId(contactId);
    const selected = stage4Contacts.find(c => c.id === contactId);
    if (selected) {
      setContact(selected);
    } else {
      setContact(null);
    }
  };

  const generateCertificate = async () => {
    if (!contact) {
      toast.error("Busca un contacto primero");
      return;
    }
    if (!selectedProgram) {
      toast.error("Selecciona un programa");
      return;
    }
    if (!selectedLevel) {
      toast.error("Selecciona un nivel");
      return;
    }
    if (!hours || parseInt(hours) <= 0) {
      toast.error("Ingresa las horas del programa");
      return;
    }
    
    setGenerating(true);
    try {
      const res = await api.post("/certificados/generate", {
        email: contact.email,
        program_id: selectedProgram,
        level: selectedLevel,
        hours: parseInt(hours)
      });
      
      toast.success(`Certificado ${res.data.certificate_number} generado`);
      setShowNewCert(false);
      resetForm();
      loadData();
      
      // Automatically download PDF
      downloadPdf(res.data.id, res.data.certificate_number);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error generando certificado");
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setSelectedContactId("");
    setContact(null);
    setSelectedProgram("");
    setSelectedLevel("");
    setHours("");
  };

  const downloadPdf = async (certId, certNumber) => {
    try {
      const response = await api.get(`/certificados/${certId}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Certificado_${certNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF descargado");
    } catch (error) {
      toast.error("Error descargando PDF");
    }
  };

  const deleteCertificate = async (certId) => {
    if (!window.confirm("¿Estás seguro de eliminar este certificado?")) return;
    
    try {
      await api.delete(`/certificados/${certId}`);
      toast.success("Certificado eliminado");
      loadData();
    } catch (error) {
      toast.error("Error eliminando certificado");
    }
  };

  const sendCertificateEmail = async (certId, email) => {
    try {
      toast.info(`Enviando certificado a ${email}...`);
      await api.post(`/certificados/${certId}/send-email`);
      toast.success(`Certificado enviado a ${email}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error enviando certificado por email");
    }
  };

  const getLevelBadge = (level) => {
    const styles = {
      commitment: "bg-blue-100 text-blue-700",
      mastery: "bg-purple-100 text-purple-700",
      performance: "bg-amber-100 text-amber-700",
      results: "bg-green-100 text-green-700"
    };
    const labels = {
      commitment: "Commitment",
      mastery: "Mastery",
      performance: "Performance",
      results: "Results"
    };
    return <Badge className={styles[level] || "bg-[#151515]"}>{labels[level] || level}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="certificados-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="certificados-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Generador de Certificados</h1>
          <p className="text-slate-500 mt-1">Emite certificados para los participantes de tus programas</p>
        </div>
        <Button onClick={() => setShowNewCert(true)} data-testid="new-certificate-btn">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Certificado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{certificates.length}</p>
            <p className="text-xs text-slate-500">Total Emitidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {certificates.filter(c => c.level === 'commitment').length}
            </p>
            <p className="text-xs text-slate-500">Commitment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {certificates.filter(c => c.level === 'mastery').length}
            </p>
            <p className="text-xs text-slate-500">Mastery</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {certificates.filter(c => c.level === 'results').length}
            </p>
            <p className="text-xs text-slate-500">Results</p>
          </CardContent>
        </Card>
      </div>

      {/* Certificates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Certificados Emitidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Award className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No hay certificados emitidos</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowNewCert(true)}>
                Emitir primer certificado
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead>Programa</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-mono font-medium text-sm">
                        {cert.certificate_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cert.contact_name}</p>
                          <p className="text-xs text-slate-500">{cert.contact_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate" title={cert.program_name}>
                          {cert.program_name}
                        </p>
                      </TableCell>
                      <TableCell>{getLevelBadge(cert.level)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{cert.hours}h</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {cert.issue_date}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => sendCertificateEmail(cert.id, cert.contact_email)}
                            title="Enviar por email"
                            className={cert.email_sent ? "text-green-600" : "text-blue-600"}
                            data-testid={`send-cert-${cert.id}`}
                          >
                            {cert.email_sent ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => downloadPdf(cert.id, cert.certificate_number)}
                            title="Descargar PDF"
                            data-testid={`download-cert-${cert.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteCertificate(cert.id)}
                            className="text-red-600 hover:text-red-700"
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

      {/* New Certificate Dialog */}
      <Dialog open={showNewCert} onOpenChange={setShowNewCert}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Generar Nuevo Certificado
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Contact Selection - Dropdown */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">1. Seleccionar Participante (Step 4)</Label>
              
              {stage4Contacts.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    No hay contactos en Step 4. Mueve contactos al Step 4 para poder certificarlos.
                  </p>
                </div>
              ) : (
                <Select value={selectedContactId} onValueChange={handleContactSelect}>
                  <SelectTrigger data-testid="contact-select">
                    <SelectValue placeholder="Seleccionar contacto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stage4Contacts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} - {c.email} {c.company && `(${c.company})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Contact Selected */}
              {contact && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-800">Contacto seleccionado</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4" />
                          <span>{contact.name || `${contact.firstname} ${contact.lastname}`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="w-4 h-4" />
                          <span>{contact.company || "Sin empresa"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 col-span-2">
                          <Mail className="w-4 h-4" />
                          <span>{contact.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Program Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">2. Nombre del Programa</Label>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger data-testid="program-select">
                  <SelectValue placeholder="Selecciona un programa" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(program => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">3. Nivel</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger data-testid="level-select">
                  <SelectValue placeholder="Selecciona un nivel" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map(level => (
                    <SelectItem key={level.id} value={level.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{level.name}</span>
                        <span className="text-xs text-slate-500">- {level.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hours */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                4. Horas del Programa
              </Label>
              <Input 
                type="number"
                placeholder="Ej: 20"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min="1"
                data-testid="hours-input"
              />
            </div>

            {/* Preview */}
            {contact && selectedProgram && selectedLevel && hours && (
              <div className="p-4 bg-[#0f0f0f] border rounded-lg">
                <p className="text-sm font-medium text-slate-200 mb-2">Vista previa:</p>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500">Participante:</span> {contact.firstname} {contact.lastname}</p>
                  <p><span className="text-slate-500">Programa:</span> {programs.find(p => p.id === selectedProgram)?.name}</p>
                  <p><span className="text-slate-500">Nivel:</span> {levels.find(l => l.id === selectedLevel)?.name}</p>
                  <p><span className="text-slate-500">Duración:</span> {hours} horas</p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewCert(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={generateCertificate} 
              disabled={generating || !contact || !selectedProgram || !selectedLevel || !hours}
              data-testid="generate-btn"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Award className="w-4 h-4 mr-2" />
              )}
              Generar Certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
