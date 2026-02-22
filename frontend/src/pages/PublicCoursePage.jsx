/**
 * PublicCoursePage - Public landing page for a course/program
 * Layout: Sidebar navigation (left) + Content (right)
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Clock, Users, BookOpen, Play, ChevronDown, ChevronUp,
  CheckCircle, FileText, Video, HelpCircle, ArrowLeft, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import api from '../lib/api';

const contentTypeIcons = {
  video: Video,
  text: FileText,
  pdf: FileText,
  quiz: HelpCircle
};

export default function PublicCoursePage() {
  const { slug } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/lms/public/course-by-slug/${slug}`);
      setCourse(res.data.course);
    } catch (err) {
      setError(err.response?.data?.detail || 'Programa no encontrado');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
        <h1 className="text-2xl font-bold mb-4">Programa no encontrado</h1>
        <p className="text-gray-400 mb-6">{error}</p>
        <Link to="/public">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Descripción' },
    ...(course.objectives?.length > 0 ? [{ id: 'objectives', label: 'Objetivos' }] : []),
    ...(course.syllabus?.length > 0 ? [{ id: 'syllabus', label: 'Temario' }] : []),
    ...(course.lessons?.length > 0 ? [{ id: 'lessons', label: 'Lecciones' }] : []),
    ...(course.faqs?.length > 0 ? [{ id: 'faqs', label: 'Preguntas Frecuentes' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link to="/public" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Link>

        <div className="flex gap-8">
          {/* Sidebar Navigation - Left */}
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <div className="sticky top-8">
              {/* Course Thumbnail */}
              {course.thumbnail_url && (
                <img 
                  src={course.thumbnail_url} 
                  alt={course.title}
                  className="w-full h-40 object-cover rounded-lg mb-4"
                />
              )}
              
              {/* Course Stats */}
              <div className="bg-slate-900 rounded-lg p-4 mb-4 border border-slate-800">
                <h3 className="font-semibold text-white mb-3">{course.title}</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  {course.instructor_name && (
                    <p>Instructor: <span className="text-white">{course.instructor_name}</span></p>
                  )}
                  {course.duration_text && (
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {course.duration_text}
                    </p>
                  )}
                  {course.lesson_count > 0 && (
                    <p className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {course.lesson_count} lecciones
                    </p>
                  )}
                  {course.enrolled_count > 0 && (
                    <p className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {course.enrolled_count} inscritos
                    </p>
                  )}
                </div>
                
                <Button className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white">
                  Inscribirme
                </Button>
              </div>
              
              {/* Navigation Links */}
              <nav className="bg-slate-900 rounded-lg border border-slate-800">
                {navItems.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      activeSection === item.id
                        ? 'text-orange-400 bg-orange-500/10 border-l-2 border-orange-500'
                        : 'text-gray-400 hover:text-white hover:bg-slate-800'
                    } ${idx !== navItems.length - 1 ? 'border-b border-slate-800' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content - Right */}
          <main className="flex-1 min-w-0">
            {/* Mobile Header */}
            <div className="lg:hidden mb-6">
              {course.thumbnail_url && (
                <img 
                  src={course.thumbnail_url} 
                  alt={course.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              <h1 className="text-2xl font-bold text-white mb-2">{course.title}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-4">
                {course.instructor_name && (
                  <span>Por: {course.instructor_name}</span>
                )}
                {course.duration_text && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> {course.duration_text}
                  </span>
                )}
              </div>
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white mb-6">
                Inscribirme
              </Button>
            </div>

            {/* Overview Section */}
            <section id="overview" className="mb-10">
              <h1 className="text-3xl font-bold text-white mb-4 hidden lg:block">
                {course.title}
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                {course.description}
              </p>
              
              {(course.formato_name || course.nivel_name) && (
                <div className="flex gap-2 mt-4">
                  {course.formato_name && (
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm">
                      {course.formato_name}
                    </span>
                  )}
                  {course.nivel_name && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                      {course.nivel_name}
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* Objectives Section */}
            {course.objectives && course.objectives.length > 0 && (
              <section id="objectives" className="mb-10">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Lo que aprenderás
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {course.objectives.map((obj, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-gray-300 bg-slate-900/50 p-3 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Syllabus Section */}
            {course.syllabus && course.syllabus.length > 0 && (
              <section id="syllabus" className="mb-10">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Temario
                </h2>
                <div className="space-y-3">
                  {course.syllabus.map((item, idx) => (
                    <Card key={idx} className="bg-slate-900 border-slate-700">
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-white mb-1">
                          {idx + 1}. {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-sm text-gray-400">{item.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Lessons Section */}
            {course.lessons && course.lessons.length > 0 && (
              <section id="lessons" className="mb-10">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Contenido del curso
                </h2>
                <Card className="bg-slate-900 border-slate-700">
                  <CardContent className="p-0">
                    {course.lessons.map((lesson, idx) => {
                      const Icon = contentTypeIcons[lesson.content_type] || FileText;
                      return (
                        <div 
                          key={lesson.id}
                          className={`flex items-center justify-between p-4 ${
                            idx !== course.lessons.length - 1 ? 'border-b border-slate-700' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                              <Icon className="w-4 h-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{lesson.title}</p>
                              {lesson.duration_minutes > 0 && (
                                <p className="text-xs text-gray-500">
                                  {formatDuration(lesson.duration_minutes)}
                                </p>
                              )}
                            </div>
                          </div>
                          {lesson.is_free ? (
                            <span className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">
                              Gratis
                            </span>
                          ) : (
                            <Play className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </section>
            )}

            {/* FAQs Section */}
            {course.faqs && course.faqs.length > 0 && (
              <section id="faqs" className="mb-10">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Preguntas frecuentes
                </h2>
                <div className="space-y-2">
                  {course.faqs.map((faq, idx) => (
                    <Card key={idx} className="bg-slate-900 border-slate-700">
                      <CardContent className="p-0">
                        <button
                          className="w-full p-4 text-left flex items-center justify-between"
                          onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                        >
                          <span className="font-medium text-white">{faq.question}</span>
                          {expandedFaq === idx ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        {expandedFaq === idx && (
                          <div className="px-4 pb-4 text-gray-400">
                            {faq.answer}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
