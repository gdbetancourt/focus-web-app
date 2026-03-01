/**
 * CurrentCasesDeliveryPage - Stage 4 cases management for delivery follow-up
 * Shows ALL Stage 4 cases organized by delivery_stage
 *
 * Features:
 * - Top-level accordion groups by delivery stage (ganados, contenidos_transcritos, etc.)
 * - Cases displayed as accordions within each stage group
 * - Sub-accordions by contact roles (Deal Makers, Coachees, Students, etc.)
 * - Checklist system with tasks/columns per subgroup
 * - Weekly indicators (green/yellow/red)
 * - WhatsApp message generation
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import ContactSheet from "../ContactSheet";
import { CaseCreateDialog } from "./CaseCreateDialog";
import { 
  WhatsAppMessageGenerator, 
  WhatsAppButton, 
  WhatsAppGroupButton 
} from "../WhatsAppMessageGenerator";
// Import canonical role mapping (single source of truth)
import { 
  normalizeRole, 
  ROLE_OPTIONS,
  CANONICAL_TO_UI
} from "../../utils/roleMapping";
import {
  Briefcase,
  Users,
  GraduationCap,
  UserCheck,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Edit,
  Calendar as CalendarIcon,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Archive,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Building2,
  User,
  Sparkles,
  Link,
  Copy,
  AlertTriangle,
  GripVertical,
  MoreVertical,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

// Get section config
const SECTION = getSectionById("current-cases") || {
  id: "current-cases",
  label: "Current Cases",
  subheadline: "It is important to follow up with each of our coachees individually to ensure the success of the project.",
  steps: [
    { title: "Review the tasks that must be completed today." },
    { title: "Complete them." }
  ]
};

// Icon mapping for each role
const ROLE_ICONS = {
  deal_maker: Briefcase,
  influencer: Sparkles,
  champion: Users,
  sponsor: Building2,
  asistente_deal_maker: UserCheck,
  procurement: Building2,
  staff: Users,
  coachee: UserCheck,
  student: GraduationCap,
  advisor: Users,
  speaker: Users,
  evaluador_360: Users,
};

// Color mapping for each role
const ROLE_COLORS = {
  deal_maker: { color: "text-green-400", bgColor: "bg-green-500/10" },
  influencer: { color: "text-amber-400", bgColor: "bg-amber-500/10" },
  champion: { color: "text-blue-400", bgColor: "bg-blue-500/10" },
  sponsor: { color: "text-purple-400", bgColor: "bg-purple-500/10" },
  asistente_deal_maker: { color: "text-teal-400", bgColor: "bg-teal-500/10" },
  procurement: { color: "text-orange-400", bgColor: "bg-orange-500/10" },
  staff: { color: "text-slate-400", bgColor: "bg-slate-500/10" },
  coachee: { color: "text-pink-400", bgColor: "bg-pink-500/10" },
  student: { color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  advisor: { color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  speaker: { color: "text-red-400", bgColor: "bg-red-500/10" },
  evaluador_360: { color: "text-indigo-400", bgColor: "bg-indigo-500/10" },
};

// Delivery stage constants
const DELIVERY_STAGE_LABELS = {
  ganados: "En Entrega Activa",
  contenidos_transcritos: "Contenidos Transcritos",
  reporte_presentado: "Reporte Presentado",
  caso_publicado: "Caso Publicado",
  concluidos: "Concluidos",
};

const DELIVERY_STAGE_COLORS = {
  ganados: "bg-green-500/20 text-green-400 border-green-500/50",
  contenidos_transcritos: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  reporte_presentado: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  caso_publicado: "bg-amber-500/20 text-amber-400 border-amber-500/50",
  concluidos: "bg-slate-500/20 text-slate-400 border-slate-500/50",
};

const DELIVERY_STAGE_ORDER = [
  "ganados",
  "contenidos_transcritos",
  "reporte_presentado",
  "caso_publicado",
  "concluidos",
];

// Get display label for a role
function getRoleLabel(role) {
  return CANONICAL_TO_UI[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Get icon for a role
function getRoleIcon(role) {
  return ROLE_ICONS[role] || User;
}

// Get colors for a role
function getRoleColors(role) {
  return ROLE_COLORS[role] || { color: "text-slate-400", bgColor: "bg-slate-500/10" };
}

// Weekly indicator component - Gray is NOT allowed for current week
function WeeklyIndicator({ status }) {
  const colors = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-red-500",
    // Gray is only for future weeks, but default to green if somehow gray appears
    gray: "bg-green-500"
  };
  
  // Ensure we never show gray for current week - default to green
  const effectiveStatus = status === "gray" ? "green" : (status || "green");
  
  return (
    <div 
      className={`w-3 h-3 rounded-full ${colors[effectiveStatus] || colors.green}`}
      title={`Status: ${effectiveStatus}`}
    />
  );
}

export default function CurrentCasesDeliveryPage() {
  // Data state
  const [cases, setCases] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [expandedCases, setExpandedCases] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedDeliveryStages, setExpandedDeliveryStages] = useState(["ganados"]);
  
  // Contact sheet state
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  
  // Column management state
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [addColumnTarget, setAddColumnTarget] = useState(null); // { caseId, groupId }
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnDueDate, setNewColumnDueDate] = useState(null);
  
  // Edit column state
  const [editColumnDialogOpen, setEditColumnDialogOpen] = useState(false);
  const [editColumnTarget, setEditColumnTarget] = useState(null); // { caseId, groupId, column }
  const [editColumnTitle, setEditColumnTitle] = useState("");
  const [editColumnDueDate, setEditColumnDueDate] = useState(null);
  
  // Delete column state
  const [deleteColumnDialogOpen, setDeleteColumnDialogOpen] = useState(false);
  const [deleteColumnTarget, setDeleteColumnTarget] = useState(null); // { caseId, groupId, column }
  
  // Archive confirmation state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [caseToArchive, setCaseToArchive] = useState(null);
  
  // WhatsApp state
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappContacts, setWhatsappContacts] = useState([]);
  const [whatsappCaseData, setWhatsappCaseData] = useState(null);
  const [whatsappGroupName, setWhatsappGroupName] = useState("");
  
  // Global traffic status
  const [trafficStatus, setTrafficStatus] = useState("gray");

  // Create case dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/cases/delivery/all");
      const allCases = res.data.cases || [];
      setCases(allCases);
      setGrouped(res.data.grouped || {});

      // Calculate global status
      calculateGlobalStatus(allCases);

      // Auto-expand first case in ganados stage
      const ganadosCases = res.data.grouped?.ganados || [];
      if (ganadosCases.length > 0) {
        setExpandedCases([ganadosCases[0].id]);
      }
    } catch (error) {
      console.error("Error loading cases:", error);
      toast.error("Error cargando casos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load cases on mount
  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const refreshCases = async () => {
    setRefreshing(true);
    await loadCases();
    setRefreshing(false);
  };

  const calculateGlobalStatus = (casesList) => {
    // CRITICAL: Gray is NOT allowed for the current week
    // If no eligible cases → GREEN
    if (!casesList || casesList.length === 0) {
      setTrafficStatus("green");
      return;
    }
    
    // Get all case statuses (default to green if undefined)
    const statuses = casesList.map(c => c.weekly_status || "green");
    
    // Aggregation rules:
    // If any project is Red → section status = Red
    if (statuses.some(s => s === "red")) {
      setTrafficStatus("red");
    // Else if any project is Yellow → section status = Yellow
    } else if (statuses.some(s => s === "yellow")) {
      setTrafficStatus("yellow");
    // Else (all projects Green) → section status = Green
    } else {
      setTrafficStatus("green");
    }
  };

  // Group contacts by individual case-level role for a case
  // Each role becomes its own subgroup
  const groupContactsByRole = (caseData) => {
    const contacts = caseData.contacts || [];
    const groups = {};
    
    // Iterate through each contact and their case_roles
    for (const contact of contacts) {
      const contactRoles = contact.case_roles || [];
      
      if (contactRoles.length === 0) {
        // Contact has no roles -> add to "others" group
        if (!groups["others"]) {
          groups["others"] = [];
        }
        if (!groups["others"].find(c => c.id === contact.id)) {
          groups["others"].push(contact);
        }
      } else {
        // Add contact to EACH role group they belong to
        for (const role of contactRoles) {
          const normalizedRole = normalizeRole(role);
          if (!groups[normalizedRole]) {
            groups[normalizedRole] = [];
          }
          // Avoid duplicates within the same role group
          if (!groups[normalizedRole].find(c => c.id === contact.id)) {
            groups[normalizedRole].push(contact);
          }
        }
      }
    }
    
    return groups;
  };

  // Get sorted role groups for a case (sorted by role label)
  const getSortedRoleGroups = (groups) => {
    const roleOrder = ROLE_OPTIONS.map(r => r.value);
    
    return Object.keys(groups)
      .filter(roleId => groups[roleId].length > 0) // Only show groups with contacts
      .sort((a, b) => {
        // "others" always goes last
        if (a === "others") return 1;
        if (b === "others") return -1;
        // Sort by predefined order, then alphabetically
        const aIdx = roleOrder.indexOf(a);
        const bIdx = roleOrder.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return getRoleLabel(a).localeCompare(getRoleLabel(b));
      });
  };

  // Toggle case expansion
  const toggleCase = (caseId) => {
    setExpandedCases(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  // Toggle group expansion within a case
  const toggleGroup = (caseId, groupId) => {
    const key = `${caseId}-${groupId}`;
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Open contact sheet
  const openContactSheet = (contact) => {
    setSelectedContact(contact);
    setContactSheetOpen(true);
  };

  // Open add column dialog
  const openAddColumnDialog = (caseId, groupId) => {
    setAddColumnTarget({ caseId, groupId });
    setNewColumnTitle("");
    setNewColumnDueDate(null);
    setAddColumnDialogOpen(true);
  };

  // Create column
  const createColumn = async () => {
    if (!newColumnTitle || !newColumnDueDate || !addColumnTarget) {
      toast.error("Título y fecha son requeridos");
      return;
    }
    
    try {
      await api.post(`/cases/${addColumnTarget.caseId}/checklist/columns`, {
        group_id: addColumnTarget.groupId,
        title: newColumnTitle,
        due_date: newColumnDueDate.toISOString()
      });
      
      toast.success("Columna creada");
      setAddColumnDialogOpen(false);
      loadCases();
    } catch (error) {
      console.error("Error creating column:", error);
      toast.error("Error creando columna");
    }
  };

  // Open edit column dialog
  const openEditColumnDialog = (caseId, groupId, column) => {
    setEditColumnTarget({ caseId, groupId, column });
    setEditColumnTitle(column.title);
    setEditColumnDueDate(column.due_date ? new Date(column.due_date) : null);
    setEditColumnDialogOpen(true);
  };

  // Update column
  const updateColumn = async () => {
    if (!editColumnTitle || !editColumnDueDate || !editColumnTarget) {
      toast.error("Título y fecha son requeridos");
      return;
    }
    
    try {
      await api.patch(`/cases/${editColumnTarget.caseId}/checklist/columns`, {
        group_id: editColumnTarget.groupId,
        column_id: editColumnTarget.column.id,
        title: editColumnTitle,
        due_date: editColumnDueDate.toISOString()
      });
      
      toast.success("Columna actualizada");
      setEditColumnDialogOpen(false);
      loadCases();
    } catch (error) {
      console.error("Error updating column:", error);
      toast.error("Error actualizando columna");
    }
  };

  // Open delete column confirmation
  const openDeleteColumnDialog = (caseId, groupId, column) => {
    setDeleteColumnTarget({ caseId, groupId, column });
    setDeleteColumnDialogOpen(true);
  };

  // Delete column
  const deleteColumn = async () => {
    if (!deleteColumnTarget) return;
    
    try {
      await api.delete(`/cases/${deleteColumnTarget.caseId}/checklist/columns`, {
        data: { 
          group_id: deleteColumnTarget.groupId,
          column_id: deleteColumnTarget.column.id
        }
      });
      
      toast.success("Columna eliminada");
      setDeleteColumnDialogOpen(false);
      loadCases();
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("Error eliminando columna");
    }
  };

  // Move column left or right
  const moveColumn = async (caseId, groupId, columnId, direction) => {
    try {
      await api.patch(`/cases/${caseId}/checklist/columns/${columnId}/move`, {
        group_id: groupId,
        direction: direction // "left" or "right"
      });
      
      loadCases();
    } catch (error) {
      console.error("Error moving column:", error);
      toast.error("Error moviendo columna");
    }
  };

  // Toggle checkbox
  const toggleCheckbox = async (caseId, groupId, contactId, columnId, currentValue) => {
    const newValue = !currentValue;
    
    // Optimistic update - update local state immediately
    setCases(prevCases => {
      return prevCases.map(caseData => {
        if (caseData.id !== caseId) return caseData;
        
        // Deep clone to avoid mutation
        const updatedCase = { ...caseData };
        
        // Ensure checklist structure exists
        if (!updatedCase.checklist) updatedCase.checklist = {};
        if (!updatedCase.checklist[groupId]) updatedCase.checklist[groupId] = { columns: [], cells: {} };
        if (!updatedCase.checklist[groupId].cells) updatedCase.checklist[groupId].cells = {};
        if (!updatedCase.checklist[groupId].cells[contactId]) updatedCase.checklist[groupId].cells[contactId] = {};
        
        // Update the specific cell
        updatedCase.checklist[groupId].cells[contactId][columnId] = {
          ...updatedCase.checklist[groupId].cells[contactId][columnId],
          checked: newValue,
          checked_at: newValue ? new Date().toISOString() : null
        };
        
        return updatedCase;
      });
    });
    
    // Send to backend
    try {
      await api.patch(`/cases/${caseId}/checklist/cell`, {
        group_id: groupId,
        contact_id: contactId,
        column_id: columnId,
        checked: newValue
      });
      // Silent refetch to pick up recalculated weekly_status from server
      const res = await api.get("/cases/delivery/all");
      const allCases = res.data.cases || [];
      setCases(allCases);
      setGrouped(res.data.grouped || {});
      calculateGlobalStatus(allCases);
      // Notify FocusLayout to refresh navigation semaphore
      window.dispatchEvent(new CustomEvent("focus:traffic-light-changed"));
    } catch (error) {
      console.error("Error updating checkbox:", error);
      toast.error("Error guardando - recargando datos...");
      // Revert on error by reloading
      loadCases();
    }
  };

  // Open WhatsApp dialog for single contact
  const openWhatsAppSingle = (contact, caseData, groupName) => {
    setWhatsappContacts([contact]);
    setWhatsappCaseData(caseData);
    setWhatsappGroupName(groupName);
    setWhatsappDialogOpen(true);
  };

  // Open WhatsApp dialog for subgroup
  const openWhatsAppGroup = (contacts, caseData, groupName) => {
    const validContacts = contacts.filter(c => c.phone);
    if (validContacts.length === 0) {
      toast.error("Ningún contacto tiene teléfono");
      return;
    }
    setWhatsappContacts(validContacts);
    setWhatsappCaseData(caseData);
    setWhatsappGroupName(groupName);
    setWhatsappDialogOpen(true);
  };

  // Archive case (change to "Concluidos")
  const archiveCase = async () => {
    if (!caseToArchive) return;
    
    try {
      await api.patch(`/cases/${caseToArchive.id}/status`, {
        status: "concluidos"
      });
      
      toast.success("Caso archivado como Concluido");
      setArchiveDialogOpen(false);
      setCaseToArchive(null);
      loadCases();
    } catch (error) {
      console.error("Error archiving case:", error);
      toast.error("Error archivando caso");
    }
  };

  // Check if case can be archived
  const canArchiveCase = (caseData) => {
    const contacts = caseData.contacts || [];
    const checklist = caseData.checklist || {};
    
    // If no contacts, can archive
    if (contacts.length === 0) return true;
    
    // Check if all tasks are completed
    for (const groupId in checklist) {
      const group = checklist[groupId];
      for (const contactId in group.cells || {}) {
        for (const columnId in group.cells[contactId] || {}) {
          if (!group.cells[contactId][columnId]?.checked) {
            return false;
          }
        }
      }
    }
    
    return true;
  };

  // Traffic rules for section layout
  const trafficRules = {
    green: "Todas las tareas completadas o sin tareas pendientes para hoy",
    yellow: "Se completó al menos una tarea esta semana",
    red: "No se ha completado ninguna tarea esta semana"
  };

  return (
    <SectionLayout
      title={SECTION.label}
          sectionId={SECTION.id}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={Briefcase}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-400 border-0">
              {cases.length} casos Stage 4
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear Caso
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshCases}
              disabled={refreshing}
              className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : cases.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400">No hay casos en Stage 4</p>
            </CardContent>
          </Card>
        ) : (
          /* Delivery Stage Accordions */
          <div className="space-y-4">
            {DELIVERY_STAGE_ORDER.map((deliveryStage) => {
              const stageCases = grouped[deliveryStage] || [];
              if (stageCases.length === 0) return null;
              const stageLabel = DELIVERY_STAGE_LABELS[deliveryStage] || deliveryStage;
              const stageColorClass = DELIVERY_STAGE_COLORS[deliveryStage] || "";
              const isStageExpanded = expandedDeliveryStages.includes(deliveryStage);
              return (
                <div key={deliveryStage} className="bg-[#0d0d0d] border border-[#222] rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] text-left"
                    onClick={() => setExpandedDeliveryStages(prev =>
                      prev.includes(deliveryStage) ? prev.filter(s => s !== deliveryStage) : [...prev, deliveryStage]
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`border text-xs ${stageColorClass}`}>
                        {stageLabel}
                      </Badge>
                      <span className="text-slate-400 text-sm">{stageCases.length} caso{stageCases.length !== 1 ? 's' : ''}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isStageExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isStageExpanded && (
                    <div className="px-3 pb-3">
                      <Accordion
                        type="multiple"
                        value={expandedCases}
                        onValueChange={setExpandedCases}
                        className="space-y-3 pt-3"
                      >
                        {stageCases.map((caseData) => {
              const contactGroups = groupContactsByRole(caseData);
              const canArchive = canArchiveCase(caseData);
              
              return (
                <AccordionItem
                  key={caseData.id}
                  value={caseData.id}
                  className="bg-[#111] border border-[#222] rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a]">
                    <AccordionTrigger className="flex-1 hover:no-underline p-0">
                      <div className="flex items-center gap-3">
                        <WeeklyIndicator status={caseData.weekly_status || "gray"} />
                        <div className="text-left">
                          <h3 className="text-white font-medium">{caseData.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {caseData.company_names?.[0] && (
                              <Badge className="bg-slate-800 text-slate-300 border-0 text-xs">
                                <Building2 className="w-3 h-3 mr-1" />
                                {caseData.company_names[0]}
                              </Badge>
                            )}
                            {(() => {
                              const dealMaker = caseData.contacts?.find(c => c.case_roles?.includes("deal_maker"));
                              return dealMaker ? (
                                <Badge className="bg-green-500/10 text-green-400 border-0 text-xs">
                                  <Briefcase className="w-3 h-3 mr-1" />
                                  {dealMaker.first_name || dealMaker.name}
                                </Badge>
                              ) : null;
                            })()}
                            <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
                              {caseData.contacts?.length || 0} contactos
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    
                    {canArchive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaseToArchive(caseData);
                          setArchiveDialogOpen(true);
                        }}
                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10 ml-2"
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        Archivar
                      </Button>
                    )}
                  </div>
                  
                  <AccordionContent className="px-4 pb-4">
                    {/* Role Group Sub-Accordions - Each role is its own subgroup */}
                    <Accordion type="multiple" className="space-y-2">
                      {getSortedRoleGroups(contactGroups).map((roleId) => {
                        const groupContacts = contactGroups[roleId] || [];
                        // Show subgroup if it has at least one contact (visibility rule)
                        if (groupContacts.length === 0) return null;
                        
                        const RoleIcon = getRoleIcon(roleId);
                        const roleColors = getRoleColors(roleId);
                        const roleLabel = roleId === "others" ? "Todos los demás" : getRoleLabel(roleId);
                        const groupKey = `${caseData.id}-${roleId}`;
                        const isExpanded = expandedGroups[groupKey];
                        // Filter out deleted columns - use roleId for checklist lookup
                        const columns = (caseData.checklist?.[roleId]?.columns || [])
                          .filter(col => !col.deleted);
                        
                        return (
                          <AccordionItem
                            key={roleId}
                            value={roleId}
                            className={`border border-[#333] rounded-lg ${roleColors.bgColor}`}
                          >
                            <div className="flex items-center justify-between px-3 py-2">
                              <AccordionTrigger className="flex-1 hover:no-underline p-0">
                                <div className="flex items-center gap-2">
                                  <RoleIcon className={`w-4 h-4 ${roleColors.color}`} />
                                  <span className={`font-medium ${roleColors.color}`}>{roleLabel}</span>
                                  <Badge className="bg-slate-800 text-slate-300 border-0 text-xs ml-2">
                                    {groupContacts.length}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              {/* WhatsApp Group Button - Outside of AccordionTrigger to avoid nested button issue */}
                              <WhatsAppGroupButton
                                contacts={groupContacts}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWhatsAppGroup(groupContacts, caseData, roleLabel);
                                }}
                              />
                            </div>
                            
                            <AccordionContent className="px-3 pb-3">
                              {/* Checklist Table */}
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-[#333]">
                                      <TableHead className="text-slate-400 font-medium w-8">
                                        {/* WhatsApp column */}
                                      </TableHead>
                                      <TableHead className="text-slate-400 font-medium">Contacto</TableHead>
                                      {columns.map((col, colIndex) => (
                                        <TableHead 
                                          key={col.id} 
                                          className="text-slate-400 font-medium text-center min-w-[140px] group"
                                        >
                                          <div className="flex flex-col items-center gap-1 relative">
                                            <div className="flex items-center gap-1">
                                              {/* Move left button */}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveColumn(caseData.id, roleId, col.id, "left")}
                                                className="h-5 w-5 p-0 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                disabled={colIndex === 0}
                                              >
                                                <ArrowLeft className="w-3 h-3" />
                                              </Button>
                                              
                                              <span className="text-xs">{col.title}</span>
                                              
                                              {/* Move right button */}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveColumn(caseData.id, roleId, col.id, "right")}
                                                className="h-5 w-5 p-0 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                disabled={colIndex === columns.length - 1}
                                              >
                                                <ArrowRight className="w-3 h-3" />
                                              </Button>
                                              
                                              {/* Column options menu */}
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 w-5 p-0 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <MoreVertical className="w-3 h-3" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-[#333]">
                                                  <DropdownMenuItem 
                                                    onClick={() => openEditColumnDialog(caseData.id, roleId, col)}
                                                    className="text-slate-300 hover:text-white hover:bg-[#333] cursor-pointer"
                                                  >
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Editar
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    onClick={() => openDeleteColumnDialog(caseData.id, roleId, col)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                                                  >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Eliminar
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                            <span className="text-[10px] text-slate-500">
                                              {col.due_date ? format(new Date(col.due_date), "dd MMM", { locale: es }) : ""}
                                            </span>
                                          </div>
                                        </TableHead>
                                      ))}
                                      <TableHead className="text-slate-400 font-medium w-10">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openAddColumnDialog(caseData.id, roleId)}
                                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </Button>
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupContacts.map((contact) => {
                                      const cells = caseData.checklist?.[roleId]?.cells?.[contact.id] || {};
                                      
                                      return (
                                        <TableRow key={contact.id} className="border-[#333]">
                                          {/* WhatsApp Button */}
                                          <TableCell className="w-8">
                                            <WhatsAppButton
                                              contact={contact}
                                              onClick={() => openWhatsAppSingle(contact, caseData, roleLabel)}
                                            />
                                          </TableCell>
                                          
                                          {/* Contact Name */}
                                          <TableCell>
                                            <button
                                              onClick={() => openContactSheet(contact)}
                                              className="text-white hover:text-cyan-400 text-sm text-left"
                                            >
                                              {contact.name || contact.first_name || "Sin nombre"}
                                            </button>
                                          </TableCell>
                                          
                                          {/* Task Checkboxes */}
                                          {columns.map((col) => {
                                            const cell = cells[col.id] || {};
                                            
                                            return (
                                              <TableCell key={col.id} className="text-center">
                                                <Checkbox
                                                  checked={cell.checked || false}
                                                  onCheckedChange={() => toggleCheckbox(
                                                    caseData.id,
                                                    roleId,
                                                    contact.id,
                                                    col.id,
                                                    cell.checked
                                                  )}
                                                  className="border-slate-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                />
                                              </TableCell>
                                            );
                                          })}
                                          
                                          {/* Empty cell for add column */}
                                          <TableCell />
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
                      </Accordion>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Column Dialog */}
      <Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Nueva Tarea</DialogTitle>
            <DialogDescription className="text-slate-400">
              Agrega una nueva columna de tarea para este grupo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Título</label>
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Ej: Llamada de seguimiento"
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Fecha límite</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left bg-[#0a0a0a] border-[#333] text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newColumnDueDate ? format(newColumnDueDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#111] border-[#222]">
                  <Calendar
                    mode="single"
                    selected={newColumnDueDate}
                    onSelect={setNewColumnDueDate}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddColumnDialogOpen(false)}
              className="border-[#333] text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={createColumn}
              disabled={!newColumnTitle || !newColumnDueDate}
              className="bg-green-600 hover:bg-green-700"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Column Dialog */}
      <Dialog open={editColumnDialogOpen} onOpenChange={setEditColumnDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Tarea</DialogTitle>
            <DialogDescription className="text-slate-400">
              Modifica el nombre y fecha de la tarea
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Título</label>
              <Input
                value={editColumnTitle}
                onChange={(e) => setEditColumnTitle(e.target.value)}
                placeholder="Ej: Llamada de seguimiento"
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Fecha límite</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left bg-[#0a0a0a] border-[#333] text-white"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editColumnDueDate ? format(editColumnDueDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#111] border-[#222]">
                  <Calendar
                    mode="single"
                    selected={editColumnDueDate}
                    onSelect={setEditColumnDueDate}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditColumnDialogOpen(false)}
              className="border-[#333] text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={updateColumn}
              disabled={!editColumnTitle || !editColumnDueDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Confirmation Dialog */}
      <Dialog open={deleteColumnDialogOpen} onOpenChange={setDeleteColumnDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Eliminar Tarea
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          {deleteColumnTarget && (
            <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <p className="text-white font-medium">{deleteColumnTarget.column.title}</p>
              {deleteColumnTarget.column.due_date && (
                <p className="text-sm text-slate-400 mt-1">
                  Fecha: {format(new Date(deleteColumnTarget.column.due_date), "PPP", { locale: es })}
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteColumnDialogOpen(false);
                setDeleteColumnTarget(null);
              }}
              className="border-[#333] text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={deleteColumn}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-green-400" />
              Archivar Proyecto
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que quieres archivar este proyecto como "Concluido"?
            </DialogDescription>
          </DialogHeader>
          
          {caseToArchive && (
            <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <p className="text-white font-medium">{caseToArchive.name}</p>
              {caseToArchive.company_names?.[0] && (
                <p className="text-sm text-slate-400 mt-1">{caseToArchive.company_names[0]}</p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setArchiveDialogOpen(false);
                setCaseToArchive(null);
              }}
              className="border-[#333] text-slate-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={archiveCase}
              className="bg-green-600 hover:bg-green-700"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archivar como Concluido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Sheet */}
      <ContactSheet
        open={contactSheetOpen}
        onOpenChange={setContactSheetOpen}
        contactId={selectedContact?.id}
        onSaved={() => {
          loadCases();
        }}
      />

      {/* WhatsApp Message Generator Modal */}
      <WhatsAppMessageGenerator
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        contacts={whatsappContacts}
        caseData={whatsappCaseData}
        groupName={whatsappGroupName}
        onUrlsGenerated={() => {
          // Optionally reload or log activity
        }}
      />

      {/* Create Case Dialog */}
      <CaseCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultStage="ganados"
        onCreated={() => loadCases()}
      />
    </SectionLayout>
  );
}
