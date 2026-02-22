/**
 * EmailRulesSettings - Component for managing email rules (E1-E10)
 * Features: Contact diagnosis, rule stats, pending emails preview
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { createSafeHTML } from "../../lib/sanitize";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
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
import ContactSheet from "../ContactSheet";
import {
  Mail,
  Play,
  Clock,
  Users,
  Target,
  Calendar,
  Send,
  Loader2,
  Save,
  TestTube,
  MessageSquare,
  Check,
  XCircle,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Star,
  Eye,
  BarChart3,
  User,
  AlertTriangle,
  Edit
} from "lucide-react";
import { Progress } from "../ui/progress";

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
    description: "Invitaciones y recordatorios de webinars",
    rules: ["E01", "E06", "E07", "E08", "E09", "E10"],
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

// Template variables available for each rule type
const WEBINAR_RULES = ["E01", "E06", "E07", "E08", "E09", "E10"];

const CONTACT_VARIABLES = [
  { key: "contact_name", label: "Nombre", icon: "👤", description: "Nombre del contacto" },
  { key: "company", label: "Empresa", icon: "🏢", description: "Empresa del contacto" },
];

const WEBINAR_VARIABLES = [
  { key: "webinar_name", label: "Nombre Webinar", icon: "📅", description: "Nombre del webinar" },
  { key: "webinar_date", label: "Fecha", icon: "📆", description: "Fecha del webinar" },
  { key: "webinar_time", label: "Hora", icon: "🕐", description: "Hora del webinar" },
  { key: "webinar_link", label: "Link", icon: "🔗", description: "Link de acceso al webinar" },
];

// EmailItem component for displaying individual emails
function EmailItem({ email, expandedEmail, setExpandedEmail, hasError, setEditingContact }) {
  return (
    <Collapsible
      open={expandedEmail === email.id}
      onOpenChange={(open) => setExpandedEmail(open ? email.id : null)}
    >
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-2 p-2 bg-[#111] rounded hover:bg-[#1a1a1a] text-left">
          {expandedEmail === email.id ? (
            <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate">
              {email.contact_name || "Sin nombre"}
            </p>
            <p className="text-xs text-slate-500 truncate">{email.contact_email}</p>
          </div>
          
          {hasError && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setEditingContact({
                  id: email.contact_id,
                  name: email.contact_name,
                  email: email.contact_email
                });
              }}
              className="h-5 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 px-2"
            >
              <Edit className="w-3 h-3" />
            </Button>
          )}
          
          <p className="text-xs text-slate-400 flex-shrink-0">
            {new Date(email.scheduled_at).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short'
            })}
          </p>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 p-2 bg-[#0a0a0a] rounded border border-[#333] ml-5">
          <div className="mb-2">
            <p className="text-xs text-slate-500">Asunto:</p>
            <p className="text-xs text-white">{email.subject}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Contenido:</p>
            <div
              className="text-xs text-slate-300 prose prose-invert prose-xs max-w-none"
              dangerouslySetInnerHTML={createSafeHTML(email.body_html)}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function EmailRulesSettings() {
  // State
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState(null);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  
  // Search & Diagnosis state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  
  // Rule editing state
  const [editingRule, setEditingRule] = useState(null);
  const [savingRule, setSavingRule] = useState(false);
  
  // Rule stats & pending
  const [ruleStats, setRuleStats] = useState({});
  const [rulePending, setRulePending] = useState({});
  const [rulePendingGrouped, setRulePendingGrouped] = useState({});
  const [rulePendingCounts, setRulePendingCounts] = useState({});
  const [expandedEmail, setExpandedEmail] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedSubgroup, setExpandedSubgroup] = useState(null);
  const [expandedStages, setExpandedStages] = useState([2, 3, 4, 5]); // All stages expanded by default
  const [generatingRule, setGeneratingRule] = useState(null);
  
  // Contact editing
  const [editingContact, setEditingContact] = useState(null);
  
  // Test email state
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingRule, setTestingRule] = useState(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  
  // Send to subgroup dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogData, setSendDialogData] = useState(null); // { rule, contacts, groupKey, subgroupKey }
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");
  const [senderName, setSenderName] = useState("María Gargari");
  const [sendingToSubgroup, setSendingToSubgroup] = useState(false);
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewContact, setPreviewContact] = useState(null);
  
  // Refs for template editing
  const subjectInputRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const [activeField, setActiveField] = useState("body"); // "subject" or "body"

  // Function to insert variable at cursor position
  const insertVariable = (variableKey) => {
    const variable = `{${variableKey}}`;
    const targetRef = activeField === "subject" ? subjectInputRef : bodyTextareaRef;
    const fieldName = activeField === "subject" ? "template_subject" : "template_body";
    
    if (targetRef.current) {
      const input = targetRef.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = editingRule[fieldName] || "";
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      
      setEditingRule({ ...editingRule, [fieldName]: newValue });
      
      // Restore cursor position after React re-render
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + variable.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      // Fallback: append to end
      const currentValue = editingRule[fieldName] || "";
      setEditingRule({ ...editingRule, [fieldName]: currentValue + variable });
    }
    
    toast.success(`Variable {${variableKey}} insertada`);
  };

  // Open send dialog for a subgroup
  const openSendDialog = (rule, contacts, groupKey, subgroupKey = null, groupData = null) => {
    setSendDialogData({
      rule,
      contacts,
      groupKey,
      subgroupKey,
      groupData
    });
    setSendSubject(rule.template_subject || "");
    setSendBody(rule.template_body || "");
    setSenderName("María Gargari");
    setPreviewContact(contacts[0] || null);
    setShowPreview(false);
    setSendDialogOpen(true);
  };

  // Generate preview content with variables replaced
  const getPreviewContent = useCallback(() => {
    if (!previewContact || !sendDialogData) return { subject: "", body: "" };
    
    const metadata = previewContact.metadata || {};
    const groupData = sendDialogData.groupData || {};
    
    // Extract first name only
    const fullName = previewContact.contact_name || "";
    const firstName = fullName.split(" ")[0];
    
    const variables = {
      contact_name: firstName,
      company: metadata.company || previewContact.company || "",
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

  // Insert variable into send dialog fields
  const [sendActiveField, setSendActiveField] = useState("body");
  const sendSubjectRef = useRef(null);
  const sendBodyRef = useRef(null);

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

  // Send emails to subgroup
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
      
      // Close dialog and refresh data
      setSendDialogOpen(false);
      setSendDialogData(null);
      
      // Reload pending emails for this rule
      loadPendingGrouped(rule.id);
      loadAllPendingCounts();
      
    } catch (error) {
      console.error("Error sending to subgroup:", error);
      toast.error(error.response?.data?.detail || "Error enviando emails");
    } finally {
      setSendingToSubgroup(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadRules();
    loadQueueStatus();
    loadAutoSendStatus();
    checkGenerationStatus();
    loadAllPendingCounts();
    
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, []);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(() => {
      searchContacts(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // API calls
  const loadRules = async () => {
    try {
      const res = await api.get("/email-rules/");
      const rulesData = res.data.rules || res.data;
      setRules(rulesData);
    } catch (error) {
      toast.error("Error cargando reglas");
    } finally {
      setLoading(false);
    }
  };

  const loadAllPendingCounts = async () => {
    try {
      const ruleIds = ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09", "E10"];
      const counts = {};
      
      // Load counts in parallel
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

  const loadQueueStatus = async () => {
    try {
      const res = await api.get("/email-rules/queue/status");
      setQueueStatus(res.data);
    } catch (error) {
      console.error("Error loading queue status:", error);
    }
  };

  const loadAutoSendStatus = async () => {
    try {
      const res = await api.get("/email-rules/scheduler/status");
      setAutoSendEnabled(res.data.enabled);
    } catch (error) {
      console.error("Error loading auto-send status:", error);
    }
  };

  const checkGenerationStatus = async () => {
    try {
      const res = await api.get("/email-rules/generation-status");
      setGenerationStatus(res.data);
      if (res.data.status === "running") {
        setGeneratingEmails(true);
        startPolling();
      }
    } catch (error) {
      console.error("Error checking generation status:", error);
    }
  };

  const searchContacts = async (query) => {
    setSearching(true);
    try {
      const res = await api.get(`/email-rules/search-contacts?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data.contacts || []);
    } catch (error) {
      console.error("Error searching contacts:", error);
    } finally {
      setSearching(false);
    }
  };

  const diagnoseContact = async (contact) => {
    setSelectedContact(contact);
    setDiagnosisLoading(true);
    setSearchResults([]);
    setSearchQuery("");
    
    try {
      const res = await api.get(`/email-rules/diagnose/${contact.id}`);
      setDiagnosis(res.data);
    } catch (error) {
      toast.error("Error al diagnosticar contacto");
      setDiagnosis(null);
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const loadRuleStats = async (ruleId) => {
    try {
      const res = await api.get(`/email-rules/rule/${ruleId}/stats`);
      setRuleStats(prev => ({ ...prev, [ruleId]: res.data }));
    } catch (error) {
      console.error(`Error loading stats for ${ruleId}:`, error);
    }
  };

  const loadRulePending = async (ruleId, page = 1) => {
    try {
      const res = await api.get(`/email-rules/rule/${ruleId}/pending?page=${page}&page_size=10`);
      setRulePending(prev => ({ ...prev, [ruleId]: res.data }));
    } catch (error) {
      console.error(`Error loading pending for ${ruleId}:`, error);
    }
  };

  const loadRulePendingGrouped = async (ruleId) => {
    try {
      const res = await api.get(`/email-rules/rule/${ruleId}/pending-grouped`);
      setRulePendingGrouped(prev => ({ ...prev, [ruleId]: res.data }));
    } catch (error) {
      console.error(`Error loading grouped pending for ${ruleId}:`, error);
    }
  };

  const generateForRule = async (ruleId) => {
    setGeneratingRule(ruleId);
    try {
      const res = await api.post(`/email-rules/rule/${ruleId}/generate`);
      toast.success(`${res.data.queued} emails generados para ${ruleId}`);
      loadRulePendingGrouped(ruleId);
      loadQueueStatus();
      // Update pending count for this rule
      setRulePendingCounts(prev => ({
        ...prev,
        [ruleId]: (prev[ruleId] || 0) + res.data.queued
      }));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error generando emails");
    } finally {
      setGeneratingRule(null);
    }
  };

  const startPolling = () => {
    if (pollingInterval) clearInterval(pollingInterval);
    
    const interval = setInterval(async () => {
      try {
        const res = await api.get("/email-rules/generation-status");
        setGenerationStatus(res.data);
        
        if (res.data.status !== "running") {
          clearInterval(interval);
          setPollingInterval(null);
          setGeneratingEmails(false);
          loadQueueStatus();
          
          if (res.data.status === "completed") {
            toast.success(`Completado: ${res.data.total_queued} emails generados`);
          } else if (res.data.status === "failed") {
            toast.error(`Error: ${res.data.error || "Falló la generación"}`);
          }
        }
      } catch (error) {
        console.error("Error polling status:", error);
      }
    }, 1500);
    
    setPollingInterval(interval);
  };

  const generateAllEmails = async () => {
    setGeneratingEmails(true);
    try {
      const res = await api.post("/email-rules/generate-all");
      if (res.data.status === "already_running") {
        toast.info("Ya hay una generación en progreso");
      } else if (res.data.success) {
        toast.success("Generación iniciada");
        startPolling();
      }
    } catch (error) {
      toast.error("Error iniciando generación");
      setGeneratingEmails(false);
    }
  };

  const cancelGeneration = async () => {
    try {
      await api.post("/email-rules/generation-cancel");
      if (pollingInterval) clearInterval(pollingInterval);
      setPollingInterval(null);
      setGeneratingEmails(false);
      toast.info("Generación cancelada");
      checkGenerationStatus();
    } catch (error) {
      toast.error("Error cancelando");
    }
  };

  const processQueue = async () => {
    setProcessingQueue(true);
    try {
      const res = await api.post("/email-rules/queue/process");
      toast.success(`${res.data.sent} emails enviados, ${res.data.failed} fallidos`);
      loadQueueStatus();
    } catch (error) {
      toast.error("Error procesando cola");
    } finally {
      setProcessingQueue(false);
    }
  };

  const toggleAutoSend = async () => {
    try {
      const res = await api.post("/email-rules/scheduler/toggle");
      setAutoSendEnabled(res.data.enabled);
      toast.success(res.data.enabled ? "Envío automático activado" : "Envío automático desactivado");
    } catch (error) {
      toast.error("Error cambiando estado");
    }
  };

  const toggleRule = async (ruleId, currentState) => {
    try {
      const res = await api.post(`/email-rules/${ruleId}/toggle`);
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: res.data.enabled } : r));
      toast.success(`${ruleId} ${res.data.enabled ? "activada" : "desactivada"}`);
    } catch (error) {
      toast.error("Error cambiando estado");
    }
  };

  const saveRule = async () => {
    if (!editingRule) return;
    setSavingRule(true);
    try {
      await api.put(`/email-rules/${editingRule.id}`, editingRule);
      toast.success("Regla guardada");
      setEditingRule(null);
      loadRules();
    } catch (error) {
      toast.error("Error guardando regla");
    } finally {
      setSavingRule(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testingRule || !testEmail) return;
    setSendingTestEmail(true);
    try {
      await api.post(`/email-rules/${testingRule.id}/test`, { email: testEmail });
      toast.success("Email de prueba enviado");
      setTestEmailDialogOpen(false);
      setTestEmail("");
      setTestingRule(null);
    } catch (error) {
      toast.error("Error enviando email de prueba");
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleAccordionChange = (value) => {
    // Load stats and pending when a rule is expanded
    if (value) {
      loadRuleStats(value);
      loadRulePendingGrouped(value);
    }
    setExpandedGroup(null);
    setExpandedEmail(null);
  };

  if (loading) {
    return (
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#111] border-[#222]" data-testid="email-rules-settings">
      <CardHeader className="border-b border-[#222]">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5 text-orange-500" />
          Reglas de Email (E1-E10)
        </CardTitle>
      </CardHeader>

      {/* Search & Diagnosis Section */}
      <div className="p-4 border-b border-[#222] bg-[#0a0a0a]">
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            Buscar contacto para diagnóstico
          </Label>
          
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="bg-[#111] border-[#333] pr-10"
              data-testid="contact-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSelectedContact(null);
                  setDiagnosis(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-[#111] border border-[#333] rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => diagnoseContact(contact)}
                  className="w-full p-3 text-left hover:bg-[#1a1a1a] border-b border-[#222] last:border-b-0 flex items-center gap-3"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{contact.name}</p>
                    <p className="text-xs text-slate-500 truncate">{contact.email || contact.phone || "Sin datos"}</p>
                  </div>
                  <Badge className="bg-slate-700 text-xs">Stage {contact.stage}</Badge>
                </button>
              ))}
            </div>
          )}
          
          {searching && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando...
            </div>
          )}
          
          {/* Diagnosis Panel */}
          {selectedContact && (
            <div className="mt-4 p-4 bg-[#111] rounded-lg border border-[#333]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-white">{selectedContact.name}</h4>
                  <p className="text-xs text-slate-400">{selectedContact.email} | Stage {selectedContact.stage}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedContact(null);
                    setDiagnosis(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {diagnosisLoading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando...
                </div>
              ) : diagnosis ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 mb-2">
                    Aplica a {diagnosis.summary.eligible_count} de {diagnosis.summary.total_rules} reglas
                  </p>
                  {diagnosis.diagnosis.map((rule) => (
                    <div
                      key={rule.rule_id}
                      className={`p-2 rounded text-sm ${rule.eligible ? "bg-green-500/10 border border-green-500/30" : "bg-[#1a1a1a]"}`}
                    >
                      <div className="flex items-center gap-2">
                        {rule.eligible ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-500" />
                        )}
                        <span className={rule.eligible ? "text-green-400" : "text-slate-400"}>
                          {rule.rule_id}: {rule.rule_name}
                        </span>
                      </div>
                      <div className="ml-6 mt-1">
                        {rule.reasons.slice(0, 2).map((reason, i) => (
                          <p key={i} className="text-xs text-slate-500">{reason}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Rules Grouped by Stage */}
      <div className="space-y-4">
        {/* Expand/Collapse All Controls */}
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="text-sm font-medium text-slate-400">Reglas por Stage</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandedStages([2, 3, 4, 5])}
              className="text-xs text-slate-400 hover:text-white h-7"
              data-testid="expand-all-stages"
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              Expandir todo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandedStages([])}
              className="text-xs text-slate-400 hover:text-white h-7"
              data-testid="collapse-all-stages"
            >
              <ChevronRight className="w-3 h-3 mr-1" />
              Colapsar todo
            </Button>
          </div>
        </div>
        
        {RULE_GROUPS.map((group) => {
          const groupRules = rules.filter(r => group.rules.includes(r.id));
          const groupPendingCount = group.rules.reduce((sum, ruleId) => sum + (rulePendingCounts[ruleId] || 0), 0);
          const isStageExpanded = expandedStages.includes(group.stage);
          
          const toggleStage = () => {
            setExpandedStages(prev => 
              prev.includes(group.stage) 
                ? prev.filter(s => s !== group.stage)
                : [...prev, group.stage]
            );
          };
          
          return (
            <div key={group.stage} className="border border-[#222] rounded-lg overflow-hidden">
              {/* Stage Header - Clickable */}
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
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-700 text-slate-300">
                      {group.rules.length} reglas
                    </Badge>
                    {groupPendingCount > 0 && (
                      <Badge className="bg-yellow-500/20 text-yellow-400">
                        {groupPendingCount} pendientes
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
              
              {/* Rules within Stage - Collapsible */}
              {isStageExpanded && (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  onValueChange={handleAccordionChange}
                >
                  {groupRules.map((rule) => (
                    <AccordionItem
                      key={rule.id}
                    value={rule.id}
                    className="border-b border-[#222] last:border-b-0"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:bg-[#1a1a1a] hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        {RULE_ICONS[rule.id]}
                        <span className="font-medium">{rule.id}</span>
                        <span className="text-slate-400 text-sm">{rule.name}</span>
                        <Badge className={rule.enabled ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}>
                          {rule.enabled ? "Activa" : "Inactiva"}
                        </Badge>
                        {rulePendingCounts[rule.id] > 0 && (
                          <Badge className="bg-yellow-500/20 text-yellow-400">
                            {rulePendingCounts[rule.id]} pendientes
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        {/* Rule Controls */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                            />
                            <span className="text-sm text-slate-400">
                              {rule.enabled ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                      variant="outline"
                      onClick={() => setEditingRule(rule)}
                      className="border-[#333] h-8"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTestingRule(rule);
                        setTestEmailDialogOpen(true);
                      }}
                      className="border-[#333] h-8"
                    >
                      <TestTube className="w-3 h-3 mr-1" />
                      Probar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => generateForRule(rule.id)}
                      disabled={generatingRule === rule.id}
                      className="bg-orange-600 hover:bg-orange-700 h-8"
                    >
                      {generatingRule === rule.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Mail className="w-3 h-3 mr-1" />
                      )}
                      Generar {rule.id}
                    </Button>
                  </div>
                </div>

                {/* Stats Panel */}
                <div className="p-4 bg-[#0a0a0a] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Estadísticas
                  </h4>
                  {ruleStats[rule.id] ? (
                    <div className="flex items-center gap-4">
                      <div className="text-center p-3 bg-[#111] rounded-lg">
                        <p className="text-2xl font-bold text-blue-400">{ruleStats[rule.id].sent_total}</p>
                        <p className="text-xs text-slate-500">Emails enviados</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando estadísticas...
                    </div>
                  )}
                </div>

                {/* Pending Emails Panel - Grouped */}
                <div className="p-4 bg-[#0a0a0a] rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    Correos por enviar
                    {rulePendingGrouped[rule.id] && (
                      <Badge className="bg-yellow-500/20 text-yellow-400">
                        {rulePendingGrouped[rule.id].total_count}
                      </Badge>
                    )}
                  </h4>
                  
                  {rulePendingGrouped[rule.id] ? (
                    rulePendingGrouped[rule.id].groups.length > 0 ? (
                      <div className="space-y-3">
                        {rulePendingGrouped[rule.id].groups.map((group) => (
                          <Collapsible
                            key={group.group_id}
                            open={expandedGroup === `${rule.id}-${group.group_id}`}
                            onOpenChange={(open) => {
                              setExpandedGroup(open ? `${rule.id}-${group.group_id}` : null);
                              setExpandedSubgroup(null);
                              setExpandedEmail(null);
                            }}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className={`flex items-center gap-3 p-3 rounded-lg text-left ${
                                group.has_error 
                                  ? "bg-red-500/10 border border-red-500/30" 
                                  : "bg-[#111] hover:bg-[#1a1a1a]"
                              }`}>
                                {expandedGroup === `${rule.id}-${group.group_id}` ? (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                
                                {group.has_error && (
                                  <AlertTriangle className="w-4 h-4 text-red-400" />
                                )}
                                
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${group.has_error ? "text-red-400" : "text-white"}`}>
                                    {group.group_type === "webinar" ? "📅 " : "👤 "}
                                    {group.group_name}
                                  </p>
                                  {group.group_date && (
                                    <p className="text-xs text-slate-500">
                                      {new Date(group.group_date).toLocaleDateString('es-MX', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric'
                                      })}
                                    </p>
                                  )}
                                </div>
                                
                                <Badge className={group.has_error ? "bg-red-500/20 text-red-400" : "bg-slate-700"}>
                                  {group.count} emails
                                </Badge>
                              </div>
                            </CollapsibleTrigger>
                            
                            <CollapsibleContent>
                              <div className="mt-2 ml-4 space-y-2">
                                {/* For webinar rules: show subgroups by buyer_persona */}
                                {rulePendingGrouped[rule.id].has_subgroups && group.subgroups ? (
                                  group.subgroups.map((subgroup) => (
                                    <Collapsible
                                      key={subgroup.subgroup_id}
                                      open={expandedSubgroup === `${rule.id}-${group.group_id}-${subgroup.subgroup_id}`}
                                      onOpenChange={(open) => {
                                        setExpandedSubgroup(open ? `${rule.id}-${group.group_id}-${subgroup.subgroup_id}` : null);
                                        setExpandedEmail(null);
                                      }}
                                    >
                                      <CollapsibleTrigger className="w-full">
                                        <div className={`flex items-center gap-3 p-2 rounded text-left ${
                                          subgroup.has_error 
                                            ? "bg-red-500/10 border border-red-500/30" 
                                            : "bg-[#1a1a1a] hover:bg-[#222]"
                                        }`}>
                                          {expandedSubgroup === `${rule.id}-${group.group_id}-${subgroup.subgroup_id}` ? (
                                            <ChevronDown className="w-3 h-3 text-slate-400" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3 text-slate-400" />
                                          )}
                                          
                                          {subgroup.has_error && (
                                            <AlertTriangle className="w-3 h-3 text-red-400" />
                                          )}
                                          
                                          <span className={`text-sm flex-1 ${subgroup.has_error ? "text-red-400" : "text-slate-300"}`}>
                                            👤 {subgroup.subgroup_name}
                                          </span>
                                          
                                          <Badge className={`text-xs ${subgroup.has_error ? "bg-red-500/20 text-red-400" : "bg-slate-600"}`}>
                                            {subgroup.count}
                                          </Badge>
                                        </div>
                                      </CollapsibleTrigger>
                                      
                                      <CollapsibleContent>
                                        <div className="mt-1 ml-4 space-y-1 max-h-48 overflow-y-auto">
                                          {subgroup.emails.slice(0, 15).map((email) => (
                                            <EmailItem 
                                              key={email.id}
                                              email={email}
                                              expandedEmail={expandedEmail}
                                              setExpandedEmail={setExpandedEmail}
                                              hasError={subgroup.has_error}
                                              setEditingContact={setEditingContact}
                                            />
                                          ))}
                                          {subgroup.emails.length > 15 && (
                                            <p className="text-xs text-slate-500 text-center py-1">
                                              ... y {subgroup.emails.length - 15} más
                                            </p>
                                          )}
                                          
                                          {/* Send button for subgroup */}
                                          {!subgroup.has_error && subgroup.emails.length > 0 && (
                                            <Button
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openSendDialog(rule, subgroup.emails, group.group_id, subgroup.subgroup_id, group);
                                              }}
                                              className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                              data-testid={`send-subgroup-${rule.id}-${group.group_id}-${subgroup.subgroup_id}`}
                                            >
                                              <Send className="w-3 h-3 mr-1" />
                                              Generar Correo ({subgroup.count})
                                            </Button>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  ))
                                ) : (
                                  /* For buyer_persona rules: show emails directly */
                                  <div className="space-y-1">
                                    <div className="max-h-60 overflow-y-auto space-y-1">
                                      {group.emails.slice(0, 20).map((email) => (
                                        <EmailItem 
                                          key={email.id}
                                          email={email}
                                          expandedEmail={expandedEmail}
                                          setExpandedEmail={setExpandedEmail}
                                          hasError={group.has_error}
                                          setEditingContact={setEditingContact}
                                        />
                                      ))}
                                      {group.emails.length > 20 && (
                                        <p className="text-xs text-slate-500 text-center py-2">
                                          ... y {group.emails.length - 20} más
                                        </p>
                                      )}
                                    </div>
                                    
                                    {/* Send button for group (buyer_persona rules) */}
                                    {!group.has_error && group.emails.length > 0 && (
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openSendDialog(rule, group.emails, group.group_id, null, group);
                                        }}
                                        className="w-full mt-2 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                        data-testid={`send-group-${rule.id}-${group.group_id}`}
                                      >
                                        <Send className="w-3 h-3 mr-1" />
                                        Generar Correo ({group.count})
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No hay correos pendientes para esta regla
                      </p>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando correos pendientes...
                    </div>
                  )}
                </div>

                {/* Rule Description */}
                <p className="text-xs text-slate-500 px-2">{rule.description}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Rule Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="bg-[#111] border-[#333] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRule && RULE_ICONS[editingRule.id]}
              Editar {editingRule?.id}: {editingRule?.name}
            </DialogTitle>
          </DialogHeader>
          
          {editingRule && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cadencia (días)</Label>
                  <Input
                    type="number"
                    value={editingRule.cadence_days || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, cadence_days: parseInt(e.target.value) })}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stages objetivo</Label>
                  <Input
                    value={(editingRule.target_stages || []).join(", ")}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      target_stages: e.target.value.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                    })}
                    placeholder="1, 2, 3"
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
              </div>

              {/* Template Section */}
              <div className="space-y-4 p-4 bg-[#0a0a0a] rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    Template del Email
                  </Label>
                </div>
                
                {/* Variable Buttons Section */}
                <div className="space-y-3 p-3 bg-[#111] rounded-lg border border-[#333]">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Haz clic en una variable para insertarla en el campo activo:</span>
                    <Badge className={activeField === "subject" ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-400"}>
                      {activeField === "subject" ? "Asunto" : "Cuerpo"}
                    </Badge>
                  </div>
                  
                  {/* Contact Variables - Always available */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Datos del Contacto</p>
                    <div className="flex flex-wrap gap-2">
                      {CONTACT_VARIABLES.map((variable) => (
                        <Button
                          key={variable.key}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => insertVariable(variable.key)}
                          className="h-8 px-3 border-[#444] hover:bg-[#222] hover:border-blue-500/50 text-xs group"
                          title={variable.description}
                        >
                          <span className="mr-1.5">{variable.icon}</span>
                          <span className="text-slate-300 group-hover:text-white">{variable.label}</span>
                          <code className="ml-2 text-slate-500 text-[10px]">{`{${variable.key}}`}</code>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Webinar Variables - Only for webinar rules */}
                  {WEBINAR_RULES.includes(editingRule.id) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Datos del Webinar</p>
                      <div className="flex flex-wrap gap-2">
                        {WEBINAR_VARIABLES.map((variable) => (
                          <Button
                            key={variable.key}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => insertVariable(variable.key)}
                            className="h-8 px-3 border-[#444] hover:bg-[#222] hover:border-green-500/50 text-xs group"
                            title={variable.description}
                          >
                            <span className="mr-1.5">{variable.icon}</span>
                            <span className="text-slate-300 group-hover:text-white">{variable.label}</span>
                            <code className="ml-2 text-slate-500 text-[10px]">{`{${variable.key}}`}</code>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Subject Input */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    Asunto del Email
                    {activeField === "subject" && (
                      <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Editando</Badge>
                    )}
                  </Label>
                  <Input
                    ref={subjectInputRef}
                    value={editingRule.template_subject || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, template_subject: e.target.value })}
                    onFocus={() => setActiveField("subject")}
                    className={`bg-[#111] border-[#333] ${activeField === "subject" ? "ring-1 ring-blue-500/50" : ""}`}
                    placeholder="Ej: ¡{contact_name}, te invitamos a {webinar_name}!"
                  />
                </div>
                
                {/* Body Textarea */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    Cuerpo del Email (HTML)
                    {activeField === "body" && (
                      <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Editando</Badge>
                    )}
                  </Label>
                  <Textarea
                    ref={bodyTextareaRef}
                    value={editingRule.template_body || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, template_body: e.target.value })}
                    onFocus={() => setActiveField("body")}
                    className={`bg-[#111] border-[#333] font-mono text-xs ${activeField === "body" ? "ring-1 ring-blue-500/50" : ""}`}
                    rows={10}
                  />
                  <p className="text-xs text-slate-500">
                    Puedes usar HTML para dar formato: <code className="bg-[#222] px-1 rounded">&lt;p&gt;</code>, <code className="bg-[#222] px-1 rounded">&lt;strong&gt;</code>, <code className="bg-[#222] px-1 rounded">&lt;a href="..."&gt;</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)} className="border-[#333]">
              Cancelar
            </Button>
            <Button onClick={saveRule} disabled={savingRule} className="bg-orange-600 hover:bg-orange-700">
              {savingRule ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
        <DialogContent className="bg-[#111] border-[#333]">
          <DialogHeader>
            <DialogTitle>Enviar email de prueba - {testingRule?.id}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Email de destino</Label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tu@email.com"
              className="bg-[#0a0a0a] border-[#333] mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialogOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button onClick={sendTestEmail} disabled={sendingTestEmail || !testEmail}>
              {sendingTestEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar prueba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Edit Sheet */}
      {editingContact && (
        <ContactSheet
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
          onUpdate={() => {
            setEditingContact(null);
            // Reload pending emails for all rules
            loadAllPendingCounts();
          }}
        />
      )}

      {/* Send to Subgroup Dialog */}
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
              {/* Recipients Preview */}
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Destinatarios ({sendDialogData.contacts?.length})
                </Label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {sendDialogData.contacts?.slice(0, 10).map((contact, idx) => (
                    <Badge key={idx} className="bg-[#222] text-slate-300 text-xs">
                      {contact.contact_name || contact.contact_email}
                    </Badge>
                  ))}
                  {sendDialogData.contacts?.length > 10 && (
                    <Badge className="bg-slate-700 text-slate-400 text-xs">
                      +{sendDialogData.contacts.length - 10} más
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
                  placeholder="María Gargari"
                />
                <p className="text-xs text-slate-500">Se enviará desde: {senderName} &lt;contact@leaderlix.com&gt;</p>
              </div>

              {/* Variable Buttons */}
              <div className="space-y-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Insertar variable en:</span>
                  <Badge className={sendActiveField === "subject" ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-400"}>
                    {sendActiveField === "subject" ? "Asunto" : "Cuerpo"}
                  </Badge>
                </div>
                
                {/* Contact Variables */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Contacto</p>
                  <div className="flex flex-wrap gap-2">
                    {CONTACT_VARIABLES.map((variable) => (
                      <Button
                        key={variable.key}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => insertSendVariable(variable.key)}
                        className="h-7 px-2 border-[#444] hover:bg-[#222] text-xs"
                      >
                        <span className="mr-1">{variable.icon}</span>
                        {variable.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Webinar Variables - only for webinar rules */}
                {WEBINAR_RULES.includes(sendDialogData.rule?.id) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Webinar</p>
                    <div className="flex flex-wrap gap-2">
                      {WEBINAR_VARIABLES.map((variable) => (
                        <Button
                          key={variable.key}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => insertSendVariable(variable.key)}
                          className="h-7 px-2 border-[#444] hover:bg-[#222] text-xs"
                        >
                          <span className="mr-1">{variable.icon}</span>
                          {variable.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  Asunto
                  {sendActiveField === "subject" && (
                    <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Editando</Badge>
                  )}
                </Label>
                <Input
                  ref={sendSubjectRef}
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  onFocus={() => setSendActiveField("subject")}
                  className={`bg-[#0a0a0a] border-[#333] ${sendActiveField === "subject" ? "ring-1 ring-blue-500/50" : ""}`}
                  placeholder="Asunto del email..."
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  Cuerpo (HTML)
                  {sendActiveField === "body" && (
                    <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Editando</Badge>
                  )}
                </Label>
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
                  
                  <div className="bg-white text-black p-4">
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
    </Card>
  );
}
