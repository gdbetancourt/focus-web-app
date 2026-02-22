import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import api from "../../lib/api";
import ImportWizard from "../../pages/foundations/ImportWizard";
import ContactSheet from "../ContactSheet";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import {
  Plus,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  ExternalLink,
  Trash2,
  RefreshCw,
  FileText,
  Upload,
  CalendarDays,
  FileUp,
  ChevronRight,
  ChevronDown,
  Link2,
  Building2,
  DollarSign,
  Edit2,
  Linkedin,
  Phone,
  Mail,
  User,
  UserCheck,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  AlertTriangle,
  MapPin,
  Video,
  ChevronUp,
  Edit,
} from "lucide-react";

// Section configuration
const SECTION = getSectionById("marketing-event-planning");

// Tasks that require a file upload before completion
const TASKS_REQUIRING_FILE = [];

// Event categories for 4 placeholders
const EVENT_CATEGORIES = [
  { 
    id: "dominant_industry", 
    label: "Dominant Industry Specific", 
    description: "Events targeting our dominant industry vertical",
    color: "blue"
  },
  { 
    id: "leadership", 
    label: "Leadership Specific", 
    description: "Events focused on leadership development topics",
    color: "purple"
  },
  { 
    id: "sales", 
    label: "Sales Specific", 
    description: "Events focused on sales excellence topics",
    color: "green"
  },
  { 
    id: "thought_leadership", 
    label: "Thought Leadership Specific", 
    description: "Events establishing thought leadership positioning",
    color: "orange"
  },
];

