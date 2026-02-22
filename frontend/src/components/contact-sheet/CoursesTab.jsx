/**
 * CoursesTab - Courses management tab for ContactSheet
 * Extracted from ContactSheet.jsx for maintainability
 */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import api from "../../lib/api";
import { GraduationCap, Plus, Loader2, X } from "lucide-react";

export function CoursesTab({ 
  contactId,
  courses,
  loadingCourses,
  onCoursesUpdate
}) {
  // Search and enrollment state
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [availableCourses, setAvailableCourses] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  
  // Quick create course
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  
  // Welcome email
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState("");
  const [welcomeEmailMessage, setWelcomeEmailMessage] = useState("");
  
  // Unenroll dialog
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false);
  const [courseToUnenroll, setCourseToUnenroll] = useState(null);

  // Search for courses
  useEffect(() => {
    const searchCourses = async () => {
      if (!courseSearchQuery || courseSearchQuery.length < 2) {
        setAvailableCourses([]);
        return;
      }
      try {
        const response = await api.get("/lms/courses", { 
          params: { search: courseSearchQuery, limit: 20 } 
        });
        // Filter out already enrolled courses
        const enrolledIds = new Set(courses.map(c => c.course_id));
        const filtered = (response.data.courses || response.data || []).filter(c => !enrolledIds.has(c.id));
        setAvailableCourses(filtered);
      } catch (error) {
        console.error("Error searching courses:", error);
      }
    };
    
    const timer = setTimeout(searchCourses, 300);
    return () => clearTimeout(timer);
  }, [courseSearchQuery, courses]);

  const enrollInCourse = async (courseId) => {
    if (!contactId || enrolling) return;
    
    setEnrolling(true);
    try {
      await api.post(`/lms/courses/${courseId}/enroll/${contactId}`, {
        send_welcome_email: sendWelcomeEmail,
        welcome_email_subject: welcomeEmailSubject || undefined,
        welcome_email_message: welcomeEmailMessage || undefined
      });
      toast.success("Contacto enrolado en el curso");
      setCourseSearchQuery("");
      onCoursesUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enrolar en curso");
    } finally {
      setEnrolling(false);
    }
  };

  const createQuickCourse = async () => {
    if (!newCourseName.trim() || creatingCourse) return;
    
    setCreatingCourse(true);
    try {
      const response = await api.post("/lms/courses/quick-create", {
        title: newCourseName.trim(),
        is_published: false
      });
      const newCourse = response.data;
      toast.success(`Curso "${newCourseName}" creado`);
      
      // Auto-enroll
      await enrollInCourse(newCourse.id);
      
      setShowCreateCourse(false);
      setNewCourseName("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear curso");
    } finally {
      setCreatingCourse(false);
    }
  };

  const confirmUnenroll = (course) => {
    setCourseToUnenroll(course);
    setUnenrollDialogOpen(true);
  };

  const unenrollFromCourse = async () => {
    if (!courseToUnenroll || !contactId) return;
    
    try {
      await api.delete(`/lms/courses/${courseToUnenroll.course_id}/enroll/${contactId}`);
      toast.success("Contacto desenrolado del curso");
      setUnenrollDialogOpen(false);
      setCourseToUnenroll(null);
      onCoursesUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al desenrolar");
    }
  };

  return (
    <div className="space-y-4">
      {/* Enroll in new course */}
      <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30 space-y-3">
        <Label className="text-purple-400 block">Enrolar en Curso</Label>
        
        {/* Course search/select */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder="Buscar curso..."
              value={courseSearchQuery}
              onChange={(e) => setCourseSearchQuery(e.target.value)}
              className="bg-[#1a1a1a] border-[#333]"
              data-testid="course-search-input"
            />
            {courseSearchQuery && availableCourses.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg max-h-48 overflow-y-auto z-50">
                {availableCourses.slice(0, 10).map(c => (
                  <div
                    key={c.id}
                    className="px-3 py-2 hover:bg-[#252525] cursor-pointer flex items-center justify-between"
                    onClick={() => {
                      enrollInCourse(c.id);
                      setCourseSearchQuery("");
                    }}
                  >
                    <span className="text-white text-sm">{c.title || c.name}</span>
                    {!c.is_published && (
                      <Badge className="text-xs bg-yellow-500/20 text-yellow-400">Borrador</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            {courseSearchQuery && availableCourses.length === 0 && !showCreateCourse && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg p-3 z-50">
                <p className="text-slate-400 text-sm mb-2">No se encontraron cursos</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setNewCourseName(courseSearchQuery);
                    setShowCreateCourse(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                >
                  <Plus className="w-4 h-4 mr-1" /> Crear "{courseSearchQuery}"
                </Button>
              </div>
            )}
          </div>
          {enrolling && <Loader2 className="w-5 h-5 animate-spin text-purple-400 self-center" />}
        </div>

        {/* Quick create course */}
        {showCreateCourse && (
          <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#333] space-y-3">
            <Label className="text-slate-300 text-sm">Crear nuevo curso</Label>
            <Input
              placeholder="Nombre del curso"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              className="bg-[#252525] border-[#333]"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={createQuickCourse}
                disabled={!newCourseName.trim() || creatingCourse}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {creatingCourse ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Crear y enrolar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreateCourse(false);
                  setNewCourseName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Welcome email option */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sendWelcomeEmail"
              checked={sendWelcomeEmail}
              onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              className="rounded border-[#333] bg-[#1a1a1a]"
            />
            <Label htmlFor="sendWelcomeEmail" className="text-slate-300 text-sm cursor-pointer">
              Enviar email de bienvenida al enrolar
            </Label>
          </div>
          
          {sendWelcomeEmail && (
            <div className="space-y-2 pl-5">
              <Input
                placeholder="Asunto del email"
                value={welcomeEmailSubject}
                onChange={(e) => setWelcomeEmailSubject(e.target.value)}
                className="bg-[#1a1a1a] border-[#333] text-sm"
              />
              <Textarea
                placeholder="Mensaje personalizado (opcional)"
                value={welcomeEmailMessage}
                onChange={(e) => setWelcomeEmailMessage(e.target.value)}
                className="bg-[#1a1a1a] border-[#333] text-sm min-h-[80px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Enrolled courses */}
      {loadingCourses ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-400" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No está enrolado en ningún curso</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-slate-400 text-sm">Cursos Enrolados ({courses.length})</Label>
          {courses.map(course => (
            <div key={course.course_id} className="p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {course.course_thumbnail ? (
                    <img 
                      src={course.course_thumbnail} 
                      alt={course.course_title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-purple-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium">{course.course_title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {course.enrolled_at && (
                        <span>Enrolado: {new Date(course.enrolled_at).toLocaleDateString('es-ES')}</span>
                      )}
                      {!course.is_published && (
                        <Badge className="text-xs bg-yellow-500/20 text-yellow-400">Borrador</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => confirmUnenroll(course)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4 mr-1" /> Desenrolar
                </Button>
              </div>
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Progreso</span>
                  <span>{course.completed_lessons}/{course.total_lessons} lecciones ({course.progress_percent}%)</span>
                </div>
                <div className="w-full h-2 bg-[#252525] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${course.progress_percent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unenroll confirmation dialog */}
      <Dialog open={unenrollDialogOpen} onOpenChange={setUnenrollDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar desenrolamiento</DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que deseas desenrolar a este contacto del curso "{courseToUnenroll?.course_title}"?
              <br /><br />
              Esta acción eliminará el acceso del contacto al curso y su progreso se mantendrá en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setUnenrollDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={unenrollFromCourse}
              className="bg-red-600 hover:bg-red-700"
            >
              Desenrolar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CoursesTab;
