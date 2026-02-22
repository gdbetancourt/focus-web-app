/**
 * EnhancedLinkedInContactImporter - Improved LinkedIn contacts import component
 * 
 * Features:
 * - Drag & Drop file upload
 * - Auto-detection of CSV columns with manual mapping
 * - Preview before import with data validation
 * - Configurable duplicate policy (create/update/skip)
 * - Country field support
 * - Background processing with progress bar for large files
 * - Real-time status polling during import
 */
import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Eye,
  Settings,
  X,
  Download,
  ExternalLink,
  Users,
  ArrowRight,
} from "lucide-react";

// Fields that can be mapped from LinkedIn CSV
const MAPPABLE_FIELDS = [
  { key: "email", label: "Email", required: true, hint: "email, correo, e-mail" },
  { key: "firstname", label: "Nombre", required: false, hint: "first name, nombre" },
  { key: "lastname", label: "Apellido", required: false, hint: "last name, apellido" },
  { key: "company", label: "Empresa", required: false, hint: "company, empresa" },
  { key: "jobtitle", label: "Cargo", required: false, hint: "position, cargo, job title" },
  { key: "linkedin_url", label: "URL LinkedIn", required: false, hint: "url, linkedin, profile" },
  { key: "country", label: "País", required: false, hint: "country, país, location" },
  { key: "phone", label: "Teléfono", required: false, hint: "phone, teléfono, móvil" },
];

// Auto-detect column mappings based on header names
const autoDetectMapping = (headers) => {
  const mapping = {};
  const headerLower = headers.map(h => h.toLowerCase().trim());
  
  const patterns = {
    email: ['email', 'e-mail', 'correo', 'email address', 'correo electrónico'],
    firstname: ['first name', 'firstname', 'nombre', 'first'],
    lastname: ['last name', 'lastname', 'apellido', 'apellidos', 'last'],
    company: ['company', 'empresa', 'organization', 'compañía', 'company name', 'nombre de la empresa'],
    jobtitle: ['position', 'job title', 'jobtitle', 'cargo', 'title', 'puesto'],
    linkedin_url: ['url', 'linkedin url', 'profile url', 'linkedin', 'profile'],
    country: ['country', 'país', 'pais', 'location', 'region', 'país/región'],
    phone: ['phone', 'teléfono', 'telefono', 'móvil', 'movil', 'celular', 'mobile'],
  };
  
  Object.entries(patterns).forEach(([field, keywords]) => {
    const matchIndex = headerLower.findIndex(h => 
      keywords.some(k => h.includes(k))
    );
    if (matchIndex !== -1) {
      mapping[field] = headers[matchIndex];
    }
  });
  
  return mapping;
};

// Parse CSV text
const parseCSV = (text) => {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };
  
  // Detect separator
  const firstLine = lines[0];
  let separator = ',';
  if (firstLine.includes('\t')) separator = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) separator = ';';
  else if (firstLine.split(';').length > firstLine.split(',').length) separator = ';';
  
  const parseLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
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
  
  const headers = parseLine(lines[0]);
  const data = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v));
  
  return { headers, data };
};

// Duplicate policies
const DUPLICATE_POLICIES = [
  { 
    value: "UPDATE_EXISTING", 
    label: "Actualizar existentes", 
    desc: "Si el contacto existe, actualiza sus datos con la nueva información",
    icon: RefreshCw
  },
  { 
    value: "CREATE_ONLY", 
    label: "Solo crear nuevos", 
    desc: "Omite contactos que ya existen en el sistema",
    icon: Users
  },
  { 
    value: "CREATE_DUPLICATE", 
    label: "Crear siempre", 
    desc: "Crea un contacto nuevo aunque ya exista (no recomendado)",
    icon: AlertCircle
  },
];