const CATEGORY_COLORS = {
  dominant_industry: { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400" },
  leadership: { bg: "bg-purple-500/20", border: "border-purple-500/50", text: "text-purple-400" },
  sales: { bg: "bg-green-500/20", border: "border-green-500/50", text: "text-green-400" },
  thought_leadership: { bg: "bg-orange-500/20", border: "border-orange-500/50", text: "text-orange-400" },
};

export default function MarketingEventPlanningPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [trafficStatus, setTrafficStatus] = useState(null);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [industries, setIndustries] = useState([]);
  
  // Filter states
  const [filterBuyerPersona, setFilterBuyerPersona] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingTask, setUploadingTask] = useState(null);
  const [uploadingEventId, setUploadingEventId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // New event form state
  const [newEventName, setNewEventName] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("10:00");
  const [newEventBuyerPersonas, setNewEventBuyerPersonas] = useState([]);
  const [newEventIndustries, setNewEventIndustries] = useState([]);
  const [newEventHubspotUrl, setNewEventHubspotUrl] = useState("");
  const [newEventImportType, setNewEventImportType] = useState("attended");  // "registered" or "attended"
  const [newEventCategory, setNewEventCategory] = useState(null);  // Category placeholder
  const [newEventFormat, setNewEventFormat] = useState("en_linea");  // presencial or en_linea
  const [newEventLinkedInUrl, setNewEventLinkedInUrl] = useState("");  // LinkedIn event URL
  
  // Edit event state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editLinkedInUrl, setEditLinkedInUrl] = useState("");
  const [editBuyerPersonas, setEditBuyerPersonas] = useState([]);
  const [editIndustries, setEditIndustries] = useState([]);
  const [editCategory, setEditCategory] = useState(null);
  const [editFormat, setEditFormat] = useState("en_linea");
  const [saving, setSaving] = useState(false);

  // Import contacts state - uses unified ImportWizard
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importingEvent, setImportingEvent] = useState(null);
  
  // Registrants/Participants view state - inline per event
  const [expandedEventRegistrants, setExpandedEventRegistrants] = useState({}); // {eventId: true/false}
  const [eventRegistrants, setEventRegistrants] = useState({}); // {eventId: [...registrants]}
  const [loadingEventRegistrants, setLoadingEventRegistrants] = useState({}); // {eventId: true/false}
  
  // Pagination state for contact subgroups: { "eventId-personaCode-status": limit }
  const [contactsLimit, setContactsLimit] = useState({});
  const DEFAULT_CONTACTS_LIMIT = 25;
  
  // Contact Sheet state for inline editing
  const [editingContact, setEditingContact] = useState(null);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  
  // HubSpot import progress during event creation
  const [hubspotImportProgress, setHubspotImportProgress] = useState(null);
  const [createdEventId, setCreatedEventId] = useState(null);
  const [isPollingProgress, setIsPollingProgress] = useState(false);
  
  // Email status state for webinar-related emails
  const [expandedEmailStatus, setExpandedEmailStatus] = useState(null); // eventId or null
  const [emailStatuses, setEmailStatuses] = useState({}); // {eventId: [...statuses]}
  const [loadingEmailStatus, setLoadingEmailStatus] = useState({});
  
  // Email detail modal state
  const [emailDetailOpen, setEmailDetailOpen] = useState(false);
  const [emailDetailData, setEmailDetailData] = useState(null);
  const [loadingEmailDetail, setLoadingEmailDetail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  
  // Show-up statistics
  const [showupStats, setShowupStats] = useState(null);
  const [showupHistoryOpen, setShowupHistoryOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, trafficRes, personasRes, industriesRes, showupRes] = await Promise.all([
        api.get("/events-v2/"),
        api.get("/events-v2/traffic-light"),
        api.get("/buyer-personas-db/"),
        api.get("/industries/"),
        api.get("/events-v2/showup-stats")
      ]);
      setEvents(eventsRes.data || []);
      setTrafficStatus(trafficRes.data);
      setBuyerPersonas(personasRes.data || []);
      setIndustries(industriesRes.data?.industries || []);
      setShowupStats(showupRes.data || null);
    } catch (error) {
      console.error("Error loading events:", error);
      toast.error("Error loading events");
    } finally {
      setLoading(false);
    }
  };

  // Separate future and past events
  const { futureEvents, pastEvents } = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const future = events.filter(e => e.webinar_date >= today);
    const past = events.filter(e => e.webinar_date < today);
    
    // Sort future by date (soonest first)
    future.sort((a, b) => a.webinar_date.localeCompare(b.webinar_date));
    // Sort past by date (most recent first)
    past.sort((a, b) => b.webinar_date.localeCompare(a.webinar_date));
    
    return { futureEvents: future, pastEvents: past };
  }, [events]);

  // Group future events by category for placeholders
  const eventsByCategory = useMemo(() => {
    const grouped = {};
    EVENT_CATEGORIES.forEach(cat => {
      grouped[cat.id] = futureEvents.filter(e => e.category === cat.id);
    });
    // Track uncategorized events
    grouped.uncategorized = futureEvents.filter(e => !e.category || !EVENT_CATEGORIES.find(c => c.id === e.category));
    return grouped;
  }, [futureEvents]);

  // Group PAST events by category (for reference when creating new events)
  // Sorted by show-up rate (attended/registered) - highest first
  const pastEventsByCategory = useMemo(() => {
    const grouped = {};
    EVENT_CATEGORIES.forEach(cat => {
      // Get past events for this category
      // Use showup_rate, total_attended, total_registrants from backend
      const categoryPastEvents = pastEvents
        .filter(e => e.category === cat.id)
        .map(e => ({
          ...e,
          showupRate: e.showup_rate || 0,
          totalRegistered: e.total_registrants || 0,
          totalAttended: e.total_attended || 0
        }))
        // Sort by show-up rate (highest first)
        .sort((a, b) => b.showupRate - a.showupRate)
        // Take top 3
        .slice(0, 3);
      
      grouped[cat.id] = categoryPastEvents;
    });
    return grouped;
  }, [pastEvents]);

  // Get uncategorized past events (need to be assigned a category)
  const uncategorizedPastEvents = useMemo(() => {
    return pastEvents
      .filter(e => !e.category || !EVENT_CATEGORIES.find(c => c.id === e.category))
      .map(e => ({
        ...e,
        showupRate: e.showup_rate || 0,
        totalRegistered: e.total_registrants || 0,
        totalAttended: e.total_attended || 0
      }))
      .sort((a, b) => b.showupRate - a.showupRate);
  }, [pastEvents]);

  // Calculate placeholder traffic light
  const placeholderTrafficLight = useMemo(() => {
    const categoriesWithEvents = EVENT_CATEGORIES.filter(
      cat => eventsByCategory[cat.id]?.length > 0
    ).length;
    
    if (categoriesWithEvents === 4) return "green";
    if (categoriesWithEvents > 0) return "yellow";
    return "red";
  }, [eventsByCategory]);

  // Load email status for an event
  const loadEmailStatus = async (eventId) => {
    // Toggle off if already expanded
    if (expandedEmailStatus === eventId) {
      setExpandedEmailStatus(null);
      return;
    }
    
    // If already loaded, just expand
    if (emailStatuses[eventId]) {
      setExpandedEmailStatus(eventId);
      return;
    }
    
    // Load from API - use new webinar-emails endpoint
    setLoadingEmailStatus(prev => ({ ...prev, [eventId]: true }));
    try {
      const response = await api.get(`/webinar-emails/event/${eventId}/status`);
      setEmailStatuses(prev => ({
        ...prev,
        [eventId]: response.data.email_statuses || []
      }));
      setExpandedEmailStatus(eventId);
    } catch (error) {
      console.error("Error loading email status:", error);
      toast.error("Error cargando estado de emails");
    } finally {
      setLoadingEmailStatus(prev => ({ ...prev, [eventId]: false }));
    }
  };

  // Load email detail logs
  const openEmailDetail = async (eventId, emailId, emailName) => {
    setLoadingEmailDetail(true);
    setEmailDetailOpen(true);
    setEmailDetailData({ eventId, emailId, emailName, recipients: [] });
    
    try {
      const response = await api.get(`/webinar-emails/event/${eventId}/logs/${emailId}`);
      setEmailDetailData(response.data);
    } catch (error) {
      console.error("Error loading email logs:", error);
      toast.error("Error cargando detalles de email");
    } finally {
      setLoadingEmailDetail(false);
    }
  };
  
  // Resend failed emails
  const resendFailedEmails = async () => {
    if (!emailDetailData?.event_id || !emailDetailData?.email_id) return;
    
    setResendingEmail(true);
    try {
      const response = await api.post(`/webinar-emails/event/${emailDetailData.event_id}/resend/${emailDetailData.email_id}`);
      toast.success(response.data.message || "Emails marcados para reenvío");
      
      // Reload email status
      await loadEmailStatus(emailDetailData.event_id);
      
      // Reload detail
      const detailRes = await api.get(`/webinar-emails/event/${emailDetailData.event_id}/logs/${emailDetailData.email_id}`);
      setEmailDetailData(detailRes.data);
    } catch (error) {
      console.error("Error resending emails:", error);
      toast.error("Error al reenviar emails");
    } finally {
      setResendingEmail(false);
    }
  };

  // Poll for HubSpot import progress
  const pollHubspotProgress = useCallback(async (eventId) => {
    console.log("Polling progress for event:", eventId);
    try {
      const response = await api.get(`/events-v2/${eventId}/import-hubspot/progress`);
      const progress = response.data;
      console.log("Progress:", progress);
      setHubspotImportProgress(progress);
      
      if (progress.status === 'complete') {
        setIsPollingProgress(false);
        toast.success(`¡Importación completada! ${progress.created} nuevos, ${progress.updated} actualizados`);
        setCreating(false);
        setCreateDialogOpen(false);
        resetForm();
        setHubspotImportProgress(null);
        setCreatedEventId(null);
        loadData();
      } else if (progress.status === 'error') {
        setIsPollingProgress(false);
        toast.error(progress.error || 'Error en importación de HubSpot');
        setCreating(false);
        setCreateDialogOpen(false);
        resetForm();
        setHubspotImportProgress(null);
        setCreatedEventId(null);
        loadData();
      }
    } catch (error) {
      console.error('Error polling progress:', error);
    }
  }, []);

  // Polling effect for HubSpot import
  useEffect(() => {
    let interval;
    if (isPollingProgress && createdEventId) {
      interval = setInterval(() => pollHubspotProgress(createdEventId), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPollingProgress, createdEventId, pollHubspotProgress]);

  const createEvent = async () => {
    if (!newEventName.trim() || !newEventDate) {
      toast.error("Name and date are required");
      return;
    }
    
    // Validation for required fields
    if (!newEventLinkedInUrl.trim()) {
      toast.error("LinkedIn event URL is required");
      return;
    }
    
    if (newEventBuyerPersonas.length === 0) {
      toast.error("At least one Buyer Persona is required");
      return;
    }
    
    setCreating(true);
    console.log("Creating event...");
    try {
      // First create the event WITHOUT HubSpot import
      const response = await api.post("/events-v2/", {
        name: newEventName,
        description: newEventDescription,
        webinar_date: newEventDate,
        webinar_time: newEventTime,
        buyer_personas: newEventBuyerPersonas,
        industries: newEventIndustries,
        hubspot_list_url: null,  // Don't import during creation
        category: newEventCategory,
        format: newEventFormat,
        linkedin_event_url: newEventLinkedInUrl
      });
      
      const eventId = response.data.id;
      console.log("Event created:", eventId);
      setEvents(prev => [response.data, ...prev]);
      
      // If HubSpot URL provided, start background import with progress
      if (newEventHubspotUrl && newEventHubspotUrl.trim()) {
        console.log("Starting HubSpot import for event:", eventId);
        setCreatedEventId(eventId);
        setHubspotImportProgress({ status: 'starting', phase: 'Iniciando importación...', percent: 0 });
        
        // Start import in background
        const importResponse = await api.post(`/events-v2/${eventId}/import-hubspot`, {
          hubspot_list_url: newEventHubspotUrl,
          import_type: newEventImportType  // "registered" or "attended"
        });
        
        console.log("Import response:", importResponse.data);
        
        if (importResponse.data.status === 'started' || importResponse.data.status === 'in_progress') {
          // Start polling for progress
          console.log("Starting progress polling...");
          setIsPollingProgress(true);
          toast.info('Evento creado. Importando contactos de HubSpot...');
        } else {
          // Import completed immediately (small list?)
          console.log("Import completed immediately");
          setCreating(false);
          setCreateDialogOpen(false);
          resetForm();
          setHubspotImportProgress(null);
          toast.success("Evento creado con contactos importados");
          loadData();
        }
      } else {
        // No HubSpot import, just finish
        toast.success("Evento creado con landing page automática");
        setCreating(false);
        setCreateDialogOpen(false);
        resetForm();
        loadData();
      }
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Error creating event");
      setCreating(false);
      setHubspotImportProgress(null);
      setCreatedEventId(null);
    }
  };

  const resetForm = () => {
    setNewEventName("");
    setNewEventDescription("");
    setNewEventDate("");
    setNewEventTime("10:00");
    setNewEventBuyerPersonas([]);
    setNewEventIndustries([]);
    setNewEventHubspotUrl("");
    setNewEventImportType("attended");
    setNewEventCategory(null);
    setNewEventFormat("en_linea");
    setNewEventLinkedInUrl("");
  };

  // Open create dialog with pre-selected category
  const openCreateWithCategory = (categoryId) => {
    resetForm();
    setNewEventCategory(categoryId);
    setCreateDialogOpen(true);
  };

  const toggleBuyerPersona = (code) => {
    setNewEventBuyerPersonas(prev => 
      prev.includes(code) 
        ? prev.filter(p => p !== code)
        : [...prev, code]
    );
  };
  
  const toggleIndustry = (id) => {
    setNewEventIndustries(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };
  
  const toggleEditIndustry = (id) => {
    setEditIndustries(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const openUploadDialog = (eventId, task) => {
    setUploadingEventId(eventId);
    setUploadingTask(task);
    setUploadFile(null);
    setUploadDialogOpen(true);
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !uploadingEventId || !uploadingTask) {
      toast.error("Select a file");
      return;
    }

    setUploading(true);
    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", uploadFile);
      
      // Upload file
      const uploadRes = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const fileUrl = uploadRes.data?.url || uploadRes.data?.file_url || `/uploads/${uploadFile.name}`;
      
      // Update task with file URL and mark as completed
      await api.put(`/events-v2/${uploadingEventId}/tasks/${uploadingTask.id}`, {
        completed: true,
        file_url: fileUrl
      });
      
      toast.success("File uploaded and task completed");
      setUploadDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error uploading:", error);
      // If upload endpoint doesn't exist, just mark as complete with a placeholder
      try {
        await api.put(`/events-v2/${uploadingEventId}/tasks/${uploadingTask.id}`, {
          completed: true,
          file_url: `uploaded_${Date.now()}.pdf`
        });
        toast.success("Task completed");
        setUploadDialogOpen(false);
        loadData();
      } catch (e) {
        toast.error("Error uploading file");
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleTask = async (eventId, task) => {
    // Check if task requires file upload
    if (!task.completed && TASKS_REQUIRING_FILE.includes(task.name) && !task.file_url) {
      openUploadDialog(eventId, task);
      return;
    }
    
    try {
      await api.put(`/events-v2/${eventId}/tasks/${task.id}`, {
        completed: !task.completed
      });
      
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          const updatedTasks = event.tasks.map(t => {
            if (t.id === task.id) {
              return { ...t, completed: !t.completed };
            }
            return t;
          });
          return { ...event, tasks: updatedTasks };
        }
        return event;
      }));
      
      toast.success(!task.completed ? "Task completed" : "Task unchecked");
      loadData();
    } catch (error) {
      toast.error("Error updating task");
    }
  };

  const deleteEvent = async (eventId) => {
    if (!confirm("¿Eliminar este evento?")) return;
    
    try {
      await api.delete(`/events-v2/${eventId}`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success("Evento eliminado");
    } catch (error) {
      // Handle protected event (has contacts)
      if (error.response?.status === 409) {
        toast.error(error.response.data?.detail || "No se puede eliminar: el evento tiene contactos asociados");
      } else {
        toast.error("Error al eliminar evento");
      }
    }
  };

  // Import contacts functions
  const openImportDialog = (event) => {
    setImportingEvent(event);
    setImportWizardOpen(true);
  };
  
  // Handle import completion - link contacts to event
  const handleImportComplete = async () => {
    if (importingEvent) {
      toast.success(`Contactos importados para ${importingEvent.name}`);
      // Note: The ImportWizard imports to unified_contacts
      // We need to link these contacts to the event via webinar_history
      // This will be done by the backend when we add event_id support to the import
    }
    setImportWizardOpen(false);
    loadData();
  };
  
  // Toggle registrants expansion for an event (inline view)
  const toggleEventRegistrants = async (eventId) => {
    const isCurrentlyExpanded = expandedEventRegistrants[eventId];
    
    if (isCurrentlyExpanded) {
      // Collapse
      setExpandedEventRegistrants(prev => ({ ...prev, [eventId]: false }));
    } else {
      // Expand and load data if not already loaded
      setExpandedEventRegistrants(prev => ({ ...prev, [eventId]: true }));
      
      if (!eventRegistrants[eventId]) {
        setLoadingEventRegistrants(prev => ({ ...prev, [eventId]: true }));
        try {
          const res = await api.get(`/events-v2/${eventId}/registrants`);
          setEventRegistrants(prev => ({ ...prev, [eventId]: res.data.registrants || [] }));
        } catch (error) {
          console.error("Error loading registrants:", error);
          toast.error("Error al cargar registrados");
          setEventRegistrants(prev => ({ ...prev, [eventId]: [] }));
        } finally {
          setLoadingEventRegistrants(prev => ({ ...prev, [eventId]: false }));
        }
      }
    }
  };
  
  // Expand all events registrants
  const expandAllRegistrants = async () => {
    const newExpanded = {};
    for (const event of sortedEvents) {
      newExpanded[event.id] = true;
      // Load registrants if not already loaded
      if (!eventRegistrants[event.id]) {
        setLoadingEventRegistrants(prev => ({ ...prev, [event.id]: true }));
        try {
          const res = await api.get(`/events-v2/${event.id}/registrants`);
          setEventRegistrants(prev => ({ ...prev, [event.id]: res.data.registrants || [] }));
        } catch (error) {
          setEventRegistrants(prev => ({ ...prev, [event.id]: [] }));
        } finally {
          setLoadingEventRegistrants(prev => ({ ...prev, [event.id]: false }));
        }
      }
    }
    setExpandedEventRegistrants(newExpanded);
  };
  
  // Collapse all events registrants
  const collapseAllRegistrants = () => {
    setExpandedEventRegistrants({});
  };
  
  // Check if any event is expanded
  const hasExpandedEvents = useMemo(() => {
    return Object.values(expandedEventRegistrants).some(v => v === true);
  }, [expandedEventRegistrants]);
  
  // Get/Set contacts limit for a subgroup
  const getContactsLimit = (eventId, personaCode, status) => {
    const key = `${eventId}-${personaCode}-${status}`;
    return contactsLimit[key] || DEFAULT_CONTACTS_LIMIT;
  };
  
  const setContactsLimitForGroup = (eventId, personaCode, status, limit) => {
    const key = `${eventId}-${personaCode}-${status}`;
    setContactsLimit(prev => ({ ...prev, [key]: limit }));
  };
  
  // Open ContactSheet for editing
  const openContactEdit = async (contactId) => {
    if (!contactId) return;
    try {
      const res = await api.get(`/contacts/${contactId}`);
      setEditingContact(res.data);
      setContactSheetOpen(true);
    } catch (error) {
      console.error("Error loading contact:", error);
      toast.error("Error al cargar contacto");
    }
  };
  
  // Handle contact update from ContactSheet
  const handleContactUpdate = (updatedContact) => {
    // Refresh registrants for all expanded events
    Object.keys(expandedEventRegistrants).forEach(eventId => {
      if (expandedEventRegistrants[eventId]) {
        // Reload registrants
        api.get(`/events-v2/${eventId}/registrants`).then(res => {
          setEventRegistrants(prev => ({ ...prev, [eventId]: res.data.registrants || [] }));
        });
      }
    });
    setContactSheetOpen(false);
    setEditingContact(null);
  };

  const openEditDialog = (event) => {
    setEditingEvent(event);
    setEditName(event.name || "");
    setEditDescription(event.description || "");
    setEditDate(event.webinar_date || "");
    setEditTime(event.webinar_time || "");
    setEditLinkedInUrl(event.linkedin_event_url || "");
    setEditBuyerPersonas(event.buyer_personas || []);
    setEditIndustries(event.industries || []);
    setEditCategory(event.category || null);
    setEditFormat(event.format || "en_linea");
    setEditDialogOpen(true);
  };

  const saveEditEvent = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await api.put(`/events-v2/${editingEvent.id}`, {
        name: editName,
        description: editDescription,
        webinar_date: editDate,
        webinar_time: editTime,
        linkedin_event_url: editLinkedInUrl || null,
        buyer_personas: editBuyerPersonas,
        industries: editIndustries,
        category: editCategory,
        format: editFormat
      });
      toast.success("Event updated");
      setEditDialogOpen(false);
      setEditingEvent(null);
      loadData();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Error updating event");
    } finally {
      setSaving(false);
    }
  };

  const toggleEditBuyerPersona = (code) => {
    setEditBuyerPersonas(prev => 
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };

  const getTrafficLightColor = (status) => {
    switch (status) {
      case "green": return "bg-green-500";
      case "yellow": return "bg-yellow-500";
      case "red": return "bg-red-500";
      default: return "bg-slate-500";
    }
  };

  const getTaskStatus = (task) => {
    const today = new Date().toISOString().split("T")[0];
    if (task.completed) return "completed";
    if (task.due_date < today) return "overdue";
    if (task.due_date === today) return "today";
    return "pending";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    // Parse date string as local time (not UTC) by adding T12:00:00
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  const formatDateLong = (dateStr) => {
    if (!dateStr) return "";
    // Parse date string as local time (not UTC) by using year, month, day
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-MX", { 
      weekday: "short", day: "numeric", month: "short", year: "numeric" 
    });
  };

  const getBackendUrl = () => process.env.REACT_APP_BACKEND_URL || "";
  
  // Get active industries only
  const activeIndustries = useMemo(() => {
    return industries.filter(ind => ind.active !== false);
  }, [industries]);

  // Filter and sort events
  const sortedEvents = useMemo(() => {
    const now = new Date();
    
    // Apply filters
    let filtered = events.filter(event => {
      // Filter by buyer persona
      if (filterBuyerPersona !== "all") {
        if (!event.buyer_personas?.includes(filterBuyerPersona)) return false;
      }
      // Filter by industry
      if (filterIndustry !== "all") {
        if (!event.industries?.includes(filterIndustry)) return false;
      }
      return true;
    });
    
    // Helper to parse date string as local time
    const parseLocalDate = (dateStr) => {
      if (!dateStr) return new Date(0);
      const [year, month, day] = dateStr.split('-');
      return new Date(year, month - 1, day);
    };
    
    // Sort chronologically
    return filtered.sort((a, b) => {
      const dateA = parseLocalDate(a.webinar_date);
      const dateB = parseLocalDate(b.webinar_date);
      const aIsFuture = dateA >= now;
      const bIsFuture = dateB >= now;
      
      // Future events first
      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;
      
      // Within same category, sort by date
      if (aIsFuture && bIsFuture) {
        return dateA - dateB; // Closest future first
      } else {
        return dateB - dateA; // Most recent past first
      }
    });
  }, [events, filterBuyerPersona, filterIndustry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={placeholderTrafficLight}
      icon={CalendarDays}
    >
      <div className="space-y-6" data-testid="events-v2-page">
        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Show-up Rate Indicator */}
            {showupStats && showupStats.overall.total_events > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowupHistoryOpen(!showupHistoryOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-[#111] border border-[#333] rounded-lg hover:border-[#444] transition-colors"
                  title="Ver histórico de show-up"
                >
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <div className="flex items-center gap-4">
                    {/* Overall average */}
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">
                        {showupStats.overall.average_showup}%
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Histórico</div>
                    </div>
                    
                    {/* Divider */}
                    <div className="w-px h-8 bg-[#333]" />
                    
                    {/* Current year */}
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <span className={`text-lg font-bold ${
                          showupStats.comparison === 'above' ? 'text-green-400' :
                          showupStats.comparison === 'below' ? 'text-red-400' : 'text-white'
                        }`}>
                          {showupStats.current_year.average_showup}%
                        </span>
                        {showupStats.comparison === 'above' && <TrendingUp className="w-4 h-4 text-green-400" />}
                        {showupStats.comparison === 'below' && <TrendingDown className="w-4 h-4 text-red-400" />}
                        {showupStats.comparison === 'equal' && <Minus className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">{showupStats.current_year.year}</div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showupHistoryOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown History */}
                {showupHistoryOpen && (
                  <div className="absolute left-0 top-full mt-2 w-80 bg-[#111] border border-[#333] rounded-lg shadow-xl z-50">
                    <div className="p-4 border-b border-[#222]">
                      <h3 className="font-semibold text-white mb-1">Histórico de Show-up</h3>
                      <p className="text-xs text-slate-500">
                        Eventos con ≥10 registrados y ≥1 asistente
                      </p>
                    </div>
                    
                    {/* Overall Stats */}
                    <div className="p-4 bg-[#0a0a0a] border-b border-[#222]">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-white">{showupStats.overall.total_events}</div>
                          <div className="text-xs text-slate-500">Eventos</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-400">{showupStats.overall.total_registrants.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">Registrados</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-400">{showupStats.overall.total_attended.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">Asistieron</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* By Year */}
                    <div className="max-h-64 overflow-y-auto">
                      {showupStats.by_year.map((year, idx) => (
                        <div 
                          key={year.year} 
                          className={`flex items-center justify-between p-3 ${idx !== showupStats.by_year.length - 1 ? 'border-b border-[#222]' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-semibold text-white">{year.year}</span>
                            <span className="text-xs text-slate-500">{year.events} eventos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              year.average_showup >= 50 ? 'text-green-400' :
                              year.average_showup >= 30 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {year.average_showup}%
                            </span>
                            {year.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
                            {year.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
                            {year.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {showupStats.by_year.length === 0 && (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        No hay suficientes datos históricos
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Expand/Collapse All Toggle */}
            <Button 
              onClick={hasExpandedEvents ? collapseAllRegistrants : expandAllRegistrants}
              variant="outline" 
              className="border-[#333] text-slate-300"
              title={hasExpandedEvents ? "Colapsar todos" : "Expandir todos"}
            >
              {hasExpandedEvents ? (
                <>
                  <ChevronDown className="w-4 h-4 mr-1 rotate-180" />
                  Colapsar
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Expandir
                </>
              )}
            </Button>
            
            <Button onClick={loadData} variant="outline" className="border-[#333] text-slate-300">
              <RefreshCw className="w-4 h-4" />
            </Button>
            
            {/* Create Event Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#ff3300] hover:bg-[#ff3300]/90">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111] border-[#222] text-white max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Nombre del evento *</label>
                  <Input
                    placeholder="e.g: Pharmaceutical Innovation Webinar"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="bg-[#0a0a0a] border-[#333] text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Descripción</label>
                  <Textarea
                    placeholder="Breve descripción..."
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    className="bg-[#0a0a0a] border-[#333] text-white"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Webinar date *</label>
                    <Input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="bg-[#0a0a0a] border-[#333] text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Time</label>
                    <Input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="bg-[#0a0a0a] border-[#333] text-white"
                    />
                  </div>
                </div>
                
                {/* Buyer Personas Selection */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    Buyer Personas (para quién es este evento)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                    {buyerPersonas.map(bp => (
                      <div
                        key={bp.code}
                        onClick={() => toggleBuyerPersona(bp.code)}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          newEventBuyerPersonas.includes(bp.code)
                            ? 'bg-[#ff3300]/20 border border-[#ff3300]/50'
                            : 'hover:bg-[#151515] border border-transparent'
                        }`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: bp.color || '#8b5cf6' }}
                        />
                        <span className="text-sm text-slate-300 truncate">
                          {bp.display_name || bp.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {newEventBuyerPersonas.length > 0 && (
                    <p className="text-xs text-[#ff3300] mt-1">
                      {newEventBuyerPersonas.length} seleccionados
                    </p>
                  )}
                </div>
                
                {/* Industries Selection */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    Industrias (sectores objetivo)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                    {activeIndustries.map(ind => (
                      <div
                        key={ind.id}
                        onClick={() => toggleIndustry(ind.id)}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          newEventIndustries.includes(ind.id)
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'hover:bg-[#151515] border border-transparent'
                        }`}
                      >
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span className="text-sm text-slate-300 truncate">
                          {ind.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {newEventIndustries.length > 0 && (
                    <p className="text-xs text-blue-400 mt-1">
                      {newEventIndustries.length} seleccionadas
                    </p>
                  )}
                </div>
                
                {/* Category Selection */}
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Category *</label>
                  <Select value={newEventCategory || ""} onValueChange={setNewEventCategory}>
                    <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-[#333]">
                      {EVENT_CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat.id]?.bg.replace("/20", "")}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Format Selection */}
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Format *</label>
                  <Select value={newEventFormat} onValueChange={setNewEventFormat}>
                    <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-[#333]">
                      <SelectItem value="en_linea">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          En Línea
                        </div>
                      </SelectItem>
                      <SelectItem value="presencial">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Presencial
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* LinkedIn Event URL */}
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">LinkedIn Event URL *</label>
                  <Input
                    placeholder="https://www.linkedin.com/events/..."
                    value={newEventLinkedInUrl}
                    onChange={(e) => setNewEventLinkedInUrl(e.target.value)}
                    className="bg-[#0a0a0a] border-[#333] text-white"
                  />
                </div>
                
                {/* HubSpot List Import */}
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg space-y-4">
                  <div>
                    <label className="text-sm text-orange-400 mb-2 block font-medium">
                      Importar desde HubSpot (opcional)
                    </label>
                    <Input
                      placeholder="https://app.hubspot.com/contacts/.../lists/..."
                      value={newEventHubspotUrl}
                      onChange={(e) => setNewEventHubspotUrl(e.target.value)}
                      className="bg-[#0a0a0a] border-[#333] text-white"
                    />
                    <p className="text-xs text-orange-400/70 mt-2">
                      Pega la URL de una lista de HubSpot para importar automáticamente los contactos al crear el evento.
                    </p>
                  </div>
                  
                  {/* Import Type Selector - Only show when HubSpot URL is entered */}
                  {newEventHubspotUrl && (
                    <div className="space-y-2">
                      <label className="text-sm text-orange-400 font-medium">Tipo de importación</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div 
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            newEventImportType === "registered" 
                              ? "border-blue-500 bg-blue-500/10" 
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                          onClick={() => setNewEventImportType("registered")}
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">Registrados</span>
                          </div>
                        </div>
                        <div 
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            newEventImportType === "attended" 
                              ? "border-green-500 bg-green-500/10" 
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                          onClick={() => setNewEventImportType("attended")}
                        >
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-white">Asistentes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 text-sm font-medium">Se generará automáticamente:</p>
                  <ul className="text-blue-400/70 text-xs mt-1 space-y-0.5">
                    <li>• Landing page con formulario</li>
                    <li>• Imagen de banner con IA</li>
                  </ul>
                </div>
                
                {/* HubSpot Import Progress Bar */}
                {hubspotImportProgress && hubspotImportProgress.status !== 'not_started' && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {hubspotImportProgress.status === 'complete' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : hubspotImportProgress.status === 'error' ? (
                          <Trash2 className="w-5 h-5 text-red-400" />
                        ) : (
                          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                        )}
                        <div>
                          <p className="font-medium text-white text-sm">{hubspotImportProgress.phase}</p>
                          {hubspotImportProgress.total > 0 && (
                            <p className="text-xs text-slate-400">
                              {hubspotImportProgress.processed || 0} de {hubspotImportProgress.total} contactos
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xl font-bold text-orange-400">
                        {hubspotImportProgress.percent || 0}%
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300 ease-out"
                        style={{ width: `${hubspotImportProgress.percent || 0}%` }}
                      />
                    </div>
                    
                    {/* Stats */}
                    {hubspotImportProgress.status === 'importing' && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-green-400">{hubspotImportProgress.created || 0}</p>
                          <p className="text-xs text-slate-400">Nuevos</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-blue-400">{hubspotImportProgress.updated || 0}</p>
                          <p className="text-xs text-slate-400">Actualizados</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-400">{hubspotImportProgress.errors || 0}</p>
                          <p className="text-xs text-slate-400">Errores</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-[#333]" disabled={isPollingProgress}>
                  Cancelar
                </Button>
                <Button onClick={createEvent} disabled={creating} className="bg-[#ff3300]">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {creating ? (hubspotImportProgress ? "Importando..." : "Creando...") : "Crear Evento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterBuyerPersona} onValueChange={setFilterBuyerPersona}>
          <SelectTrigger className="w-48 bg-[#111] border-[#333] text-white">
            <SelectValue placeholder="Filtrar por Buyer Persona" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-[#333]">
            <SelectItem value="all">Todos los Buyer Personas</SelectItem>
            {buyerPersonas.map(bp => (
              <SelectItem key={bp.code} value={bp.code}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bp.color || '#8b5cf6' }} />
                  {bp.display_name || bp.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterIndustry} onValueChange={setFilterIndustry}>
          <SelectTrigger className="w-48 bg-[#111] border-[#333] text-white">
            <SelectValue placeholder="Filtrar por Industria" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-[#333]">
            <SelectItem value="all">Todas las Industrias</SelectItem>
            {activeIndustries.map(ind => (
              <SelectItem key={ind.id} value={ind.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3 h-3 text-blue-400" />
                  {ind.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {(filterBuyerPersona !== "all" || filterIndustry !== "all") && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setFilterBuyerPersona("all"); setFilterIndustry("all"); }}
            className="text-slate-400 hover:text-white"
          >
            Limpiar filtros
          </Button>
        )}
        
        <span className="text-sm text-slate-500 ml-auto">
          {sortedEvents.length} de {events.length} eventos
        </span>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-[#ff3300]" />
              Upload Required Document
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-400 text-sm">
              The task <strong className="text-white">{uploadingTask?.name}</strong> requires 
              uploading a PDF document before marking it as complete.
            </p>
            <div className="border-2 border-dashed border-[#333] rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-sm text-slate-400">
                  {uploadFile ? uploadFile.name : "Click to select PDF"}
                </p>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={handleFileUpload} disabled={!uploadFile || uploading} className="bg-[#ff3300]">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-[#ff3300]" />
              Edit Event
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Event name *</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Webinar date *</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Time</label>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                />
              </div>
            </div>
            
            {/* LinkedIn Event URL */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block flex items-center gap-2">
                <Linkedin className="w-4 h-4" />
                LinkedIn Event URL
              </label>
              <Input
                value={editLinkedInUrl}
                onChange={(e) => setEditLinkedInUrl(e.target.value)}
                placeholder="https://www.linkedin.com/events/..."
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
              <p className="text-xs text-slate-500 mt-1">
                Required for inviting LinkedIn contacts to the event
              </p>
            </div>
            
            {/* Category Selection */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Category</label>
              <Select value={editCategory || ""} onValueChange={setEditCategory}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  {EVENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[cat.id]?.bg.replace("/20", "")}`} />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format Selection */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Format</label>
              <Select value={editFormat} onValueChange={setEditFormat}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  <SelectItem value="en_linea">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      En Línea
                    </div>
                  </SelectItem>
                  <SelectItem value="presencial">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Presencial
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Buyer Personas */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Buyer Personas</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                {buyerPersonas.map(bp => (
                  <div
                    key={bp.code}
                    onClick={() => toggleEditBuyerPersona(bp.code)}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                      editBuyerPersonas.includes(bp.code)
                        ? 'bg-[#ff3300]/20 border border-[#ff3300]/50'
                        : 'bg-[#111] border border-[#222] hover:border-[#333]'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: bp.color }}
                    />
                    <span className="text-xs text-slate-300">{bp.display_name || bp.name}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Industries */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Industrias</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                {activeIndustries.map(ind => (
                  <div
                    key={ind.id}
                    onClick={() => toggleEditIndustry(ind.id)}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                      editIndustries.includes(ind.id)
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'bg-[#111] border border-[#222] hover:border-[#333]'
                    }`}
                  >
                    <Building2 className="w-3 h-3 text-blue-400" />
                    <span className="text-xs text-slate-300">{ind.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setEditDialogOpen(false); setEditingEvent(null); }} 
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveEditEvent} 
              disabled={saving || !editName.trim()} 
              className="bg-[#ff3300] hover:bg-[#ff3300]/90"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4 Category Placeholders for Future Events */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${
              placeholderTrafficLight === "green" ? "bg-green-500" :
              placeholderTrafficLight === "yellow" ? "bg-yellow-500" : "bg-red-500"
            }`} />
            <h2 className="text-lg font-semibold text-white">Event Placeholders</h2>
            <span className="text-xs text-slate-500">
              {placeholderTrafficLight === "green" 
                ? "All categories covered" 
                : placeholderTrafficLight === "yellow"
                  ? "Some categories need events"
                  : "No upcoming events"}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {EVENT_CATEGORIES.map((category) => {
            const categoryEvents = eventsByCategory[category.id] || [];
            const isEmpty = categoryEvents.length === 0;
            const colors = CATEGORY_COLORS[category.id];
            
            return (
              <Card 
                key={category.id}
                className={`bg-[#111] border ${isEmpty ? "border-red-500/50 border-dashed" : "border-[#222]"}`}
              >
                <CardContent className="p-4">
                  {/* Category Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors.bg.replace("/20", "")}`} />
                      <h3 className={`font-semibold text-sm ${colors.text}`}>{category.label}</h3>
                      <Badge className="bg-[#222] text-slate-400 text-xs">
                        {categoryEvents.length}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openCreateWithCategory(category.id)}
                      className={`h-7 ${colors.bg} ${colors.text} hover:opacity-80 border ${colors.border}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      New
                    </Button>
                  </div>

                  {/* Empty State */}
                  {isEmpty && (
                    <div className="py-6 text-center border border-dashed border-red-500/30 rounded-lg bg-red-500/5">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                      <p className="text-red-400 text-sm font-medium">No scheduled events</p>
                      <p className="text-[10px] text-slate-500 mt-1">{category.description}</p>
                    </div>
                  )}

                  {/* Event List in Placeholder */}
                  {!isEmpty && (
                    <div className="space-y-2">
                      {categoryEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`rounded ${colors.bg} border ${colors.border} text-sm`}
                        >
                          <div className="p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-white truncate font-medium">{event.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Email Status Button */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => loadEmailStatus(event.id)}
                                  className={`p-1 h-auto ${expandedEmailStatus === event.id ? 'text-purple-400' : 'text-slate-400 hover:text-purple-400'}`}
                                  title="Ver estado de correos"
                                >
                                  {loadingEmailStatus[event.id] ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Mail className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditDialog(event)}
                                  className="text-slate-400 hover:text-white p-1 h-auto"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <Calendar className="w-3 h-3" />
                              <span>{event.webinar_date}</span>
                              <span>•</span>
                              <span>{event.webinar_time}</span>
                              {event.format === "presencial" ? (
                                <MapPin className="w-3 h-3 ml-1" />
                              ) : (
                                <Video className="w-3 h-3 ml-1" />
                              )}
                            </div>
                          </div>
                          
                          {/* Email Status Expanded */}
                          {expandedEmailStatus === event.id && emailStatuses[event.id] && (
                            <div className="px-2 pb-2 border-t border-[#333]/50 pt-2">
                              <div className="space-y-1">
                                {emailStatuses[event.id].map((email) => (
                                  <div 
                                    key={email.email_id} 
                                    className="flex items-center justify-between text-[10px] p-1 rounded hover:bg-[#0a0a0a] cursor-pointer"
                                    onClick={() => openEmailDetail(event.id, email.email_id, email.name)}
                                    title="Click para ver detalles"
                                  >
                                    <span className="text-slate-400 truncate">{email.name}</span>
                                    <Badge className={`text-[9px] shrink-0 ml-2 ${
                                      email.status === 'sent' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                      email.status === 'error' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                      email.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                    }`}>
                                      {email.status === 'sent' 
                                        ? `Enviado (${email.sent_count}/${email.total_registrants})` 
                                        : email.status === 'error'
                                          ? `Error (${email.error_count})`
                                          : email.status === 'scheduled'
                                            ? `Programado`
                                            : 'Pendiente'}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {categoryEvents.length > 3 && (
                        <p className="text-xs text-slate-500 text-center">
                          +{categoryEvents.length - 3} more events
                        </p>
                      )}
                    </div>
                  )}

                  {/* Past Events Reference (Top 3 by Show-up Rate) */}
                  {pastEventsByCategory[category.id]?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#333]">
                      <p className="text-[10px] text-slate-500 uppercase mb-2">Top events by show-up rate:</p>
                      <div className="space-y-1">
                        {pastEventsByCategory[category.id].map((event) => (
                          <div key={event.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-slate-400 truncate">{event.name}</span>
                              {event.totalRegistered > 0 && (
                                <Badge className={`text-[9px] shrink-0 ${
                                  event.showupRate >= 50 ? "bg-green-500/20 text-green-400" :
                                  event.showupRate >= 30 ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-red-500/20 text-red-400"
                                }`}>
                                  {Math.round(event.showupRate)}%
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(event)}
                              className="text-slate-500 hover:text-white p-0.5 h-auto text-[10px]"
                              title="Edit to assign category"
                            >
                              <Edit className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Uncategorized Events Warning */}
        {eventsByCategory.uncategorized?.length > 0 && (
          <Card className="mt-4 bg-yellow-500/10 border-yellow-500/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-400 font-medium">
                  {eventsByCategory.uncategorized.length} upcoming event(s) without category
                </span>
                <span className="text-xs text-slate-500">- Edit them to assign a category</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Uncategorized PAST Events - Need categorization for reference */}
        {uncategorizedPastEvents.length > 0 && (
          <Card className="mt-4 bg-orange-500/10 border-orange-500/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-orange-400 font-medium">
                  {uncategorizedPastEvents.length} past event(s) need categorization
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Assign categories to past events so they appear as references in the placeholders above.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {uncategorizedPastEvents.slice(0, 9).map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#333]">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-white truncate block">{event.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">{event.webinar_date}</span>
                        {event.totalRegistered > 0 && (
                          <Badge className={`text-[9px] ${
                            event.showupRate >= 50 ? "bg-green-500/20 text-green-400" :
                            event.showupRate >= 30 ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400"
                          }`}>
                            {Math.round(event.showupRate)}% ({event.totalAttended}/{event.totalRegistered})
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(event)}
                      className="text-orange-400 hover:text-white p-1 h-auto shrink-0"
                      title="Assign category"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              {uncategorizedPastEvents.length > 9 && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  +{uncategorizedPastEvents.length - 9} more events need categorization
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content - Compact List View */}
      {sortedEvents.length === 0 ? (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500">No hay eventos creados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map(event => {
            // Parse date as local time to avoid timezone issues
            const [year, month, day] = (event.webinar_date || '').split('-');
            const eventDate = event.webinar_date ? new Date(year, month - 1, day) : new Date(0);
            const isPast = eventDate < new Date(new Date().setHours(0,0,0,0));
            const isExpanded = expandedEventRegistrants[event.id];
            const registrants = eventRegistrants[event.id] || [];
            const isLoadingRegistrants = loadingEventRegistrants[event.id];
            
            return (
              <Card key={event.id} className={`border-[#222] ${isPast ? 'bg-[#0a0a0a] opacity-70' : 'bg-[#0f0f0f]'}`}>
                <CardContent className="p-3">
                  {/* Compact Event Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white truncate">{event.name}</h3>
                          {isPast && <Badge className="bg-slate-700 text-slate-400 text-[10px]">Pasado</Badge>}
                          {event.category && (
                            <Badge className={`text-[10px] ${CATEGORY_COLORS[event.category]?.bg} ${CATEGORY_COLORS[event.category]?.text}`}>
                              {EVENT_CATEGORIES.find(c => c.id === event.category)?.label?.split(' ')[0]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateLong(event.webinar_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.webinar_time}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Buyer Personas */}
                      {event.buyer_personas?.length > 0 && (
                        <div className="hidden md:flex gap-1">
                          {event.buyer_personas.slice(0, 2).map(bp => {
                            const persona = buyerPersonas.find(p => p.code === bp);
                            return persona ? (
                              <Badge key={bp} className="text-[10px]" style={{ backgroundColor: `${persona.color}30`, color: persona.color }}>
                                {persona.display_name || persona.name}
                              </Badge>
                            ) : null;
                          })}
                          {event.buyer_personas.length > 2 && (
                            <Badge className="text-[10px] bg-slate-700">+{event.buyer_personas.length - 2}</Badge>
                          )}
                        </div>
                      )}
                      
                      {/* Registrants Count - Clickable to expand */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleEventRegistrants(event.id)}
                        className={`px-2 ${isExpanded ? 'text-blue-300 bg-blue-500/10' : 'text-blue-400 hover:text-blue-300'}`}
                        title="Ver registrados"
                        data-testid={`view-registrants-btn-${event.id}`}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        <span className="text-xs">
                          {event.total_registrants || 0}
                          {event.total_attended > 0 && (
                            <span className="text-green-400 ml-1">
                              ({event.total_attended} ✓)
                            </span>
                          )}
                          {event.showup_rate > 0 && (
                            <span className={`ml-1 ${
                              event.showup_rate >= 50 ? 'text-green-400' : 
                              event.showup_rate >= 30 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {event.showup_rate}%
                            </span>
                          )}
                        </span>
                        <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 border-l border-[#333] pl-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/evento/${event.slug}`, '_blank')}
                          className="text-slate-400 hover:text-[#ff3300] p-1"
                          title="Ver Landing Page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(event)}
                          className="text-slate-400 hover:text-blue-400 p-1"
                          title="Editar evento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openImportDialog(event)}
                          className="text-slate-400 hover:text-green-400 p-1"
                          title="Importar contactos CSV"
                          data-testid={`import-contacts-btn-${event.id}`}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteEvent(event.id)}
                          className="text-slate-400 hover:text-red-400 p-1"
                          title="Eliminar evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Inline Registrants Section - Expanded */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#222]">
                      {isLoadingRegistrants ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                      ) : registrants.length === 0 ? (
                        <div className="text-center py-4 text-slate-500 text-sm">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No hay registrados aún
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Stats Summary */}
                          <div className="flex items-center gap-4 text-xs mb-3 flex-wrap">
                            <span className="text-blue-400">
                              <strong>{registrants.length}</strong> Total
                            </span>
                            <span className="text-green-400">
                              <strong>{registrants.filter(r => r.attended).length}</strong> Asistieron
                            </span>
                            <span className="text-orange-400">
                              <strong>{registrants.filter(r => !r.attended).length}</strong> Solo Registrados
                            </span>
                            {registrants.length > 0 && registrants.filter(r => r.attended).length > 0 && (
                              <span className={`font-semibold px-2 py-0.5 rounded ${
                                (registrants.filter(r => r.attended).length / registrants.length * 100) >= 50 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : (registrants.filter(r => r.attended).length / registrants.length * 100) >= 30 
                                    ? 'bg-yellow-500/20 text-yellow-400' 
                                    : 'bg-red-500/20 text-red-400'
                              }`}>
                                {Math.round(registrants.filter(r => r.attended).length / registrants.length * 100)}% Show-up
                              </span>
                            )}
                          </div>
                          
                          {/* Grouped by Buyer Persona */}
                          {(() => {
                            const grouped = {};
                            registrants.forEach(r => {
                              const persona = r.buyer_persona || 'sin_clasificar';
                              const status = r.attended ? 'attended' : 'registered';
                              if (!grouped[persona]) grouped[persona] = { attended: [], registered: [] };
                              grouped[persona][status].push(r);
                            });
                            
                            return Object.entries(grouped).map(([personaCode, statusGroups]) => {
                              const persona = buyerPersonas.find(p => p.code === personaCode);
                              const personaName = persona?.display_name || persona?.name || 'Sin Clasificar';
                              const personaColor = persona?.color || '#666';
                              const totalInPersona = statusGroups.attended.length + statusGroups.registered.length;
                              
                              return (
                                <Collapsible key={personaCode} defaultOpen={true}>
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#222] rounded cursor-pointer hover:bg-[#151515]">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: personaColor }} />
                                        <span className="text-sm font-medium text-white">{personaName}</span>
                                        <Badge className="text-[10px] bg-slate-700">{totalInPersona}</Badge>
                                      </div>
                                      <ChevronDown className="w-3 h-3 text-slate-400 transition-transform data-[state=closed]:rotate-[-90deg]" />
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="ml-3 mt-1 space-y-1">
                                      {/* Attended */}
                                      {statusGroups.attended.length > 0 && (() => {
                                        const attendedLimit = getContactsLimit(event.id, personaCode, 'attended');
                                        const displayedAttended = attendedLimit === 'all' 
                                          ? statusGroups.attended 
                                          : statusGroups.attended.slice(0, attendedLimit);
                                        
                                        return (
                                        <div className="border-l-2 border-green-500/50 pl-2">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] text-green-400 flex items-center gap-1">
                                              <CheckCircle2 className="w-3 h-3" />
                                              Asistieron ({statusGroups.attended.length})
                                            </div>
                                            {statusGroups.attended.length > 10 && (
                                              <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-500">Mostrar:</span>
                                                <Select 
                                                  value={String(attendedLimit)} 
                                                  onValueChange={(v) => setContactsLimitForGroup(event.id, personaCode, 'attended', v === 'all' ? 'all' : parseInt(v))}
                                                >
                                                  <SelectTrigger className="h-5 w-16 text-[10px] bg-[#0a0a0a] border-[#333]">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent className="bg-[#111] border-[#333]">
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                    <SelectItem value="100">100</SelectItem>
                                                    <SelectItem value="all">Todos</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            )}
                                          </div>
                                          {/* Header row */}
                                          <div className="grid grid-cols-5 gap-2 text-[10px] text-slate-600 px-2 mb-1">
                                            <span>Nombre</span>
                                            <span>Email</span>
                                            <span>Teléfono</span>
                                            <span>Cargo</span>
                                            <span>Empresa</span>
                                          </div>
                                          {displayedAttended.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 py-1 px-2 hover:bg-[#1a1a1a] rounded text-xs group">
                                              <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                                <span className="text-white truncate">
                                                  {r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-'}
                                                </span>
                                                <span className="text-slate-400 truncate">{r.email || '-'}</span>
                                                <span className="text-slate-500 truncate">{r.phone || '-'}</span>
                                                <span className="text-slate-500 truncate">{r.job_title || '-'}</span>
                                                <span className="text-slate-500 truncate">{r.company || '-'}</span>
                                              </div>
                                              {r.id && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => openContactEdit(r.id)}
                                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 p-1 h-auto"
                                                  title="Editar contacto"
                                                >
                                                  <Edit2 className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
                                          {attendedLimit !== 'all' && statusGroups.attended.length > attendedLimit && (
                                            <div className="text-[10px] text-slate-500 px-2 pt-1">
                                              Mostrando {displayedAttended.length} de {statusGroups.attended.length}
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })()}
                                      
                                      {/* Registered only */}
                                      {statusGroups.registered.length > 0 && (() => {
                                        const registeredLimit = getContactsLimit(event.id, personaCode, 'registered');
                                        const displayedRegistered = registeredLimit === 'all' 
                                          ? statusGroups.registered 
                                          : statusGroups.registered.slice(0, registeredLimit);
                                        
                                        return (
                                        <div className="border-l-2 border-orange-500/50 pl-2">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] text-orange-400 flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              Solo Registrados ({statusGroups.registered.length})
                                            </div>
                                            {statusGroups.registered.length > 10 && (
                                              <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-500">Mostrar:</span>
                                                <Select 
                                                  value={String(registeredLimit)} 
                                                  onValueChange={(v) => setContactsLimitForGroup(event.id, personaCode, 'registered', v === 'all' ? 'all' : parseInt(v))}
                                                >
                                                  <SelectTrigger className="h-5 w-16 text-[10px] bg-[#0a0a0a] border-[#333]">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent className="bg-[#111] border-[#333]">
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                    <SelectItem value="100">100</SelectItem>
                                                    <SelectItem value="all">Todos</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            )}
                                          </div>
                                          {/* Header row */}
                                          <div className="grid grid-cols-5 gap-2 text-[10px] text-slate-600 px-2 mb-1">
                                            <span>Nombre</span>
                                            <span>Email</span>
                                            <span>Teléfono</span>
                                            <span>Cargo</span>
                                            <span>Empresa</span>
                                          </div>
                                          {displayedRegistered.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 py-1 px-2 hover:bg-[#1a1a1a] rounded text-xs group">
                                              <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                                <span className="text-white truncate">
                                                  {r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-'}
                                                </span>
                                                <span className="text-slate-400 truncate">{r.email || '-'}</span>
                                                <span className="text-slate-500 truncate">{r.phone || '-'}</span>
                                                <span className="text-slate-500 truncate">{r.job_title || '-'}</span>
                                                <span className="text-slate-500 truncate">{r.company || '-'}</span>
                                              </div>
                                              {r.id && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => openContactEdit(r.id)}
                                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 p-1 h-auto"
                                                  title="Editar contacto"
                                                >
                                                  <Edit2 className="w-3 h-3" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
                                          {registeredLimit !== 'all' && statusGroups.registered.length > registeredLimit && (
                                            <div className="text-[10px] text-slate-500 px-2 pt-1">
                                              Mostrando {displayedRegistered.length} de {statusGroups.registered.length}
                                            </div>
                                          )}
                                        </div>
                                        );
                                      })()}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Landing Page Link */}
                  <div className="mt-2 pt-2 border-t border-[#222] flex items-center gap-2 text-xs">
                    <Link2 className="w-3 h-3 text-slate-500" />
                    <code className="text-[#ff3300] bg-[#0a0a0a] px-2 py-0.5 rounded text-[10px]">
                      {getBackendUrl()}/evento/{event.slug}
                    </code>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import Contacts - Use unified ImportWizard */}
      <ImportWizard 
        open={importWizardOpen} 
        onOpenChange={setImportWizardOpen}
        onImportComplete={handleImportComplete}
        eventId={importingEvent?.id}
        eventName={importingEvent?.name}
        eventDate={importingEvent?.webinar_date}
      />
      
      {/* Email Detail Modal */}
      <Dialog open={emailDetailOpen} onOpenChange={setEmailDetailOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#ff3300]" />
              Detalle: {emailDetailData?.email_name || emailDetailData?.email_id}
            </DialogTitle>
          </DialogHeader>
          
          {loadingEmailDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#ff3300]" />
            </div>
          ) : emailDetailData ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                  <div className="text-xl font-bold text-green-400">
                    {emailDetailData.recipients?.filter(r => r.status === 'sent').length || 0}
                  </div>
                  <div className="text-xs text-green-400/70">Enviados</div>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                  <div className="text-xl font-bold text-yellow-400">
                    {emailDetailData.recipients?.filter(r => r.status === 'pending').length || 0}
                  </div>
                  <div className="text-xs text-yellow-400/70">Pendientes</div>
                </div>
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
                  <div className="text-xl font-bold text-red-400">
                    {emailDetailData.recipients?.filter(r => r.status === 'error').length || 0}
                  </div>
                  <div className="text-xs text-red-400/70">Errores</div>
                </div>
              </div>
              
              {/* Recipients List */}
              <div className="max-h-64 overflow-y-auto border border-[#222] rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[#0a0a0a] sticky top-0">
                    <tr>
                      <th className="text-left p-2 text-slate-500 font-medium">Contacto</th>
                      <th className="text-left p-2 text-slate-500 font-medium">Email</th>
                      <th className="text-left p-2 text-slate-500 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(emailDetailData.recipients || []).map((recipient, idx) => (
                      <tr key={recipient.contact_id || idx} className="border-t border-[#222] hover:bg-[#151515]">
                        <td className="p-2 text-slate-300">{recipient.contact_name || '-'}</td>
                        <td className="p-2 text-slate-400">{recipient.contact_email}</td>
                        <td className="p-2">
                          <Badge className={`text-xs ${
                            recipient.status === 'sent' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : recipient.status === 'error'
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {recipient.status === 'sent' ? 'Enviado' : recipient.status === 'error' ? 'Error' : 'Pendiente'}
                          </Badge>
                          {recipient.sent_at && (
                            <span className="text-[10px] text-slate-500 ml-2">
                              {new Date(recipient.sent_at).toLocaleDateString('es-MX')}
                            </span>
                          )}
                          {recipient.error_message && (
                            <span className="text-[10px] text-red-400 ml-2" title={recipient.error_message}>
                              (ver error)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!emailDetailData.recipients || emailDetailData.recipients.length === 0) && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-500">
                          No hay destinatarios registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Resend Button */}
              {emailDetailData.recipients?.some(r => r.status === 'error') && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-400 font-medium">Hay emails con error</p>
                    <p className="text-xs text-red-400/70">
                      {emailDetailData.recipients.filter(r => r.status === 'error').length} emails fallaron
                    </p>
                  </div>
                  <Button
                    onClick={resendFailedEmails}
                    disabled={resendingEmail}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  >
                    {resendingEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Reintentar envío
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDetailOpen(false)}
              className="border-[#333] text-slate-300"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Contact Sheet for inline editing */}
      <ContactSheet
        contact={editingContact}
        open={contactSheetOpen}
        onOpenChange={(open) => {
          setContactSheetOpen(open);
          if (!open) setEditingContact(null);
        }}
        onUpdate={handleContactUpdate}
        buyerPersonas={buyerPersonas}
      />
    </div>
    </SectionLayout>
  );
}
