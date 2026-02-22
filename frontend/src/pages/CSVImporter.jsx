import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
  DialogDescription,
} from "../components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "../components/ui/alert";
import api from "../lib/api";
import { 
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Users,
  Sparkles,
  Download,
  RefreshCw,
  Eye,
  History,
  Calendar,
  User,
  XCircle
} from "lucide-react";

export default function CSVImporter() {
  // File upload state
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Column mapping state
  const [columnMapping, setColumnMapping] = useState({
    email: "",
    firstname: "",
    lastname: "",
    company: "",
    jobtitle: "",
    phone: "",
    country: ""
  });
  
  // Processing state
  const [step, setStep] = useState(1); // 1: select event, 2: upload, 3: map columns, 4: preview, 5: processing, 6: done
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  
  // Preview dialog
  const [previewContact, setPreviewContact] = useState(null);
  
  // Import history state
  const [importHistory, setImportHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Event selection state
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Import type: "registered" or "attended"
  const [importType, setImportType] = useState("registered");

  // Required fields - matches LinkedIn Events export format
  const requiredFields = [
    { key: "email", label: "Email", required: true },
    { key: "firstname", label: "Nombre (First Name)", required: false },
    { key: "lastname", label: "Apellidos (Last Name)", required: false },
    { key: "company", label: "Nombre de la empresa (Company)", required: false },
    { key: "jobtitle", label: "Cargo (Job Title)", required: false },
    { key: "phone", label: "Teléfono (Phone)", required: false },
    { key: "country", label: "País/región (Country)", required: false }
  ];

  // Load import history
  const loadImportHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get("/hubspot/imports/history");
      setImportHistory(response.data.imports || []);
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Error al cargar historial");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load events for selection
  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const response = await api.get("/hubspot/events/stats");
      // Transform the events data to a simpler format
      const eventsData = (response.data.events || []).map(e => ({
        id: e.event_id,
        name: e.event_name,
        total_contacts: e.total_contacts
      }));
      setEvents(eventsData);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Load history and events on mount
  useEffect(() => {
    loadImportHistory();
    loadEvents();
  }, []);

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Parse CSV file - supports comma, semicolon, and tab separators
  const parseCSV = (text) => {
    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };
    
    const firstLine = lines[0];
    
    // Detect separator: tab, semicolon, or comma
    let separator = ',';
    if (firstLine.includes('\t')) {
      separator = '\t';
    } else if (firstLine.includes(';') && !firstLine.includes(',')) {
      separator = ';';
    } else if (firstLine.split(';').length > firstLine.split(',').length) {
      separator = ';';
    }
    
    // Parse a single line handling quoted values
    const parseLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === separator && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      return values;
    };
    
    const headers = parseLine(firstLine);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      // Accept rows with at least some values
      if (values.length >= 1 && values.some(v => v)) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        data.push(row);
      }
    }
    
    return { headers, data };
  };

  // Handle file upload
  const handleFileUpload = useCallback((uploadedFile) => {
    if (!uploadedFile) return;
    
    if (!uploadedFile.name.endsWith('.csv')) {
      toast.error("Por favor sube un archivo CSV");
      return;
    }
    
    setFile(uploadedFile);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, data } = parseCSV(text);
      
      if (data.length === 0) {
        toast.error("El archivo CSV está vacío o tiene formato inválido");
        return;
      }
      
      setCsvHeaders(headers);
      setCsvData(data);
      
      // Auto-detect column mapping - supports LinkedIn Events format
      const autoMapping = { ...columnMapping };
      headers.forEach(header => {
        const headerLower = header.toLowerCase().trim();
        const headerNormalized = headerLower.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
        
        // Email mapping
        if (headerLower === 'email' || headerLower === 'correo' || headerLower.includes('e-mail')) {
          autoMapping.email = header;
        } 
        // First name mapping - LinkedIn uses "Nombre"
        else if (headerLower === 'nombre' || headerLower === 'first name' || headerLower === 'firstname' || 
                 headerLower === 'first_name' || headerNormalized === 'nombre') {
          if (!autoMapping.firstname) autoMapping.firstname = header;
        } 
        // Last name mapping - LinkedIn uses "Apellidos"
        else if (headerLower === 'apellidos' || headerLower === 'apellido' || headerLower === 'last name' || 
                 headerLower === 'lastname' || headerLower === 'last_name' || headerNormalized === 'apellidos') {
          autoMapping.lastname = header;
        } 
        // Company mapping - LinkedIn uses "Nombre de la empresa"
        else if (headerLower === 'nombre de la empresa' || headerLower === 'company' || headerLower === 'empresa' || 
                 headerLower === 'organization' || headerLower === 'organización' || headerLower.includes('company') ||
                 headerNormalized === 'nombre de la empresa') {
          autoMapping.company = header;
        } 
        // Job title mapping - LinkedIn uses "Cargo"
        else if (headerLower === 'cargo' || headerLower === 'title' || headerLower === 'job title' || 
                 headerLower === 'jobtitle' || headerLower === 'job_title' || headerLower === 'puesto' ||
                 headerLower === 'position' || headerNormalized === 'cargo') {
          autoMapping.jobtitle = header;
        } 
        // Phone mapping
        else if (headerLower.includes('phone') || headerLower.includes('tel') || headerLower.includes('móvil') || 
                 headerLower.includes('celular') || headerLower === 'telefono' || headerNormalized.includes('telefono')) {
          autoMapping.phone = header;
        }
        // Country mapping - LinkedIn uses "País/región"
        else if (headerLower.includes('país') || headerLower.includes('pais') || headerLower === 'country' || 
                 headerLower.includes('region') || headerNormalized.includes('pais') || headerLower.includes('país/región')) {
          autoMapping.country = header;
        }
      });
      
      setColumnMapping(autoMapping);
      setStep(3); // Step 3 is now column mapping (after event selection)
      toast.success(`Archivo cargado: ${data.length} contactos encontrados`);
    };
    
    reader.readAsText(uploadedFile);
  }, [columnMapping]);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Map contacts from CSV
  const getMappedContacts = () => {
    return csvData.map((row, idx) => ({
      _rowIndex: idx,
      email: row[columnMapping.email] || "",
      firstname: row[columnMapping.firstname] || "",
      lastname: row[columnMapping.lastname] || "",
      company: row[columnMapping.company] || "",
      jobtitle: row[columnMapping.jobtitle] || "",
      phone: row[columnMapping.phone] || "",
      country: row[columnMapping.country] || ""
    })).filter(c => c.email); // Only contacts with email
  };

  // Process and import contacts
  const processContacts = async () => {
    const mappedContacts = getMappedContacts();
    
    if (mappedContacts.length === 0) {
      toast.error("No hay contactos válidos para importar");
      return;
    }
    
    if (!selectedEvent) {
      toast.error("Debes seleccionar un evento primero");
      return;
    }
    
    setStep(5); // Processing step
    setProcessing(true);
    setProgress(0);
    
    try {
      // Send to backend for processing - using new endpoint
      const response = await api.post("/contacts/import-csv", {
        contacts: mappedContacts,
        classify: true,
        event_id: selectedEvent?.id || null,
        event_name: selectedEvent?.name || null,
        import_type: importType // "registered" or "attended"
      });
      
      setProgress(100);
      setResults(response.data);
      setStep(6); // Done step
      toast.success(`¡Importación completada! ${response.data.imported} nuevos, ${response.data.updated} actualizados`);
      
      // Reload history after successful import
      loadImportHistory();
    } catch (error) {
      console.error("Error importing:", error);
      toast.error(error.response?.data?.detail || "Error al importar contactos");
      setStep(4); // Back to preview
    } finally {
      setProcessing(false);
    }
  };

  // Reset everything
  const resetImporter = () => {
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setSelectedEvent(null);
    setImportType("registered");
    setColumnMapping({
      email: "",
      firstname: "",
      lastname: "",
      company: "",
      jobtitle: "",
      phone: "",
      country: ""
    });
    setStep(1);
    setProgress(0);
    setResults(null);
  };

  // Download template - includes LinkedIn format example
  const downloadTemplate = () => {
    const template = `Email,Nombre,Apellidos,Cargo,Nombre de la empresa,País/región
juan@ejemplo.com,Juan,Pérez García,Director Marketing,Empresa SA de CV,Mexico
maria@ejemplo.com,María,García López,Gerente RRHH,Otra Empresa,Mexico
carlos@ejemplo.com,Carlos,Rodríguez,CEO,Startup Inc,Argentina`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_contactos_linkedin.csv';
    a.click();
  };

  const mappedContacts = step >= 4 ? getMappedContacts() : [];

  return (
    <div className="space-y-6" data-testid="csv-importer">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Importar Contactos</h1>
          <p className="text-slate-500 mt-1">Sube un CSV de LinkedIn Events para clasificar contactos automáticamente</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" />
          Descargar Plantilla
        </Button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {[
          { num: 1, label: "Seleccionar Evento" },
          { num: 2, label: "Subir CSV" },
          { num: 3, label: "Mapear Columnas" },
          { num: 4, label: "Previsualizar" },
          { num: 5, label: "Procesar" },
          { num: 6, label: "Completado" }
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
              step >= s.num 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'bg-[#111111] border-[#333333] text-slate-400'
            }`}>
              {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
            </div>
            <span className={`ml-2 text-sm hidden sm:inline ${step >= s.num ? 'text-white font-medium' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {idx < 5 && <ArrowRight className="w-4 h-4 mx-2 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Event */}
      {step === 1 && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Seleccionar Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-white mb-2 block">Evento *</Label>
              <Select value={selectedEvent?.id || ""} onValueChange={(value) => {
                const event = events.find(e => e.id === value);
                setSelectedEvent(event);
              }}>
                <SelectTrigger className="bg-[#1a1a1a] border-[#333] text-white">
                  <SelectValue placeholder="Selecciona un evento" />
                </SelectTrigger>
                <SelectContent>
                  {loadingEvents ? (
                    <SelectItem value="loading" disabled>Cargando eventos...</SelectItem>
                  ) : events.length === 0 ? (
                    <SelectItem value="empty" disabled>No hay eventos disponibles</SelectItem>
                  ) : (
                    events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white mb-2 block">Tipo de Lista *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    importType === "registered" 
                      ? "border-blue-500 bg-blue-500/10" 
                      : "border-[#333] hover:border-[#444]"
                  }`}
                  onClick={() => setImportType("registered")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-blue-400" />
                    <span className="font-medium text-white">Registrados</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Personas que se registraron al evento
                  </p>
                </div>
                <div 
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    importType === "attended" 
                      ? "border-green-500 bg-green-500/10" 
                      : "border-[#333] hover:border-[#444]"
                  }`}
                  onClick={() => setImportType("attended")}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="font-medium text-white">Asistentes</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Personas que asistieron al evento
                  </p>
                </div>
              </div>
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <strong>Importante:</strong> Si un contacto ya existe, se actualizará su participación en eventos. 
                Si importas primero "Registrados" y luego "Asistentes", se marcará tanto el registro como la asistencia.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={() => setStep(2)} 
              disabled={!selectedEvent}
              className="w-full"
            >
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload */}
      {step === 2 && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Subir Archivo CSV
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{selectedEvent?.name}</Badge>
              <Badge className={importType === "attended" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}>
                {importType === "attended" ? "Asistentes" : "Registrados"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-[#333333] hover:border-blue-400 hover:bg-[#0f0f0f]'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-medium text-slate-200 mb-2">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-sm text-slate-500 mb-4">
                o haz clic para seleccionar
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e.target.files[0])}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Seleccionar Archivo
                </label>
              </Button>
            </div>
            
            <Alert className="mt-4 border-blue-200 bg-blue-50">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Formatos soportados:</strong> LinkedIn Events (lead_id, Email, Nombre, Apellidos, Cargo, País/región), 
                HubSpot exports, y cualquier CSV con columna de Email.
              </AlertDescription>
            </Alert>

            <Button 
              variant="outline" 
              onClick={() => setStep(1)} 
              className="mt-4"
            >
              Volver a selección de evento
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Map Columns */}
      {step === 3 && (
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Mapear Columnas</CardTitle>
            <p className="text-sm text-slate-500">
              Asocia las columnas del CSV con los campos de contacto
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{selectedEvent?.name}</Badge>
              <Badge className={importType === "attended" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}>
                {importType === "attended" ? "Asistentes" : "Registrados"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiredFields.map(field => (
                <div key={field.key} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {field.label}
                    {field.required && <Badge variant="destructive" className="text-xs">Requerido</Badge>}
                  </Label>
                  <Select 
                    value={columnMapping[field.key] || "_none_"} 
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [field.key]: v === "_none_" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">-- No mapear --</SelectItem>
                      {csvHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={resetImporter}>
                Cancelar
              </Button>
              <Button 
                onClick={() => setStep(4)}
                disabled={!columnMapping.email}
              >
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Previsualizar Contactos
              </CardTitle>
              <Badge variant="secondary" className="text-lg">
                {mappedContacts.length} contactos
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{selectedEvent?.name}</Badge>
              <Badge className={importType === "attended" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}>
                {importType === "attended" ? "Asistentes" : "Registrados"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>País</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedContacts.slice(0, 10).map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{contact.email}</TableCell>
                      <TableCell>{contact.firstname} {contact.lastname}</TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>{contact.jobtitle || '-'}</TableCell>
                      <TableCell>{contact.country || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {mappedContacts.length > 10 && (
              <p className="text-sm text-slate-500 mt-2 text-center">
                Mostrando 10 de {mappedContacts.length} contactos
              </p>
            )}
            
            <Alert className="mt-4 border-purple-200 bg-purple-50">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <AlertDescription className="text-purple-700">
                Al importar, la IA clasificará automáticamente cada contacto en su Buyer Persona 
                correspondiente basándose en su cargo y empresa.
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>
                Volver
              </Button>
              <Button onClick={processContacts} className="btn-accent">
                <Sparkles className="w-4 h-4 mr-2" />
                Importar y Clasificar con IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Processing */}
      {step === 5 && (
        <Card className="max-w-xl mx-auto">
          <CardContent className="p-12 text-center">
            <RefreshCw className="w-16 h-16 mx-auto mb-6 text-blue-500 animate-spin" />
            <h3 className="text-xl font-bold mb-2">Procesando contactos...</h3>
            <p className="text-slate-500 mb-6">
              Importando y clasificando con IA. Esto puede tomar unos momentos.
            </p>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-400 mt-2">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Done */}
      {step === 6 && results && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold mb-2">¡Importación Completada!</h3>
            <p className="text-slate-500 mb-6">
              Los contactos han sido importados al evento: <strong>{selectedEvent?.name}</strong>
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-[#0f0f0f] rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{results.imported}</p>
                <p className="text-sm text-slate-500">Nuevos</p>
              </div>
              <div className="p-4 bg-[#0f0f0f] rounded-lg">
                <p className="text-3xl font-bold text-green-600">{results.updated || 0}</p>
                <p className="text-sm text-slate-500">Actualizados</p>
              </div>
              <div className="p-4 bg-[#0f0f0f] rounded-lg">
                <p className="text-3xl font-bold text-amber-600">{results.skipped || 0}</p>
                <p className="text-sm text-slate-500">Omitidos</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={resetImporter}>
                Importar Otro Archivo
              </Button>
              <Button onClick={() => window.location.href = '/contacts'}>
                <Users className="w-4 h-4 mr-2" />
                Ver Contactos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import History Section */}
      <Card className="mt-8" data-testid="import-history-section">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historial de Importaciones
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadImportHistory}
              disabled={loadingHistory}
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Cargando historial...
            </div>
          ) : importHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay importaciones previas</p>
              <p className="text-sm">Las importaciones aparecerán aquí</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Importados</TableHead>
                    <TableHead className="text-center">Clasificados</TableHead>
                    <TableHead className="text-center">Duplicados</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {formatDate(item.imported_at)}
                          </div>
                          <span className="text-xs text-slate-400 ml-6">{item.imported_by}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.event_name ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {item.event_name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.total_rows}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-blue-600 font-medium">{item.imported}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{item.classified}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-600 font-medium">{item.duplicates}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completado
                          </Badge>
                        ) : item.status === 'completed_with_errors' ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Con errores
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{item.status}</Badge>
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
    </div>
  );
}
