import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Plus, Edit, Trash2, Video, FileText, File, HelpCircle, 
  ChevronDown, ChevronRight, GripVertical, Eye, EyeOff, Clock, 
  RefreshCw, Search, Filter, X, Play, Save, ArrowUp, ArrowDown, Newspaper,
  ExternalLink, Sparkles, Image, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import api from '../lib/api';

const NONE_VALUE = "_none";

const contentTypeIcons = {
  video: Video,
  text: FileText,
  pdf: File,
  quiz: HelpCircle,
  blog: Newspaper
};

const contentTypeColors = {
  video: 'blue',
  text: 'green',
  pdf: 'orange',
  quiz: 'purple',
  blog: 'pink'
};

const LMSPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState({ formatos: [], enfoques: [], niveles: [], content_types: [], blog_posts: [] });
  
  // Course dialog
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    formato_id: '',
    formato_name: '',
    enfoque_id: '',
    enfoque_name: '',
    nivel_id: '',
    nivel_name: '',
    instructor_name: '',
    is_published: false,
    enrolled_student_ids: [],
    // New fields for public page
    slug: '',
    objectives: [],
    syllabus: [],
    faqs: [],
    duration_text: '',
    price_text: ''
  });
  
  // Active tab in course dialog
  const [courseDialogTab, setCourseDialogTab] = useState('general');
  
  // Students for enrollment
  const [availableStudents, setAvailableStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  
  // Thumbnail generation
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  
  // Lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonCourseId, setLessonCourseId] = useState(null);
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    content_type: 'video',
    content_url: '',
    content_text: '',
    duration_minutes: 0,
    is_free: false
  });
  
  // Expanded courses
  const [expandedCourses, setExpandedCourses] = useState({});
  const [courseLessons, setCourseLessons] = useState({});
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCourses();
    loadOptions();
    loadStudents();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/lms/courses');
      setCourses(res.data.courses || []);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Error loading courses');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const res = await api.get('/lms/options');
      setOptions(res.data);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  };

  const loadStudents = async (searchTerm = '') => {
    try {
      // Search ALL contacts in the database
      const params = new URLSearchParams({ limit: '50' });
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      const res = await api.get(`/contacts?${params.toString()}`);
      setAvailableStudents(res.data.contacts || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadLessons = async (courseId) => {
    try {
      const res = await api.get(`/lms/courses/${courseId}`);
      setCourseLessons(prev => ({
        ...prev,
        [courseId]: res.data.course.lessons || []
      }));
    } catch (error) {
      console.error('Error loading lessons:', error);
    }
  };

  const toggleCourseExpanded = async (courseId) => {
    const isExpanded = expandedCourses[courseId];
    setExpandedCourses(prev => ({ ...prev, [courseId]: !isExpanded }));
    
    if (!isExpanded && !courseLessons[courseId]) {
      await loadLessons(courseId);
    }
  };

  // Course CRUD
  const openCourseDialog = (course = null) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        title: course.title || '',
        description: course.description || '',
        thumbnail_url: course.thumbnail_url || '',
        formato_id: course.formato_id || '',
        formato_name: course.formato_name || '',
        enfoque_id: course.enfoque_id || '',
        enfoque_name: course.enfoque_name || '',
        nivel_id: course.nivel_id || '',
        nivel_name: course.nivel_name || '',
        instructor_name: course.instructor_name || '',
        is_published: course.is_published || false,
        enrolled_student_ids: course.enrolled_student_ids || [],
        // New fields
        slug: course.slug || '',
        objectives: course.objectives || [],
        syllabus: course.syllabus || [],
        faqs: course.faqs || [],
        duration_text: course.duration_text || '',
        price_text: course.price_text || ''
      });
    } else {
      setEditingCourse(null);
      setCourseForm({
        title: '',
        description: '',
        thumbnail_url: '',
        formato_id: '',
        formato_name: '',
        enfoque_id: '',
        enfoque_name: '',
        nivel_id: '',
        nivel_name: '',
        instructor_name: '',
        is_published: false,
        enrolled_student_ids: [],
        // New fields
        slug: '',
        objectives: [],
        syllabus: [],
        faqs: [],
        duration_text: '',
        price_text: ''
      });
    }
    setStudentSearchTerm('');
    setCourseDialogTab('general');
    setCourseDialogOpen(true);
  };

  const toggleStudentEnrollment = (studentId) => {
    setCourseForm(prev => ({
      ...prev,
      enrolled_student_ids: prev.enrolled_student_ids.includes(studentId)
        ? prev.enrolled_student_ids.filter(id => id !== studentId)
        : [...prev.enrolled_student_ids, studentId]
    }));
  };

  // Debounced search for students
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadStudents(studentSearchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentSearchTerm]);

  const handleCourseSelectChange = (field, value, nameField, optionsArray) => {
    const actualValue = value === NONE_VALUE ? '' : value;
    const found = optionsArray.find(o => o.id === actualValue);
    setCourseForm(prev => ({
      ...prev,
      [field]: actualValue,
      [nameField]: found?.name || ''
    }));
  };

  const saveCourse = async () => {
    if (!courseForm.title.trim()) {
      toast.error('Course title is required');
      return;
    }
    
    try {
      if (editingCourse) {
        await api.put(`/lms/courses/${editingCourse.id}`, courseForm);
        toast.success('Course updated');
      } else {
        await api.post('/lms/courses', courseForm);
        toast.success('Course created');
      }
      setCourseDialogOpen(false);
      loadCourses();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving course');
    }
  };

  const generateThumbnail = async (courseId) => {
    if (!courseId) {
      toast.error('Save the course first to generate a thumbnail');
      return;
    }
    
    setGeneratingThumbnail(true);
    toast.info('Generating thumbnail with AI... This may take up to 60 seconds');
    
    try {
      const res = await api.post(`/lms/courses/${courseId}/generate-thumbnail`, {}, { timeout: 90000 });
      if (res.data.success && res.data.thumbnail_url) {
        setCourseForm(prev => ({ ...prev, thumbnail_url: res.data.thumbnail_url }));
        toast.success('Thumbnail generated successfully!');
        loadCourses();
      }
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      toast.error(error.response?.data?.detail || 'Error generating thumbnail');
    } finally {
      setGeneratingThumbnail(false);
    }
  };

  const deleteCourse = async (courseId) => {
    if (!confirm('Delete this course and all its lessons?')) return;
    
    try {
      await api.delete(`/lms/courses/${courseId}`);
      toast.success('Course deleted');
      loadCourses();
    } catch (error) {
      toast.error('Error deleting course');
    }
  };

  const togglePublish = async (course) => {
    try {
      await api.put(`/lms/courses/${course.id}`, { is_published: !course.is_published });
      toast.success(course.is_published ? 'Course unpublished' : 'Course published');
      loadCourses();
    } catch (error) {
      toast.error('Error updating course');
    }
  };

  // Lesson CRUD
  const openLessonDialog = (courseId, lesson = null) => {
    setLessonCourseId(courseId);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        title: lesson.title || '',
        description: lesson.description || '',
        content_type: lesson.content_type || 'video',
        content_url: lesson.content_url || '',
        content_text: lesson.content_text || '',
        duration_minutes: lesson.duration_minutes || 0,
        is_free: lesson.is_free || false
      });
    } else {
      setEditingLesson(null);
      setLessonForm({
        title: '',
        description: '',
        content_type: 'video',
        content_url: '',
        content_text: '',
        duration_minutes: 0,
        is_free: false
      });
    }
    setLessonDialogOpen(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim()) {
      toast.error('Lesson title is required');
      return;
    }
    
    try {
      if (editingLesson) {
        await api.put(`/lms/lessons/${editingLesson.id}`, lessonForm);
        toast.success('Lesson updated');
      } else {
        await api.post(`/lms/courses/${lessonCourseId}/lessons`, lessonForm);
        toast.success('Lesson created');
      }
      setLessonDialogOpen(false);
      loadLessons(lessonCourseId);
      loadCourses(); // Refresh lesson count
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving lesson');
    }
  };

  const deleteLesson = async (lessonId, courseId) => {
    if (!confirm('Delete this lesson?')) return;
    
    try {
      await api.delete(`/lms/lessons/${lessonId}`);
      toast.success('Lesson deleted');
      loadLessons(courseId);
      loadCourses();
    } catch (error) {
      toast.error('Error deleting lesson');
    }
  };

  const moveLesson = async (lesson, courseId, direction) => {
    const lessons = courseLessons[courseId] || [];
    const currentIndex = lessons.findIndex(l => l.id === lesson.id);
    const newOrder = direction === 'up' ? lesson.order - 1 : lesson.order + 1;
    
    if (newOrder < 1 || newOrder > lessons.length) return;
    
    try {
      await api.put(`/lms/lessons/${lesson.id}/reorder?new_order=${newOrder}`);
      loadLessons(courseId);
    } catch (error) {
      toast.error('Error reordering lesson');
    }
  };

  const filteredCourses = courses.filter(c => 
    (c.title || c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.instructor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading && courses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lms-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/20">
            <BookOpen className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Learning Management</h1>
            <p className="text-slate-500">Create and manage courses with video lessons, PDFs, and quizzes</p>
          </div>
        </div>
        <Button 
          onClick={() => openCourseDialog()} 
          className="bg-blue-600 hover:bg-blue-700"
          data-testid="add-course-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Course
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{courses.length}</p>
            <p className="text-xs text-slate-500">Total Courses</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">
              {courses.filter(c => c.is_published).length}
            </p>
            <p className="text-xs text-slate-500">Published</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-400">
              {courses.reduce((acc, c) => acc + (c.lesson_count || 0), 0)}
            </p>
            <p className="text-xs text-slate-500">Total Lessons</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-400">
              {formatDuration(courses.reduce((acc, c) => acc + (c.total_duration || 0), 0))}
            </p>
            <p className="text-xs text-slate-500">Total Content</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search courses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-600 text-white"
          data-testid="search-courses"
        />
      </div>

      {/* Courses List */}
      <div className="space-y-4">
        {filteredCourses.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-semibold text-white mb-2">No Courses Yet</h3>
              <p className="text-slate-500 mb-4">Create your first course to get started</p>
              <Button onClick={() => openCourseDialog()} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredCourses.map(course => {
            const isExpanded = expandedCourses[course.id];
            const lessons = courseLessons[course.id] || [];
            
            return (
              <Card key={course.id} className="bg-[#111] border-[#222]" data-testid={`course-${course.id}`}>
                <CardContent className="p-0">
                  {/* Course Header */}
                  <div 
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5"
                    onClick={() => toggleCourseExpanded(course.id)}
                  >
                    <button className="text-slate-400">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt="" className="w-16 h-12 rounded object-cover" />
                    ) : (
                      <div className="w-16 h-12 rounded bg-slate-800 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-slate-600" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white truncate">{course.title}</h3>
                        {course.is_published ? (
                          <Badge className="bg-green-500/20 text-green-400">Published</Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400">Draft</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        {course.instructor_name && <span>{course.instructor_name}</span>}
                        <span>{course.lesson_count || 0} lessons</span>
                        <span>{formatDuration(course.total_duration)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {course.formato_name && (
                          <Badge className="bg-blue-500/20 text-blue-400 text-xs">{course.formato_name}</Badge>
                        )}
                        {course.enfoque_name && (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">{course.enfoque_name}</Badge>
                        )}
                      </div>
                      {course.is_published && (
                        <a
                          href={`/learn/course/${course.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-blue-400 p-2"
                          title="View public course"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePublish(course)}
                        className="text-slate-400 hover:text-white"
                        title={course.is_published ? 'Unpublish' : 'Publish'}
                      >
                        {course.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      {course.is_published && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const courseSlug = course.slug || course.id;
                            window.open(`/programa/${courseSlug}`, '_blank');
                          }}
                          className="text-green-400 hover:text-green-300"
                          title="Ver página pública"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCourseDialog(course)}
                        className="text-slate-400 hover:text-white"
                        data-testid={`edit-course-${course.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCourse(course.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Lessons List */}
                  {isExpanded && (
                    <div className="border-t border-[#222] bg-black/20">
                      <div className="p-3 border-b border-[#222] flex justify-between items-center">
                        <span className="text-sm text-slate-400">Lessons</span>
                        <Button
                          size="sm"
                          onClick={() => openLessonDialog(course.id)}
                          className="bg-blue-600 hover:bg-blue-700 h-7"
                          data-testid={`add-lesson-${course.id}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Lesson
                        </Button>
                      </div>
                      
                      {lessons.length === 0 ? (
                        <div className="p-6 text-center text-slate-500">
                          No lessons yet. Add your first lesson.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#222]">
                          {lessons.map((lesson, index) => {
                            const Icon = contentTypeIcons[lesson.content_type] || FileText;
                            const color = contentTypeColors[lesson.content_type] || 'gray';
                            
                            return (
                              <div 
                                key={lesson.id} 
                                className="p-3 flex items-center gap-3 hover:bg-white/5"
                                data-testid={`lesson-${lesson.id}`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    onClick={() => moveLesson(lesson, course.id, 'up')}
                                    disabled={index === 0}
                                    className={`p-0.5 rounded ${index === 0 ? 'text-slate-700' : 'text-slate-500 hover:text-white'}`}
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => moveLesson(lesson, course.id, 'down')}
                                    disabled={index === lessons.length - 1}
                                    className={`p-0.5 rounded ${index === lessons.length - 1 ? 'text-slate-700' : 'text-slate-500 hover:text-white'}`}
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                                
                                <span className="text-slate-600 text-sm w-6">{lesson.order}.</span>
                                
                                <div className={`p-1.5 rounded bg-${color}-500/20`}>
                                  <Icon className={`w-4 h-4 text-${color}-400`} />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white text-sm truncate">{lesson.title}</span>
                                    {lesson.is_free && (
                                      <Badge className="bg-green-500/20 text-green-400 text-xs">Free</Badge>
                                    )}
                                  </div>
                                  {lesson.description && (
                                    <p className="text-xs text-slate-500 truncate">{lesson.description}</p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDuration(lesson.duration_minutes)}</span>
                                </div>
                                
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openLessonDialog(course.id, lesson)}
                                    className="text-slate-400 hover:text-white h-7 w-7 p-0"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteLesson(lesson.id, course.id)}
                                    className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Course Dialog */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Editar Programa' : 'Nuevo Programa'}</DialogTitle>
          </DialogHeader>
          
          {/* Tabs for Course Dialog */}
          <div className="flex gap-1 border-b border-slate-700 mb-4">
            {[
              { id: 'general', label: 'General' },
              { id: 'content', label: 'Contenido' },
              { id: 'students', label: 'Estudiantes' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCourseDialogTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  courseDialogTab === tab.id
                    ? 'text-orange-400 border-b-2 border-orange-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="space-y-4 py-2">
            {/* General Tab */}
            {courseDialogTab === 'general' && (
              <>
                <div>
                  <Label className="text-slate-400">Título *</Label>
                  <Input
                    value={courseForm.title}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="Nombre del programa"
                    data-testid="course-title-input"
                  />
                </div>
                
                <div>
                  <Label className="text-slate-400">Slug (URL)</Label>
                  <Input
                    value={courseForm.slug}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="nombre-del-programa (se genera automáticamente)"
                  />
                  {courseForm.slug && (
                    <p className="text-xs text-slate-500 mt-1">
                      URL: go.leaderlix.com/programa/{courseForm.slug}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label className="text-slate-400">Descripción</Label>
                  <Textarea
                    value={courseForm.description}
                    onChange={(e) => setCourseForm(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="¿Qué aprenderán los estudiantes?"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label className="text-slate-400">Thumbnail</Label>
                  <div className="flex gap-2">
                    <Input
                      value={courseForm.thumbnail_url}
                      onChange={(e) => setCourseForm(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white flex-1"
                      placeholder="URL de imagen o genera con AI..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => generateThumbnail(editingCourse?.id)}
                      disabled={generatingThumbnail || !editingCourse}
                      className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                      title={!editingCourse ? "Guarda primero para generar thumbnail" : "Generar con AI"}
                    >
                      {generatingThumbnail ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {courseForm.thumbnail_url && (
                    <img src={courseForm.thumbnail_url} alt="Preview" className="mt-2 w-full h-32 object-cover rounded border border-slate-600" />
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400">Instructor</Label>
                    <Input
                      value={courseForm.instructor_name}
                      onChange={(e) => setCourseForm(prev => ({ ...prev, instructor_name: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white"
                      placeholder="Nombre del instructor"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Duración</Label>
                    <Input
                      value={courseForm.duration_text}
                      onChange={(e) => setCourseForm(prev => ({ ...prev, duration_text: e.target.value }))}
                      className="bg-slate-800 border-slate-600 text-white"
                      placeholder="Ej: 8 semanas"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-slate-400 text-xs">Nivel</Label>
                  <Select
                    value={courseForm.nivel_id || NONE_VALUE}
                    onValueChange={(v) => handleCourseSelectChange('nivel_id', v, 'nivel_name', options.niveles)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Ninguno</SelectItem>
                      {[...new Map(options.niveles.map(n => [n.name, n])).values()].map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="is_published"
                    checked={courseForm.is_published}
                    onCheckedChange={(checked) => setCourseForm(prev => ({ ...prev, is_published: checked }))}
                  />
                  <Label htmlFor="is_published" className="text-slate-300 cursor-pointer">
                    Publicar programa (visible para estudiantes)
                  </Label>
                </div>
              </>
            )}
            
            {/* Content Tab - Objectives, Syllabus, FAQs */}
            {courseDialogTab === 'content' && (
              <>
                {/* Objectives */}
                <div>
                  <Label className="text-slate-400 mb-2 block">Objetivos de Aprendizaje</Label>
                  {courseForm.objectives.map((obj, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <Input
                        value={obj}
                        onChange={(e) => {
                          const newObjs = [...courseForm.objectives];
                          newObjs[idx] = e.target.value;
                          setCourseForm(prev => ({ ...prev, objectives: newObjs }));
                        }}
                        className="bg-slate-800 border-slate-600 text-white flex-1"
                        placeholder="Objetivo de aprendizaje"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newObjs = courseForm.objectives.filter((_, i) => i !== idx);
                          setCourseForm(prev => ({ ...prev, objectives: newObjs }));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCourseForm(prev => ({ ...prev, objectives: [...prev.objectives, ''] }))}
                    className="border-slate-600 text-slate-400"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Agregar objetivo
                  </Button>
                </div>
                
                {/* Syllabus */}
                <div className="pt-4 border-t border-slate-700">
                  <Label className="text-slate-400 mb-2 block">Temario</Label>
                  {courseForm.syllabus.map((item, idx) => (
                    <div key={idx} className="mb-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={item.title || ''}
                          onChange={(e) => {
                            const newSyllabus = [...courseForm.syllabus];
                            newSyllabus[idx] = { ...newSyllabus[idx], title: e.target.value };
                            setCourseForm(prev => ({ ...prev, syllabus: newSyllabus }));
                          }}
                          className="bg-slate-800 border-slate-600 text-white flex-1"
                          placeholder="Título del módulo"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newSyllabus = courseForm.syllabus.filter((_, i) => i !== idx);
                            setCourseForm(prev => ({ ...prev, syllabus: newSyllabus }));
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={item.description || ''}
                        onChange={(e) => {
                          const newSyllabus = [...courseForm.syllabus];
                          newSyllabus[idx] = { ...newSyllabus[idx], description: e.target.value };
                          setCourseForm(prev => ({ ...prev, syllabus: newSyllabus }));
                        }}
                        className="bg-slate-800 border-slate-600 text-white"
                        placeholder="Descripción del módulo"
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCourseForm(prev => ({ ...prev, syllabus: [...prev.syllabus, { title: '', description: '' }] }))}
                    className="border-slate-600 text-slate-400"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Agregar módulo
                  </Button>
                </div>
                
                {/* FAQs */}
                <div className="pt-4 border-t border-slate-700">
                  <Label className="text-slate-400 mb-2 block">Preguntas Frecuentes</Label>
                  {courseForm.faqs.map((faq, idx) => (
                    <div key={idx} className="mb-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={faq.question || ''}
                          onChange={(e) => {
                            const newFaqs = [...courseForm.faqs];
                            newFaqs[idx] = { ...newFaqs[idx], question: e.target.value };
                            setCourseForm(prev => ({ ...prev, faqs: newFaqs }));
                          }}
                          className="bg-slate-800 border-slate-600 text-white flex-1"
                          placeholder="Pregunta"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newFaqs = courseForm.faqs.filter((_, i) => i !== idx);
                            setCourseForm(prev => ({ ...prev, faqs: newFaqs }));
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={faq.answer || ''}
                        onChange={(e) => {
                          const newFaqs = [...courseForm.faqs];
                          newFaqs[idx] = { ...newFaqs[idx], answer: e.target.value };
                          setCourseForm(prev => ({ ...prev, faqs: newFaqs }));
                        }}
                        className="bg-slate-800 border-slate-600 text-white"
                        placeholder="Respuesta"
                        rows={2}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCourseForm(prev => ({ ...prev, faqs: [...prev.faqs, { question: '', answer: '' }] }))}
                    className="border-slate-600 text-slate-400"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Agregar FAQ
                  </Button>
                </div>
              </>
            )}
            
            {/* Students Tab */}
            {courseDialogTab === 'students' && (
              <div className="space-y-2">
                <Label className="text-slate-300">Contactos Inscritos ({courseForm.enrolled_student_ids.length})</Label>
                <Input
                  placeholder="Buscar contactos por nombre o email..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="bg-slate-800 border-slate-600"
                />
                <p className="text-xs text-slate-500">Escribe para buscar en todos los contactos de la base de datos</p>
                <div className="max-h-64 overflow-y-auto space-y-1 bg-slate-800/50 rounded-lg p-2">
                  {availableStudents.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      {studentSearchTerm ? 'No se encontraron contactos' : 'Escribe para buscar contactos'}
                    </p>
                  ) : (
                    availableStudents.map(student => (
                      <div
                        key={student.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          courseForm.enrolled_student_ids.includes(student.id)
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'hover:bg-slate-700'
                        }`}
                        onClick={() => toggleStudentEnrollment(student.id)}
                      >
                        <Checkbox
                          checked={courseForm.enrolled_student_ids.includes(student.id)}
                          onCheckedChange={() => toggleStudentEnrollment(student.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{student.name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500 truncate">{student.email}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialogOpen(false)} className="border-slate-600">
              Cancelar
            </Button>
            <Button onClick={saveCourse} className="bg-blue-600 hover:bg-blue-700" data-testid="save-course-btn">
              <Save className="w-4 h-4 mr-2" />
              {editingCourse ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLesson ? 'Edit Lesson' : 'New Lesson'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Title *</Label>
              <Input
                value={lessonForm.title}
                onChange={(e) => setLessonForm(prev => ({ ...prev, title: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Lesson title"
                data-testid="lesson-title-input"
              />
            </div>
            
            <div>
              <Label className="text-slate-400">Description</Label>
              <Textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm(prev => ({ ...prev, description: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Brief description"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400">Content Type</Label>
                <Select
                  value={lessonForm.content_type}
                  onValueChange={(v) => setLessonForm(prev => ({ ...prev, content_type: v }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.content_types.map(ct => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Duration (minutes)</Label>
                <Input
                  type="number"
                  value={lessonForm.duration_minutes}
                  onChange={(e) => setLessonForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  min="0"
                />
              </div>
            </div>
            
            {(lessonForm.content_type === 'video' || lessonForm.content_type === 'pdf') && (
              <div>
                <Label className="text-slate-400">Content URL</Label>
                <Input
                  value={lessonForm.content_url}
                  onChange={(e) => setLessonForm(prev => ({ ...prev, content_url: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder={lessonForm.content_type === 'video' ? 'Vimeo or YouTube URL' : 'PDF URL'}
                />
              </div>
            )}
            
            {lessonForm.content_type === 'text' && (
              <div>
                <Label className="text-slate-400">Content</Label>
                <Textarea
                  value={lessonForm.content_text}
                  onChange={(e) => setLessonForm(prev => ({ ...prev, content_text: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="Lesson content..."
                  rows={6}
                />
              </div>
            )}
            
            {lessonForm.content_type === 'blog' && (
              <div>
                <Label className="text-slate-400">Select Blog Post</Label>
                <Select
                  value={lessonForm.content_url || NONE_VALUE}
                  onValueChange={(v) => {
                    const post = options.blog_posts?.find(p => p.slug === v);
                    setLessonForm(prev => ({
                      ...prev,
                      content_url: v === NONE_VALUE ? '' : `/blog/${v}`,
                      duration_minutes: post?.reading_time_minutes || prev.duration_minutes
                    }));
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select a blog post" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Select a post...</SelectItem>
                    {(options.blog_posts || []).map(post => (
                      <SelectItem key={post.id || post.slug} value={post.slug}>
                        {post.title} ({post.reading_time_minutes || 1} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Lesson will link to the published blog post
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="is_free"
                checked={lessonForm.is_free}
                onCheckedChange={(checked) => setLessonForm(prev => ({ ...prev, is_free: checked }))}
              />
              <Label htmlFor="is_free" className="text-slate-300 cursor-pointer">
                Free preview (visible without enrollment)
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialogOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={saveLesson} className="bg-blue-600 hover:bg-blue-700" data-testid="save-lesson-btn">
              <Save className="w-4 h-4 mr-2" />
              {editingLesson ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LMSPage;
