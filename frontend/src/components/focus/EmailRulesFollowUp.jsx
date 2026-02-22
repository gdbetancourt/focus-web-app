/**
 * EmailRulesFollowUp - Email rules management for Focus/Follow-up section
 * Shows emails pending for today, grouped by Stage > Rule > Webinar > Buyer Persona
 * Includes send functionality with traffic light status updates
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import ContactSheet from "../ContactSheet";
import { createSafeHTML } from "../../lib/sanitize";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Progress } from "../ui/progress";
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
  Mail,
  Send,
  Calendar,
  Target,
  Users,
  Star,
  MessageSquare,
  Check,
  Clock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  User,
  X,
  Phone,
  Edit,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// Pagination constants
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 5;

// Rule type icons
const RULE_ICONS = {
  "E01": <Calendar className="w-4 h-4 text-blue-400" />,
  "E02": <Target className="w-4 h-4 text-green-400" />,
  "E03": <Users className="w-4 h-4 text-purple-400" />,
  "E04": <Star className="w-4 h-4 text-yellow-400" />,
  "E05": <MessageSquare className="w-4 h-4 text-pink-400" />,
  "E06": <Check className="w-4 h-4 text-teal-400" />,
  "E07": <Clock className="w-4 h-4 text-red-400" />,
  "E08": <Clock className="w-4 h-4 text-orange-400" />,
  "E09": <Clock className="w-4 h-4 text-amber-400" />,
  "E10": <Clock className="w-4 h-4 text-lime-400" />,
};

// Group rules by Stage
const RULE_GROUPS = [
  {
    stage: 1,
    title: "Stage 1 - Prospeccion",
    description: "Prospeccion activa (vacio por ahora)",
    rules: [],
    headerClass: "bg-gradient-to-r from-cyan-500/10 to-transparent",
    titleClass: "text-cyan-400"
  },
  {
    stage: 2,
    title: "Stage 2 - Nurturing",
    description: "Invitaciones a webinars (E06-E10 son automáticos, ver Settings)",
    rules: ["E01"],
    headerClass: "bg-gradient-to-r from-blue-500/10 to-transparent",
    titleClass: "text-blue-400"
  },
  {
    stage: 3,
    title: "Stage 3 - Close",
    description: "Seguimiento de cotizaciones",
    rules: ["E02"],
    headerClass: "bg-gradient-to-r from-green-500/10 to-transparent",
    titleClass: "text-green-400"
  },
  {
    stage: 4,
    title: "Stage 4 - Delivery",
    description: "Recordatorios de sesiones",
    rules: ["E03"],
    headerClass: "bg-gradient-to-r from-purple-500/10 to-transparent",
    titleClass: "text-purple-400"
  },
  {
    stage: 5,
    title: "Stage 5 - Repurchase",
    description: "Recompra y check-in",
    rules: ["E04", "E05"],
    headerClass: "bg-gradient-to-r from-yellow-500/10 to-transparent",
    titleClass: "text-yellow-400"
  }
];

// Template variables
// Rules that appear in Email Follow-up (E06-E10 are now automatic, managed in Settings)
const MANUAL_EMAIL_RULES = ["E01", "E02", "E03", "E04", "E05"];
// E06-E10 are automatic webinar emails - not shown here
const WEBINAR_RULES = ["E01"]; // Only E01 (invitation) is manual

const CONTACT_VARIABLES = [
  { key: "contact_name", label: "Nombre", icon: "👤" },
  { key: "company", label: "Empresa", icon: "🏢" },
];

const WEBINAR_VARIABLES = [
  { key: "webinar_name", label: "Webinar", icon: "📅" },
  { key: "webinar_date", label: "Fecha", icon: "📆" },
  { key: "webinar_time", label: "Hora", icon: "🕐" },
  { key: "webinar_link", label: "Link", icon: "🔗" },
];

// Email item component
const EmailItem = ({ email, expandedEmail, setExpandedEmail, onEdit }) => {
  const isExpanded = expandedEmail === email.id;
  
  return (
    <div 
      className={`p-2 rounded cursor-pointer transition-colors ${
        isExpanded ? "bg-[#1a1a1a]" : "bg-[#111] hover:bg-[#1a1a1a]"
      }`}
      onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-sm text-white truncate">{email.contact_name}</span>
          <span className="text-xs text-slate-500 truncate hidden sm:inline">
            {email.contact_email}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(email);
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
        <div className="mt-2 pt-2 border-t border-[#333] space-y-2">
          <p className="text-xs text-slate-400">
            <span className="text-slate-500">Email:</span> {email.contact_email}
          </p>
          {email.scheduled_at && (
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Programado:</span>{" "}
              {new Date(email.scheduled_at).toLocaleString("es-MX")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default function EmailRulesFollowUp({ onStatusChange }) {
  // Rules state
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pending emails state
  const [rulePendingGrouped, setRulePendingGrouped] = useState({});
  const [rulePendingCounts, setRulePendingCounts] = useState({});
  
  // UI state
  const [expandedStages, setExpandedStages] = useState([2, 3, 4, 5]);
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedSubgroup, setExpandedSubgroup] = useState(null);
  
  // Send dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogData, setSendDialogData] = useState(null);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [senderName, setSenderName] = useState("María Gargari");
  const [sendingToSubgroup, setSendingToSubgroup] = useState(false);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContact, setPreviewContact] = useState(null);
  
  // Diagnosis search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  
  // Queue generation state
  const [generatingQueue, setGeneratingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState(0);
  const [queueProgressText, setQueueProgressText] = useState("");
  
  // Edit contact state
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  // Pagination state
  const [groupPages, setGroupPages] = useState({});
  const [groupPageSizes, setGroupPageSizes] = useState({});
  
  // Variable insertion
  const [sendActiveField, setSendActiveField] = useState("body");
  const sendSubjectRef = useRef(null);
  const sendBodyRef = useRef(null);

  // Handle edit contact
  const handleEditContact = async (email) => {
    try {
      // Fetch full contact data
      const res = await api.get(`/contacts/${email.contact_id || email.id}`);
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

  // Generate/refresh email queues with progress
  const generateEmailQueue = async () => {
    setGeneratingQueue(true);
    setQueueProgress(0);
    setQueueProgressText("Iniciando generación...");
    
    try {
      // Start the background job
      setQueueProgressText("Generando emails...");
      const startRes = await api.post("/email-rules/generate-all");
      
      if (!startRes.data.success) {
        if (startRes.data.status === "already_running") {
          toast.info("Ya hay una generación en progreso");
        } else {
          toast.error(startRes.data.error || "Error al iniciar generación");
        }
        return;
      }
      
      const jobId = startRes.data.job_id;
      
      // Poll for progress
      let completed = false;
      while (!completed) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const statusRes = await api.get(`/email-rules/generation-status?job_id=${jobId}`);
          const job = statusRes.data;
          
          if (job.status === "completed" || job.status === "failed") {
            completed = true;
            setQueueProgress(100);
            setQueueProgressText("Completado");
            
            if (job.status === "completed") {
              toast.success(`${job.total_queued || 0} emails agregados a la cola`);
            } else {
              toast.error(job.error || "Error en generación");
            }
          } else {
            // Update progress
            const progressPct = job.total_rules > 0 
              ? Math.round((job.current_rule_index / job.total_rules) * 100)
              : 0;
            setQueueProgress(progressPct);
            setQueueProgressText(job.status_message || `Procesando ${job.current_rule || ""}...`);
          }
        } catch (pollError) {
          console.error("Error polling status:", pollError);
        }
      }
      
      // Reload data
      await loadRules();
      
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      console.error("Error generating email queue:", error);
      toast.error("Error actualizando cola de emails");
    } finally {
      setGeneratingQueue(false);
      setTimeout(() => {
        setQueueProgress(0);
        setQueueProgressText("");
      }, 1500);
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

  // Generate preview with variables replaced
  const getPreviewContent = useCallback(() => {
    if (!previewContact || !sendDialogData) return { subject: "", body: "" };
    
    // Get metadata from the email object (previewContact is actually an email from the queue)
    const metadata = previewContact.metadata || {};
    const groupData = sendDialogData.groupData || {};
    
    // Extract first name only
    const fullName = previewContact.contact_name || "";
    const firstName = fullName.split(" ")[0];
    
    const variables = {
      contact_name: firstName,
      company: metadata.company || previewContact.company || "",
      // Use metadata first, then group data, then fallback
      webinar_name: metadata.webinar_name || groupData.group_name || sendDialogData.groupKey || "",
      webinar_date: metadata.webinar_date || groupData.group_date || "",
      webinar_time: metadata.webinar_time || groupData.group_time || "",
      webinar_link: metadata.webinar_link || groupData.group_link || "",
    };
    
    let previewSubject = sendSubject;
    let previewBody = sendBody;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      previewSubject = previewSubject.replace(regex, value || `[${key}]`);
      previewBody = previewBody.replace(regex, value || `[${key}]`);
    }
    
    return { subject: previewSubject, body: previewBody };
  }, [previewContact, sendDialogData, sendSubject, sendBody]);

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await api.get("/email-rules/");
      const rulesList = res.data.rules || [];
      setRules(rulesList);
      
      // Load pending counts for all rules
      await loadAllPendingCounts();
    } catch (error) {
      console.error("Error loading rules:", error);
      toast.error("Error cargando reglas");
    } finally {
      setLoading(false);
    }
  };

  const loadAllPendingCounts = async () => {
    try {
      // Load rules - exclude E06-E10 which are now automatic
      const ruleIds = ["E01", "E02", "E03", "E04", "E05"];
      // E06-E10 are automatic webinar emails managed in Settings
      const counts = {};
      
      await Promise.all(
        ruleIds.map(async (ruleId) => {
          try {
            const res = await api.get(`/email-rules/rule/${ruleId}/pending?page_size=1`);
            counts[ruleId] = res.data.total_count || 0;
          } catch (error) {
            counts[ruleId] = 0;
          }
        })
      );
      
      setRulePendingCounts(counts);
    } catch (error) {
      console.error("Error loading pending counts:", error);
    }
  };

  const loadPendingGrouped = useCallback(async (ruleId) => {
    try {
      const res = await api.get(`/email-rules/rule/${ruleId}/pending-grouped`);
      setRulePendingGrouped(prev => ({
        ...prev,
        [ruleId]: res.data
      }));
    } catch (error) {
      console.error(`Error loading pending for ${ruleId}:`, error);
    }
  }, []);

  // Load pending grouped when accordion opens
  const handleAccordionChange = useCallback((value) => {
    if (value && !rulePendingGrouped[value]) {
      loadPendingGrouped(value);
    }
  }, [rulePendingGrouped, loadPendingGrouped]);

  // Search contacts for diagnosis
  const handleSearchContacts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await api.get(`/mensajes-hoy/email/search-contacts?q=${encodeURIComponent(query)}`);
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
      const res = await api.get(`/mensajes-hoy/email/diagnose/${contact.id}`);
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
    setSendDialogData({ rule, contacts, groupKey, subgroupKey, groupData });
    setSendSubject(rule.template_subject || "");
    setSendBody(rule.template_body || "");
    setSenderName("María Gargari");
    setPreviewContact(contacts[0] || null); // Select first contact for preview
    setShowPreview(false);
    setSendDialogOpen(true);
  };

  // Insert variable
  const insertSendVariable = (variableKey) => {
    const variable = `{${variableKey}}`;
    const targetRef = sendActiveField === "subject" ? sendSubjectRef : sendBodyRef;
    const setter = sendActiveField === "subject" ? setSendSubject : setSendBody;
    const currentValue = sendActiveField === "subject" ? sendSubject : sendBody;
    
    if (targetRef.current) {
      const input = targetRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      setter(newValue);
      
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + variable.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      setter(currentValue + variable);
    }
    
    toast.success(`Variable {${variableKey}} insertada`);
  };

  // Send to subgroup
  const sendToSubgroup = async () => {
    if (!sendDialogData) return;
    
    setSendingToSubgroup(true);
    try {
      const { rule, contacts, groupKey, subgroupKey } = sendDialogData;
      
      const response = await api.post("/email-rules/send-to-subgroup", {
        rule_id: rule.id,
        group_key: groupKey,
        subgroup_key: subgroupKey,
        contact_ids: contacts.map(c => c.contact_id),
        subject: sendSubject,
        body_html: sendBody,
        sender_name: senderName
      });
      
      toast.success(`${response.data.sent_count} emails enviados correctamente`);
      
      // Close dialog and refresh
      setSendDialogOpen(false);
      setSendDialogData(null);
      
      // Reload pending emails
      loadPendingGrouped(rule.id);
      loadAllPendingCounts();
      
      // Notify parent to update traffic light
      if (onStatusChange) {
        onStatusChange();
      }
      
    } catch (error) {
      console.error("Error sending to subgroup:", error);
      toast.error(error.response?.data?.detail || "Error enviando emails");
    } finally {
      setSendingToSubgroup(false);
    }
  };

  // Calculate total pending
  const totalPending = Object.values(rulePendingCounts).reduce((sum, count) => sum + count, 0);

  // Diagnosis search UI component
  const DiagnosisSearchCard = () => (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Search className="w-4 h-4 text-yellow-400" />
          Buscar contacto para diagnóstico Email
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
                data-testid="email-diagnosis-search-input"
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
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{contact.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {contact.email || contact.phone || 'Sin contacto'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        Stage {contact.stage || '?'}
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
            <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-4" data-testid="email-diagnosis-panel">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-white font-medium">{selectedDiagnosis.contact?.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                    {selectedDiagnosis.contact?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedDiagnosis.contact?.phone}
                      </span>
                    )}
                    {selectedDiagnosis.contact?.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedDiagnosis.contact?.email}
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
                {!selectedDiagnosis.contact?.email && (
                  <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                    Sin email
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
                    : `❌ Este contacto NO cumple ninguna regla de Email hoy`}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
        <p className="text-slate-400">Cargando emails pendientes...</p>
      </div>
    );
  }

  if (totalPending === 0) {
    return (
      <div className="space-y-4">
        <DiagnosisSearchCard />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">¡Todo al día!</h3>
          <p className="text-slate-400 text-sm max-w-md">
            No hay emails pendientes para hoy. Los nuevos emails aparecerán aquí
            según las reglas configuradas.
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
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="email-rules-followup">
      {/* Contact Diagnosis Search */}
      <DiagnosisSearchCard />

      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            {totalPending} emails pendientes
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={generateEmailQueue}
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
            onClick={() => setExpandedStages([2, 3, 4, 5])}
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
        {RULE_GROUPS.map((group) => {
          const groupRules = rules.filter(r => group.rules.includes(r.id));
          const groupPendingCount = group.rules.reduce((sum, ruleId) => sum + (rulePendingCounts[ruleId] || 0), 0);
          const isStageExpanded = expandedStages.includes(group.stage);
          
          if (groupPendingCount === 0) return null;
          
          const toggleStage = () => {
            setExpandedStages(prev => 
              prev.includes(group.stage) 
                ? prev.filter(s => s !== group.stage)
                : [...prev, group.stage]
            );
          };
          
          return (
            <div key={group.stage} className="border border-[#222] rounded-lg overflow-hidden">
              {/* Stage Header */}
              <button
                onClick={toggleStage}
                className={`w-full px-4 py-3 ${group.headerClass} border-b border-[#222] hover:bg-[#1a1a1a] transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isStageExpanded ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                    <div className="text-left">
                      <h3 className={`text-sm font-semibold ${group.titleClass}`}>
                        {group.title}
                      </h3>
                      <p className="text-xs text-slate-500">{group.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-400">
                    {groupPendingCount} pendientes
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
                  {groupRules.map((rule) => {
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
                          {/* Pending emails grouped */}
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
                                        {grp.description && (
                                          <p className="text-xs text-slate-500">{grp.description}</p>
                                        )}
                                      </div>
                                      <Badge className="bg-slate-700">{grp.count}</Badge>
                                    </div>
                                  </CollapsibleTrigger>
                                  
                                  <CollapsibleContent>
                                    <div className="mt-2 ml-4 space-y-2">
                                      {/* Subgroups (buyer persona within webinar) */}
                                      {rulePendingGrouped[rule.id].has_subgroups && grp.subgroups ? (
                                        grp.subgroups.map((subgrp) => (
                                          <Collapsible
                                            key={subgrp.subgroup_id}
                                            open={expandedSubgroup === `${rule.id}-${grp.group_id}-${subgrp.subgroup_id}`}
                                            onOpenChange={(open) => {
                                              setExpandedSubgroup(open ? `${rule.id}-${grp.group_id}-${subgrp.subgroup_id}` : null);
                                              setExpandedEmail(null);
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
                                                const paginatedEmails = getPaginatedContacts(subgroupKey, subgrp.emails);
                                                const totalPages = getTotalPages(subgroupKey, subgrp.emails);
                                                const currentPage = getCurrentPage(subgroupKey);
                                                const pageSize = getPageSize(subgroupKey);
                                                
                                                return (
                                                  <div className="mt-2 ml-4 space-y-1">
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
                                                    
                                                    {/* Email list */}
                                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                                      {paginatedEmails.map((email) => (
                                                        <EmailItem
                                                          key={email.id}
                                                          email={email}
                                                          expandedEmail={expandedEmail}
                                                          setExpandedEmail={setExpandedEmail}
                                                          onEdit={handleEditContact}
                                                        />
                                                      ))}
                                                    </div>
                                                    
                                                    {/* Send button for subgroup */}
                                                    <Button
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openSendDialog(rule, paginatedEmails, grp.group_id, subgrp.subgroup_id, grp);
                                                      }}
                                                      className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                                    >
                                                      <Send className="w-3 h-3 mr-1" />
                                                      Generar Correo ({paginatedEmails.length})
                                                    </Button>
                                                  </div>
                                                );
                                              })()}
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        /* Direct emails (no subgroups) */
                                        (() => {
                                          const groupKey = `${rule.id}-${grp.group_id}`;
                                          const paginatedEmails = getPaginatedContacts(groupKey, grp.emails);
                                          const totalPages = getTotalPages(groupKey, grp.emails);
                                          const currentPage = getCurrentPage(groupKey);
                                          const pageSize = getPageSize(groupKey);
                                          
                                          return (
                                            <div className="space-y-1">
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
                                                {paginatedEmails.map((email) => (
                                                  <EmailItem
                                                    key={email.id}
                                                    email={email}
                                                    expandedEmail={expandedEmail}
                                                    setExpandedEmail={setExpandedEmail}
                                                    onEdit={handleEditContact}
                                                  />
                                                ))}
                                              </div>
                                              
                                              {/* Send button for group */}
                                              <Button
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openSendDialog(rule, paginatedEmails, grp.group_id, null, grp);
                                                }}
                                                className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                              >
                                                <Send className="w-3 h-3 mr-1" />
                                                Generar Correo ({paginatedEmails.length})
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
              <Send className="w-5 h-5 text-green-400" />
              Enviar {sendDialogData?.rule?.id} - {sendDialogData?.rule?.name}
            </DialogTitle>
            {sendDialogData && (
              <p className="text-sm text-slate-400">
                {sendDialogData.subgroupKey || sendDialogData.groupKey} • {sendDialogData.contacts?.length || 0} contactos
              </p>
            )}
          </DialogHeader>
          
          {sendDialogData && (
            <div className="space-y-4">
              {/* Recipients */}
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Destinatarios ({sendDialogData.contacts?.length})
                </Label>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {sendDialogData.contacts?.slice(0, 8).map((contact, idx) => (
                    <Badge key={idx} className="bg-[#222] text-slate-300 text-xs">
                      {contact.contact_name || contact.contact_email}
                    </Badge>
                  ))}
                  {sendDialogData.contacts?.length > 8 && (
                    <Badge className="bg-slate-700 text-slate-400 text-xs">
                      +{sendDialogData.contacts.length - 8} más
                    </Badge>
                  )}
                </div>
              </div>

              {/* Sender Name */}
              <div className="space-y-2">
                <Label className="text-sm">Nombre del Remitente</Label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="bg-[#0a0a0a] border-[#333]"
                />
                <p className="text-xs text-slate-500">
                  Se enviará desde: {senderName} &lt;contact@leaderlix.com&gt;
                </p>
              </div>

              {/* Variables */}
              <div className="space-y-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Insertar en:</span>
                  <Badge className={sendActiveField === "subject" ? "bg-blue-500/20 text-blue-400" : "bg-slate-700"}>
                    {sendActiveField === "subject" ? "Asunto" : "Cuerpo"}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {CONTACT_VARIABLES.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => insertSendVariable(v.key)}
                      className="h-7 px-2 border-[#444] text-xs"
                    >
                      {v.icon} {v.label}
                    </Button>
                  ))}
                  {WEBINAR_RULES.includes(sendDialogData.rule?.id) && 
                    WEBINAR_VARIABLES.map((v) => (
                      <Button
                        key={v.key}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => insertSendVariable(v.key)}
                        className="h-7 px-2 border-[#444] text-xs"
                      >
                        {v.icon} {v.label}
                      </Button>
                    ))
                  }
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label className="text-sm">Asunto</Label>
                <Input
                  ref={sendSubjectRef}
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  onFocus={() => setSendActiveField("subject")}
                  className={`bg-[#0a0a0a] border-[#333] ${sendActiveField === "subject" ? "ring-1 ring-blue-500/50" : ""}`}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label className="text-sm">Cuerpo (HTML)</Label>
                <Textarea
                  ref={sendBodyRef}
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                  onFocus={() => setSendActiveField("body")}
                  className={`bg-[#0a0a0a] border-[#333] font-mono text-xs ${sendActiveField === "body" ? "ring-1 ring-blue-500/50" : ""}`}
                  rows={8}
                />
              </div>

              {/* Preview Section */}
              {showPreview && previewContact && (
                <div className="border border-blue-500/30 rounded-lg overflow-hidden">
                  {/* Preview Header */}
                  <div className="bg-blue-500/10 px-4 py-2 border-b border-blue-500/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-400">Vista Previa del Email</span>
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
                            {c.contact_name || c.contact_email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* Email Preview */}
                  <div className="bg-white text-black p-4">
                    {/* From */}
                    <div className="border-b border-gray-200 pb-3 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 w-12">De:</span>
                        <span className="font-medium">{senderName} &lt;contact@leaderlix.com&gt;</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span className="text-gray-500 w-12">Para:</span>
                        <span>{previewContact.contact_name} &lt;{previewContact.contact_email}&gt;</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span className="text-gray-500 w-12">Asunto:</span>
                        <span className="font-semibold">{getPreviewContent().subject}</span>
                      </div>
                    </div>
                    
                    {/* Body */}
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={createSafeHTML(getPreviewContent().body)}
                    />
                  </div>
                </div>
              )}
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
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
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
              onClick={sendToSubgroup} 
              disabled={sendingToSubgroup || !sendSubject || !sendBody}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingToSubgroup ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar a {sendDialogData?.contacts?.length || 0} contactos
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
