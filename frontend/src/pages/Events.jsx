import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import api from "../lib/api";
import { 
  Calendar, 
  ExternalLink, 
  CalendarDays,
  Link as LinkIcon,
  AlertTriangle,
  UserCircle,
  Edit,
  Check,
  Users,
  Plus,
  AlertCircle,
  Trash2,
  Image,
  Clock,
  Globe,
  CheckCircle2,
  XCircle,
  Sparkles,
  List,
  LayoutGrid,
  Eye,
  Filter,
  FileText,
  Link2
} from "lucide-react";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [buyerPersonasDB, setBuyerPersonasDB] = useState([]);
  const [personaMap, setPersonaMap] = useState({});
  const [personasWithoutFutureEvent, setPersonasWithoutFutureEvent] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [thematicAxes, setThematicAxes] = useState([]);
  const [contactCounts, setContactCounts] = useState({});
  
  // Filters
  const [filterPersona, setFilterPersona] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  
  // View mode
  const [viewMode, setViewMode] = useState("grid"); // grid, checklist
  
  // Dialogs
  const [editingEvent, setEditingEvent] = useState(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(null);
  
  // Theme selection dialog
  const [selectingTheme, setSelectingTheme] = useState(null); // buyer persona key
  const [selectedTheme, setSelectedTheme] = useState("");
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [titleMode, setTitleMode] = useState("ai"); // "ai" | "manual"
  
  // Form state
  const [saving, setSaving] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    date: "",
    time: "",
    url_website: "",
    url_linkedin: "",
    buyer_personas: [],
    status: "draft"
  });
  
  // Persona filter in event form
  const [personaFilter, setPersonaFilter] = useState("");
  const [personaFilterType, setPersonaFilterType] = useState("all");

  useEffect(() => {
    loadEvents();
    loadBuyerPersonas();
    loadThematicAxes();
    loadBuyerPersonasDB();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [filterPersona, filterDateFrom, filterDateTo]);

  useEffect(() => {
    checkPersonasWithoutFutureEvents();
  }, [events, buyerPersonas]);

  const checkPersonasWithoutFutureEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const personasWithFutureEvents = new Set();
    events.forEach(event => {
      if (event.date) {
        const eventDate = new Date(event.date);
        if (eventDate >= today && event.buyer_personas) {
          event.buyer_personas.forEach(p => personasWithFutureEvents.add(p));
        }
      }
    });
    
    const missing = buyerPersonas.filter(p => !personasWithFutureEvents.has(p.key));
    setPersonasWithoutFutureEvent(missing);
  };

  const loadEvents = async () => {
    try {
      let params = new URLSearchParams();
      if (filterPersona) params.append("buyer_persona", filterPersona);
      if (filterDateFrom) params.append("date_from", filterDateFrom);
      if (filterDateTo) params.append("date_to", filterDateTo);
      
      const response = await api.get(`/events/?${params.toString()}`);
      setEvents(response.data);
      
      // Also load checklist
      const checklistRes = await api.get("/events/checklist");
      setChecklist(checklistRes.data);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuyerPersonas = async () => {
    try {
      const response = await api.get("/hubspot/buyer-personas");
      setBuyerPersonas(response.data.buyer_personas || []);
      setPersonaMap(response.data.persona_map || {});
    } catch (error) {
      console.error("Error loading buyer personas:", error);
    }
  };

  const loadThematicAxes = async () => {
    try {
      const response = await api.get("/thematic-axes/");
      setThematicAxes(response.data || []);
      
      // If no axes exist, seed them
      if (response.data.length === 0) {
        await api.post("/thematic-axes/seed");
        const seededResponse = await api.get("/thematic-axes/");
        setThematicAxes(seededResponse.data || []);
      }
    } catch (error) {
      console.error("Error loading thematic axes:", error);
    }
  };

  const loadBuyerPersonasDB = async () => {
    try {
      const response = await api.get("/buyer-personas-db/");
      setBuyerPersonasDB(response.data || []);
      
      // Build contact counts map from unified_contacts
      const contactsRes = await api.get("/contacts", { params: { limit: 5000 } });
      const contacts = contactsRes.data.contacts || contactsRes.data || [];
      const counts = {};
      contacts.forEach(contact => {
        const bp = contact.buyer_persona;
        if (bp) {
          counts[bp] = (counts[bp] || 0) + 1;
        }
      });
      setContactCounts(counts);
    } catch (error) {
      console.error("Error loading buyer personas DB:", error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getPersonaName = (key) => {
    if (!key) return key;
    // First try to get display_name from DB
    const dbPersona = buyerPersonasDB.find(p => p.code === key);
    if (dbPersona?.display_name) return dbPersona.display_name;
    // Fallback to HubSpot personas
    const persona = buyerPersonas.find(p => p.key === key);
    return persona?.name || personaMap[key] || key;
  };

  const getPersonaDisplayName = (personaKey) => {
    const dbPersona = buyerPersonasDB.find(p => p.code === personaKey);
    return dbPersona?.display_name || dbPersona?.persona_name || getPersonaName(personaKey);
  };

  const getContactCount = (personaKey) => {
    return contactCounts[personaKey] || 0;
  };

  // Filter personas for the event form
  const getFilteredPersonas = () => {
    let filtered = [...buyerPersonasDB];
    
    // Apply text filter
    if (personaFilter.trim()) {
      const query = personaFilter.toLowerCase();
      filtered = filtered.filter(p => 
        (p.display_name || p.name || "").toLowerCase().includes(query) ||
        (p.area || "").toLowerCase().includes(query) ||
        (p.sector || "").toLowerCase().includes(query)
      );
    }
    
    // Apply type filter
    if (personaFilterType !== "all") {
      const areaMap = {
        marketing: "marketing",
        comercial: "comercial",
        rrhh: "rrhh",
        compras: "compras",
        medico: "médic"
      };
      const areaKey = areaMap[personaFilterType];
      if (areaKey) {
        filtered = filtered.filter(p => 
          (p.area || "").toLowerCase().includes(areaKey) ||
          (p.area_code || "").toLowerCase().includes(areaKey)
        );
      }
    }
    
    // Sort by contact count
    return filtered.sort((a, b) => {
      const countA = contactCounts[a.code] || 0;
      const countB = contactCounts[b.code] || 0;
      return countB - countA;
    });
  };

  // Sort personas without future events by contact count (descending)
  const sortedPersonasWithoutFutureEvent = [...personasWithoutFutureEvent].sort((a, b) => {
    const countA = getContactCount(a.key);
    const countB = getContactCount(b.key);
    return countB - countA;
  });

  const openCreateDialogWithTheme = (personaKey) => {
    setSelectingTheme(personaKey);
    setSelectedTheme("");
  };

  const handleThemeSelected = async () => {
    if (!selectedTheme || !selectingTheme) return;
    
    setGeneratingTitle(true);
    try {
      // Generate title with AI
      const response = await api.post("/events/generate-title", {
        thematic_axis_id: selectedTheme,
        buyer_persona_code: selectingTheme
      });
      
      if (response.data.success) {
        // Open create dialog with generated title
        setEventForm({
          name: response.data.title,
          description: "",
          date: "",
          time: "",
          url_website: "",
          url_linkedin: "",
          buyer_personas: [selectingTheme],
          status: "draft"
        });
        setSelectingTheme(null);
        setSelectedTheme("");
        setManualTitle("");
        setTitleMode("ai");
        setCreatingEvent(true);
        toast.success("Título generado con IA");
      }
    } catch (error) {
      toast.error("Error al generar título");
      console.error(error);
    } finally {
      setGeneratingTitle(false);
    }
  };

  const handleManualTitle = () => {
    if (!manualTitle.trim() || !selectingTheme) return;
    
    setEventForm({
      name: manualTitle.trim(),
      description: "",
      date: "",
      time: "",
      url_website: "",
      url_linkedin: "",
      buyer_personas: [selectingTheme],
      status: "draft"
    });
    setSelectingTheme(null);
    setSelectedTheme("");
    setManualTitle("");
    setTitleMode("ai");
    setCreatingEvent(true);
  };

  const openCreateDialog = (preselectedPersona = null) => {
    setEventForm({
      name: "",
      description: "",
      date: "",
      time: "",
      url_website: "",
      url_linkedin: "",
      buyer_personas: preselectedPersona ? [preselectedPersona] : [],
      status: "draft"
    });
    setCreatingEvent(true);
  };

  const openEditDialog = (event) => {
    setEventForm({
      name: event.name || "",
      description: event.description || "",
      date: event.date || "",
      time: event.time || "",
      url_website: event.url_website || "",
      url_linkedin: event.url_linkedin || "",
      buyer_personas: event.buyer_personas || [],
      status: event.status || "draft"
    });
    setEditingEvent(event);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.name.trim()) {
      toast.error("El nombre del evento es requerido");
      return;
    }
    
    setSaving(true);
    try {
      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, eventForm);
        toast.success("Evento actualizado");
      } else {
        await api.post("/events/", eventForm);
        toast.success("Evento creado");
      }
      
      setEditingEvent(null);
      setCreatingEvent(false);
      loadEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar evento");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    
    try {
      await api.delete(`/events/${deletingEvent.id}`);
      toast.success("Evento eliminado");
      setDeletingEvent(null);
      loadEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar evento");
    }
  };

  const handleGenerateContent = async (event) => {
    setGeneratingContent(event.id);
    try {
      const response = await api.post(`/events/${event.id}/generate-content`);
      if (response.data.success) {
        toast.success("Contenido generado exitosamente");
        loadEvents();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al generar contenido");
    } finally {
      setGeneratingContent(null);
    }
  };

  const toggleFormPersona = (personaKey) => {
    setEventForm(prev => ({
      ...prev,
      buyer_personas: prev.buyer_personas.includes(personaKey)
        ? prev.buyer_personas.filter(p => p !== personaKey)
        : [...prev.buyer_personas, personaKey]
    }));
  };

  const clearFilters = () => {
    setFilterPersona("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const EventCard = ({ event }) => (
    <Card 
      className={`stat-card hover:shadow-lg transition-all duration-300 ${
        (!event.buyer_personas || event.buyer_personas.length === 0) 
          ? 'border-amber-300 bg-amber-50/50' 
          : ''
      }`}
      data-testid={`event-card-${event.id}`}
    >
      <CardContent className="p-0">
        {/* Cover Image */}
        {event.cover_image ? (
          <div className="h-40 bg-[#151515] rounded-t-xl overflow-hidden">
            <img 
              src={event.cover_image} 
              alt={event.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 rounded-t-xl flex items-center justify-center">
            <Image className="w-12 h-12 text-slate-300" />
          </div>
        )}
        
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <Badge className={event.status === "published" ? "badge-success" : "bg-[#151515] text-slate-300"}>
              {event.status === "published" ? "Publicado" : "Borrador"}
            </Badge>
            {(!event.buyer_personas || event.buyer_personas.length === 0) && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sin Persona
              </Badge>
            )}
          </div>
          
          <h3 className="font-bold text-lg text-white mb-2 line-clamp-2">
            {event.name}
          </h3>
          
          {event.description && (
            <p className="text-sm text-slate-500 mb-3 line-clamp-2">{event.description}</p>
          )}
          
          <div className="space-y-2 text-sm mb-4">
            {event.date && (
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{formatDate(event.date)}</span>
                {event.time && <span className="text-slate-400">• {event.time}</span>}
              </div>
            )}
            
            {event.buyer_personas && event.buyer_personas.length > 0 && (
              <div className="flex items-start gap-2 text-slate-300">
                <Users className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {event.buyer_personas.slice(0, 2).map((key) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {getPersonaName(key)}
                    </Badge>
                  ))}
                  {event.buyer_personas.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{event.buyer_personas.length - 2}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 pt-3 border-t">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => openEditDialog(event)}
              className="flex-1"
            >
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleGenerateContent(event)}
              disabled={generatingContent === event.id}
              className="flex-1"
            >
              <Sparkles className={`w-4 h-4 mr-1 ${generatingContent === event.id ? 'animate-spin' : ''}`} />
              {generatingContent === event.id ? "..." : "Generar"}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setDeletingEvent(event)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ChecklistItem = ({ item }) => {
    const checks = item.checks;
    const event = events.find(e => e.id === item.id);
    const [quickEditField, setQuickEditField] = useState(null);
    const [quickEditValue, setQuickEditValue] = useState("");
    const [savingQuickEdit, setSavingQuickEdit] = useState(false);
    
    const fieldConfig = {
      has_name: { 
        label: "Título", 
        field: "name", 
        type: "text",
        icon: FileText,
        placeholder: "Nombre del evento"
      },
      has_description: { 
        label: "Descripción", 
        field: "description", 
        type: "textarea",
        icon: FileText,
        placeholder: "Descripción del evento",
        canGenerate: true
      },
      has_date: { 
        label: "Fecha", 
        field: "date", 
        type: "date",
        icon: Calendar,
        placeholder: ""
      },
      has_time: { 
        label: "Hora", 
        field: "time", 
        type: "time",
        icon: Clock,
        placeholder: ""
      },
      has_url_website: { 
        label: "URL Website", 
        field: "url_website", 
        type: "url",
        icon: Globe,
        placeholder: "https://..."
      },
      has_url_linkedin: { 
        label: "URL LinkedIn", 
        field: "url_linkedin", 
        type: "url",
        icon: Link2,
        placeholder: "https://linkedin.com/events/..."
      },
      has_buyer_personas: { 
        label: "Buyer Personas", 
        field: "buyer_personas", 
        type: "personas",
        icon: Users,
        placeholder: ""
      },
      has_cover_image: { 
        label: "Portada", 
        field: "cover_image", 
        type: "image",
        icon: Image,
        placeholder: "",
        canGenerate: true
      }
    };

    const handleQuickSave = async (fieldKey) => {
      if (!event) return;
      const config = fieldConfig[fieldKey];
      
      setSavingQuickEdit(true);
      try {
        await api.put(`/events/${event.id}`, {
          [config.field]: quickEditValue
        });
        toast.success(`${config.label} actualizado`);
        loadEvents();
        setQuickEditField(null);
      } catch (error) {
        toast.error("Error al guardar");
      } finally {
        setSavingQuickEdit(false);
      }
    };

    const handleGenerateAI = async () => {
      if (!event) return;
      setQuickEditField(null);
      handleGenerateContent(event);
    };

    const getFieldValue = (fieldKey) => {
      if (!event) return null;
      const config = fieldConfig[fieldKey];
      const value = event[config.field];
      
      if (fieldKey === "has_buyer_personas") {
        if (!value || value.length === 0) return null;
        return value.map(key => getPersonaName(key)).join(", ");
      }
      if (fieldKey === "has_cover_image") {
        return value;
      }
      return value;
    };

    return (
      <div className="flex items-center gap-4 p-4 bg-[#111111] rounded-xl border hover:shadow-sm transition-all">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{item.name}</h4>
          <p className="text-sm text-slate-500">{formatDate(item.date) || "Sin fecha"}</p>
        </div>
        
        <div className="flex items-center gap-1">
          {Object.entries(checks).map(([key, value]) => {
            const config = fieldConfig[key];
            const Icon = config.icon;
            const currentValue = getFieldValue(key);
            
            return (
              <Popover key={key}>
                <PopoverTrigger asChild>
                  <button 
                    className={`p-1.5 rounded cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all ${
                      value ? 'bg-emerald-100 hover:ring-emerald-300' : 'bg-red-100 hover:ring-red-300'
                    }`}
                    title={config.label}
                  >
                    {value ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="center">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${value ? 'text-emerald-600' : 'text-red-500'}`} />
                      <span className="font-medium text-sm">{config.label}</span>
                      <Badge variant={value ? "default" : "destructive"} className="ml-auto text-xs">
                        {value ? "Completo" : "Pendiente"}
                      </Badge>
                    </div>
                    
                    {value ? (
                      // Show current value for completed fields
                      <div className="bg-[#0f0f0f] rounded-lg p-3">
                        {key === "has_cover_image" && currentValue ? (
                          <img 
                            src={currentValue} 
                            alt="Portada" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ) : key === "has_buyer_personas" ? (
                          <div className="flex flex-wrap gap-1">
                            {event?.buyer_personas?.map(p => (
                              <Badge key={p} variant="secondary" className="text-xs">
                                {getPersonaName(p)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-200 break-words">
                            {currentValue || "-"}
                          </p>
                        )}
                      </div>
                    ) : (
                      // Show input for incomplete fields
                      <div className="space-y-2">
                        {config.type === "textarea" ? (
                          <Textarea
                            placeholder={config.placeholder}
                            value={quickEditField === key ? quickEditValue : ""}
                            onChange={(e) => {
                              setQuickEditField(key);
                              setQuickEditValue(e.target.value);
                            }}
                            rows={3}
                            className="text-sm"
                          />
                        ) : config.type === "personas" ? (
                          <div className="text-sm text-slate-500">
                            <p className="mb-2">Usa el botón Editar para asignar buyer personas</p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openEditDialog(event)}
                              className="w-full"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar evento
                            </Button>
                          </div>
                        ) : config.type === "image" ? (
                          <div className="text-sm text-slate-500">
                            <p className="mb-2">Genera una portada con IA</p>
                          </div>
                        ) : (
                          <Input
                            type={config.type}
                            placeholder={config.placeholder}
                            value={quickEditField === key ? quickEditValue : ""}
                            onChange={(e) => {
                              setQuickEditField(key);
                              setQuickEditValue(e.target.value);
                            }}
                            className="text-sm"
                          />
                        )}
                        
                        <div className="flex gap-2">
                          {config.type !== "personas" && config.type !== "image" && (
                            <Button 
                              size="sm" 
                              onClick={() => handleQuickSave(key)}
                              disabled={savingQuickEdit || !quickEditValue}
                              className="flex-1"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Guardar
                            </Button>
                          )}
                          
                          {config.canGenerate && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={handleGenerateAI}
                              disabled={generatingContent === event?.id}
                              className="flex-1"
                            >
                              <Sparkles className={`w-3 h-3 mr-1 ${generatingContent === event?.id ? 'animate-spin' : ''}`} />
                              {generatingContent === event?.id ? "..." : "Generar IA"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Edit button for all fields */}
                    {value && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => openEditDialog(event)}
                        className="w-full text-slate-300"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Editar en formulario completo
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
        
        <div className="w-20">
          <Progress value={item.completion_percentage} className="h-2" />
          <p className="text-xs text-center mt-1 text-slate-500">{item.completion_percentage}%</p>
        </div>
        
        <Button variant="ghost" size="sm" onClick={() => {
          if (event) openEditDialog(event);
        }}>
          <Edit className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="events-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Eventos</h1>
          <p className="text-slate-500 mt-1">{events.length} eventos • Gestiona tus webinars y masterclasses</p>
        </div>
        <Button 
          onClick={() => openCreateDialog()}
          className="btn-accent"
          data-testid="create-event-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Crear Evento
        </Button>
      </div>

      {/* Alert for personas without future events */}
      {sortedPersonasWithoutFutureEvent.length > 0 && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Buyer Personas sin eventos futuros</AlertTitle>
          <AlertDescription className="text-red-700">
            <p className="mb-3">Los siguientes buyer personas no tienen eventos programados (ordenados por cantidad de contactos):</p>
            <div className="flex flex-wrap gap-2">
              {sortedPersonasWithoutFutureEvent.slice(0, 8).map((persona) => {
                const displayName = getPersonaDisplayName(persona.key);
                const contactCount = getContactCount(persona.key);
                return (
                  <div key={persona.key} className="flex items-center gap-2 bg-[#111111] rounded-lg px-3 py-2 border border-red-200">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-white text-sm block">{displayName}</span>
                      <span className="text-xs text-slate-500">{contactCount} contactos</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs border-red-300 text-red-700 hover:bg-red-100"
                      onClick={() => openCreateDialogWithTheme(persona.key)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Crear
                    </Button>
                  </div>
                );
              })}
              {sortedPersonasWithoutFutureEvent.length > 8 && (
                <Badge variant="outline" className="border-red-300 text-red-700">
                  +{sortedPersonasWithoutFutureEvent.length - 8} más
                </Badge>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters and View Toggle */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Buyer Persona</Label>
                <Select value={filterPersona || "all"} onValueChange={(v) => setFilterPersona(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {buyerPersonas.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Desde</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Hasta</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              {(filterPersona || filterDateFrom || filterDateTo) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              )}
              
              <div className="flex border rounded-lg overflow-hidden">
                <Button 
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-none"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button 
                  variant={viewMode === "checklist" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("checklist")}
                  className="rounded-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Display */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-80 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === "grid" ? (
        events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="stat-card">
            <CardContent className="p-12 text-center">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-white mb-2">No hay eventos</h3>
              <p className="text-slate-500 mb-4">Crea tu primer evento para comenzar</p>
              <Button onClick={() => openCreateDialog()} className="btn-accent">
                <Plus className="w-4 h-4 mr-2" />
                Crear Evento
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 px-4">
            <span className="flex-1">Evento</span>
            <span className="w-64 text-center">Completitud</span>
            <span className="w-20 text-center">%</span>
            <span className="w-10"></span>
          </div>
          {checklist.length > 0 ? (
            checklist.map((item) => (
              <ChecklistItem key={item.id} item={item} />
            ))
          ) : (
            <Card className="stat-card">
              <CardContent className="p-8 text-center text-slate-500">
                No hay eventos para mostrar
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create/Edit Event Dialog */}
      <Dialog open={creatingEvent || !!editingEvent} onOpenChange={(open) => {
        if (!open) {
          setCreatingEvent(false);
          setEditingEvent(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Crear Evento"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "Modifica los detalles del evento" : "Completa la información del nuevo evento"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Título del evento *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Masterclass de Marketing Digital"
                  value={eventForm.name}
                  onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="time">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={eventForm.time}
                  onChange={(e) => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="url_website">URL del Website</Label>
                <Input
                  id="url_website"
                  placeholder="https://..."
                  value={eventForm.url_website}
                  onChange={(e) => setEventForm(prev => ({ ...prev, url_website: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="url_linkedin">URL de LinkedIn</Label>
                <Input
                  id="url_linkedin"
                  placeholder="https://linkedin.com/events/..."
                  value={eventForm.url_linkedin}
                  onChange={(e) => setEventForm(prev => ({ ...prev, url_linkedin: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describe brevemente el evento..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={eventForm.status} 
                  onValueChange={(v) => setEventForm(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Buyer Personas</Label>
                <span className="text-xs text-slate-500">
                  {eventForm.buyer_personas.length} seleccionados
                </span>
              </div>
              
              {/* Filter controls */}
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por nombre, área o sector..."
                  value={personaFilter}
                  onChange={(e) => setPersonaFilter(e.target.value)}
                  className="text-sm"
                />
                <Select value={personaFilterType} onValueChange={setPersonaFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="rrhh">RRHH</SelectItem>
                    <SelectItem value="compras">Compras</SelectItem>
                    <SelectItem value="medico">Médico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {buyerPersonasDB.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                  {getFilteredPersonas().map((persona) => {
                    const displayName = persona.display_name || persona.persona_name || persona.name;
                    const isSelected = eventForm.buyer_personas.includes(persona.code);
                    const contactCount = contactCounts[persona.code] || 0;
                    
                    return (
                      <div 
                        key={persona.code}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 border border-blue-200' 
                            : 'bg-[#0f0f0f] hover:bg-[#151515] border border-transparent'
                        }`}
                        onClick={() => toggleFormPersona(persona.code)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleFormPersona(persona.code)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{displayName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {contactCount} contactos
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {persona.area} • {persona.sector}
                          </p>
                          {persona.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{persona.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : buyerPersonas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                  {buyerPersonas.map((persona) => (
                    <div 
                      key={persona.key}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        eventForm.buyer_personas.includes(persona.key) 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'bg-[#0f0f0f] hover:bg-[#151515]'
                      }`}
                      onClick={() => toggleFormPersona(persona.key)}
                    >
                      <Checkbox 
                        checked={eventForm.buyer_personas.includes(persona.key)}
                        onCheckedChange={() => toggleFormPersona(persona.key)}
                      />
                      <span className="text-sm font-medium">{persona.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 p-4 bg-[#0f0f0f] rounded-lg">
                  Sincroniza contactos para ver los buyer personas disponibles
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreatingEvent(false);
              setEditingEvent(null);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEvent} 
              disabled={saving || !eventForm.name.trim()}
              className="btn-accent"
            >
              <Check className="w-4 h-4 mr-2" />
              {saving ? "Guardando..." : (editingEvent ? "Actualizar" : "Crear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el evento 
              "{deletingEvent?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEvent}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Theme Selection Dialog */}
      <Dialog open={!!selectingTheme} onOpenChange={(open) => {
        if (!open) {
          setSelectingTheme(null);
          setSelectedTheme("");
          setManualTitle("");
          setTitleMode("ai");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Crear evento para {selectingTheme ? getPersonaDisplayName(selectingTheme) : ""}
            </DialogTitle>
            <DialogDescription>
              Elige cómo quieres crear el título del evento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  titleMode === "ai" 
                    ? "bg-purple-600 text-white" 
                    : "bg-[#0f0f0f] text-slate-200 hover:bg-[#151515]"
                }`}
                onClick={() => setTitleMode("ai")}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                Generar con IA
              </button>
              <button
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  titleMode === "manual" 
                    ? "bg-purple-600 text-white" 
                    : "bg-[#0f0f0f] text-slate-200 hover:bg-[#151515]"
                }`}
                onClick={() => setTitleMode("manual")}
              >
                <Edit className="w-4 h-4 inline mr-2" />
                Escribir manualmente
              </button>
            </div>

            {titleMode === "ai" ? (
              <>
                <p className="text-sm text-slate-300">Selecciona un eje temático:</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {thematicAxes.length > 0 ? (
                    thematicAxes.map((axis) => (
                      <div 
                        key={axis.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedTheme === axis.id 
                            ? 'border-purple-400 bg-purple-50 ring-2 ring-purple-200' 
                            : 'border-[#222222] hover:border-purple-200 hover:bg-[#0f0f0f]'
                        }`}
                        onClick={() => setSelectedTheme(axis.id)}
                      >
                        <h4 className="font-medium text-white">{axis.name}</h4>
                        {axis.description && (
                          <p className="text-xs text-slate-500 mt-1">{axis.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">
                      No hay ejes temáticos. Ve a la sección de Ejes Temáticos para agregarlos.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="manual-title">Título del evento</Label>
                <Input
                  id="manual-title"
                  placeholder="Escribe el título del webinar..."
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectingTheme(null);
              setSelectedTheme("");
              setManualTitle("");
              setTitleMode("ai");
            }}>
              Cancelar
            </Button>
            {titleMode === "ai" ? (
              <Button 
                onClick={handleThemeSelected}
                disabled={!selectedTheme || generatingTitle}
                className="btn-accent"
              >
                {generatingTitle ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generar título
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleManualTitle}
                disabled={!manualTitle.trim()}
                className="btn-accent"
              >
                Continuar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