export default function EnhancedLinkedInContactImporter({ onImportComplete }) {
  const [step, setStep] = useState(1); // 1: upload, 2: preview/config, 3: importing, 4: done
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [duplicatePolicy, setDuplicatePolicy] = useState("UPDATE_EXISTING");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);
  
  // Handle file selection - parse and show preview
  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error("Por favor selecciona un archivo CSV");
      return;
    }
    
    try {
      setFile(selectedFile);
      const text = await selectedFile.text();
      const { headers, data } = parseCSV(text);
      
      if (headers.length === 0 || data.length === 0) {
        toast.error("El archivo CSV está vacío o no es válido");
        setFile(null);
        return;
      }
      
      setCsvHeaders(headers);
      setCsvData(data);
      setColumnMapping(autoDetectMapping(headers));
      setStep(2);
      toast.success(`Archivo cargado: ${data.length.toLocaleString()} contactos encontrados`);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      toast.error("Error al leer el archivo CSV");
      setFile(null);
    }
  };
  
  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);
  
  // Poll for import job status
  const pollJobStatus = async (jobId) => {
    try {
      const res = await api.get(`/contacts/imports/${jobId}/status`);
      const job = res.data;
      
      setImportProgress({
        processed: job.results?.created + job.results?.updated + job.results?.skipped + job.results?.errors || 0,
        total: job.total_rows || 0,
        created: job.results?.created || 0,
        updated: job.results?.updated || 0,
        skipped: job.results?.skipped || 0,
        errors: job.results?.errors || 0,
        status: job.status
      });
      
      if (job.status === "completed") {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setImporting(false);
        setImportResult(job.results);
        setStep(4);
        toast.success(`Importación completada: ${job.results?.created || 0} creados, ${job.results?.updated || 0} actualizados`);
        if (onImportComplete) onImportComplete();
      } else if (job.status === "failed") {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setImporting(false);
        toast.error("Error en la importación");
      }
    } catch (error) {
      console.error("Error polling job:", error);
    }
  };
  
  // Start the import process
  const handleStartImport = async () => {
    if (!columnMapping.email) {
      toast.error("Debes mapear al menos la columna de Email");
      return;
    }
    
    setStep(3);
    setImporting(true);
    setImportProgress({ processed: 0, total: csvData.length, status: 'starting' });
    
    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await api.post("/contacts/imports/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const batchId = uploadRes.data.batch_id;
      
      // Step 2: Save mapping and config
      const mappings = Object.entries(columnMapping)
        .filter(([_, csvCol]) => csvCol)
        .map(([focusField, csvCol]) => ({
          csv_column: csvCol,
          focus_field: focusField,
          is_primary: focusField === 'email',
          separator: null
        }));
      
      await api.post(`/contacts/imports/${batchId}/map`, {
        mappings,
        config: {
          delimiter: ",",
          has_headers: true,
          default_country_code: "+52",
          multivalue_separator: ";",
          upsert_policy: duplicatePolicy,
          strict_mode: false,
          overwrite_empty: false
        }
      });
      
      // Step 3: Validate
      await api.post(`/contacts/imports/${batchId}/validate`);
      
      // Step 4: Run import
      const runRes = await api.post(`/contacts/imports/${batchId}/run`);
      
      setImportResult(runRes.data);
      setImportProgress({
        processed: runRes.data.created + runRes.data.updated + runRes.data.skipped + runRes.data.errors,
        total: csvData.length,
        created: runRes.data.created,
        updated: runRes.data.updated,
        skipped: runRes.data.skipped,
        errors: runRes.data.errors,
        status: 'completed'
      });
      setImporting(false);
      setStep(4);
      toast.success(`Importación completada: ${runRes.data.created} creados, ${runRes.data.updated} actualizados`);
      if (onImportComplete) onImportComplete();
      
    } catch (error) {
      console.error("Error importing:", error);
      const msg = error.response?.data?.detail || "Error al importar contactos";
      toast.error(msg);
      setImporting(false);
      setStep(2);
    }
  };
  
  // Reset everything
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setDuplicatePolicy("UPDATE_EXISTING");
    setImporting(false);
    setImportProgress(null);
    setImportResult(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };
  
  // Download template
  const downloadTemplate = () => {
    const template = `Email,First Name,Last Name,Company,Position,Country,Phone,LinkedIn URL
juan@ejemplo.com,Juan,Pérez García,Empresa SA de CV,Director Marketing,Mexico,+52 55 1234 5678,https://linkedin.com/in/juanperez
maria@ejemplo.com,María,García López,Otra Empresa,Gerente RRHH,Mexico,+52 55 8765 4321,https://linkedin.com/in/mariagarcia`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_contactos_linkedin.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  // Count mapped fields
  const mappedFieldsCount = Object.values(columnMapping).filter(Boolean).length;
  
  return (
    <div className="space-y-6" data-testid="linkedin-importer">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#ff3300]" />
            Importar Contactos de LinkedIn
          </h2>
          <p className="text-slate-400 mt-1">
            Sube tu archivo CSV exportado de LinkedIn para importar conexiones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="download-template-btn">
            <Download className="w-4 h-4 mr-2" />
            Plantilla CSV
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Exportar de LinkedIn
            </a>
          </Button>
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[
          { num: 1, label: "Subir CSV" },
          { num: 2, label: "Configurar" },
          { num: 3, label: "Importar" },
          { num: 4, label: "Completado" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center" data-testid={`step-${s.num}`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
              step > s.num 
                ? 'bg-green-500 text-white' 
                : step === s.num
                ? 'bg-[#ff3300] text-white'
                : 'bg-slate-700 text-slate-400'
            }`}>
              {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
            </div>
            <span className={`ml-1 text-xs hidden sm:inline ${step >= s.num ? 'text-white' : 'text-slate-500'}`}>
              {s.label}
            </span>
            {idx < 3 && <ArrowRight className="w-4 h-4 mx-2 text-slate-600" />}
          </div>
        ))}
      </div>
      
      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-6">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                dragActive 
                  ? 'border-[#ff3300] bg-[#ff3300]/5' 
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="drop-zone"
            >
              <Upload className={`w-16 h-16 mx-auto mb-4 ${dragActive ? 'text-[#ff3300]' : 'text-slate-400'}`} />
              <p className="text-lg font-medium text-white mb-2">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-sm text-slate-400 mb-4">
                o haz clic para seleccionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                data-testid="file-input"
              />
              <Badge variant="secondary" className="mt-2">
                Soporta archivos CSV hasta 50MB
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step 2: Preview & Config */}
      {step === 2 && (
        <div className="space-y-6">
          {/* File info */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/20">
                  <FileSpreadsheet className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{file?.name}</p>
                  <p className="text-sm text-slate-400">
                    {csvData.length.toLocaleString()} contactos • {csvHeaders.length} columnas detectadas
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} data-testid="change-file-btn">
                  <X className="w-4 h-4 mr-1" />
                  Cambiar archivo
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Column Mapping */}
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#ff3300]" />
                Mapeo de Columnas
              </CardTitle>
              <CardDescription>
                Asocia las columnas del CSV con los campos de contacto. {mappedFieldsCount} de {MAPPABLE_FIELDS.length} mapeados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {MAPPABLE_FIELDS.map(field => (
                  <div key={field.key} data-testid={`mapping-${field.key}`}>
                    <Label className="text-xs text-slate-400 mb-1.5 block">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </Label>
                    <Select
                      value={columnMapping[field.key] || "_none_"}
                      onValueChange={(v) => setColumnMapping(prev => ({
                        ...prev,
                        [field.key]: v === "_none_" ? "" : v
                      }))}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">-- No mapear --</SelectItem>
                        {csvHeaders.map(header => (
                          <SelectItem key={header} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">{field.hint}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Duplicate Policy */}
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-lg">Política de Duplicados</CardTitle>
              <CardDescription>
                ¿Qué hacer si un contacto ya existe en el sistema?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DUPLICATE_POLICIES.map(policy => (
                  <div
                    key={policy.value}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      duplicatePolicy === policy.value
                        ? 'border-[#ff3300] bg-[#ff3300]/10'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    onClick={() => setDuplicatePolicy(policy.value)}
                    data-testid={`policy-${policy.value}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <policy.icon className={`w-4 h-4 ${duplicatePolicy === policy.value ? 'text-[#ff3300]' : 'text-slate-400'}`} />
                      <p className="font-medium text-sm text-white">{policy.label}</p>
                    </div>
                    <p className="text-xs text-slate-400">{policy.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Preview Table */}
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Vista Previa
              </CardTitle>
              <CardDescription>
                Primeros 5 registros con el mapeo actual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 bg-slate-800/50">
                      {MAPPABLE_FIELDS.filter(f => columnMapping[f.key]).map(field => (
                        <TableHead key={field.key} className="text-slate-300 text-xs font-medium">
                          {field.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx} className="border-slate-700">
                        {MAPPABLE_FIELDS.filter(f => columnMapping[f.key]).map(field => (
                          <TableCell key={field.key} className="text-sm py-2 text-slate-300">
                            {row[columnMapping[field.key]] || <span className="text-slate-500">-</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {csvData.length > 5 && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  ...y {(csvData.length - 5).toLocaleString()} registros más
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset} data-testid="cancel-btn">
              Cancelar
            </Button>
            <Button 
              onClick={handleStartImport}
              disabled={!columnMapping.email}
              className="bg-[#ff3300] hover:bg-[#ff4400]"
              data-testid="start-import-btn"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar {csvData.length.toLocaleString()} contactos
            </Button>
          </div>
        </div>
      )}
      
      {/* Step 3: Importing */}
      {step === 3 && (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-6 text-[#ff3300] animate-spin" />
            <h3 className="text-xl font-bold text-white mb-2">Importando contactos...</h3>
            <p className="text-slate-400 mb-6">
              Por favor espera mientras procesamos {csvData.length.toLocaleString()} contactos
            </p>
            
            {importProgress && (
              <div className="max-w-md mx-auto space-y-4">
                <Progress 
                  value={importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0} 
                  className="h-2"
                />
                <div className="flex justify-between text-sm text-slate-400">
                  <span>{importProgress.processed.toLocaleString()} / {importProgress.total.toLocaleString()}</span>
                  <span>{Math.round((importProgress.processed / importProgress.total) * 100)}%</span>
                </div>
                <div className="flex justify-center gap-6 text-xs">
                  <span className="text-green-400">Creados: {importProgress.created}</span>
                  <span className="text-blue-400">Actualizados: {importProgress.updated}</span>
                  <span className="text-slate-400">Omitidos: {importProgress.skipped}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Step 4: Done */}
      {step === 4 && importResult && (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">¡Importación Completada!</h3>
            <p className="text-slate-400 mb-8">
              Los contactos han sido importados exitosamente
            </p>
            
            <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto mb-8">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-3xl font-bold text-green-400">{importResult.created}</p>
                <p className="text-xs text-slate-400">Creados</p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-3xl font-bold text-blue-400">{importResult.updated}</p>
                <p className="text-xs text-slate-400">Actualizados</p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <p className="text-3xl font-bold text-slate-400">{importResult.skipped}</p>
                <p className="text-xs text-slate-400">Omitidos</p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <p className="text-3xl font-bold text-red-400">{importResult.errors}</p>
                <p className="text-xs text-slate-400">Errores</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleReset} data-testid="import-another-btn">
                Importar otro archivo
              </Button>
              <Button onClick={() => window.location.href = '/focus/assets/contacts'} data-testid="view-contacts-btn">
                <Users className="w-4 h-4 mr-2" />
                Ver Contactos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
