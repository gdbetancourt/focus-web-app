/**
 * TodoTabContent - Task management tab
 * 
 * Features:
 * - Create manual tasks
 * - Sync starred Gmail emails as tasks
 * - Filter by status, priority
 * - Task completion with due date indicators
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  Plus,
  RefreshCw,
  CheckCircle,
  Circle,
  Mail,
  Calendar,
  Clock,
  Star,
  ExternalLink,
  Trash2,
  Edit,
  MoreVertical,
  AlertCircle,
  User,
  Filter,
  ChevronDown,
} from "lucide-react";

// Priority badge component (moved outside to avoid re-renders)
const PriorityBadge = ({ priority }) => {
  const config = {
    high: { label: "Alta", class: "bg-red-500/20 text-red-400 border-red-500/30" },
    medium: { label: "Media", class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    low: { label: "Baja", class: "bg-green-500/20 text-green-400 border-green-500/30" }
  };
  const c = config[priority] || config.medium;
  return <Badge variant="outline" className={c.class}>{c.label}</Badge>;
};

export function TodoTabContent() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("pending"); // all, pending, completed
  
  // Create task dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium"
  });
  const [creating, setCreating] = useState(false);
  
  // Edit task dialog
  const [editingTask, setEditingTask] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/?status=${filter}`);
      setTasks(res.data.tasks || []);
      setStats(res.data.stats || { total: 0, pending: 0, completed: 0, overdue: 0 });
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Sync starred emails
  const handleSyncGmail = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/tasks/sync-starred-emails");
      if (res.data.created > 0) {
        toast.success(`${res.data.created} tareas creadas de correos con estrella`);
        loadTasks();
      } else if (res.data.skipped_existing > 0) {
        toast.info(`No hay nuevos correos con estrella (${res.data.skipped_existing} ya sincronizados)`);
      } else {
        toast.info("No hay correos con estrella en los últimos 7 días");
      }
    } catch (error) {
      console.error("Error syncing Gmail:", error);
      const message = error.response?.data?.detail || "Error al sincronizar Gmail";
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  // Create task
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("El título es requerido");
      return;
    }
    
    setCreating(true);
    try {
      await api.post("/tasks/", newTask);
      toast.success("Tarea creada");
      setShowCreateDialog(false);
      setNewTask({ title: "", description: "", due_date: "", priority: "medium" });
      loadTasks();
    } catch (error) {
      toast.error("Error al crear tarea");
    } finally {
      setCreating(false);
    }
  };

  // Toggle task completion
  const handleToggleComplete = async (taskId) => {
    try {
      const res = await api.post(`/tasks/${taskId}/toggle-complete`);
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, is_completed: res.data.is_completed }
          : t
      ));
      // Update stats
      if (res.data.is_completed) {
        setStats(prev => ({ ...prev, pending: prev.pending - 1, completed: prev.completed + 1 }));
      } else {
        setStats(prev => ({ ...prev, pending: prev.pending + 1, completed: prev.completed - 1 }));
      }
    } catch (error) {
      toast.error("Error al actualizar tarea");
    }
  };

  // Update task
  const handleUpdateTask = async () => {
    if (!editingTask) return;
    
    try {
      await api.put(`/tasks/${editingTask.id}`, {
        title: editingTask.title,
        description: editingTask.description,
        notes: editingTask.notes,
        due_date: editingTask.due_date,
        priority: editingTask.priority
      });
      toast.success("Tarea actualizada");
      setShowEditDialog(false);
      setEditingTask(null);
      loadTasks();
    } catch (error) {
      toast.error("Error al actualizar tarea");
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success("Tarea eliminada");
      loadTasks();
    } catch (error) {
      toast.error("Error al eliminar tarea");
    }
  };

  // Format due date with color indicator
  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let color = "text-slate-400";
    let icon = <Calendar className="w-3.5 h-3.5" />;
    
    if (diffDays < 0) {
      color = "text-red-400";
      icon = <AlertCircle className="w-3.5 h-3.5" />;
    } else if (diffDays === 0) {
      color = "text-yellow-400";
      icon = <Clock className="w-3.5 h-3.5" />;
    } else if (diffDays <= 2) {
      color = "text-orange-400";
    }
    
    const formatted = date.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
    
    return (
      <span className={`flex items-center gap-1 ${color}`}>
        {icon}
        {formatted}
      </span>
    );
  };

  return (
    <div className="space-y-4" data-testid="todo-tab">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">2DO</h2>
          <div className="flex items-center gap-2 text-sm">
            <Badge className="bg-yellow-500/20 text-yellow-400">
              {stats.pending} pendientes
            </Badge>
            {stats.overdue > 0 && (
              <Badge className="bg-red-500/20 text-red-400">
                {stats.overdue} vencidas
              </Badge>
            )}
            <Badge className="bg-green-500/20 text-green-400">
              {stats.completed} completadas
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-[#333] gap-2">
                <Filter className="w-4 h-4" />
                {filter === "all" ? "Todas" : filter === "pending" ? "Pendientes" : "Completadas"}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#111] border-[#333]">
              <DropdownMenuItem onClick={() => setFilter("all")}>
                Todas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("pending")}>
                Pendientes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("completed")}>
                Completadas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Sync Gmail button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncGmail}
            disabled={syncing}
            className="border-[#333] gap-2"
            data-testid="btn-sync-gmail"
          >
            <Star className={`w-4 h-4 text-yellow-400 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Gmail
          </Button>
          
          {/* Create task button */}
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="bg-[#ff3300] hover:bg-[#e62e00] gap-2"
            data-testid="btn-create-task"
          >
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </Button>
          
          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={loadTasks}
            className="border-[#333]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tasks list */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Cargando tareas...
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p className="text-lg font-medium text-white mb-2">
                {filter === "pending" ? "No hay tareas pendientes" : 
                 filter === "completed" ? "No hay tareas completadas" : 
                 "No hay tareas"}
              </p>
              <p className="mb-4">
                Crea una tarea manualmente o sincroniza correos con estrella de Gmail.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-[#ff3300] hover:bg-[#e62e00] gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Tarea
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncGmail}
                  className="border-[#333] gap-2"
                >
                  <Star className="w-4 h-4 text-yellow-400" />
                  Sincronizar Gmail
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-lg border transition-all ${
                    task.is_completed 
                      ? 'bg-[#0a0a0a] border-[#1a1a1a] opacity-60' 
                      : 'bg-[#111] border-[#222] hover:border-[#333]'
                  }`}
                  data-testid={`task-${task.id}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      className={`mt-0.5 shrink-0 ${
                        task.is_completed ? 'text-green-500' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {task.is_completed ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {task.source === "gmail_starred" && (
                              <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <span className={`font-medium ${
                              task.is_completed ? 'line-through text-slate-500' : 'text-white'
                            }`}>
                              {task.title}
                            </span>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-slate-500 mb-2 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          
                          {/* Meta info */}
                          <div className="flex items-center flex-wrap gap-3 text-xs">
                            {task.due_date && (
                              <div className="flex items-center">
                                {formatDueDate(task.due_date)}
                              </div>
                            )}
                            
                            <PriorityBadge priority={task.priority} />
                            
                            {task.contact && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <User className="w-3.5 h-3.5" />
                                {task.contact.name}
                              </span>
                            )}
                            
                            {task.gmail_link && (
                              <a
                                href={task.gmail_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Ver email
                              </a>
                            )}
                          </div>
                          
                          {/* Notes */}
                          {task.notes && (
                            <div className="mt-2 p-2 bg-[#0a0a0a] rounded text-xs text-slate-400 border-l-2 border-[#ff3300]">
                              {task.notes}
                            </div>
                          )}
                        </div>
                        
                        {/* Actions menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#111] border-[#333]">
                            <DropdownMenuItem onClick={() => {
                              setEditingTask(task);
                              setShowEditDialog(true);
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#333]" />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#111] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Nueva Tarea</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Título *</label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="¿Qué necesitas hacer?"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Descripción</label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalles adicionales..."
                className="bg-[#0a0a0a] border-[#333] min-h-[80px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Fecha límite</label>
                <Input
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Prioridad</label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111] border-[#333]">
                    <SelectItem value="high">🔴 Alta</SelectItem>
                    <SelectItem value="medium">🟡 Media</SelectItem>
                    <SelectItem value="low">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={creating}
              className="bg-[#ff3300] hover:bg-[#e62e00]"
            >
              {creating ? "Creando..." : "Crear Tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[#111] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
          </DialogHeader>
          
          {editingTask && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Título *</label>
                <Input
                  value={editingTask.title}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Descripción</label>
                <Textarea
                  value={editingTask.description || ""}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-[#0a0a0a] border-[#333] min-h-[80px]"
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Notas</label>
                <Textarea
                  value={editingTask.notes || ""}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Agrega notas sobre esta tarea..."
                  className="bg-[#0a0a0a] border-[#333] min-h-[60px]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Fecha límite</label>
                  <Input
                    type="datetime-local"
                    value={editingTask.due_date?.slice(0, 16) || ""}
                    onChange={(e) => setEditingTask(prev => ({ ...prev, due_date: e.target.value }))}
                    className="bg-[#0a0a0a] border-[#333]"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Prioridad</label>
                  <Select
                    value={editingTask.priority}
                    onValueChange={(value) => setEditingTask(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111] border-[#333]">
                      <SelectItem value="high">🔴 Alta</SelectItem>
                      <SelectItem value="medium">🟡 Media</SelectItem>
                      <SelectItem value="low">🟢 Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {editingTask.contact && (
                <div className="p-3 bg-[#0a0a0a] rounded border border-[#222]">
                  <label className="text-sm text-slate-400 mb-1 block">Contacto asociado</label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-white">{editingTask.contact.name}</span>
                    {editingTask.contact.email && (
                      <span className="text-slate-500">({editingTask.contact.email})</span>
                    )}
                  </div>
                </div>
              )}
              
              {editingTask.gmail_link && (
                <a
                  href={editingTask.gmail_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <Mail className="w-4 h-4" />
                  Ver email original en Gmail
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateTask}
              className="bg-[#ff3300] hover:bg-[#e62e00]"
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TodoTabContent;
