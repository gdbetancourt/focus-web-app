import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Plus,
  RefreshCw,
  Bug,
  Sparkles,
  Wrench,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Edit,
  ChevronRight,
  Download,
  Flame,
  AlertCircle,
} from "lucide-react";

const STAGES = [
  { key: "por_desarrollar", label: "Por Desarrollar", color: "bg-slate-700" },
  { key: "en_desarrollo", label: "En Desarrollo", color: "bg-blue-700" },
  { key: "por_aprobar", label: "Por Aprobar", color: "bg-yellow-700" },
  { key: "aprobado", label: "Aprobado", color: "bg-green-700" },
];

const CATEGORIES = [
  { value: "bug", label: "Bug", icon: Bug, color: "text-red-400 border-red-500/30" },
  { value: "feature", label: "Feature", icon: Sparkles, color: "text-purple-400 border-purple-500/30" },
  { value: "improvement", label: "Mejora", icon: Wrench, color: "text-blue-400 border-blue-500/30" },
  { value: "refactor", label: "Refactor", icon: RefreshCw, color: "text-teal-400 border-teal-500/30" },
];

const PRIORITIES = [
  { value: "critical", label: "Crítico", icon: Flame, color: "bg-red-500" },
  { value: "high", label: "Alto", icon: AlertCircle, color: "bg-orange-500" },
  { value: "medium", label: "Medio", color: "bg-yellow-500" },
  { value: "low", label: "Bajo", color: "bg-slate-500" },
];

