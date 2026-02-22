import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, ChevronRight, ChevronLeft, Star, Users, Award, Sparkles, Play, ArrowRight, Mail, Lock, Loader2, Check, Video, Filter, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LeaderlixIsotipo } from '../components/LeaderlixLogo';
import { Turnstile } from 'react-turnstile';

// Translations
const translations = {
  en: {
    nav: {
      signIn: 'Sign In',
      language: 'ES'
    },
    hero: {
      title: 'Present Your Ideas',
      titleHighlight: 'Like a Rockstar!',
      subtitle: 'We help you speak in public with impact so you can cut through the noise and lead meaningful change in your organization and the world.',
      cta: 'Start Learning',
      feature1: 'Internationally Recognized Competencies',
      feature2: 'Adapted to Your Level (Beginner to Rockstar!)',
      feature3: '1-on-1 Coaching Focused on Your Results'
    },
    clients: {
      title: 'Trusted by Leading Companies',
      subtitle: 'Leaderlix has trained thousands of rising leaders at the most influential companies in their industries.'
    },
    features: {
      title: 'The Leaderlix Experience is Different',
      f1: { title: '9 Competencies', desc: 'Aligned with internationally recognized standards.' },
      f2: { title: 'Learning Paths', desc: 'A personalized experience for each student.' },
      f3: { title: '1-on-1 Coaching', desc: 'The best way to learn and incorporate skills.' },
      f4: { title: 'From Beginner to Master', desc: 'Progress through 4 certification levels.' }
    },
    cases: {
      title: 'Success Stories',
      subtitle: 'See how we\'ve helped companies transform their communication.'
    },
    testimonials: {
      title: 'What Our Students Say',
      subtitle: 'Real feedback from leaders who transformed their presentation skills.'
    },
    auth: {
      title: 'Sign In to Continue',
      email: 'Email',
      password: 'Password',
      signIn: 'Sign In',
      signUp: 'Create Account',
      orContinueWith: 'Or continue with',
      google: 'Continue with Google',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?'
    },
    events: {
      title: 'Upcoming Webinars',
      subtitle: 'Join our free educational events'
    },
    footer: {
      rights: '© 2026 Leaderlix. All rights reserved.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service'
    }
  },
  es: {
    nav: {
      signIn: 'Iniciar Sesión',
      language: 'EN'
    },
    hero: {
      title: 'Presenta tus Ideas',
      titleHighlight: '¡Como un Rockstar!',
      subtitle: 'Te ayudamos a hablar en público con impacto para que puedas atravesar el ruido y liderar cambio significativo en tu organización y el mundo.',
      cta: 'Empezar a Aprender',
      feature1: 'Competencias Internacionalmente Reconocidas',
      feature2: 'Adaptado a tu Nivel (de Principiante a Rockstar!)',
      feature3: 'Coaching 1 a 1 Centrado en tus Resultados'
    },
    events: {
      title: 'Próximos Webinars',
      subtitle: 'Únete a nuestros eventos educativos gratuitos'
    },
    clients: {
      title: 'Empresas que Confían en Nosotros',
      subtitle: 'Leaderlix ha entrenado a miles de líderes en ascenso en las empresas más influyentes de sus industrias.'
    },
    features: {
      title: 'La Experiencia Leaderlix es Diferente',
      f1: { title: '9 Competencias', desc: 'Alineadas con estándares internacionalmente reconocidos.' },
      f2: { title: 'Rutas de Aprendizaje', desc: 'Una experiencia personalizada para cada alumno.' },
      f3: { title: 'Coaching 1-1', desc: 'La mejor forma de aprender e incorporar.' },
      f4: { title: 'De Aspirante a Maestro', desc: 'Avanza por 4 niveles de certificación.' }
    },
    cases: {
      title: 'Casos de Éxito',
      subtitle: 'Mira cómo hemos ayudado a empresas a transformar su comunicación.'
    },
    testimonials: {
      title: 'Lo que Dicen Nuestros Alumnos',
      subtitle: 'Testimonios reales de líderes que transformaron sus habilidades de presentación.'
    },
    auth: {
      title: 'Inicia Sesión para Continuar',
      email: 'Correo Electrónico',
      password: 'Contraseña',
      signIn: 'Iniciar Sesión',
      signUp: 'Crear Cuenta',
      orContinueWith: 'O continúa con',
      google: 'Continuar con Google',
      noAccount: '¿No tienes cuenta?',
      hasAccount: '¿Ya tienes cuenta?'
    },
    footer: {
      rights: '© 2026 Leaderlix. Todos los derechos reservados.',
      privacy: 'Política de Privacidad',
      terms: 'Términos de Servicio'
    }
  }
};

