import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BookOpen, Play, Clock, CheckCircle, Lock, ChevronLeft, 
  FileText, File, Video, Award, User, ArrowRight, Newspaper
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
  quiz: Award,
  blog: Newspaper
};

// Course Catalog Component
export const CourseCatalog = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const res = await api.get('/lms/public/courses');
      setCourses(res.data.courses || []);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="course-catalog">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Learning Center</h1>
        <p className="text-slate-400">Develop your communication and leadership skills</p>
      </div>

      {/* Course Grid */}
      {courses.length === 0 ? (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">No Courses Available</h3>
            <p className="text-slate-500">Check back soon for new learning content!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => (
            <Card 
              key={course.id} 
              className="bg-[#111] border-[#222] hover:border-blue-500/50 transition-all cursor-pointer group"
              onClick={() => navigate(`/learn/course/${course.id}`)}
              data-testid={`course-card-${course.id}`}
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative h-40 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-t-lg overflow-hidden">
                  {course.thumbnail_url ? (
                    <img 
                      src={course.thumbnail_url} 
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <BookOpen className="w-16 h-16 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Play className="w-4 h-4 mr-2" />
                      Start Learning
                    </Button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <div className="flex gap-2 mb-2">
                    {course.formato_name && (
                      <Badge className="bg-blue-500/20 text-blue-400 text-xs">{course.formato_name}</Badge>
                    )}
                    {course.enfoque_name && (
                      <Badge className="bg-green-500/20 text-green-400 text-xs">{course.enfoque_name}</Badge>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-white mb-2 line-clamp-2">{course.title}</h3>
                  
                  {course.description && (
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">{course.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {course.lesson_count} lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDuration(course.total_duration)}
                      </span>
                    </div>
                    {course.free_lessons > 0 && (
                      <Badge className="bg-green-500/20 text-green-400 text-xs">
                        {course.free_lessons} free
                      </Badge>
                    )}
                  </div>
                  
                  {course.instructor_name && (
                    <div className="mt-3 pt-3 border-t border-[#222] flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-400">{course.instructor_name}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Course Detail Component
export const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState(null);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    loadCourse();
    loadProgress();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      const res = await api.get(`/lms/public/courses/${courseId}`);
      setCourse(res.data.course);
      
      // Auto-select first lesson or first free lesson
      const lessons = res.data.course?.lessons || [];
      const firstFree = lessons.find(l => l.is_free);
      const firstLesson = firstFree || lessons[0];
      if (firstLesson) setActiveLesson(firstLesson);
    } catch (error) {
      console.error('Error loading course:', error);
      toast.error('Course not found');
      navigate('/learn');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const stored = localStorage.getItem(`course_progress_${courseId}`);
      if (stored) {
        setProgress(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const markComplete = (lessonId) => {
    const newProgress = { ...progress, [lessonId]: true };
    setProgress(newProgress);
    localStorage.setItem(`course_progress_${courseId}`, JSON.stringify(newProgress));
    toast.success('Lesson marked as complete!');
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getProgressPercentage = () => {
    if (!course?.lessons?.length) return 0;
    const completed = Object.values(progress).filter(Boolean).length;
    return Math.round((completed / course.lessons.length) * 100);
  };

  const getVideoEmbedUrl = (url) => {
    if (!url) return null;
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    
    return url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Course not found</p>
        <Button onClick={() => navigate('/learn')} className="mt-4">
          Back to Courses
        </Button>
      </div>
    );
  }

  const progressPercent = getProgressPercentage();

  return (
    <div className="space-y-6" data-testid="course-detail">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/learn')}
        className="text-slate-400 hover:text-white"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        All Courses
      </Button>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player / Content Area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          <Card className="bg-[#111] border-[#222] overflow-hidden">
            <CardContent className="p-0">
              {activeLesson ? (
                activeLesson.is_free || activeLesson.content_url ? (
                  <div>
                    {activeLesson.content_type === 'video' && activeLesson.content_url ? (
                      <div className="aspect-video bg-black">
                        <iframe
                          src={getVideoEmbedUrl(activeLesson.content_url)}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : activeLesson.content_type === 'text' ? (
                      <div className="p-6 prose prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-slate-300">
                          {activeLesson.content_text || 'No content available'}
                        </div>
                      </div>
                    ) : activeLesson.content_type === 'blog' && activeLesson.content_url ? (
                      <div className="p-6">
                        <div className="text-center mb-6">
                          <FileText className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                          <p className="text-slate-400 mb-4">This lesson is a blog article</p>
                          <a
                            href={activeLesson.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Read the Article
                          </a>
                        </div>
                      </div>
                    ) : activeLesson.content_type === 'pdf' && activeLesson.content_url ? (
                      <div className="aspect-video">
                        <iframe
                          src={activeLesson.content_url}
                          className="w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                          <p className="text-slate-400">Content not available</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Lesson Info */}
                    <div className="p-4 border-t border-[#222]">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-white mb-1">
                            {activeLesson.title}
                          </h2>
                          {activeLesson.description && (
                            <p className="text-sm text-slate-400">{activeLesson.description}</p>
                          )}
                        </div>
                        {!progress[activeLesson.id] ? (
                          <Button 
                            onClick={() => markComplete(activeLesson.id)}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid="mark-complete-btn"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Complete
                          </Button>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <Lock className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400 mb-2">This lesson is locked</p>
                      <p className="text-sm text-slate-500">Enroll in the course to access this content</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="aspect-video flex items-center justify-center bg-slate-900">
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400">Select a lesson to start</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Course Info & Lessons */}
        <div className="space-y-4">
          {/* Course Info */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <h1 className="text-lg font-bold text-white mb-2">{course.title}</h1>
              
              {course.description && (
                <p className="text-sm text-slate-400 mb-4">{course.description}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mb-4">
                {course.formato_name && (
                  <Badge className="bg-blue-500/20 text-blue-400">{course.formato_name}</Badge>
                )}
                {course.enfoque_name && (
                  <Badge className="bg-green-500/20 text-green-400">{course.enfoque_name}</Badge>
                )}
                {course.nivel_name && (
                  <Badge className="bg-purple-500/20 text-purple-400">{course.nivel_name}</Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {course.lesson_count} lessons
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(course.total_duration)}
                </span>
              </div>
              
              {course.instructor_name && (
                <div className="flex items-center gap-2 text-sm text-slate-400 pt-3 border-t border-[#222]">
                  <User className="w-4 h-4" />
                  <span>Instructor: {course.instructor_name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Your Progress</span>
                <span className="text-sm text-slate-400">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-slate-500 mt-2">
                {Object.values(progress).filter(Boolean).length} of {course.lessons?.length || 0} lessons completed
              </p>
            </CardContent>
          </Card>

          {/* Lessons List */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              <div className="p-3 border-b border-[#222]">
                <h3 className="font-medium text-white">Course Content</h3>
              </div>
              <div className="divide-y divide-[#222] max-h-[400px] overflow-y-auto">
                {(course.lessons || []).map((lesson, index) => {
                  const Icon = contentTypeIcons[lesson.content_type] || FileText;
                  const isActive = activeLesson?.id === lesson.id;
                  const isCompleted = progress[lesson.id];
                  const isLocked = !lesson.is_free && !lesson.content_url;
                  
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setActiveLesson(lesson)}
                      className={`w-full p-3 flex items-center gap-3 text-left transition-colors ${
                        isActive 
                          ? 'bg-blue-500/20' 
                          : 'hover:bg-white/5'
                      }`}
                      data-testid={`lesson-item-${lesson.id}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : isLocked
                            ? 'bg-slate-700 text-slate-500'
                            : 'bg-slate-700 text-slate-400'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : isLocked ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm truncate ${
                            isActive ? 'text-blue-400' : 'text-white'
                          }`}>
                            {lesson.title}
                          </span>
                          {lesson.is_free && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">Free</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Icon className="w-3 h-3" />
                          <span>{formatDuration(lesson.duration_minutes)}</span>
                        </div>
                      </div>
                      
                      {isActive && (
                        <Play className="w-4 h-4 text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Default export for catalog
export default CourseCatalog;
