/**
 * TasksTab - Tasks management tab for ContactSheet
 * Extracted from ContactSheet.jsx for maintainability
 */
import { Label } from "../ui/label";
import { 
  Loader2, 
  ListTodo, 
  Clock, 
  Circle, 
  CheckCircle, 
  Calendar, 
  Mail, 
  AlertCircle,
  ExternalLink 
} from "lucide-react";

export function TasksTab({
  contactTasks,
  loadingTasks,
  onToggleTaskComplete
}) {
  const handleToggle = (taskId) => {
    if (onToggleTaskComplete) {
      onToggleTaskComplete(taskId);
    }
  };

  return (
    <div className="space-y-4">
      {loadingTasks ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-yellow-400" />
        </div>
      ) : (contactTasks.pending.length + contactTasks.completed.length) === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay tareas asociadas a este contacto</p>
          <p className="text-xs mt-2">Las tareas se crean desde la pestaña 2DO o al marcar correos con estrella en Gmail</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending Tasks */}
          {contactTasks.pending.length > 0 && (
            <div>
              <Label className="text-slate-400 text-sm flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4" />
                Pendientes ({contactTasks.pending.length})
              </Label>
              <div className="space-y-2">
                {contactTasks.pending.map((task) => (
                  <div 
                    key={task.id}
                    className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggle(task.id)}
                        className="mt-0.5 text-slate-500 hover:text-green-400 transition-colors"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {task.source === "gmail_starred" && (
                            <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <span className="text-white font-medium">{task.title}</span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-400 mb-2 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs">
                          {task.due_date && (
                            <span className={`flex items-center gap-1 ${
                              new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              {new Date(task.due_date) < new Date() && <AlertCircle className="w-3 h-3" />}
                              <Calendar className="w-3 h-3" />
                              {new Date(task.due_date).toLocaleDateString('es-MX', {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          )}
                          {task.gmail_link && (
                            <a
                              href={task.gmail_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Ver email
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {contactTasks.completed.length > 0 && (
            <div>
              <Label className="text-slate-400 text-sm flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Completadas ({contactTasks.completed.length})
              </Label>
              <div className="space-y-2">
                {contactTasks.completed.map((task) => (
                  <div 
                    key={task.id}
                    className="p-3 rounded-lg bg-[#0a0a0a] border border-[#222] opacity-60"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggle(task.id)}
                        className="mt-0.5 text-green-500 hover:text-slate-400 transition-colors"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-400 line-through">{task.title}</span>
                        {task.completed_at && (
                          <p className="text-xs text-slate-500 mt-1">
                            Completada: {new Date(task.completed_at).toLocaleDateString('es-MX', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TasksTab;
