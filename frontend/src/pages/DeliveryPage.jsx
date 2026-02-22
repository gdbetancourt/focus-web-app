import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/ui/collapsible";
import ContactSheet from "../components/ContactSheet";
import api from "../lib/api";
import {
  Package,
  RefreshCw,
  Users,
  Building2,
  ExternalLink,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Link2,
  Trophy,
  FileCheck,
  ClipboardCheck,
  Eye,
  Edit2,
  Mail,
  Phone,
  Copy,
  Hash,
  Undo2,
  Target,
  GraduationCap,
  PlayCircle,
  FileSpreadsheet,
  Briefcase,
  CheckCircle,
  Trash2
} from "lucide-react";
import { STAGE_4_LABELS, STAGE_4_COLORS } from "../constants/stages";

// Use centralized stage constants
const DELIVERY_STAGE_LABELS = STAGE_4_LABELS;
const DELIVERY_STAGE_COLORS = STAGE_4_COLORS;

export default function DeliveryPage() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    ganados: 0,
    concluidos: 0,
    contenidos_transcritos: 0,
    reporte_presentado: 0,
    caso_publicado: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState("all");
  
  // Project detail dialog
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Contact edit
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Stage 5 confirmation dialog
  const [stage5ConfirmOpen, setStage5ConfirmOpen] = useState(false);
  const [stage5PendingProject, setStage5PendingProject] = useState(null);
  const [stage5ContactsSummary, setStage5ContactsSummary] = useState(null);
  const [loadingStage5Summary, setLoadingStage5Summary] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await api.get("/delivery/");
      setProjects(response.data.projects || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error("Error loading delivery projects:", error);
      toast.error("Error cargando proyectos");
    } finally {
      setLoading(false);
    }
  };

  const openProjectDetail = async (project) => {
    setSelectedProject(project);
    setDetailDialogOpen(true);
    setLoadingDetail(true);
    
    try {
      const response = await api.get(`/delivery/${project.id}`);
      setSelectedProject(response.data);
    } catch (error) {
      console.error("Error loading project detail:", error);
      toast.error("Error cargando detalle");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Role labels for display
  const ROLE_LABELS = {
    deal_maker: "Deal Maker",
    sponsor: "Patrocinador Ejecutivo",
    coachee: "Coachee (Lo Hago Contigo)",
    Coachee: "Coachee (Lo Hago Contigo)",
    student: "Alumno",
    alumno: "Alumno",
    Alumno: "Alumno",
    estudiante: "Estudiante",
    Estudiante: "Estudiante",
    staff: "Staff",
    speaker: "Speaker",
    advisor: "Consejero",
    procurement: "Compras",
    champion: "Recomendado",
    asistente_deal_maker: "Asistente Deal Maker",
    evaluador_360: "Evaluador 360",
    sin_rol: "Sin rol asignado"
  };

  const handleStageChange = async (projectId, newStage, currentStage) => {
    // If changing to concluidos or caso_publicado, show confirmation dialog
    if ((newStage === "concluidos" || newStage === "caso_publicado") && currentStage !== newStage) {
      setStage5PendingProject({ id: projectId, newStage });
      setLoadingStage5Summary(true);
      setStage5ConfirmOpen(true);
      
      try {
        const response = await api.get(`/delivery/${projectId}/contacts-summary?target_stage=${newStage}`);
        setStage5ContactsSummary(response.data);
      } catch (error) {
        console.error("Error loading contacts summary:", error);
        toast.error("Error cargando resumen de contactos");
        setStage5ConfirmOpen(false);
      } finally {
        setLoadingStage5Summary(false);
      }
    } else {
      // For other stage changes, proceed directly
      updateProjectStage(projectId, newStage);
    }
  };

  const confirmMoveToStage5 = async () => {
    if (!stage5PendingProject) return;
    
    try {
      const response = await api.patch(`/delivery/${stage5PendingProject.id}`, { 
        stage: stage5PendingProject.newStage 
      });
      const contactsMoved = response.data.contacts_moved_to_stage5 || 0;
      toast.success(`Proyecto movido a Caso Publicado. ${contactsMoved} contactos movidos a Stage 5.`);
      loadProjects();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Error al actualizar etapa");
    } finally {
      setStage5ConfirmOpen(false);
      setStage5PendingProject(null);
      setStage5ContactsSummary(null);
    }
  };

  const updateProjectStage = async (projectId, newStage) => {
    try {
      await api.patch(`/delivery/${projectId}`, { stage: newStage });
      toast.success(`Proyecto movido a ${DELIVERY_STAGE_LABELS[newStage]}`);
      loadProjects();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Error al actualizar etapa");
    }
  };

  const moveBackToCases = async (projectId) => {
    if (!confirm("¿Devolver este proyecto a Cases (Stage 3)?")) return;
    
    try {
      await api.post(`/delivery/move-back-to-cases/${projectId}`);
      toast.success("Proyecto devuelto a Cases");
      loadProjects();
      setDetailDialogOpen(false);
    } catch (error) {
      console.error("Error moving back:", error);
      toast.error("Error al devolver proyecto");
    }
  };

  const deleteProject = async (projectId) => {
    if (!confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    
    try {
      await api.delete(`/cases/${projectId}`);
      toast.success("Proyecto eliminado");
      loadProjects();
      setDetailDialogOpen(false);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Error al eliminar proyecto");
    }
  };

  const formatCurrency = (amount, currency = "MXN") => {
    if (!amount) return "-";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterStage !== "all" && p.stage !== filterStage) return false;
      return true;
    });
  }, [projects, filterStage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="delivery-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/20">
            <Package className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Delivery (Proyectos)</h1>
            <p className="text-slate-500">Stage 4: Proyectos ganados en ejecución</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={loadProjects} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Proyectos</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Package className="w-8 h-8 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-400">Ganados</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.ganados}</p>
              </div>
              <Trophy className="w-8 h-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-cyan-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyan-400">Concluidos</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.concluidos}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-cyan-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-400">Transcritos</p>
                <p className="text-2xl font-bold text-blue-400">{stats.contenidos_transcritos}</p>
              </div>
              <FileCheck className="w-8 h-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-400">Reporte Presentado</p>
                <p className="text-2xl font-bold text-purple-400">{stats.reporte_presentado}</p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-400">Caso Publicado</p>
                <p className="text-2xl font-bold text-amber-400">{stats.caso_publicado}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-52 bg-[#111] border-[#333] text-white">
            <SelectValue placeholder="Filtrar por etapa" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-[#333]">
            <SelectItem value="all">Todas las etapas</SelectItem>
            <SelectItem value="ganados">Ganados</SelectItem>
            <SelectItem value="concluidos">Concluidos</SelectItem>
            <SelectItem value="contenidos_transcritos">Contenidos Transcritos</SelectItem>
            <SelectItem value="reporte_presentado">Reporte Presentado</SelectItem>
            <SelectItem value="caso_publicado">Caso Publicado</SelectItem>
          </SelectContent>
        </Select>
        
        {filterStage !== "all" && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setFilterStage("all")}
            className="text-slate-400 hover:text-white"
          >
            Limpiar filtros
          </Button>
        )}
        
        <span className="text-sm text-slate-500 ml-auto">
          {filteredProjects.length} proyectos
        </span>
      </div>

      {/* Projects Table */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-0">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No hay proyectos</h3>
              <p className="text-sm">Los proyectos ganados aparecerán aquí</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#222] hover:bg-transparent">
                  <TableHead className="text-slate-400">Proyecto</TableHead>
                  <TableHead className="text-slate-400">Empresas</TableHead>
                  <TableHead className="text-slate-400">Monto</TableHead>
                  <TableHead className="text-slate-400">Etapa</TableHead>
                  <TableHead className="text-slate-400">Contactos</TableHead>
                  <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    className="border-[#222] hover:bg-[#151515]"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{project.name}</p>
                        {project.anonymous_name && (
                          <p className="text-xs text-slate-500">({project.anonymous_name})</p>
                        )}
                        {project.services?.length > 0 && (
                          <p className="text-xs text-orange-400 mt-1">
                            {project.services.join(", ")}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {project.company_names?.length > 0 ? (
                          project.company_names.map((name, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-slate-300 text-sm">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              {name}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-400 font-medium">
                        {formatCurrency(project.amount, project.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={project.stage} 
                        onValueChange={(val) => handleStageChange(project.id, val, project.stage)}
                      >
                        <SelectTrigger className={`w-44 h-8 text-xs border ${DELIVERY_STAGE_COLORS[project.stage]} bg-transparent`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#111] border-[#333]">
                          <SelectItem value="ganados">Ganados</SelectItem>
                          <SelectItem value="contenidos_transcritos">Contenidos Transcritos</SelectItem>
                          <SelectItem value="reporte_presentado">Reporte Presentado</SelectItem>
                          <SelectItem value="caso_publicado">Caso Publicado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-400 text-sm">
                        {project.contact_ids?.length || 0} contacto(s)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openProjectDetail(project)}
                          className="text-slate-400 hover:text-white p-1"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteProject(project.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1"
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Project Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              {selectedProject?.name || "Detalle del Proyecto"}
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : selectedProject && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Monto</p>
                  <p className="text-green-400 font-bold">
                    {formatCurrency(selectedProject.amount, selectedProject.currency)}
                  </p>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Etapa Delivery</p>
                  <Badge className={`${DELIVERY_STAGE_COLORS[selectedProject.stage]} border`}>
                    {DELIVERY_STAGE_LABELS[selectedProject.stage]}
                  </Badge>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Movido a Delivery</p>
                  <p className="text-white text-sm">{formatDate(selectedProject.delivery_moved_at)}</p>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Nombre Anónimo</p>
                  <p className="text-white text-sm">{selectedProject.anonymous_name || "-"}</p>
                </div>
              </div>
              
              {/* Services */}
              {selectedProject.services?.length > 0 && (
                <div className="p-3 bg-[#0a0a0a] rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">Servicios</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.services.map((service, idx) => (
                      <Badge key={idx} className="bg-orange-500/20 text-orange-400">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Companies */}
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                  <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-300">Empresas ({selectedProject.companies?.length || 0})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-6">
                    {selectedProject.companies?.length > 0 ? (
                      selectedProject.companies.map((company) => (
                        <div key={company.id} className="p-3 bg-[#0a0a0a] rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{company.name}</p>
                            <p className="text-xs text-slate-500">
                              {[company.industry, company.city, company.country].filter(Boolean).join(" • ")}
                            </p>
                          </div>
                          {company.domain && (
                            <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No hay empresas asociadas</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Contacts */}
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                  <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                  <Users className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-slate-300">Contactos ({selectedProject.contacts?.length || 0})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-6">
                    {selectedProject.contacts?.length > 0 ? (
                      selectedProject.contacts.map((contact) => (
                        <div key={contact.id} className="p-3 bg-[#0a0a0a] rounded-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white">{contact.name}</p>
                                {contact.stage && (
                                  <Badge className="text-[10px] bg-emerald-700">Stage {contact.stage}</Badge>
                                )}
                                {contact.buyer_persona && (
                                  <Badge className="text-[10px] bg-slate-700">{contact.buyer_persona}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{contact.job_title || "-"} • {contact.company || "-"}</p>
                              
                              {/* Email and Phone with copy */}
                              <div className="mt-2 space-y-1">
                                {contact.email && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Mail className="w-3 h-3 text-slate-500" />
                                    <span className="text-slate-300">{contact.email}</span>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(contact.email); toast.success("Email copiado"); }}
                                      className="text-slate-500 hover:text-white"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                {contact.phone && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    <span className="text-slate-300">{contact.phone}</span>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(contact.phone); toast.success("Teléfono copiado"); }}
                                      className="text-slate-500 hover:text-white"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingContact(contact); setEditContactOpen(true); }}
                                className="text-slate-400 hover:text-white h-7 px-2"
                                title="Editar contacto"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              {contact.email && (
                                <a 
                                  href={`mailto:${contact.email}`} 
                                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-2"
                                >
                                  <Mail className="w-3 h-3" /> Email
                                </a>
                              )}
                              {contact.phone && (
                                <a 
                                  href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 px-2"
                                >
                                  <Phone className="w-3 h-3" /> WhatsApp
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">No hay contactos asociados</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Quotes */}
              {selectedProject.quotes?.length > 0 && (
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">Cotizaciones ({selectedProject.quotes?.length || 0})</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-6">
                      {selectedProject.quotes.map((quote, idx) => (
                        <div key={quote.hubspot_quote_id || quote.id || idx} className="p-3 bg-[#0a0a0a] rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{quote.title}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Badge className="text-[10px] bg-slate-700">
                                {quote.source === 'hubspot_native' ? 'HubSpot' : quote.source === 'google_drive' ? 'Google Drive' : 'Manual'}
                              </Badge>
                              {quote.amount && <span>{formatCurrency(parseFloat(quote.amount))}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(quote.public_url || quote.url) && (
                              <a href={quote.public_url || quote.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Objectives */}
              {(selectedProject.objective_business_results || selectedProject.objective_behavior_change || 
                selectedProject.objective_learning || selectedProject.objective_experience) && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                    <Target className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-slate-300">Objetivos</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-6">
                      {selectedProject.objective_business_results && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Resultados de Negocio</p>
                          <p className="text-sm text-slate-300">{selectedProject.objective_business_results}</p>
                        </div>
                      )}
                      {selectedProject.objective_behavior_change && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Cambio de Comportamiento</p>
                          <p className="text-sm text-slate-300">{selectedProject.objective_behavior_change}</p>
                        </div>
                      )}
                      {selectedProject.objective_learning && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Aprendizaje</p>
                          <p className="text-sm text-slate-300">{selectedProject.objective_learning}</p>
                        </div>
                      )}
                      {selectedProject.objective_experience && (
                        <div className="p-3 bg-[#0a0a0a] rounded-lg">
                          <p className="text-xs text-yellow-400 mb-1">Experiencia</p>
                          <p className="text-sm text-slate-300">{selectedProject.objective_experience}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              
              {/* Drive Links */}
              {(selectedProject.slides_url || selectedProject.report_url || selectedProject.case_drive_url || 
                selectedProject.alignment_calls_transcription || selectedProject.students_transcription) && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left p-2 hover:bg-[#151515] rounded">
                    <ChevronRight className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-90" />
                    <Link2 className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-slate-300">Archivos y Enlaces</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 grid grid-cols-2 gap-2 pl-6">
                      {selectedProject.slides_url && (
                        <a href={selectedProject.slides_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <PlayCircle className="w-4 h-4" />
                          <span className="text-sm">Slides</span>
                        </a>
                      )}
                      {selectedProject.report_url && (
                        <a href={selectedProject.report_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <FileSpreadsheet className="w-4 h-4" />
                          <span className="text-sm">Reporte</span>
                        </a>
                      )}
                      {selectedProject.case_drive_url && (
                        <a href={selectedProject.case_drive_url} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <Briefcase className="w-4 h-4" />
                          <span className="text-sm">Caso en Drive</span>
                        </a>
                      )}
                      {selectedProject.alignment_calls_transcription && (
                        <a href={selectedProject.alignment_calls_transcription} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">Transcripciones Alineación</span>
                        </a>
                      )}
                      {selectedProject.students_transcription && (
                        <a href={selectedProject.students_transcription} target="_blank" rel="noopener noreferrer" className="p-3 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] flex items-center gap-2 text-cyan-400">
                          <GraduationCap className="w-4 h-4" />
                          <span className="text-sm">Transcripciones Alumnos</span>
                        </a>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => moveBackToCases(selectedProject?.id)} 
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Devolver a Cases
            </Button>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)} className="border-[#333]">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Edit Sheet */}
      <ContactSheet
        contact={editingContact}
        open={editContactOpen}
        onOpenChange={(open) => {
          setEditContactOpen(open);
          if (!open) {
            setEditingContact(null);
            if (selectedProject?.id) {
              openProjectDetail(selectedProject);
            }
          }
        }}
      />

      {/* Stage 5 Confirmation Dialog */}
      <Dialog open={stage5ConfirmOpen} onOpenChange={(open) => {
        if (!open) {
          setStage5ConfirmOpen(false);
          setStage5PendingProject(null);
          setStage5ContactsSummary(null);
        }
      }}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-400">
              <Users className="w-5 h-5" />
              {stage5PendingProject?.newStage === "concluidos" 
                ? "Mover Alumnos/Coachees a Stage 5"
                : "Mover contactos a Stage 5"
              }
            </DialogTitle>
          </DialogHeader>
          
          {loadingStage5Summary ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : stage5ContactsSummary && (
            <div className="py-4 space-y-4">
              {stage5PendingProject?.newStage === "concluidos" ? (
                <>
                  <p className="text-slate-300">
                    Al mover este proyecto a <span className="font-bold text-cyan-400">Concluidos</span>, 
                    se moverán <span className="font-bold text-white">{stage5ContactsSummary.will_move_to_stage5}</span> contactos 
                    con rol de Alumno/Coachee a Stage 5 (Repurchase).
                  </p>
                  
                  {stage5ContactsSummary.will_move_to_stage5 > 0 && (
                    <div className="bg-[#0a0a0a] rounded-lg p-4 max-h-48 overflow-y-auto">
                      <p className="text-xs text-slate-500 mb-3">Contactos que serán movidos:</p>
                      <div className="space-y-2">
                        {stage5ContactsSummary.contacts_to_move?.map((contact) => (
                          <div key={contact.id} className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">{contact.name}</span>
                            <div className="flex gap-1">
                              {contact.roles?.map((role, idx) => (
                                <Badge key={idx} className="bg-slate-700 text-white text-xs">
                                  {ROLE_LABELS[role] || role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-slate-300">
                    ¿Estás seguro de que quieres mover <span className="font-bold text-white">{stage5ContactsSummary.will_move_to_stage5}</span> contactos a Stage 5 (Repurchase)?
                  </p>
                  
                  <div className="bg-[#0a0a0a] rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-3">Desglose por rol:</p>
                    <div className="space-y-2">
                      {Object.entries(stage5ContactsSummary.by_role || {})
                        .sort((a, b) => b[1] - a[1])
                        .map(([role, count]) => (
                          <div key={role} className="flex items-center justify-between">
                            <span className="text-sm text-slate-300">
                              {ROLE_LABELS[role] || role}
                            </span>
                            <Badge className="bg-slate-700 text-white">{count}</Badge>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </>
              )}
              
              <p className="text-xs text-amber-400">
                ⚠️ Esta acción no se puede deshacer automáticamente. Los contactos permanecerán en Stage 5.
              </p>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setStage5ConfirmOpen(false);
                setStage5PendingProject(null);
                setStage5ContactsSummary(null);
              }} 
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmMoveToStage5}
              disabled={loadingStage5Summary}
              className={`text-white ${
                stage5PendingProject?.newStage === "concluidos" 
                  ? "bg-cyan-600 hover:bg-cyan-700" 
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {stage5PendingProject?.newStage === "concluidos" 
                ? `Confirmar (${stage5ContactsSummary?.will_move_to_stage5 || 0} contactos)`
                : "Confirmar y mover a Stage 5"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
