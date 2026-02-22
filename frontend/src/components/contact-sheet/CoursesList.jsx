/**
 * CoursesList - Display and manage course enrollments
 */
import { GraduationCap, Calendar, CheckCircle2, Clock, BookOpen } from "lucide-react";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";

export function CoursesList({ courses = [], loading = false }) {
  if (loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
        <p>Cargando cursos...</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay cursos asignados</p>
      </div>
    );
  }

  const completedCount = courses.filter(c => c.status === 'completed' || c.progress >= 100).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-slate-400 text-sm">
          Cursos Asignados ({courses.length})
        </Label>
        <div className="text-xs text-slate-500">
          Completados: {completedCount}
        </div>
      </div>
      
      {courses.map((course, idx) => (
        <CourseCard key={course.course_id || idx} course={course} />
      ))}
    </div>
  );
}

function CourseCard({ course }) {
  const progress = course.progress || 0;
  const isCompleted = course.status === 'completed' || progress >= 100;
  const isInProgress = progress > 0 && progress < 100;
  
  return (
    <div 
      className={`p-3 rounded-lg border ${
        isCompleted 
          ? 'bg-green-500/10 border-green-500/30' 
          : isInProgress
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-[#1a1a1a] border-[#222]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          isCompleted ? 'bg-green-500/20' : 'bg-slate-500/20'
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <BookOpen className="w-5 h-5 text-slate-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs ${
              isCompleted
                ? 'bg-green-500/20 text-green-400'
                : isInProgress
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-slate-500/20 text-slate-400'
            }`}>
              {isCompleted ? '✓ Completado' : isInProgress ? '◐ En progreso' : '○ Pendiente'}
            </Badge>
          </div>
          
          <p className="text-white font-medium truncate">
            {course.course_name || course.name || 'Curso'}
          </p>
          
          {/* Progress bar */}
          {!isCompleted && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Progreso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            {course.enrolled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Inscrito: {new Date(course.enrolled_at).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short'
                })}
              </span>
            )}
            {course.completed_at && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Completado: {new Date(course.completed_at).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short'
                })}
              </span>
            )}
            {course.last_activity && !isCompleted && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Última actividad: {new Date(course.last_activity).toLocaleDateString('es-MX')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoursesList;
