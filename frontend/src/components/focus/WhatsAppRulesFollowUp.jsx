/**
 * WhatsAppRulesFollowUp - WhatsApp rules management for Focus/Follow-up section
 * Shows contacts pending for today, grouped by Stage > Rule > Group > Buyer Persona
 * Includes template editing, preview, and URL generation
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import ContactSheet from "../ContactSheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  MessageSquare,
  Send,
  Calendar,
  Users,
  Building,
  Briefcase,
  GraduationCap,
  UserCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  ExternalLink,
  Phone,
  AlertTriangle,
  Search,
  User,
  X,
  Mail,
  Edit,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";

// Pagination constants
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 5;

// Rule type icons
const RULE_ICONS = {
  "W01": <Calendar className="w-4 h-4 text-slate-400" />,
  "W02": <Calendar className="w-4 h-4 text-slate-400" />,
  "W03": <Calendar className="w-4 h-4 text-slate-400" />,
  "W04": <Calendar className="w-4 h-4 text-slate-400" />,
  "W05": <Building className="w-4 h-4 text-cyan-400" />,
  "W06": <Building className="w-4 h-4 text-cyan-400" />,
  "W07": <MessageSquare className="w-4 h-4 text-blue-400" />,
  "W08": <MessageSquare className="w-4 h-4 text-blue-400" />,
  "W09": <MessageSquare className="w-4 h-4 text-blue-400" />,
  "W10": <Briefcase className="w-4 h-4 text-green-400" />,
  "W11": <Briefcase className="w-4 h-4 text-green-400" />,
  "W12": <GraduationCap className="w-4 h-4 text-purple-400" />,
  "W13": <UserCheck className="w-4 h-4 text-yellow-400" />,
  "W14": <MessageSquare className="w-4 h-4 text-blue-400" />,
};

// Stage groups configuration
const STAGE_GROUPS = [
  {
    stage: "all",
    title: "All Stages",
    description: "Confirmaciones y recordatorios de citas",
    rules: ["W01", "W02", "W03", "W04"],
    headerClass: "bg-gradient-to-r from-slate-500/10 to-transparent",
    titleClass: "text-slate-400"
  },
  {
    stage: 1,
    title: "Stage 1 - Prospeccion",
    description: "Nuevos negocios B2B",
    rules: ["W05", "W06"],
    headerClass: "bg-gradient-to-r from-cyan-500/10 to-transparent",
    titleClass: "text-cyan-400"
  },
  {
    stage: 2,
    title: "Stage 2 - Nurturing",
    description: "Webinars e invitaciones",
    rules: ["W07", "W08", "W09", "W14"],
    headerClass: "bg-gradient-to-r from-blue-500/10 to-transparent",
    titleClass: "text-blue-400"
  },
  {
    stage: 3,
    title: "Stage 3 - Close",
    description: "Deal Makers y cierres",
    rules: ["W10", "W11"],
    headerClass: "bg-gradient-to-r from-green-500/10 to-transparent",
    titleClass: "text-green-400"
  },
  {
    stage: 4,
    title: "Stage 4 - Delivery",
    description: "Coaching y entregas",
    rules: ["W12"],
    headerClass: "bg-gradient-to-r from-purple-500/10 to-transparent",
    titleClass: "text-purple-400"
  },
  {
    stage: 5,
    title: "Stage 5 - Repurchase",
    description: "Alumni y recompra",
    rules: ["W13"],
    headerClass: "bg-gradient-to-r from-yellow-500/10 to-transparent",
    titleClass: "text-yellow-400"
  }
];

// Template variables by rule type
const MEETING_RULES = ["W01", "W02", "W03", "W04"];
const BUSINESS_RULES = ["W05", "W06"];
const WEBINAR_RULES = ["W07", "W08", "W09"];

const CONTACT_VARIABLES = [
  { key: "contact_name", label: "Nombre", icon: "👤" },
  { key: "company", label: "Empresa", icon: "🏢" },
];

const MEETING_VARIABLES = [
  { key: "meeting_title", label: "Titulo", icon: "📋" },
  { key: "meeting_date", label: "Fecha", icon: "📅" },
  { key: "meeting_time", label: "Hora", icon: "🕐" },
  { key: "meeting_link", label: "Link", icon: "🔗" },
];

const BUSINESS_VARIABLES = [
  { key: "business_type", label: "Tipo negocio", icon: "🏪" },
];

const WEBINAR_VARIABLES = [
  { key: "webinar_name", label: "Webinar", icon: "📅" },
  { key: "webinar_date", label: "Fecha", icon: "📆" },
  { key: "webinar_time", label: "Hora", icon: "🕐" },
  { key: "webinar_link", label: "Link", icon: "🔗" },
];

// Contact item component
const ContactItem = ({ contact, expandedContact, setExpandedContact, onEdit, onSnooze, ruleId }) => {
  const isExpanded = expandedContact === contact.id;
  const hasPhone = !!contact.contact_phone;
  
  return (
    <div 
      className={`p-2 rounded cursor-pointer transition-colors ${
        isExpanded ? "bg-[#1a1a1a]" : "bg-[#111] hover:bg-[#1a1a1a]"
      } ${!hasPhone ? "border-l-2 border-orange-500" : ""}`}
      onClick={() => setExpandedContact(isExpanded ? null : contact.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasPhone ? (
            <Phone className="w-3 h-3 text-green-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />
          )}
          <span className="text-sm text-white truncate">{contact.contact_name}</span>
          {!hasPhone && (
            <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">Sin telefono</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onSnooze && ruleId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-yellow-400"
              title="Postergar"
              onClick={(e) => {
                e.stopPropagation();
                onSnooze(contact, ruleId);
              }}
            >
              <Clock className="w-3 h-3" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
              title="Editar"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(contact);
              }}
            >
              <Edit className="w-3 h-3" />
            </Button>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-[#333] space-y-1">
          <p className="text-xs text-slate-400">
            <span className="text-slate-500">Telefono:</span> {contact.contact_phone || "No disponible"}
          </p>
          {contact.metadata?.company && (
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Empresa:</span> {contact.metadata.company}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default function WhatsAppRulesFollowUp({ onStatusChange }) {
  // Rules state
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pending counts
  const [rulePendingCounts, setRulePendingCounts] = useState({});
  const [rulePendingGrouped, setRulePendingGrouped] = useState({});
  
  // Queue generation state
  const [generatingQueue, setGeneratingQueue] = useState(false);
  
  // UI state
  const [expandedStages, setExpandedStages] = useState(["all", 1, 2, 3, 4, 5]);
  const [expandedContact, setExpandedContact] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedSubgroup, setExpandedSubgroup] = useState(null);
  
  // Send dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogData, setSendDialogData] = useState(null);
  const [sendMessage, setSendMessage] = useState("");
  const [sendingUrls, setSendingUrls] = useState(false);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContact, setPreviewContact] = useState(null);
  
  // URLs modal state
  const [urlsModalOpen, setUrlsModalOpen] = useState(false);
  const [generatedUrls, setGeneratedUrls] = useState([]);
  
  // Gemini variation state
  const [useGeminiVariation, setUseGeminiVariation] = useState(true);
  const [geminiProgress, setGeminiProgress] = useState({ current: 0, total: 0, active: false });
  
  // Gemini preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [geminiPreviews, setGeminiPreviews] = useState([]);
  const [showGeminiPreview, setShowGeminiPreview] = useState(false);
  
  // Diagnosis search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  
  // Edit contact state
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  // Pagination state
  const [groupPages, setGroupPages] = useState({});
  const [groupPageSizes, setGroupPageSizes] = useState({});
  
  // Message ref for cursor position
  const messageRef = useRef(null);

  // Handle edit contact
  const handleEditContact = async (contact) => {
    try {
      // Fetch full contact data
      const res = await api.get(`/contacts/${contact.contact_id || contact.id}`);
      setEditingContact(res.data);
      setEditContactOpen(true);
    } catch (error) {
      console.error("Error fetching contact:", error);
      toast.error("Error al cargar contacto");
    }
  };

  const handleContactUpdate = async (updatedContact) => {
    setEditContactOpen(false);
    setEditingContact(null);
    // Reload data to reflect changes
    await loadRules();
    if (onStatusChange) {
      onStatusChange();
    }
    toast.success("Contacto actualizado");
  };

  // Handle snooze contact
  const handleSnoozeContact = async (contact, ruleId) => {
    try {
      const res = await api.post("/whatsapp-rules/snooze", {
        contact_id: contact.contact_id || contact.id,
        rule_id: ruleId,
        queue_item_id: contact.queue_id || null
      });
      
      if (res.data.success) {
        toast.success(res.data.message || `Postergado por ${res.data.snooze_days} días`);
        // Reload data
        await loadRules();
        if (onStatusChange) {
          onStatusChange();
        }
      }
    } catch (error) {
      console.error("Error snoozing contact:", error);
      toast.error("Error al postergar contacto");
    }
  };

  // Pagination helpers
  const getPageSize = (groupKey) => groupPageSizes[groupKey] || DEFAULT_PAGE_SIZE;
  const setPageSize = (groupKey, size) => {
    setGroupPageSizes(prev => ({ ...prev, [groupKey]: size }));
    setGroupPages(prev => ({ ...prev, [groupKey]: 1 })); // Reset to page 1
  };
  const getCurrentPage = (groupKey) => groupPages[groupKey] || 1;
  const setCurrentPage = (groupKey, page) => {
    setGroupPages(prev => ({ ...prev, [groupKey]: page }));
  };
  const getPaginatedContacts = (groupKey, contacts) => {
    const currentPage = getCurrentPage(groupKey);
    const pageSize = getPageSize(groupKey);
    const startIndex = (currentPage - 1) * pageSize;
    return contacts.slice(startIndex, startIndex + pageSize);
  };
  const getTotalPages = (groupKey, contacts) => {
    const pageSize = getPageSize(groupKey);
    return Math.ceil(contacts.length / pageSize);
  };

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.get("/whatsapp-rules/");
      setRules(res.data.rules || []);
      await loadAllPendingCounts();
    } catch (error) {
      console.error("Error loading WhatsApp rules:", error);
      toast.error("Error cargando reglas de WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const loadAllPendingCounts = async () => {
    try {
      const res = await api.get("/whatsapp-rules/pending-counts");
      setRulePendingCounts(res.data.counts || {});
    } catch (error) {
      console.error("Error loading pending counts:", error);
    }
  };

  const loadPendingGrouped = useCallback(async (ruleId) => {
    try {
      const res = await api.get(`/whatsapp-rules/rule/${ruleId}/pending-grouped`);
      setRulePendingGrouped(prev => ({
        ...prev,
        [ruleId]: res.data
      }));
    } catch (error) {
      console.error(`Error loading pending for ${ruleId}:`, error);
    }
  }, []);

  const handleAccordionChange = useCallback((value) => {
    if (value && !rulePendingGrouped[value]) {
      loadPendingGrouped(value);
    }
  }, [rulePendingGrouped, loadPendingGrouped]);

  // Generate/refresh queues from various sources with progress
  const [queueProgress, setQueueProgress] = useState(0);
  const [queueProgressText, setQueueProgressText] = useState("");
  
  const generateAllQueues = async () => {
    setGeneratingQueue(true);
    setQueueProgress(0);
    setQueueProgressText("Iniciando...");
    
    try {
      const sources = ["contactos", "calendario", "webinars"];
      const endpoints = [
        "/whatsapp-rules/generate-queue",
        "/whatsapp-rules/generate-calendar-queue", 
        "/whatsapp-rules/generate-webinar-queue"
      ];
      
      let totalGenerated = 0;
      let errors = [];
      
      // Run sequentially with progress updates
      for (let i = 0; i < endpoints.length; i++) {
        setQueueProgressText(`Procesando ${sources[i]}...`);
        setQueueProgress(Math.round(((i) / endpoints.length) * 100));
        
        try {
          const result = await api.post(endpoints[i]);
          totalGenerated += result.data.generated_count || 0;
        } catch (error) {
          console.error(`Error generating ${sources[i]} queue:`, error);
          if (error?.response?.status !== 400) {
            errors.push(sources[i]);
          }
        }
        
        setQueueProgress(Math.round(((i + 1) / endpoints.length) * 100));
      }
      
      setQueueProgressText("Completado");
      setQueueProgress(100);
      
      if (totalGenerated > 0) {
        toast.success(`${totalGenerated} mensajes agregados a la cola`);
      } else {
        toast.info("Cola actualizada - sin nuevos mensajes");
      }
      
      if (errors.length > 0) {
        toast.error(`Error en: ${errors.join(", ")}`);
      }
      
      // Reload data
      await loadRules();
      
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      console.error("Error generating queues:", error);
      toast.error("Error actualizando cola");
    } finally {
      setGeneratingQueue(false);
      // Reset progress after a short delay
      setTimeout(() => {
        setQueueProgress(0);
        setQueueProgressText("");
      }, 1500);
    }
  };

  // Search contacts for diagnosis
  const handleSearchContacts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await api.get(`/mensajes-hoy/whatsapp/search-contacts?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data.contacts || []);
      setShowSearchDropdown(true);
    } catch (error) {
      console.error("Error searching contacts:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearchContacts(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearchContacts]);

  const handleDiagnoseContact = async (contact) => {
    setShowSearchDropdown(false);
    setSearchQuery(contact.name);
    setDiagnosisLoading(true);
    
    try {
      const res = await api.get(`/mensajes-hoy/whatsapp/diagnose/${contact.id}`);
      setSelectedDiagnosis(res.data);
    } catch (error) {
      console.error("Error diagnosing contact:", error);
      toast.error("Error al diagnosticar contacto");
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const clearDiagnosis = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedDiagnosis(null);
    setShowSearchDropdown(false);
  };

  // Open send dialog
  const openSendDialog = (rule, contacts, groupKey, subgroupKey = null, groupData = null) => {
    const contactsWithPhone = contacts.filter(c => c.contact_phone);
    setSendDialogData({ rule, contacts: contactsWithPhone, allContacts: contacts, groupKey, subgroupKey, groupData });
    setSendMessage(rule.template_message || "");
    setPreviewContact(contactsWithPhone[0] || null);
    setShowPreview(false);
    setSendDialogOpen(true);
  };

  // Get variables for current rule
  const getVariablesForRule = (ruleId) => {
    if (MEETING_RULES.includes(ruleId)) {
      return [...CONTACT_VARIABLES, ...MEETING_VARIABLES];
    } else if (BUSINESS_RULES.includes(ruleId)) {
      return BUSINESS_VARIABLES;
    } else if (WEBINAR_RULES.includes(ruleId)) {
      return [...CONTACT_VARIABLES, ...WEBINAR_VARIABLES];
    }
    return CONTACT_VARIABLES;
  };

  // Insert variable
  const insertVariable = (variableKey) => {
    const variable = `{${variableKey}}`;
    if (messageRef.current) {
      const input = messageRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = sendMessage.substring(0, start) + variable + sendMessage.substring(end);
      setSendMessage(newValue);
      
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + variable.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      setSendMessage(sendMessage + variable);
    }
    toast.success(`Variable {${variableKey}} insertada`);
  };

  // Generate preview
  const getPreviewContent = useCallback(() => {
    if (!previewContact || !sendDialogData) return "";
    
    const metadata = previewContact.metadata || {};
    const groupData = sendDialogData.groupData || {};
    
    const fullName = previewContact.contact_name || "";
    const firstName = fullName.split(" ")[0];
    
    const variables = {
      contact_name: firstName,
      company: metadata.company || "",
      business_type: metadata.business_type || "",
      meeting_title: metadata.meeting_title || "",
      meeting_date: metadata.meeting_date || "",
      meeting_time: metadata.meeting_time || "",
      meeting_link: metadata.meeting_link || "[Sin link de acceso]",
      webinar_name: metadata.webinar_name || groupData.group_name || "",
      webinar_date: metadata.webinar_date || groupData.group_date || "",
      webinar_time: metadata.webinar_time || groupData.group_time || "",
      webinar_link: metadata.webinar_link || groupData.group_link || "[Sin link de acceso]",
    };
    
    let preview = sendMessage;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      preview = preview.replace(regex, value || `[${key}]`);
    }
    
    return preview;
  }, [previewContact, sendDialogData, sendMessage]);

  // Generate Gemini preview variations
  const generateGeminiPreview = async () => {
    if (!sendDialogData || !sendDialogData.contacts?.length) return;
    
    setPreviewLoading(true);
    setShowGeminiPreview(true);
    setGeminiPreviews([]);
    
    try {
      // Take up to 3 contacts for preview
      const sampleContacts = sendDialogData.contacts.slice(0, 3).map(c => ({
        contact_name: c.contact_name || "",
        company: c.metadata?.company || "",
        business_type: c.metadata?.business_type || "",
        meeting_title: c.metadata?.meeting_title || "",
        meeting_date: c.metadata?.meeting_date || "",
        meeting_time: c.metadata?.meeting_time || "",
        meeting_link: c.metadata?.meeting_link || "",
        webinar_name: c.metadata?.webinar_name || sendDialogData.groupData?.group_name || "",
        webinar_date: c.metadata?.webinar_date || sendDialogData.groupData?.group_date || "",
        webinar_time: c.metadata?.webinar_time || sendDialogData.groupData?.group_time || "",
        webinar_link: c.metadata?.webinar_link || sendDialogData.groupData?.group_link || "",
      }));
      
      const response = await api.post("/whatsapp-rules/preview-varied-messages", {
        template_message: sendMessage,
        sample_contacts: sampleContacts,
        num_previews: 3
      });
      
      setGeminiPreviews(response.data.previews || []);
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Error generando previsualización");
      setShowGeminiPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Generate URLs (with optional Gemini variation)
  const generateUrls = async () => {
    if (!sendDialogData) return;
    
    setSendingUrls(true);
    const { rule, contacts, groupKey, subgroupKey } = sendDialogData;
    
    try {
      let response;
      
      if (useGeminiVariation) {
        // Use Gemini-varied endpoint with progress tracking
        setGeminiProgress({ current: 0, total: contacts.length, active: true });
        
        response = await api.post("/whatsapp-rules/generate-varied-urls", {
          rule_id: rule.id,
          group_key: groupKey,
          subgroup_key: subgroupKey,
          contact_ids: contacts.map(c => c.contact_id),
          template_message: sendMessage
        });
        
        // Update progress from response
        if (response.data.urls) {
          setGeminiProgress(prev => ({ ...prev, current: response.data.urls.length }));
        }
        
      } else {
        // Use standard endpoint (same message for all)
        response = await api.post("/whatsapp-rules/generate-urls", {
          rule_id: rule.id,
          group_key: groupKey,
          subgroup_key: subgroupKey,
          contact_ids: contacts.map(c => c.contact_id),
          message: sendMessage
        });
      }
      
      setGeneratedUrls(response.data.urls || []);
      setSendDialogOpen(false);
      setUrlsModalOpen(true);
      
      const variationType = useGeminiVariation ? " (variados con IA)" : "";
      toast.success(`${response.data.sent_count} URLs generadas${variationType}`);
      
      // Refresh data
      loadPendingGrouped(rule.id);
      loadAllPendingCounts();
      
      if (onStatusChange) {
        onStatusChange();
      }
      
    } catch (error) {
      console.error("Error generating URLs:", error);
      toast.error(error.response?.data?.detail || "Error generando URLs");
    } finally {
      setSendingUrls(false);
      setGeminiProgress({ current: 0, total: 0, active: false });
    }
  };

  // Copy all URLs (only the wa.me links, one per line)
  const copyAllUrls = () => {
    const urlText = generatedUrls.map(u => u.url).join("\n");
    navigator.clipboard.writeText(urlText);
    toast.success("URLs copiadas al portapapeles");
  };

  // Calculate total pending
  const totalPending = Object.values(rulePendingCounts).reduce((sum, count) => sum + count, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500 mb-3" />
        <p className="text-slate-400">Cargando mensajes pendientes...</p>
      </div>
    );
  }

  if (totalPending === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Todo al dia!</h3>
        <p className="text-slate-400 text-sm max-w-md">
          No hay mensajes de WhatsApp pendientes. Los nuevos mensajes apareceran aqui segun las reglas configuradas.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadRules}
          className="mt-4 border-[#333]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>
    );
  }

  // Diagnosis search UI component
  const DiagnosisSearchCard = () => (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Search className="w-4 h-4 text-green-400" />
          Buscar contacto para diagnóstico WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white pr-10"
                data-testid="whatsapp-diagnosis-search-input"
              />
              {searchLoading && (
                <RefreshCw className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              )}
              
              {/* Search Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => handleDiagnoseContact(contact)}
                      className="w-full px-3 py-2 text-left hover:bg-[#222] flex items-center gap-3 border-b border-[#222] last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {contact.phone || contact.email || 'Sin contacto'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {contact.type === 'business' ? 'Negocio' : `Stage ${contact.stage || '?'}`}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(searchQuery || selectedDiagnosis) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearDiagnosis}
                className="border-[#333] shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Diagnosis Panel */}
          {diagnosisLoading && (
            <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg">
              <div className="flex items-center gap-2 text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analizando contacto...
              </div>
            </div>
          )}

          {selectedDiagnosis && !diagnosisLoading && (
            <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-4" data-testid="whatsapp-diagnosis-panel">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-white font-medium">{selectedDiagnosis.contact?.name || selectedDiagnosis.business?.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                    {(selectedDiagnosis.contact?.phone || selectedDiagnosis.business?.phone) && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedDiagnosis.contact?.phone || selectedDiagnosis.business?.phone}
                      </span>
                    )}
                    {(selectedDiagnosis.contact?.email || selectedDiagnosis.business?.email) && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedDiagnosis.contact?.email || selectedDiagnosis.business?.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {selectedDiagnosis.diagnosis?.should_receive_message ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Cumple regla {selectedDiagnosis.diagnosis.matched_rule}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      <XCircle className="w-3 h-3 mr-1" />
                      No cumple reglas
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!(selectedDiagnosis.contact?.phone || selectedDiagnosis.business?.phone) && (
                  <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                    Sin teléfono
                  </Badge>
                )}
                {selectedDiagnosis.contact && (
                  <Badge variant="outline" className="text-xs">
                    Stage {selectedDiagnosis.contact.stage || '?'}
                  </Badge>
                )}
                {selectedDiagnosis.contact?.buyer_persona && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedDiagnosis.contact.buyer_persona}
                  </Badge>
                )}
                {selectedDiagnosis.business && (
                  <Badge variant="outline" className="text-xs">
                    Negocio
                  </Badge>
                )}
              </div>

              {/* Rules Checklist */}
              {selectedDiagnosis.diagnosis?.rules_checked && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Reglas evaluadas:</p>
                  {selectedDiagnosis.diagnosis.rules_checked.map((rule, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded border ${rule.passed ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'}`}
                    >
                      <div className="flex items-center gap-2">
                        {rule.passed ? (
                          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${rule.passed ? 'text-green-400' : 'text-slate-400'}`}>
                          {rule.rule_name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-6">{rule.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Conclusion */}
              <div className={`p-3 rounded-lg ${selectedDiagnosis.diagnosis?.should_receive_message ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800/50 border border-slate-700'}`}>
                <p className={`text-sm font-medium ${selectedDiagnosis.diagnosis?.should_receive_message ? 'text-green-400' : 'text-slate-400'}`}>
                  {selectedDiagnosis.diagnosis?.should_receive_message
                    ? `✅ Este contacto CUMPLE la regla ${selectedDiagnosis.diagnosis.matched_rule}`
                    : `❌ Este contacto NO cumple ninguna regla de WhatsApp hoy`}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4" data-testid="whatsapp-rules-followup">
      {/* Contact Diagnosis Search */}
      <DiagnosisSearchCard />

      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          {totalPending} mensajes pendientes
        </Badge>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={generateAllQueues}
            disabled={generatingQueue}
            className="border-green-500/50 text-green-400 hover:bg-green-500/10 h-7"
          >
            {generatingQueue ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Actualizar Cola
          </Button>
          
          {/* Progress bar during queue generation */}
          {generatingQueue && (
            <div className="flex items-center gap-2 min-w-[200px]">
              <Progress value={queueProgress} className="h-2 flex-1" />
              <span className="text-xs text-slate-400 whitespace-nowrap">{queueProgressText}</span>
            </div>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandedStages(["all", 1, 2, 3, 4, 5])}
            className="text-xs text-slate-400 hover:text-white h-7"
          >
            <ChevronDown className="w-3 h-3 mr-1" />
            Expandir
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandedStages([])}
            className="text-xs text-slate-400 hover:text-white h-7"
          >
            <ChevronRight className="w-3 h-3 mr-1" />
            Colapsar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadRules}
            className="border-[#333] h-7"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Rules by Stage */}
      <div className="space-y-3">
        {STAGE_GROUPS.map((stageGroup) => {
          const stageRules = rules.filter(r => stageGroup.rules.includes(r.id));
          const stagePendingCount = stageGroup.rules.reduce((sum, ruleId) => sum + (rulePendingCounts[ruleId] || 0), 0);
          const isStageExpanded = expandedStages.includes(stageGroup.stage);
          
          if (stagePendingCount === 0) return null;
          
          const toggleStage = () => {
            setExpandedStages(prev => 
              prev.includes(stageGroup.stage) 
                ? prev.filter(s => s !== stageGroup.stage)
                : [...prev, stageGroup.stage]
            );
          };
          
          return (
            <div key={stageGroup.stage} className="border border-[#222] rounded-lg overflow-hidden">
              {/* Stage Header */}
              <button
                onClick={toggleStage}
                className={`w-full px-4 py-3 ${stageGroup.headerClass} border-b border-[#222] hover:bg-[#1a1a1a] transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isStageExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="text-left">
                      <h3 className={`text-sm font-semibold ${stageGroup.titleClass}`}>
                        {stageGroup.title}
                      </h3>
                      <p className="text-xs text-slate-500">{stageGroup.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400">
                    {stagePendingCount} pendientes
                  </Badge>
                </div>
              </button>
              
              {/* Rules within Stage */}
              {isStageExpanded && (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  onValueChange={handleAccordionChange}
                >
                  {stageRules.map((rule) => {
                    const pendingCount = rulePendingCounts[rule.id] || 0;
                    if (pendingCount === 0) return null;
                    
                    return (
                      <AccordionItem
                        key={rule.id}
                        value={rule.id}
                        className="border-b border-[#222] last:border-0"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[#0a0a0a]">
                          <div className="flex items-center gap-3 flex-1">
                            {RULE_ICONS[rule.id]}
                            <span className="text-white font-medium text-sm">{rule.id}</span>
                            <span className="text-slate-400 text-sm truncate">{rule.name}</span>
                            <Badge className="bg-slate-700 ml-auto mr-2">
                              {pendingCount}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {/* Grouped contacts */}
                          {rulePendingGrouped[rule.id]?.groups?.length > 0 ? (
                            <div className="space-y-2">
                              {rulePendingGrouped[rule.id].groups.map((grp) => (
                                <Collapsible
                                  key={grp.group_id}
                                  open={expandedGroup === `${rule.id}-${grp.group_id}`}
                                  onOpenChange={(open) => {
                                    setExpandedGroup(open ? `${rule.id}-${grp.group_id}` : null);
                                    setExpandedSubgroup(null);
                                  }}
                                >
                                  <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center gap-3 p-2 rounded bg-[#111] hover:bg-[#1a1a1a]">
                                      {expandedGroup === `${rule.id}-${grp.group_id}` ? (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                      )}
                                      <div className="flex-1 text-left">
                                        <p className="text-sm text-white">{grp.group_name}</p>
                                      </div>
                                      <Badge className="bg-slate-700">{grp.count}</Badge>
                                    </div>
                                  </CollapsibleTrigger>
                                  
                                  <CollapsibleContent>
                                    <div className="mt-2 ml-4 space-y-2">
                                      {/* Subgroups or direct contacts */}
                                      {rulePendingGrouped[rule.id].has_subgroups && grp.subgroups ? (
                                        grp.subgroups.map((subgrp) => (
                                          <Collapsible
                                            key={subgrp.subgroup_id}
                                            open={expandedSubgroup === `${rule.id}-${grp.group_id}-${subgrp.subgroup_id}`}
                                            onOpenChange={(open) => {
                                              setExpandedSubgroup(open ? `${rule.id}-${grp.group_id}-${subgrp.subgroup_id}` : null);
                                            }}
                                          >
                                            <CollapsibleTrigger className="w-full">
                                              <div className="flex items-center gap-3 p-2 rounded bg-[#1a1a1a] hover:bg-[#222]">
                                                {expandedSubgroup === `${rule.id}-${grp.group_id}-${subgrp.subgroup_id}` ? (
                                                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                                ) : (
                                                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                                )}
                                                <span className="text-sm text-slate-300 text-left flex-1">{subgrp.subgroup_name}</span>
                                                <Badge className="bg-slate-600 shrink-0">{subgrp.count}</Badge>
                                              </div>
                                            </CollapsibleTrigger>
                                            
                                            <CollapsibleContent>
                                              {(() => {
                                                const subgroupKey = `${rule.id}-${grp.group_id}-${subgrp.subgroup_id}`;
                                                const paginatedContacts = getPaginatedContacts(subgroupKey, subgrp.emails);
                                                const totalPages = getTotalPages(subgroupKey, subgrp.emails);
                                                const currentPage = getCurrentPage(subgroupKey);
                                                const pageSize = getPageSize(subgroupKey);
                                                
                                                return (
                                                  <div className="mt-2 ml-4 space-y-1">
                                                    {/* WARNING: More than 5 contacts */}
                                                    {pageSize > 5 && (
                                                      <div className="bg-yellow-500 text-black px-3 py-2 rounded-lg flex items-center gap-2 animate-pulse mb-2">
                                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                                        <div>
                                                          <p className="font-bold text-xs uppercase">ADVERTENCIA: RIESGO DE SPAM</p>
                                                          <p className="text-[10px] font-medium">Para reducir riesgos genera 5 mensajes máximo al mismo tiempo</p>
                                                        </div>
                                                      </div>
                                                    )}
                                                    
                                                    {/* Pagination Controls */}
                                                    {subgrp.emails.length > DEFAULT_PAGE_SIZE && (
                                                      <div className="flex items-center justify-between py-2 border-b border-[#222]">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-slate-400 text-xs">Mostrar:</span>
                                                          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(subgroupKey, parseInt(v))}>
                                                            <SelectTrigger className="w-[60px] h-6 bg-[#0a0a0a] border-[#333] text-xs">
                                                              <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                              {PAGE_SIZE_OPTIONS.map(size => (
                                                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                                                              ))}
                                                            </SelectContent>
                                                          </Select>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-slate-500 text-xs">Pág {currentPage}/{totalPages}</span>
                                                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(subgroupKey, currentPage - 1)} disabled={currentPage <= 1} className="h-6 w-6 p-0 border-[#333]">‹</Button>
                                                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(subgroupKey, currentPage + 1)} disabled={currentPage >= totalPages} className="h-6 w-6 p-0 border-[#333]">›</Button>
                                                        </div>
                                                      </div>
                                                    )}
                                                    
                                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                                      {paginatedContacts.map((contact) => (
                                                        <ContactItem
                                                          key={contact.id}
                                                          contact={contact}
                                                          expandedContact={expandedContact}
                                                          setExpandedContact={setExpandedContact}
                                                          onEdit={handleEditContact}
                                                          onSnooze={handleSnoozeContact}
                                                          ruleId={rule.id}
                                                        />
                                                      ))}
                                                    </div>
                                                    
                                                    <Button
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openSendDialog(rule, paginatedContacts, grp.group_id, subgrp.subgroup_id, grp);
                                                      }}
                                                      className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                                    >
                                                      <MessageSquare className="w-3 h-3 mr-1" />
                                                      Generar Mensaje ({paginatedContacts.filter(c => c.contact_phone).length})
                                                    </Button>
                                                  </div>
                                                );
                                              })()}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        (() => {
                                          const groupKey = `${rule.id}-${grp.group_id}`;
                                          const paginatedContacts = getPaginatedContacts(groupKey, grp.emails);
                                          const totalPages = getTotalPages(groupKey, grp.emails);
                                          const currentPage = getCurrentPage(groupKey);
                                          const pageSize = getPageSize(groupKey);
                                          
                                          return (
                                            <div className="space-y-1">
                                              {/* WARNING: More than 5 contacts */}
                                              {pageSize > 5 && (
                                                <div className="bg-yellow-500 text-black px-3 py-2 rounded-lg flex items-center gap-2 animate-pulse mb-2">
                                                  <AlertTriangle className="w-5 h-5 shrink-0" />
                                                  <div>
                                                    <p className="font-bold text-xs uppercase">ADVERTENCIA: RIESGO DE SPAM</p>
                                                    <p className="text-[10px] font-medium">Para reducir riesgos genera 5 mensajes máximo al mismo tiempo</p>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {/* Pagination Controls */}
                                              {grp.emails.length > DEFAULT_PAGE_SIZE && (
                                                <div className="flex items-center justify-between py-2 border-b border-[#222]">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 text-xs">Mostrar:</span>
                                                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(groupKey, parseInt(v))}>
                                                      <SelectTrigger className="w-[60px] h-6 bg-[#0a0a0a] border-[#333] text-xs">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {PAGE_SIZE_OPTIONS.map(size => (
                                                          <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-slate-500 text-xs">Pág {currentPage}/{totalPages}</span>
                                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(groupKey, currentPage - 1)} disabled={currentPage <= 1} className="h-6 w-6 p-0 border-[#333]">‹</Button>
                                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(groupKey, currentPage + 1)} disabled={currentPage >= totalPages} className="h-6 w-6 p-0 border-[#333]">›</Button>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              <div className="max-h-60 overflow-y-auto space-y-1">
                                                {paginatedContacts.map((contact) => (
                                                  <ContactItem
                                                    key={contact.id}
                                                    contact={contact}
                                                    expandedContact={expandedContact}
                                                    setExpandedContact={setExpandedContact}
                                                    onEdit={handleEditContact}
                                                    onSnooze={handleSnoozeContact}
                                                    ruleId={rule.id}
                                                  />
                                                ))}
                                              </div>
                                              
                                              <Button
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openSendDialog(rule, paginatedContacts, grp.group_id, null, grp);
                                                }}
                                                className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                              >
                                                <MessageSquare className="w-3 h-3 mr-1" />
                                                Generar Mensaje ({paginatedContacts.filter(c => c.contact_phone).length})
                                              </Button>
                                            </div>
                                          );
                                        })()
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-4 text-slate-500 text-sm">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Cargando...
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          );
        })}
      </div>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => {
        setSendDialogOpen(open);
        if (!open) setSendDialogData(null);
      }}>
        <DialogContent className="bg-[#111] border-[#333] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              {sendDialogData?.rule?.id} - {sendDialogData?.rule?.name}
            </DialogTitle>
            {sendDialogData && (
              <div className="space-y-1">
                <p className="text-sm text-slate-400">
                  {sendDialogData.subgroupKey || sendDialogData.groupKey}
                </p>
                {sendDialogData.allContacts?.length !== sendDialogData.contacts?.length && (
                  <p className="text-xs text-orange-400">
                    {sendDialogData.allContacts?.length - sendDialogData.contacts?.length} contactos sin telefono (excluidos)
                  </p>
                )}
              </div>
            )}
          </DialogHeader>
          
          {sendDialogData && (
            <div className="space-y-4">
              {/* Recipients */}
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-green-400" />
                  Destinatarios ({sendDialogData.contacts?.length})
                </Label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {sendDialogData.contacts?.slice(0, 8).map((contact, idx) => (
                    <Badge key={idx} className="bg-[#222] text-slate-300 text-xs">
                      {contact.contact_name}
                    </Badge>
                  ))}
                  {sendDialogData.contacts?.length > 8 && (
                    <Badge className="bg-slate-700 text-slate-400 text-xs">
                      +{sendDialogData.contacts.length - 8} mas
                    </Badge>
                  )}
                </div>
              </div>

              {/* Variables */}
              <div className="space-y-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <p className="text-xs text-slate-400">Insertar variable:</p>
                <div className="flex flex-wrap gap-2">
                  {getVariablesForRule(sendDialogData.rule?.id).map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => insertVariable(v.key)}
                      className="h-7 px-2 border-[#444] text-xs"
                    >
                      {v.icon} {v.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label className="text-sm">Mensaje</Label>
                <Textarea
                  ref={messageRef}
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333] text-sm"
                  rows={6}
                />
              </div>

              {/* Preview */}
              {showPreview && previewContact && (
                <div className="border border-green-500/30 rounded-lg overflow-hidden">
                  <div className="bg-green-500/10 px-4 py-2 border-b border-green-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-400">Vista Previa</span>
                      <select
                        value={previewContact?.contact_id || ""}
                        onChange={(e) => {
                          const contact = sendDialogData.contacts.find(c => c.contact_id === e.target.value);
                          if (contact) setPreviewContact(contact);
                        }}
                        className="bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-slate-300"
                      >
                        {sendDialogData.contacts?.map((c) => (
                          <option key={c.contact_id} value={c.contact_id}>
                            {c.contact_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="bg-[#0a0a0a] p-4">
                    <div className="bg-green-600 text-white p-3 rounded-lg max-w-[80%] ml-auto">
                      <p className="text-sm whitespace-pre-wrap">{getPreviewContent()}</p>
                    </div>
                    <p className="text-xs text-slate-500 text-right mt-1">
                      Para: {previewContact.contact_phone}
                    </p>
                  </div>
                </div>
              )}

              {/* Gemini Variation Toggle */}
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Variar mensajes con IA</p>
                      <p className="text-xs text-slate-500">Cada mensaje será ligeramente diferente para evitar spam</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {useGeminiVariation && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateGeminiPreview}
                        disabled={previewLoading || !sendMessage}
                        className="h-7 border-purple-500/50 text-purple-400 hover:bg-purple-500/10 text-xs"
                      >
                        {previewLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Eye className="w-3 h-3 mr-1" />
                        )}
                        Previsualizar IA
                      </Button>
                    )}
                    <Switch
                      checked={useGeminiVariation}
                      onCheckedChange={(checked) => {
                        setUseGeminiVariation(checked);
                        if (!checked) {
                          setShowGeminiPreview(false);
                          setGeminiPreviews([]);
                        }
                      }}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                </div>
                
                {/* Gemini Preview Results */}
                {showGeminiPreview && geminiPreviews.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-purple-400 font-medium">Ejemplos de variaciones:</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowGeminiPreview(false)}
                        className="h-5 w-5 p-0 text-slate-500 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {geminiPreviews.map((preview, idx) => (
                      <div key={idx} className="p-3 bg-[#111] rounded-lg border border-purple-500/20">
                        <p className="text-xs text-slate-500 mb-1">Para: {preview.contact_name}</p>
                        <div className="space-y-2">
                          <div className="p-2 bg-[#1a1a1a] rounded text-xs text-slate-400 line-through opacity-60">
                            <span className="text-slate-600 text-[10px] block mb-1">Original:</span>
                            {preview.original_message}
                          </div>
                          <div className="p-2 bg-purple-500/10 rounded text-xs text-white border border-purple-500/30">
                            <span className="text-purple-400 text-[10px] block mb-1">Variado con IA:</span>
                            {preview.varied_message}
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-500 text-center">
                      Nota: Cada vez que se generen las URLs, se crearán variaciones nuevas y únicas
                    </p>
                  </div>
                )}
                
                {/* Preview Loading */}
                {previewLoading && (
                  <div className="mt-3 flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400 mr-2" />
                    <span className="text-xs text-slate-400">Generando previsualizaciones...</span>
                  </div>
                )}
                
                {/* Progress bar during Gemini generation */}
                {geminiProgress.active && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-purple-400">Generando mensajes variados...</span>
                      <span className="text-slate-400">{geminiProgress.current}/{geminiProgress.total}</span>
                    </div>
                    <Progress 
                      value={(geminiProgress.current / geminiProgress.total) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSendDialogOpen(false)} 
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowPreview(!showPreview)} 
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              {showPreview ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Ocultar Preview
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Vista Previa
                </>
              )}
            </Button>
            <Button 
              onClick={generateUrls} 
              disabled={sendingUrls || !sendMessage || sendDialogData?.contacts?.length === 0}
              className={useGeminiVariation ? "bg-purple-600 hover:bg-purple-700" : "bg-green-600 hover:bg-green-700"}
            >
              {sendingUrls ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {useGeminiVariation && geminiProgress.active ? (
                    `Generando ${geminiProgress.current}/${geminiProgress.total}...`
                  ) : (
                    "Generando..."
                  )}
                </>
              ) : (
                <>
                  {useGeminiVariation ? (
                    <Sparkles className="w-4 h-4 mr-2" />
                  ) : (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  )}
                  Generar {sendDialogData?.contacts?.length || 0} URLs {useGeminiVariation && "(IA)"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URLs Modal */}
      <Dialog open={urlsModalOpen} onOpenChange={setUrlsModalOpen}>
        <DialogContent className="bg-[#111] border-[#333] max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              URLs Generadas ({generatedUrls.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={copyAllUrls}
                className="border-[#333]"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar todas
              </Button>
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {generatedUrls.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{item.contact_name}</p>
                    <p className="text-xs text-slate-500">{item.phone}</p>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Abrir WhatsApp
                  </a>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setUrlsModalOpen(false)} className="bg-slate-700 hover:bg-slate-600">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Sheet */}
      <ContactSheet
        contact={editingContact}
        open={editContactOpen}
        onOpenChange={(open) => {
          setEditContactOpen(open);
          if (!open) setEditingContact(null);
        }}
        onUpdate={handleContactUpdate}
      />
    </div>
  );
}
