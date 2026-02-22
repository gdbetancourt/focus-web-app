import { useState, useEffect, useCallback } from "react";
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, AlertCircle,
  Loader2, Download, ChevronDown, Settings2, Eye, CheckCircle, XCircle, AlertTriangle, Link2, User, UserCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { toast } from "sonner";
import api from "../../lib/api";

const FOCUS_FIELDS = [
  { value: "ignore", label: "— Ignore —" },
  { value: "salutation", label: "Salutation (Tratamiento)" },
  { value: "first_name", label: "First Name (Nombre)" },
  { value: "last_name", label: "Last Name (Apellido)" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "linkedin_url", label: "LinkedIn URL" },
  { value: "company", label: "Company" },
  { value: "job_title", label: "Job Title (Cargo)" },
  { value: "buyer_persona", label: "Buyer Persona" },
  { value: "roles", label: "Roles (comma separated)" },
  { value: "specialty", label: "Specialty" },
  { value: "stage", label: "Stage (1-5)" },
  { value: "location", label: "Location" },
  { value: "country", label: "Country" },
  { value: "notes", label: "Notes" },
];

const UPSERT_POLICIES = [
  { value: "UPDATE_EXISTING", label: "Update existing contacts (recommended)" },
  { value: "CREATE_ONLY", label: "Create only - Skip existing" },
  { value: "CREATE_DUPLICATE", label: "Create duplicates (not recommended)" },
];

const COUNTRY_CODES = [
  { value: "+52", label: "+52 México" },
  { value: "+1", label: "+1 USA/Canada" },
  { value: "+34", label: "+34 España" },
  { value: "+57", label: "+57 Colombia" },
  { value: "+54", label: "+54 Argentina" },
];

