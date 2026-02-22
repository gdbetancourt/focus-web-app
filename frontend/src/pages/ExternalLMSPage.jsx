/**
 * ExternalLMSPage - LMS view for external (non-@leaderlix.com) users
 * Shows courses the user is enrolled in and their progress
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Play, Clock, Award, ChevronRight, LogOut, 
  User, Video, FileText, File, HelpCircle, Lock, CheckCircle,
  Loader2, GraduationCap
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import api from '../lib/api';

const contentTypeIcons = {
  video: Video,
  text: FileText,
  pdf: File,
  quiz: HelpCircle,
  blog: FileText
};

export default function ExternalLMSPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      // Check if user is authenticated as external user
      const authRes = await api.get('/auth/check', { withCredentials: true });
      
      if (!authRes.data.authenticated) {
        toast.error('Por favor inicia sesión para acceder al LMS');
        navigate('/');
        return;
      }

      if (authRes.data.user_type === 'staff') {
        // Staff users should go to the admin LMS
        navigate('/focus/assets/programs');
        return;
      }

      setUser(authRes.data.user);
      
      // Load user's enrolled courses
      await loadCourses(authRes.data.user.id);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async (userId) => {
    try {
      // Get courses assigned to this external user
      const res = await api.get(`/lms/external/my-courses`, { withCredentials: true });
      setCourses(res.data.courses || []);
      
      // Load progress for each course
      const progressData = {};
      for (const course of res.data.courses || []) {
        try {
          const progressRes = await api.get(`/lms/external/progress/${course.id}`, { withCredentials: true });
          progressData[course.id] = progressRes.data;
        } catch (e) {
          progressData[course.id] = { completed_lessons: [], progress_percent: 0 };
        }
      }
      setProgress(progressData);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Error cargando cursos');
    }
  };

  const selectCourse = async (course) => {
    try {
      const res = await api.get(`/lms/external/courses/${course.id}`, { withCredentials: true });
      setSelectedCourse(res.data.course);
      setSelectedLesson(null);
    } catch (error) {
      toast.error('Error cargando curso');
    }
  };

  const selectLesson = (lesson) => {
    setSelectedLesson(lesson);
    // Mark as viewed
    markLessonComplete(lesson.id);
  };

  const markLessonComplete = async (lessonId) => {
    if (!selectedCourse) return;
    
    try {
      await api.post(`/lms/external/progress/${selectedCourse.id}/complete/${lessonId}`, {}, { withCredentials: true });
      // Refresh progress
      const progressRes = await api.get(`/lms/external/progress/${selectedCourse.id}`, { withCredentials: true });
      setProgress(prev => ({
        ...prev,
        [selectedCourse.id]: progressRes.data
      }));
    } catch (error) {
      console.error('Error marking lesson complete:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
      toast.success('Sesión cerrada');
      navigate('/');
    } catch (error) {
      navigate('/');
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-400">Cargando tu espacio de aprendizaje...</p>
        </div>
      </div>
    );
  }

  // Course detail view
  if (selectedCourse) {
    const courseProgress = progress[selectedCourse.id] || { completed_lessons: [], progress_percent: 0 };
    
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        {/* Header */}
        <header className="bg-[#111] border-b border-[#222] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setSelectedCourse(null)}
                className="text-slate-400 hover:text-white"
              >
                ← Volver
              </Button>
              <h1 className="text-lg font-semibold text-white truncate">{selectedCourse.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-500/20 text-orange-400">
                {courseProgress.progress_percent}% completado
              </Badge>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar - Lesson list */}
          <aside className="w-80 bg-[#111] border-r border-[#222] min-h-[calc(100vh-57px)] overflow-y-auto">
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-400 mb-3">LECCIONES</h2>
              <div className="space-y-1">
                {(selectedCourse.lessons || []).map((lesson, index) => {
                  const Icon = contentTypeIcons[lesson.content_type] || FileText;
                  const isCompleted = courseProgress.completed_lessons?.includes(lesson.id);
                  const isSelected = selectedLesson?.id === lesson.id;
                  const isLocked = !lesson.is_free && !lesson.content_url;
                  
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => !isLocked && selectLesson(lesson)}
                      disabled={isLocked}
                      className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                        isSelected 
                          ? 'bg-orange-500/20 border border-orange-500/50' 
                          : isLocked
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`p-1.5 rounded ${
                        isCompleted ? 'bg-green-500/20' : 'bg-slate-800'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : isLocked ? (
                          <Lock className="w-4 h-4 text-slate-500" />
                        ) : (
                          <Icon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                          {index + 1}. {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(lesson.duration_minutes)}</span>
                          {lesson.is_free && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs h-4">Gratis</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-6">
            {selectedLesson ? (
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-white mb-2">{selectedLesson.title}</h2>
                {selectedLesson.description && (
                  <p className="text-slate-400 mb-6">{selectedLesson.description}</p>
                )}
                
                {/* Video content */}
                {selectedLesson.content_type === 'video' && selectedLesson.content_url && (
                  <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                    {selectedLesson.content_url.includes('vimeo') ? (
                      <iframe
                        src={`https://player.vimeo.com/video/${selectedLesson.content_url.split('/').pop()}?autoplay=0`}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    ) : selectedLesson.content_url.includes('youtube') || selectedLesson.content_url.includes('youtu.be') ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${selectedLesson.content_url.includes('youtu.be') 
                          ? selectedLesson.content_url.split('/').pop() 
                          : new URLSearchParams(new URL(selectedLesson.content_url).search).get('v')}`}
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video src={selectedLesson.content_url} controls className="w-full h-full" />
                    )}
                  </div>
                )}

                {/* Text content */}
                {selectedLesson.content_type === 'text' && selectedLesson.content_text && (
                  <div className="prose prose-invert max-w-none">
                    <div 
                      className="text-slate-300 bg-[#111] rounded-xl p-6 border border-[#222]"
                      dangerouslySetInnerHTML={{ __html: selectedLesson.content_text }}
                    />
                  </div>
                )}

                {/* PDF content */}
                {selectedLesson.content_type === 'pdf' && selectedLesson.content_url && (
                  <div className="bg-[#111] rounded-xl p-6 border border-[#222]">
                    <a 
                      href={selectedLesson.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-orange-400 hover:text-orange-300"
                    >
                      <File className="w-6 h-6" />
                      <span>Descargar PDF</span>
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {/* Blog content */}
                {selectedLesson.content_type === 'blog' && selectedLesson.content_url && (
                  <div className="bg-[#111] rounded-xl p-6 border border-[#222]">
                    <a 
                      href={selectedLesson.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-orange-400 hover:text-orange-300"
                    >
                      <FileText className="w-6 h-6" />
                      <span>Leer artículo completo</span>
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto text-center py-20">
                <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Selecciona una lección</h2>
                <p className="text-slate-500">Elige una lección del menú lateral para comenzar a aprender</p>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // Course list view
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#111] border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Mi Aprendizaje</h1>
              <p className="text-sm text-slate-500">Bienvenido, {user?.name || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="w-4 h-4" />
              <span className="text-sm">{user?.email}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No tienes cursos asignados</h2>
            <p className="text-slate-500 mb-6">
              Contacta al administrador para que te inscriba en un curso
            </p>
            <Button onClick={handleLogout} variant="outline" className="border-slate-600">
              Volver al inicio
            </Button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="bg-[#111] border-[#222]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <BookOpen className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{courses.length}</p>
                    <p className="text-sm text-slate-500">Cursos inscritos</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#111] border-[#222]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-500/20">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {courses.filter(c => (progress[c.id]?.progress_percent || 0) === 100).length}
                    </p>
                    <p className="text-sm text-slate-500">Completados</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#111] border-[#222]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-orange-500/20">
                    <Clock className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {formatDuration(courses.reduce((acc, c) => acc + (c.total_duration || 0), 0))}
                    </p>
                    <p className="text-sm text-slate-500">Contenido total</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Course grid */}
            <h2 className="text-lg font-semibold text-white mb-4">Mis Cursos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map(course => {
                const courseProgress = progress[course.id] || { progress_percent: 0 };
                
                return (
                  <Card 
                    key={course.id}
                    className="bg-[#111] border-[#222] overflow-hidden hover:border-orange-500/50 transition-all cursor-pointer group"
                    onClick={() => selectCourse(course)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-slate-800 relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img 
                          src={course.thumbnail_url} 
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-12 h-12 text-slate-600" />
                        </div>
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white ml-1" />
                        </div>
                      </div>
                      {/* Progress bar */}
                      {courseProgress.progress_percent > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                          <div 
                            className="h-full bg-orange-500"
                            style={{ width: `${courseProgress.progress_percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-white mb-1 line-clamp-2">{course.title}</h3>
                      {course.instructor_name && (
                        <p className="text-sm text-slate-500 mb-2">{course.instructor_name}</p>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          {course.lesson_count || 0} lecciones • {formatDuration(course.total_duration)}
                        </span>
                        <Badge className={`${
                          courseProgress.progress_percent === 100 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {courseProgress.progress_percent}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