export default function DevKanban() {
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState({
    por_desarrollar: [],
    en_desarrollo: [],
    por_aprobar: [],
    aprobado: [],
  });
  const [counts, setCounts] = useState({});
  
  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    category: "feature",
    module: "",
    priority: "medium",
    details: "",
    estimated_credits: "",
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/dev-kanban/tasks");
      setGrouped(res.data.grouped || {});
      setCounts(res.data.counts || {});
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Error cargando tareas");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !taskForm.description) {
      toast.error("Título y descripción son requeridos");
      return;
    }

    try {
      if (editingTask) {
        await api.put(`/dev-kanban/tasks/${editingTask.id}`, taskForm);
        toast.success("Tarea actualizada");
      } else {
        await api.post("/dev-kanban/tasks", taskForm);
        toast.success("Tarea creada");
      }
      setShowAddDialog(false);
      setEditingTask(null);
      setTaskForm({
        title: "",
        description: "",
        category: "feature",
        module: "",
        priority: "medium",
        details: "",
        estimated_credits: "",
      });
      loadTasks();
    } catch (error) {
      toast.error("Error guardando tarea");
    }
  };

  const moveTask = async (taskId, newStage) => {
    try {
      await api.post(`/dev-kanban/tasks/${taskId}/move?new_stage=${newStage}`);
      loadTasks();
    } catch (error) {
      toast.error("Error moviendo tarea");
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    try {
      await api.delete(`/dev-kanban/tasks/${taskId}`);
      toast.success("Tarea eliminada");
      loadTasks();
    } catch (error) {
      toast.error("Error eliminando tarea");
    }
  };

  const exportForFork = async () => {
    try {
      const res = await api.get("/dev-kanban/export");
      await navigator.clipboard.writeText(res.data.export_text);
      toast.success("Kanban exportado al portapapeles");
    } catch (error) {
      toast.error("Error exportando");
    }
  };

  const getCategoryInfo = (category) => CATEGORIES.find(c => c.value === category) || CATEGORIES[1];
  const getPriorityInfo = (priority) => PRIORITIES.find(p => p.value === priority) || PRIORITIES[2];

  const getNextStage = (currentStage) => {
    const idx = STAGES.findIndex(s => s.key === currentStage);
    return idx < STAGES.length - 1 ? STAGES[idx + 1].key : null;
  };

  const getPrevStage = (currentStage) => {
    const idx = STAGES.findIndex(s => s.key === currentStage);
    return idx > 0 ? STAGES[idx - 1].key : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dev-kanban-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban de Desarrollo</h1>
          <p className="text-sm text-slate-500">
            {counts.total || 0} tareas · {counts.por_desarrollar || 0} pendientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportForFork}
            className="border-[#333]"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTasks}
            className="border-[#333]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {
              setEditingTask(null);
              setTaskForm({
                title: "",
                description: "",
                category: "feature",
                module: "",
                priority: "medium",
                details: "",
                estimated_credits: "",
              });
              setShowAddDialog(true);
            }}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
            data-testid="add-task-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className="space-y-3">
            {/* Column Header */}
            <div className={`p-3 rounded-lg ${stage.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">{stage.label}</h3>
                <Badge variant="secondary" className="bg-white/20 text-white">
                  {grouped[stage.key]?.length || 0}
                </Badge>
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-2 min-h-[200px]">
              {grouped[stage.key]?.map((task) => {
                const catInfo = getCategoryInfo(task.category);
                const prioInfo = getPriorityInfo(task.priority);
                const CatIcon = catInfo.icon || Sparkles;

                return (
                  <Card
                    key={task.id}
                    className="bg-[#111] border-[#222] hover:border-[#333] transition-colors cursor-pointer"
                    onClick={() => {
                      setEditingTask(task);
                      setTaskForm({
                        title: task.title,
                        description: task.description,
                        category: task.category,
                        module: task.module || "",
                        priority: task.priority,
                        details: task.details || "",
                        estimated_credits: task.estimated_credits || "",
                      });
                      setShowAddDialog(true);
                    }}
                  >
                    <CardContent className="p-3 space-y-2">
                      {/* Category & Priority */}
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={catInfo.color}>
                          <CatIcon className="w-3 h-3 mr-1" />
                          {catInfo.label}
                        </Badge>
                        <div className={`w-2 h-2 rounded-full ${prioInfo.color}`} title={prioInfo.label} />
                      </div>

                      {/* Title */}
                      <p className="font-medium text-white text-sm line-clamp-2">{task.title}</p>

                      {/* Module */}
                      {task.module && (
                        <p className="text-xs text-slate-500">Módulo: {task.module}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#222]">
                        <div className="flex gap-1">
                          {getPrevStage(task.stage) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-slate-500 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveTask(task.id, getPrevStage(task.stage));
                              }}
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </Button>
                          )}
                          {getNextStage(task.stage) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-slate-500 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveTask(task.id, getNextStage(task.stage));
                              }}
                            >
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#111] border-[#222] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingTask ? "Editar Tarea" : "Nueva Tarea"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Documenta el detalle para que no se pierda en el siguiente fork
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Title */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Título *</label>
              <Input
                placeholder="Descripción corta de la tarea"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Descripción *</label>
              <Textarea
                placeholder="Qué se necesita hacer"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="bg-[#0a0a0a] border-[#333] min-h-[80px]"
              />
            </div>

            {/* Category & Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Categoría</label>
                <Select
                  value={taskForm.category}
                  onValueChange={(v) => setTaskForm({ ...taskForm, category: v })}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#333]">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Prioridad</label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#333]">
                    {PRIORITIES.map((prio) => (
                      <SelectItem key={prio.value} value={prio.value}>
                        {prio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Module */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Módulo (ej: 1.1.1, 2.2.6.1)</label>
              <Input
                placeholder="Identificador del módulo afectado"
                value={taskForm.module}
                onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>

            {/* Details */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Detalles de Implementación</label>
              <Textarea
                placeholder="Archivos involucrados, endpoints, lógica específica..."
                value={taskForm.details}
                onChange={(e) => setTaskForm({ ...taskForm, details: e.target.value })}
                className="bg-[#0a0a0a] border-[#333] min-h-[100px]"
              />
            </div>

            {/* Estimated Credits */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Créditos AI Estimados</label>
              <Input
                placeholder="ej: 0 (no AI), bajo, medio, alto"
                value={taskForm.estimated_credits}
                onChange={(e) => setTaskForm({ ...taskForm, estimated_credits: e.target.value })}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveTask} className="bg-[#ff3300] hover:bg-[#cc2900]">
              {editingTask ? "Guardar" : "Crear Tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