// Theme Context
const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

// Language Context
const LanguageContext = createContext();
const useLanguage = () => useContext(LanguageContext);

export default function PublicWebsite() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  
  // Theme state
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('leaderlix-theme');
    return saved ? saved === 'dark' : true;
  });
  
  // Language state with localStorage persistence
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('leaderlix-lang');
    return saved || 'es';
  });
  
  const toggleLanguage = () => {
    const newLang = lang === 'es' ? 'en' : 'es';
    setLang(newLang);
    localStorage.setItem('leaderlix-lang', newLang);
  };
  
  // Data state
  const [clientLogos, setClientLogos] = useState([]);
  const [caseStudies, setCaseStudies] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [heroSlides, setHeroSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSlideTransitioning, setIsSlideTransitioning] = useState(false);
  const [heroCountdown, setHeroCountdown] = useState(null);
  const [countdownTime, setCountdownTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  
  // External user login state
  const [externalLoginEmail, setExternalLoginEmail] = useState('');
  const [externalLoginPassword, setExternalLoginPassword] = useState('');
  const [externalTurnstileToken, setExternalTurnstileToken] = useState(null);
  const [externalLoginLoading, setExternalLoginLoading] = useState(false);
  const [externalLoginError, setExternalLoginError] = useState('');
  
  // Testimonial filters
  const [testimonialFilters, setTestimonialFilters] = useState({
    formato_id: '',
    enfoque_id: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    formatos: [],
    enfoques: []
  });
  const [loadingTestimonials, setLoadingTestimonials] = useState(false);
  
  // Auth dialog - Unified login/register
  const [authDialog, setAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  
  const t = translations[lang];
  
  // Toggle theme
  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('leaderlix-theme', newTheme ? 'dark' : 'light');
  };
  
  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [logosRes, casesRes, heroRes, optionsRes, countdownRes, eventsRes] = await Promise.all([
          api.get('/public/client-logos'),
          api.get('/public/case-studies'),
          api.get('/website-config/thematic-axes/hero'),
          api.get('/website-config/formatos/public').catch(() => ({ data: { formatos: [] } })),
          api.get('/countdown/public/homepage').catch(() => ({ data: { countdown: null } })),
          api.get('/events-v2/public/upcoming').catch(() => ({ data: { events: [] } }))
        ]);
        setClientLogos(logosRes.data.logos || []);
        setCaseStudies(casesRes.data.case_studies || []);
        setHeroSlides(heroRes.data.axes || []);
        setHeroCountdown(countdownRes.data.countdown || null);
        setUpcomingEvents(eventsRes.data.events || []);
        
        // Load filter options
        const enfoques = heroRes.data.axes?.map(a => ({ id: a.id, name: a.name })) || [];
        setFilterOptions({
          formatos: optionsRes.data.formatos || [],
          enfoques: enfoques
        });
        
        // Load testimonials
        loadTestimonials();
      } catch (error) {
        console.error('Error loading public data:', error);
      }
    };
    loadData();
  }, []);
  
  // Helper function to get the last Monday of a given month
  const getLastMondayOfMonth = (year, month) => {
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    // Calculate days to subtract to get to Monday (0 = Sunday, 1 = Monday, ...)
    const dayOfWeek = lastDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const lastMonday = new Date(lastDay);
    lastMonday.setDate(lastDay.getDate() - daysToSubtract);
    // Set time to 6 PM Mexico City time (local event time)
    lastMonday.setHours(18, 0, 0, 0);
    return lastMonday;
  };
  
  // Get the next upcoming last Monday of month
  const getNextLastMonday = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Get last Monday of current month
    let targetDate = getLastMondayOfMonth(currentYear, currentMonth);
    
    // If that date has passed, get last Monday of next month
    if (targetDate < now) {
      if (currentMonth === 11) {
        targetDate = getLastMondayOfMonth(currentYear + 1, 0);
      } else {
        targetDate = getLastMondayOfMonth(currentYear, currentMonth + 1);
      }
    }
    
    return targetDate;
  };
  
  // Countdown timer logic - auto-targets last Monday of month
  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const target = getNextLastMonday().getTime();
      const diff = target - now;
      
      if (diff <= 0) {
        setCountdownTime({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      setCountdownTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };
    
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Load testimonials with filters
  const loadTestimonials = async (filters = testimonialFilters) => {
    setLoadingTestimonials(true);
    try {
      const params = new URLSearchParams();
      if (filters.formato_id) params.append('formato_id', filters.formato_id);
      if (filters.enfoque_id) params.append('enfoque_id', filters.enfoque_id);
      params.append('limit', '9');
      
      const res = await api.get(`/testimonials/public?${params.toString()}`);
      setTestimonials(res.data.testimonials || []);
    } catch (error) {
      console.error('Error loading testimonials:', error);
      setTestimonials([]);
    } finally {
      setLoadingTestimonials(false);
    }
  };
  
  // Handle filter change
  const handleFilterChange = (key, value) => {
    const newFilters = { ...testimonialFilters, [key]: value };
    setTestimonialFilters(newFilters);
    loadTestimonials(newFilters);
  };
  
  // Clear filters
  const clearFilters = () => {
    const emptyFilters = { formato_id: '', enfoque_id: '' };
    setTestimonialFilters(emptyFilters);
    loadTestimonials(emptyFilters);
  };
  
  // Auto-advance slider
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    
    const interval = setInterval(() => {
      setIsSlideTransitioning(true);
      setTimeout(() => {
        setCurrentSlide(prev => (prev + 1) % heroSlides.length);
        setIsSlideTransitioning(false);
      }, 300);
    }, 6000);
    
    return () => clearInterval(interval);
  }, [heroSlides.length]);
  
  // Slide navigation
  const goToSlide = useCallback((index) => {
    if (index === currentSlide || isSlideTransitioning) return;
    setIsSlideTransitioning(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsSlideTransitioning(false);
    }, 300);
  }, [currentSlide, isSlideTransitioning]);
  
  const nextSlide = useCallback(() => {
    goToSlide((currentSlide + 1) % heroSlides.length);
  }, [currentSlide, heroSlides.length, goToSlide]);
  
  const prevSlide = useCallback(() => {
    goToSlide((currentSlide - 1 + heroSlides.length) % heroSlides.length);
  }, [currentSlide, heroSlides.length, goToSlide]);
  
  // Handle email login for external users
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!externalLoginEmail || !externalLoginPassword) {
      toast.error(lang === 'es' ? 'Por favor completa todos los campos' : 'Please fill all fields');
      return;
    }
    
    // Check if trying to use @leaderlix.com email
    if (externalLoginEmail.toLowerCase().endsWith('@leaderlix.com')) {
      setExternalLoginError(lang === 'es' 
        ? 'Los usuarios @leaderlix.com deben iniciar sesión con Google' 
        : '@leaderlix.com users must sign in with Google');
      return;
    }
    
    if (!externalTurnstileToken) {
      toast.error(lang === 'es' ? 'Por favor completa el CAPTCHA' : 'Please complete the CAPTCHA');
      return;
    }
    
    setExternalLoginLoading(true);
    setExternalLoginError('');
    
    try {
      const response = await api.post('/auth/login', {
        email: externalLoginEmail,
        password: externalLoginPassword,
        turnstile_token: externalTurnstileToken
      }, { withCredentials: true });
      
      if (response.data.success) {
        toast.success(lang === 'es' ? '¡Bienvenido!' : 'Welcome!');
        setAuthDialog(false);
        // Redirect based on user type
        window.location.href = response.data.redirect_url || '/nurture/lms';
      }
    } catch (error) {
      const message = error.response?.data?.detail || (lang === 'es' ? 'Error al iniciar sesión' : 'Login failed');
      setExternalLoginError(message);
    } finally {
      setExternalLoginLoading(false);
    }
  };
  
  // Handle email registration for external users
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (!externalLoginEmail || !externalLoginPassword || !registerName) {
      toast.error(lang === 'es' ? 'Por favor completa todos los campos requeridos' : 'Please fill all required fields');
      return;
    }
    
    // Check if trying to register with @leaderlix.com email
    if (externalLoginEmail.toLowerCase().endsWith('@leaderlix.com')) {
      setExternalLoginError(lang === 'es' 
        ? 'Los usuarios @leaderlix.com deben iniciar sesión con Google' 
        : '@leaderlix.com users must sign in with Google');
      return;
    }
    
    if (!externalTurnstileToken) {
      toast.error(lang === 'es' ? 'Por favor completa el CAPTCHA' : 'Please complete the CAPTCHA');
      return;
    }
    
    setExternalLoginLoading(true);
    setExternalLoginError('');
    
    try {
      const response = await api.post('/auth/register', {
        email: externalLoginEmail,
        password: externalLoginPassword,
        name: registerName,
        phone: registerPhone || null,
        turnstile_token: externalTurnstileToken
      });
      
      if (response.data.success) {
        toast.success(lang === 'es' 
          ? 'Cuenta creada. Por favor verifica tu correo.' 
          : 'Account created. Please verify your email.');
        // Switch to login mode
        setAuthMode('login');
        setExternalLoginError(lang === 'es' 
          ? 'Se envió un correo de verificación. Por favor revisa tu bandeja de entrada.' 
          : 'Verification email sent. Please check your inbox.');
      }
    } catch (error) {
      const message = error.response?.data?.detail || (lang === 'es' ? 'Error al registrar' : 'Registration failed');
      setExternalLoginError(message);
    } finally {
      setExternalLoginLoading(false);
    }
  };
  
  // Handle Google auth - Direct OAuth flow
  const handleGoogleAuth = async () => {
    try {
      // Get auth URL from backend (Direct Google OAuth)
      const response = await api.get('/auth/google/init');
      if (response.data.auth_url) {
        window.location.href = response.data.auth_url;
      } else {
        // Fallback to Emergent Auth if direct OAuth not configured
        const redirectUrl = window.location.origin + '/auth/callback';
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      }
    } catch (error) {
      // Fallback to Emergent Auth
      const redirectUrl = window.location.origin + '/auth/callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  };
  
  const themeClasses = isDark 
    ? 'bg-[#0a0a0a] text-white' 
    : 'bg-white text-gray-900';
  
  const cardClasses = isDark
    ? 'bg-[#111111] border-[#222]'
    : 'bg-gray-50 border-gray-200';

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <LanguageContext.Provider value={{ lang, t }}>
        <div className={`min-h-screen ${themeClasses} transition-colors duration-300`}>
          
          {/* Navigation */}
          <nav className={`fixed top-0 left-0 right-0 z-50 ${isDark ? 'bg-[#0a0a0a]/90' : 'bg-white/90'} backdrop-blur-md border-b ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-[#ff3000] to-[#f9a11d] flex items-center justify-center p-1.5 hover:scale-110 transition-transform cursor-pointer">
                    <LeaderlixIsotipo className="w-full h-full" variant="white" animate={true} animationType="pulse" />
                  </div>
                  <span className="text-xl font-bold" style={{ fontFamily: "'Comfortaa', sans-serif" }}>leaderlix</span>
                </div>
                
                {/* Right side */}
                <div className="flex items-center gap-3">
                  {/* Language Toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleLanguage}
                    className={`font-medium ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {lang === 'es' ? 'EN' : 'ES'}
                  </Button>
                  
                  {/* Theme Toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTheme}
                    className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>
                  
                  {/* Sign In */}
                  <Button
                    onClick={() => setAuthDialog(true)}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                  >
                    {t.nav.signIn}
                  </Button>
                </div>
              </div>
            </div>
          </nav>
          
          {/* Hero Slider Section */}
          <section className="pt-32 pb-20 px-4 relative overflow-hidden min-h-[600px]">
            {/* Background gradient based on current slide */}
            <div className={`absolute inset-0 transition-opacity duration-500 ${
              currentSlide === 0 ? 'opacity-100' : 'opacity-0'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-cyan-600/10" />
            </div>
            <div className={`absolute inset-0 transition-opacity duration-500 ${
              currentSlide === 1 ? 'opacity-100' : 'opacity-0'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-transparent to-amber-600/10" />
            </div>
            <div className={`absolute inset-0 transition-opacity duration-500 ${
              currentSlide === 2 ? 'opacity-100' : 'opacity-0'
            }`}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-pink-600/10" />
            </div>
            
            <div className="max-w-7xl mx-auto relative">
              {/* Dynamic slider content */}
              {heroSlides.length > 0 ? (
                <div className="text-center max-w-4xl mx-auto">
                  {/* Slide content with transition */}
                  <div className={`transition-all duration-300 ${isSlideTransitioning ? 'opacity-0 transform translate-y-4' : 'opacity-100 transform translate-y-0'}`}>
                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                      <span className={`text-transparent bg-clip-text ${
                        currentSlide === 0 ? 'bg-gradient-to-r from-blue-400 to-cyan-400' :
                        currentSlide === 1 ? 'bg-gradient-to-r from-orange-400 to-amber-400' :
                        'bg-gradient-to-r from-purple-400 to-pink-400'
                      }`}>
                        {heroSlides[currentSlide]?.headline || t.hero.title}
                      </span>
                    </h1>
                    
                    {/* Subheadline */}
                    <p className={`text-lg sm:text-xl mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {heroSlides[currentSlide]?.subheadline || t.hero.subtitle}
                    </p>
                    
                    {/* Key Ideas as feature badges */}
                    <div className="flex flex-wrap justify-center gap-4 mb-10">
                      {(heroSlides[currentSlide]?.key_ideas || []).map((idea, i) => (
                        <div 
                          key={i} 
                          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${
                            currentSlide === 0 ? 'bg-blue-500/10 text-blue-400' :
                            currentSlide === 1 ? 'bg-orange-500/10 text-orange-400' :
                            'bg-purple-500/10 text-purple-400'
                          }`}
                          style={{ animationDelay: `${i * 100}ms` }}
                        >
                          <Check className={`w-4 h-4 ${
                            currentSlide === 0 ? 'text-blue-500' :
                            currentSlide === 1 ? 'text-orange-500' :
                            'text-purple-500'
                          }`} />
                          <span className="text-sm">{idea}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Countdown Timer - Auto-targets last Monday of month */}
                  <div className="mb-8">
                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Next Free Webinar
                    </p>
                    <div className="flex gap-4 justify-center">
                      {[
                        { value: countdownTime.days, label: 'Days' },
                        { value: countdownTime.hours, label: 'Hrs' },
                        { value: countdownTime.minutes, label: 'Min' },
                        { value: countdownTime.seconds, label: 'Sec' }
                      ].map((item, i) => (
                        <div key={i} className={`text-center p-3 rounded-lg ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>
                          <div className={`text-2xl md:text-3xl font-bold ${
                            currentSlide === 0 ? 'text-blue-500' :
                            currentSlide === 1 ? 'text-orange-500' :
                            'text-purple-500'
                          }`}>
                            {String(item.value).padStart(2, '0')}
                          </div>
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* CTA Button */}
                  <Button
                    size="lg"
                    onClick={() => {
                      const eventsSection = document.getElementById('events-section');
                      if (eventsSection) {
                        eventsSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={`text-lg px-8 py-6 h-auto transition-all duration-300 ${
                      currentSlide === 0 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' :
                      currentSlide === 1 ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' :
                      'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                    } text-white`}
                  >
                    {t.hero.cta}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  
                  {/* Slider Navigation */}
                  {heroSlides.length > 1 && (
                    <div className="mt-12 flex items-center justify-center gap-4">
                      {/* Prev button */}
                      <button
                        onClick={prevSlide}
                        className={`p-2 rounded-full transition-all ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                        data-testid="hero-prev-btn"
                      >
                        <ChevronLeft className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                      </button>
                      
                      {/* Dots */}
                      <div className="flex gap-2">
                        {heroSlides.map((slide, index) => (
                          <button
                            key={slide.id || index}
                            onClick={() => goToSlide(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              currentSlide === index 
                                ? `w-8 ${
                                    index === 0 ? 'bg-blue-500' :
                                    index === 1 ? 'bg-orange-500' :
                                    'bg-purple-500'
                                  }` 
                                : `w-2 ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'}`
                            }`}
                            data-testid={`hero-dot-${index}`}
                          />
                        ))}
                      </div>
                      
                      {/* Next button */}
                      <button
                        onClick={nextSlide}
                        className={`p-2 rounded-full transition-all ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                        data-testid="hero-next-btn"
                      >
                        <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback static hero if no slides */
                <div className="text-center max-w-4xl mx-auto">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                    {t.hero.title}{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                      {t.hero.titleHighlight}
                    </span>
                  </h1>
                  
                  <p className={`text-lg sm:text-xl mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t.hero.subtitle}
                  </p>
                  
                  <div className="flex flex-wrap justify-center gap-4 mb-10">
                    {[t.hero.feature1, t.hero.feature2, t.hero.feature3].map((feature, i) => (
                      <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700'}`}>
                        <span className="text-green-500">✓</span>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    size="lg"
                    onClick={() => setAuthDialog(true)}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-lg px-8 py-6 h-auto"
                  >
                    {t.hero.cta}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </section>
          
          {/* Upcoming Events Section */}
          {upcomingEvents.length > 0 && (
            <section id="events-section" className={`py-16 ${isDark ? 'bg-gradient-to-b from-[#111] to-[#0a0a0a]' : 'bg-gradient-to-b from-gray-50 to-white'}`}>
              <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold mb-3">{t.events?.title || 'Upcoming Webinars'}</h2>
                  <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {t.events?.subtitle || 'Join our free educational events'}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map((event) => (
                    <div 
                      key={event.id}
                      className={`rounded-xl overflow-hidden transition-all hover:scale-105 ${
                        isDark ? 'bg-[#111] border border-[#222]' : 'bg-white shadow-lg'
                      }`}
                    >
                      {/* Event Banner */}
                      {event.banner_image && (
                        <div className="aspect-video w-full overflow-hidden">
                          <img 
                            src={event.banner_image} 
                            alt={event.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Event Info */}
                      <div className="p-5">
                        <h3 className="text-lg font-bold mb-2 line-clamp-2">{event.name}</h3>
                        {event.description && (
                          <p className={`text-sm mb-4 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {event.description}
                          </p>
                        )}
                        
                        {/* Date & Time */}
                        <div className={`flex items-center gap-4 text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(event.webinar_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {event.webinar_time && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {event.webinar_time}
                            </span>
                          )}
                        </div>
                        
                        {/* Register Button */}
                        <Button
                          onClick={() => window.open(`/event/${event.slug}`, '_blank')}
                          className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                        >
                          Register Free
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          
          {/* Client Logos Carousel */}
          <section className={`py-16 ${isDark ? 'bg-[#0f0f0f]' : 'bg-gray-100'}`}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold mb-2">{t.clients.title}</h2>
                <p className={`${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t.clients.subtitle}</p>
              </div>
              
              {/* Infinite scroll carousel */}
              <div className="relative overflow-hidden">
                <div className="flex animate-scroll">
                  {[...clientLogos, ...clientLogos].map((logo, i) => (
                    <div 
                      key={i} 
                      className={`flex-shrink-0 w-40 h-20 mx-4 flex items-center justify-center rounded-lg ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} p-4`}
                    >
                      {logo.logo ? (
                        <img 
                          src={logo.logo} 
                          alt={logo.name} 
                          className="max-w-full max-h-full object-contain filter grayscale hover:grayscale-0 transition-all"
                          onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${logo.name}&background=random&size=200`; }}
                        />
                      ) : (
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{logo.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          
          {/* Features Section */}
          <section className="py-20 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4">{t.features.title}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Award, ...t.features.f1 },
                  { icon: Users, ...t.features.f2 },
                  { icon: Sparkles, ...t.features.f3 },
                  { icon: ChevronRight, ...t.features.f4 }
                ].map((feature, i) => (
                  <div key={i} className={`p-6 rounded-xl border ${cardClasses} hover:border-orange-500/50 transition-all`}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          
          {/* Testimonials Section - Dynamic without Filters */}
          <section className="py-20 px-4" data-testid="testimonials-section">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">{t.testimonials.title}</h2>
                <p className={`${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t.testimonials.subtitle}</p>
              </div>
              
              {/* Testimonials Grid */}
              {loadingTestimonials ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : testimonials.length === 0 ? (
                <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-[#111]' : 'bg-gray-100'}`}>
                  <Award className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {lang === 'es' 
                      ? 'No hay testimonios que coincidan con los filtros seleccionados.' 
                      : 'No testimonials match the selected filters.'}
                  </p>
                  {(testimonialFilters.formato_id || testimonialFilters.enfoque_id) && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 text-orange-500 hover:text-orange-400 text-sm"
                    >
                      {lang === 'es' ? 'Ver todos los testimonios' : 'View all testimonials'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {testimonials.map((testimonial) => (
                    <div 
                      key={testimonial.id} 
                      className={`p-6 rounded-xl border ${cardClasses} hover:border-orange-500/50 transition-all`}
                      data-testid={`testimonial-card-${testimonial.id}`}
                    >
                      {/* Badges for format and focus */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {testimonial.formato_name && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {testimonial.formato_name}
                          </span>
                        )}
                        {testimonial.enfoque_name && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                          }`}>
                            {testimonial.enfoque_name}
                          </span>
                        )}
                      </div>
                      
                      {/* Ratings row */}
                      {(testimonial.rating_presentacion || testimonial.rating_articulacion) && (
                        <div className="flex gap-1 mb-3">
                          {[...Array(testimonial.rating_presentacion || 0)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          ))}
                          {[...Array(5 - (testimonial.rating_presentacion || 0))].map((_, i) => (
                            <Star key={`empty-${i}`} className={`w-4 h-4 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                          ))}
                        </div>
                      )}
                      
                      {/* Quote */}
                      <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'} line-clamp-4`}>
                        "{testimonial.testimonio}"
                      </p>
                      
                      {/* Video link if available */}
                      {(testimonial.video_vimeo || testimonial.video_descript) && (
                        <a 
                          href={testimonial.video_vimeo || testimonial.video_descript}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 text-xs mb-4 ${
                            isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          <Video className="w-3 h-3" />
                          {lang === 'es' ? 'Ver video' : 'Watch video'}
                        </a>
                      )}
                      
                      {/* Author */}
                      <div className="flex items-center gap-3 pt-4 border-t border-[#222]">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isDark ? 'bg-orange-500/20' : 'bg-orange-100'
                        }`}>
                          <span className={`text-sm font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                            {testimonial.nombre?.charAt(0) || 'A'}{testimonial.apellido?.charAt(0) || ''}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {testimonial.nombre} {testimonial.apellido}
                          </div>
                          {testimonial.industria_name && (
                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                              {testimonial.industria_name}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Added Value badge */}
                      {testimonial.valor_agregado && (
                        <div className={`mt-3 text-xs px-2 py-1 rounded inline-block ${
                          isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          ✨ {lang === 'es' ? 'Valor Agregado' : 'Added Value'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          
          {/* Footer */}
          <footer className={`py-8 border-t ${isDark ? 'border-[#222] bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <LeaderlixIsotipo className="w-8 h-8" />
                  <span className="font-semibold">Leaderlix</span>
                </div>
                
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  {t.footer.rights}
                </p>
                
                <div className="flex gap-4 text-sm">
                  <a href="/legal" className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>{t.footer.privacy}</a>
                  <a href="/legal" className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>{t.footer.terms}</a>
                </div>
              </div>
            </div>
          </footer>
          
          {/* Auth Dialog - Unified Login/Register */}
          <Dialog open={authDialog} onOpenChange={(open) => {
            setAuthDialog(open);
            if (!open) {
              // Reset form when closing
              setAuthMode('login');
              setExternalLoginEmail('');
              setExternalLoginPassword('');
              setRegisterName('');
              setRegisterPhone('');
              setExternalTurnstileToken(null);
              setExternalLoginError('');
            }
          }}>
            <DialogContent className={`max-w-md ${isDark ? 'bg-[#0f0f0f] border-[#222]' : 'bg-white border-gray-200'}`}>
              <DialogHeader>
                <DialogTitle className={isDark ? 'text-white' : 'text-gray-900'}>
                  {authMode === 'login' 
                    ? (lang === 'es' ? 'Iniciar Sesión' : 'Sign In')
                    : (lang === 'es' ? 'Crear Cuenta' : 'Create Account')
                  }
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-4 space-y-4">
                {/* Google Button - For everyone */}
                <Button
                  variant="outline"
                  className={`w-full ${isDark ? 'border-[#333] hover:bg-[#1a1a1a]' : 'border-gray-300 hover:bg-gray-50'}`}
                  onClick={handleGoogleAuth}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t.auth.google}
                </Button>
                
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className={`w-full border-t ${isDark ? 'border-[#333]' : 'border-gray-200'}`}></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className={`px-2 ${isDark ? 'bg-[#0f0f0f] text-gray-500' : 'bg-white text-gray-400'}`}>
                      {lang === 'es' ? 'o con correo' : 'or with email'}
                    </span>
                  </div>
                </div>
                
                {/* Email/Password Form */}
                <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailRegister} className="space-y-3">
                  {/* Name field (register only) */}
                  {authMode === 'register' && (
                    <Input
                      type="text"
                      placeholder={lang === 'es' ? 'Nombre completo' : 'Full name'}
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className={isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-300'}
                      required
                    />
                  )}
                  
                  <Input
                    type="email"
                    placeholder={lang === 'es' ? 'Correo electrónico' : 'Email address'}
                    value={externalLoginEmail}
                    onChange={(e) => setExternalLoginEmail(e.target.value)}
                    className={isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-300'}
                    required
                  />
                  
                  <Input
                    type="password"
                    placeholder={lang === 'es' ? 'Contraseña' : 'Password'}
                    value={externalLoginPassword}
                    onChange={(e) => setExternalLoginPassword(e.target.value)}
                    className={isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-300'}
                    required
                  />
                  
                  {/* Phone field (register only) */}
                  {authMode === 'register' && (
                    <Input
                      type="tel"
                      placeholder={lang === 'es' ? 'Teléfono' : 'Phone number'}
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      className={isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-300'}
                    />
                  )}
                  
                  {/* Turnstile CAPTCHA */}
                  <div className="flex justify-center">
                    <Turnstile
                      sitekey={process.env.REACT_APP_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                      onVerify={(token) => setExternalTurnstileToken(token)}
                      theme={isDark ? 'dark' : 'light'}
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                    disabled={externalLoginLoading || !externalTurnstileToken}
                  >
                    {externalLoginLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {authMode === 'login' 
                      ? (lang === 'es' ? 'Iniciar Sesión' : 'Sign In')
                      : (lang === 'es' ? 'Crear Cuenta' : 'Create Account')
                    }
                  </Button>
                  
                  {externalLoginError && (
                    <p className="text-red-500 text-sm text-center">{externalLoginError}</p>
                  )}
                </form>
                
                {/* Toggle between login/register */}
                <p className={`text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  {authMode === 'login' ? (
                    <>
                      {lang === 'es' ? '¿No tienes cuenta? ' : "Don't have an account? "}
                      <button 
                        type="button"
                        onClick={() => setAuthMode('register')}
                        className="text-orange-500 hover:text-orange-400 font-medium"
                      >
                        {lang === 'es' ? 'Regístrate' : 'Sign up'}
                      </button>
                    </>
                  ) : (
                    <>
                      {lang === 'es' ? '¿Ya tienes cuenta? ' : 'Already have an account? '}
                      <button 
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className="text-orange-500 hover:text-orange-400 font-medium"
                      >
                        {lang === 'es' ? 'Inicia sesión' : 'Sign in'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* CSS for infinite scroll animation */}
        <style>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-scroll {
            animation: scroll 30s linear infinite;
          }
          .animate-scroll:hover {
            animation-play-state: paused;
          }
        `}</style>
      </LanguageContext.Provider>
    </ThemeContext.Provider>
  );
}