export default function ImportWizard({ open, onOpenChange, onImportComplete, eventId = null, eventName = null, eventDate = null }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Import mode: 'csv' or 'hubspot'
  const [importMode, setImportMode] = useState('csv');
  
  // HubSpot import
  const [hubspotUrl, setHubspotUrl] = useState('');
  const [hubspotResult, setHubspotResult] = useState(null);
  const [hubspotProgress, setHubspotProgress] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // Step 1: Upload
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Step 2: Mapping
  const [mappings, setMappings] = useState([]);
  const [config, setConfig] = useState({
    delimiter: ",",
    has_headers: true,
    default_country_code: "+52",
    multivalue_separator: ";",
    upsert_policy: "UPDATE_EXISTING",
    strict_mode: false,
    overwrite_empty: false,
  });
  
  // Calendar invite option (only for event imports)
  const [sendCalendarInvite, setSendCalendarInvite] = useState(true);
  const [calendarDescription, setCalendarDescription] = useState("");
  const [calendarLocation, setCalendarLocation] = useState("");
  
  // Import type: "registered" or "attended" (only for event imports)
  const [importType, setImportType] = useState("attended");
  
  // Calculate if event is in the future
  const isEventFuture = eventDate ? new Date(eventDate) >= new Date(new Date().toDateString()) : false;
  
  // Set default based on event date when eventId changes
  useEffect(() => {
    if (eventId && eventDate) {
      setSendCalendarInvite(isEventFuture);
    }
  }, [eventId, eventDate, isEventFuture]);
  
  // Step 3-4: Validation
  const [validationResult, setValidationResult] = useState(null);
  
  // Step 5: Import result
  const [importResult, setImportResult] = useState(null);

  const resetWizard = () => {
    setStep(1);
    setImportMode('csv');
    setHubspotUrl('');
    setHubspotResult(null);
    setHubspotProgress(null);
    setIsPolling(false);
    setFile(null);
    setUploadResult(null);
    setMappings([]);
    setConfig({
      delimiter: ",",
      has_headers: true,
      default_country_code: "+52",
      multivalue_separator: ";",
      upsert_policy: "UPDATE_EXISTING",
      strict_mode: false,
      overwrite_empty: false,
    });
    setValidationResult(null);
    setImportResult(null);
    // Reset calendar invite based on event date
    if (eventId && eventDate) {
      setSendCalendarInvite(new Date(eventDate) >= new Date(new Date().toDateString()));
    } else {
      setSendCalendarInvite(true);
    }
    setCalendarDescription("");
    setCalendarLocation("");
    setImportType("attended");
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  // HubSpot Import with progress polling
  const pollProgress = useCallback(async () => {
    if (!eventId) return;
    
    try {
      const response = await api.get(`/events-v2/${eventId}/import-hubspot/progress`);
      const progress = response.data;
      setHubspotProgress(progress);
      
      if (progress.status === 'complete') {
        setIsPolling(false);
        setHubspotResult({
          success: true,
          message: `Importación completada: ${progress.created} creados, ${progress.updated} actualizados`,
          created: progress.created,
          updated: progress.updated,
          total: progress.total,
          errors: progress.errors
        });
        setStep(5);
        setLoading(false);
        toast.success(`Importación completada: ${progress.created} nuevos, ${progress.updated} actualizados`);
        if (onImportComplete) onImportComplete();
      } else if (progress.status === 'error') {
        setIsPolling(false);
        setHubspotResult({
          success: false,
          message: progress.error || 'Error en importación',
          error: progress.error
        });
        setStep(5);
        setLoading(false);
        toast.error(progress.error || 'Error en importación');
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, [eventId, onImportComplete]);

  // Polling effect
  useEffect(() => {
    let interval;
    if (isPolling) {
      interval = setInterval(pollProgress, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, pollProgress]);

  const handleHubspotImport = async () => {
    if (!hubspotUrl || !eventId) return;
    
    setLoading(true);
    setHubspotProgress({ status: 'starting', phase: 'Iniciando...', percent: 0 });
    
    try {
      const response = await api.post(`/events-v2/${eventId}/import-hubspot`, {
        hubspot_list_url: hubspotUrl,
        import_type: importType  // "registered" or "attended"
      });
      
      if (response.data.status === 'started' || response.data.status === 'in_progress') {
        // Start polling for progress
        setIsPolling(true);
        toast.info('Importación iniciada, por favor espera...');
      } else if (response.data.success) {
        setHubspotResult(response.data);
        setStep(5);
        setLoading(false);
        toast.success(response.data.message);
        if (onImportComplete) onImportComplete();
      }
    } catch (error) {
      setLoading(false);
      setHubspotProgress(null);
      toast.error(error.response?.data?.detail || "Error importing from HubSpot");
    }
  };

  // Step 1: Upload file
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await api.post("/contacts/imports/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      setUploadResult(response.data);
      
      // Initialize mappings from suggestions
      const initialMappings = response.data.suggested_mappings.map(s => ({
        csv_column: s.csv_column,
        focus_field: s.suggested_field || "ignore",
        is_primary: s.is_primary || false,
        separator: null
      }));
      setMappings(initialMappings);
      
      setConfig(prev => ({
        ...prev,
        delimiter: response.data.detected_delimiter
      }));
      
      setStep(2);
      toast.success(`Uploaded ${response.data.total_rows} rows`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error uploading file");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save mapping
  const updateMapping = (index, field, value) => {
    setMappings(prev => prev.map((m, i) => 
      i === index ? { ...m, [field]: value } : m
    ));
  };

  const handleSaveMapping = async () => {
    if (!uploadResult?.batch_id) return;
    
    setLoading(true);
    try {
      await api.post(`/contacts/imports/${uploadResult.batch_id}/map`, {
        mappings: mappings.filter(m => m.focus_field !== "ignore"),
        config
      });
      
      setStep(3);
      // Auto-run validation
      await handleValidate();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error saving mapping");
      setLoading(false);
    }
  };

  // Step 3-4: Validate
  const handleValidate = async () => {
    if (!uploadResult?.batch_id) return;
    
    setLoading(true);
    try {
      const response = await api.post(`/contacts/imports/${uploadResult.batch_id}/validate`);
      setValidationResult(response.data);
      setStep(4);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error validating");
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Run import
  const handleRunImport = async () => {
    if (!uploadResult?.batch_id) return;
    
    setLoading(true);
    try {
      // Pass eventId and calendar invite options if importing for an event
      let params = eventId ? `?event_id=${eventId}` : '';
      if (eventId) {
        params += `&send_calendar_invite=${sendCalendarInvite}`;
        if (sendCalendarInvite) {
          // Pass calendar description and location as URL encoded params
          if (calendarDescription) {
            params += `&calendar_description=${encodeURIComponent(calendarDescription)}`;
          }
          if (calendarLocation) {
            params += `&calendar_location=${encodeURIComponent(calendarLocation)}`;
          }
        }
      }
      const response = await api.post(`/contacts/imports/${uploadResult.batch_id}/run${params}`);
      setImportResult(response.data);
      setStep(5);
      
      const calendarMsg = sendCalendarInvite && response.data.calendar_events_created 
        ? ` (${response.data.calendar_events_created} invitaciones enviadas)`
        : '';
      const msg = eventId 
        ? `Importado para evento! Creados: ${response.data.created}, Actualizados: ${response.data.updated}${calendarMsg}`
        : `Import completed! Created: ${response.data.created}, Updated: ${response.data.updated}`;
      toast.success(msg);
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error running import");
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    const eventLabel = eventName ? ` - ${eventName}` : '';
    switch (step) {
      case 1: return `Upload CSV File${eventLabel}`;
      case 2: return `Map Columns${eventLabel}`;
      case 3: return `Configure Options${eventLabel}`;
      case 4: return `Review & Validate${eventLabel}`;
      case 5: return "Import Complete";
      default: return "Import Contacts";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#ff3300]" />
            {getStepTitle()}
          </DialogTitle>
          <DialogDescription>
            Step {step} of 5 — Import contacts from CSV file
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator - only show for CSV mode */}
        {importMode === 'csv' && (
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-[#ff3300] text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 5 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-500' : 'bg-slate-700'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="py-4">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Import Mode Tabs - Only show HubSpot option when eventId exists */}
              {eventId && (
                <div className="flex gap-2 p-1 bg-slate-800 rounded-lg w-fit">
                  <button
                    onClick={() => setImportMode('csv')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                      ${importMode === 'csv' ? 'bg-[#ff3300] text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV File
                  </button>
                  <button
                    onClick={() => setImportMode('hubspot')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2
                      ${importMode === 'hubspot' ? 'bg-[#ff3300] text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Link2 className="w-4 h-4" />
                    HubSpot URL
                  </button>
                </div>
              )}

              {/* Import Type Selection: Registered vs Attended */}
              {eventId && (
                <div className="space-y-3">
                  <Label className="text-slate-300">Tipo de importación</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        importType === "registered" 
                          ? "border-blue-500 bg-blue-500/10" 
                          : "border-slate-700 hover:border-slate-500"
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
                          : "border-slate-700 hover:border-slate-500"
                      }`}
                      onClick={() => setImportType("attended")}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-5 h-5 text-green-400" />
                        <span className="font-medium text-white">Asistentes</span>
                      </div>
                      <p className="text-sm text-slate-400">
                        Personas que asistieron al evento
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Si importas primero "Registrados" y luego "Asistentes", se marcará tanto el registro como la asistencia.
                  </p>
                </div>
              )}

              {/* CSV Upload Mode */}
              {importMode === 'csv' && (
                <>
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-[#ff3300] transition-colors">
                    <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-white mb-2">Drag and drop your CSV file here, or click to browse</p>
                    <p className="text-sm text-slate-400 mb-4">Supports CSV files with UTF-8 encoding</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload">
                      <Button variant="outline" asChild>
                        <span>Choose File</span>
                      </Button>
                    </label>
                  </div>

                  {file && (
                    <Card className="bg-slate-800">
                      <CardContent className="p-4 flex items-center gap-4">
                        <FileSpreadsheet className="w-10 h-10 text-green-400" />
                        <div className="flex-1">
                          <p className="font-medium text-white">{file.name}</p>
                          <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <Button onClick={() => setFile(null)} variant="ghost" size="sm">
                          <X className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* HubSpot URL Mode */}
              {importMode === 'hubspot' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 hover:border-[#ff3300] transition-colors">
                    <Link2 className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                    <p className="text-white mb-2 text-center">Import contacts from a HubSpot list</p>
                    <p className="text-sm text-slate-400 mb-4 text-center">
                      Paste the URL of your HubSpot contact list
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="hubspot-url" className="text-slate-300">HubSpot List URL</Label>
                      <Input
                        id="hubspot-url"
                        type="url"
                        value={hubspotUrl}
                        onChange={(e) => setHubspotUrl(e.target.value)}
                        placeholder="https://app.hubspot.com/contacts/.../objectLists/..."
                        className="bg-slate-900 border-slate-700"
                      />
                      <p className="text-xs text-slate-500">
                        Example: https://app.hubspot.com/contacts/20165345/objectLists/3761/filters
                      </p>
                    </div>
                  </div>

                  {hubspotUrl && !hubspotProgress && (
                    <Card className="bg-slate-800 border-orange-500/30">
                      <CardContent className="p-4 flex items-center gap-4">
                        <Link2 className="w-10 h-10 text-orange-400" />
                        <div className="flex-1">
                          <p className="font-medium text-white">HubSpot List URL</p>
                          <p className="text-sm text-slate-400 truncate">{hubspotUrl}</p>
                        </div>
                        <Button onClick={() => setHubspotUrl('')} variant="ghost" size="sm">
                          <X className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Progress Bar */}
                  {hubspotProgress && hubspotProgress.status !== 'not_started' && (
                    <Card className="bg-slate-800 border-orange-500/50">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {hubspotProgress.status === 'complete' ? (
                                <CheckCircle className="w-6 h-6 text-green-400" />
                              ) : hubspotProgress.status === 'error' ? (
                                <XCircle className="w-6 h-6 text-red-400" />
                              ) : (
                                <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                              )}
                              <div>
                                <p className="font-medium text-white">{hubspotProgress.phase}</p>
                                {hubspotProgress.total > 0 && (
                                  <p className="text-sm text-slate-400">
                                    {hubspotProgress.processed || 0} de {hubspotProgress.total} contactos
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-2xl font-bold text-orange-400">
                              {hubspotProgress.percent || 0}%
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300 ease-out"
                              style={{ width: `${hubspotProgress.percent || 0}%` }}
                            />
                          </div>
                          
                          {/* Stats during import */}
                          {hubspotProgress.status === 'importing' && (
                            <div className="grid grid-cols-3 gap-4 pt-2">
                              <div className="text-center">
                                <p className="text-xl font-bold text-green-400">{hubspotProgress.created || 0}</p>
                                <p className="text-xs text-slate-400">Creados</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-blue-400">{hubspotProgress.updated || 0}</p>
                                <p className="text-xs text-slate-400">Actualizados</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold text-red-400">{hubspotProgress.errors || 0}</p>
                                <p className="text-xs text-slate-400">Errores</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 2 && uploadResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
                <span>Detected {uploadResult.headers.length} columns, {uploadResult.total_rows} rows</span>
                <span>Delimiter: <code className="bg-slate-700 px-1 rounded">{uploadResult.detected_delimiter === ',' ? 'comma' : uploadResult.detected_delimiter === ';' ? 'semicolon' : 'tab'}</code></span>
              </div>

              <div className="bg-slate-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-900 text-sm font-medium text-slate-300">
                  <div>CSV Column</div>
                  <div>Map to Field</div>
                  <div>Primary?</div>
                  <div>Separator</div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {mappings.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 p-3 border-b border-slate-700 items-center">
                      <div className="text-white font-medium truncate" title={mapping.csv_column}>
                        {mapping.csv_column}
                      </div>
                      <Select
                        value={mapping.focus_field}
                        onValueChange={(v) => updateMapping(index, "focus_field", v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOCUS_FIELDS.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center">
                        {(mapping.focus_field === "email" || mapping.focus_field === "phone") && (
                          <Checkbox
                            checked={mapping.is_primary}
                            onCheckedChange={(v) => updateMapping(index, "is_primary", v)}
                          />
                        )}
                      </div>
                      <div>
                        {(mapping.focus_field === "email" || mapping.focus_field === "phone" || mapping.focus_field === "roles") && (
                          <Select
                            value={mapping.separator || "none"}
                            onValueChange={(v) => updateMapping(index, "separator", v === "none" ? null : v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value=";">Semicolon (;)</SelectItem>
                              <SelectItem value="|">Pipe (|)</SelectItem>
                              <SelectItem value=",">Comma (,)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4">
                <Label className="text-sm text-slate-400">Preview (first 5 rows)</Label>
                <div className="bg-slate-900 rounded-lg overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {uploadResult.headers.map((h, i) => (
                          <th key={i} className="px-2 py-1 text-left text-slate-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.preview_rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-slate-800">
                          {uploadResult.headers.map((h, j) => (
                            <td key={j} className="px-2 py-1 text-slate-300 truncate max-w-[150px]">{row.data[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configure Options */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Default Country Code (for phones)</Label>
                  <Select
                    value={config.default_country_code}
                    onValueChange={(v) => setConfig(prev => ({ ...prev, default_country_code: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Multi-value Separator</Label>
                  <Select
                    value={config.multivalue_separator}
                    onValueChange={(v) => setConfig(prev => ({ ...prev, multivalue_separator: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=";">Semicolon (;)</SelectItem>
                      <SelectItem value="|">Pipe (|)</SelectItem>
                      <SelectItem value=",">Comma (,)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Duplicate Handling Policy</Label>
                <Select
                  value={config.upsert_policy}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, upsert_policy: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UPSERT_POLICIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  {config.upsert_policy === "UPDATE_EXISTING" && "If a contact with the same email exists, it will be updated with new data."}
                  {config.upsert_policy === "CREATE_ONLY" && "If a contact with the same email exists, the row will be skipped."}
                  {config.upsert_policy === "CREATE_DUPLICATE" && "A new contact will always be created, even if one with the same email exists."}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={config.strict_mode}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, strict_mode: v }))}
                  />
                  <Label className="font-normal">Strict Mode — Block import only for critical errors (email format)</Label>
                </div>
                <p className="text-xs text-slate-500 ml-6">
                  Phone format issues are warnings only and will not block import
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={config.overwrite_empty}
                    onCheckedChange={(v) => setConfig(prev => ({ ...prev, overwrite_empty: v }))}
                  />
                  <Label className="font-normal">Overwrite with empty values</Label>
                </div>
              </div>
              
              {/* Calendar invite option - only for event imports */}
              {eventId && (
                <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="send-calendar-invite"
                      checked={sendCalendarInvite}
                      onCheckedChange={(v) => setSendCalendarInvite(v)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="send-calendar-invite" className="font-medium text-white cursor-pointer">
                        Enviar invitación de Google Calendar
                      </Label>
                      <p className="text-xs text-slate-400 mt-1">
                        {isEventFuture 
                          ? "Se creará un evento en Google Calendar y se enviarán invitaciones a todos los contactos importados."
                          : "⚠️ Este evento ya pasó. Las invitaciones serán para una fecha pasada."}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        🔒 Los invitados no podrán ver la lista de otros asistentes.
                      </p>
                    </div>
                  </div>
                  
                  {/* Calendar event details - only show when sending invites */}
                  {sendCalendarInvite && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-slate-700">
                      <div>
                        <Label className="text-sm text-slate-300">Descripción del evento en calendario</Label>
                        <Textarea
                          value={calendarDescription}
                          onChange={(e) => setCalendarDescription(e.target.value)}
                          placeholder="Descripción que aparecerá en la invitación de Google Calendar..."
                          className="mt-1 bg-slate-900 border-slate-600 text-white min-h-[80px]"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          El link del webinar se agregará automáticamente al final.
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm text-slate-300">Ubicación</Label>
                        <Input
                          value={calendarLocation}
                          onChange={(e) => setCalendarLocation(e.target.value)}
                          placeholder="Ej: Zoom, Google Meet, Oficina CDMX..."
                          className="mt-1 bg-slate-900 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                  )}
                  
                  {!isEventFuture && sendCalendarInvite && (
                    <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Estás a punto de enviar invitaciones para un evento que ya ocurrió.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review & Validate */}
          {step === 4 && validationResult && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-5 gap-3">
                <Card className="bg-slate-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-white">{validationResult.total_rows}</p>
                    <p className="text-xs text-slate-400">Total Rows</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-900/30 border-emerald-500/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{validationResult.to_create}</p>
                    <p className="text-xs text-slate-400">To Create</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-900/30 border-blue-500/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">{validationResult.to_update}</p>
                    <p className="text-xs text-slate-400">To Update</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-slate-400">{validationResult.to_skip}</p>
                    <p className="text-xs text-slate-400">To Skip</p>
                  </CardContent>
                </Card>
                <Card className={validationResult.errors > 0 ? "bg-red-900/30 border-red-500/30" : "bg-slate-800"}>
                  <CardContent className="p-4 text-center">
                    <p className={`text-2xl font-bold ${validationResult.errors > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {validationResult.errors}
                    </p>
                    <p className="text-xs text-slate-400">Errors</p>
                  </CardContent>
                </Card>
              </div>

              {validationResult.warnings > 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-300">{validationResult.warnings} warnings found (import can proceed)</span>
                </div>
              )}

              {validationResult.errors > 0 && config.strict_mode && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-300">Strict mode is on. Fix errors before importing.</span>
                </div>
              )}

              {/* Preview results */}
              <div>
                <Label className="text-sm text-slate-400">Preview Results (first 10 rows)</Label>
                <div className="bg-slate-900 rounded-lg overflow-x-auto mt-2 max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-700">
                        <th className="px-2 py-2 text-left text-slate-400">Row</th>
                        <th className="px-2 py-2 text-left text-slate-400">Name</th>
                        <th className="px-2 py-2 text-left text-slate-400">Email</th>
                        <th className="px-2 py-2 text-left text-slate-400">Action</th>
                        <th className="px-2 py-2 text-left text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResult.preview_results.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-slate-800">
                          <td className="px-2 py-2 text-slate-400">{row.row_index + 1}</td>
                          <td className="px-2 py-2 text-white">
                            {row.processed_data.name || `${row.processed_data.first_name || ''} ${row.processed_data.last_name || ''}`.trim() || '-'}
                          </td>
                          <td className="px-2 py-2 text-slate-300">
                            {row.processed_data.emails?.[0]?.email || '-'}
                          </td>
                          <td className="px-2 py-2">
                            <Badge className={
                              row.action === 'create' ? 'bg-emerald-500/20 text-emerald-400' :
                              row.action === 'update' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-slate-700 text-slate-400'
                            }>
                              {row.action}
                            </Badge>
                            {row.matched_contact && (
                              <span className="text-xs text-slate-500 ml-1">
                                → {row.matched_contact.name}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {row.errors.length > 0 ? (
                              <span className="text-red-400 flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {typeof row.errors[0] === 'object' ? row.errors[0].message || row.errors[0].detail : row.errors[0]}
                              </span>
                            ) : row.warnings.length > 0 ? (
                              <span className="text-yellow-400 flex items-center gap-1" title="Warning - will not block import">
                                <AlertTriangle className="w-3 h-3" />
                                {typeof row.warnings[0] === 'object' ? row.warnings[0].message || row.warnings[0].detail : row.warnings[0]}
                              </span>
                            ) : (
                              <span className="text-green-400 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (importResult || hubspotResult) && (
            <div className="space-y-6 text-center py-8">
              <div className={`w-20 h-20 ${(hubspotResult?.success !== false && !hubspotResult?.error) || importResult ? 'bg-green-500/20' : 'bg-red-500/20'} rounded-full flex items-center justify-center mx-auto`}>
                {(hubspotResult?.success !== false && !hubspotResult?.error) || importResult ? (
                  <CheckCircle className="w-10 h-10 text-green-400" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-400" />
                )}
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {hubspotResult ? (hubspotResult.success ? 'HubSpot Import Complete!' : 'Import Error') : 'Import Complete!'}
                </h3>
                <p className="text-slate-400 mt-1">
                  {hubspotResult?.message || 'Your contacts have been successfully imported.'}
                </p>
              </div>

              {/* Stats for CSV import */}
              {importResult && (
                <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
                  <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-4">
                    <p className="text-3xl font-bold text-emerald-400">{importResult.created}</p>
                    <p className="text-xs text-slate-400">Created</p>
                  </div>
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-3xl font-bold text-blue-400">{importResult.updated}</p>
                    <p className="text-xs text-slate-400">Updated</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-3xl font-bold text-slate-400">{importResult.skipped}</p>
                    <p className="text-xs text-slate-400">Skipped</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-3xl font-bold text-red-400">{importResult.errors}</p>
                    <p className="text-xs text-slate-400">Errors</p>
                  </div>
                </div>
              )}

              {/* Stats for HubSpot import */}
              {hubspotResult && !hubspotResult.error && (
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-4">
                    <p className="text-3xl font-bold text-emerald-400">{hubspotResult.created || 0}</p>
                    <p className="text-xs text-slate-400">Created</p>
                  </div>
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-3xl font-bold text-blue-400">{hubspotResult.updated || 0}</p>
                    <p className="text-xs text-slate-400">Updated</p>
                  </div>
                  <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-4">
                    <p className="text-3xl font-bold text-orange-400">{hubspotResult.total || 0}</p>
                    <p className="text-xs text-slate-400">Total</p>
                  </div>
                </div>
              )}

              {importResult?.error_details?.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-left max-w-lg mx-auto">
                  <p className="text-sm text-red-400 font-medium mb-2">Errors:</p>
                  <ul className="text-xs text-red-300 space-y-1">
                    {importResult.error_details.slice(0, 5).map((err, i) => (
                      <li key={i}>Row {err.row_index + 1}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && step < 5 && importMode === 'csv' && (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          <div className="flex-1" />
          
          {step === 1 && importMode === 'csv' && (
            <Button onClick={handleUpload} disabled={!file || loading} className="btn-accent">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload & Continue
            </Button>
          )}

          {step === 1 && importMode === 'hubspot' && (
            <Button onClick={handleHubspotImport} disabled={!hubspotUrl || loading} className="btn-accent">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Import from HubSpot
            </Button>
          )}
          
          {step === 2 && (
            <Button onClick={handleSaveMapping} disabled={loading} className="btn-accent">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings2 className="w-4 h-4 mr-2" />}
              Configure Options
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          
          {step === 3 && (
            <Button onClick={handleValidate} disabled={loading} className="btn-accent">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Validate
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          
          {step === 4 && (
            <Button 
              onClick={handleRunImport} 
              disabled={loading || (validationResult?.errors > 0 && config.strict_mode) || !validationResult?.can_proceed}
              className="btn-accent"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Run Import
            </Button>
          )}
          
          {step === 5 && (
            <Button onClick={handleClose} className="btn-accent">
              <Check className="w-4 h-4 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
