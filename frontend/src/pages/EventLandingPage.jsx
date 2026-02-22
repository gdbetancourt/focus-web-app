import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Turnstile } from "react-turnstile";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Calendar, Clock, CheckCircle2, AlertCircle, Users, Sparkles, BookOpen, Layers, BarChart3, Sun, Moon, Plus, Trash2, UserPlus } from "lucide-react";
import { LeaderlixIsotipo } from "../components/LeaderlixLogo";
import api from "../lib/api";

// Country phone codes and expected lengths
const COUNTRIES = [
  { code: "MX", name: "México", dial: "+52", length: 10 },
  { code: "US", name: "Estados Unidos", dial: "+1", length: 10 },
  { code: "CO", name: "Colombia", dial: "+57", length: 10 },
  { code: "AR", name: "Argentina", dial: "+54", length: 10 },
  { code: "ES", name: "España", dial: "+34", length: 9 },
  { code: "CL", name: "Chile", dial: "+56", length: 9 },
  { code: "PE", name: "Perú", dial: "+51", length: 9 },
];

const TREATMENTS = [
  { value: "Sr.", label: "Sr." },
  { value: "Sra.", label: "Sra." },
  { value: "Dr.", label: "Dr." },
  { value: "Dra.", label: "Dra." },
  { value: "Lic.", label: "Lic." },
  { value: "Ing.", label: "Ing." },
  { value: "Mtro.", label: "Mtro." },
  { value: "Mtra.", label: "Mtra." },
];

export default function EventLandingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDark, setIsDark] = useState(true);
  
  // Form state
  const [treatment, setTreatment] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("MX");
  const [specialty, setSpecialty] = useState("");
  const [formError, setFormError] = useState("");
  
  // CAPTCHA state
  const [turnstileToken, setTurnstileToken] = useState("");
  
  // Consent checkboxes
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptNews, setAcceptNews] = useState(true);
  
  // "One more thing" - Team invitations flow
  const [showTeamInvite, setShowTeamInvite] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [submittingTeam, setSubmittingTeam] = useState(false);
  const [registeredContact, setRegisteredContact] = useState(null);
  
  // Medical specialties
  const [specialties, setSpecialties] = useState([]);

  useEffect(() => {
    loadEvent();
    loadSpecialties();
  }, [slug]);

  const loadEvent = async () => {
    try {
      const response = await api.get(`/events-v2/public/landing/${slug}`);
      setEvent(response.data);
    } catch (err) {
      setError("Evento no encontrado");
    } finally {
      setLoading(false);
    }
  };

  const loadSpecialties = async () => {
    try {
      const res = await api.get("/medical/specialties/public");
      setSpecialties(res.data.specialties || []);
    } catch (err) {
      console.error("Could not load specialties");
    }
  };

  const toggleTheme = () => setIsDark(!isDark);

  // Check if selected treatment is doctor
  const isDoctor = treatment === "Dr." || treatment === "Dra.";

  const validatePhone = (phoneNumber, country) => {
    const countryData = COUNTRIES.find(c => c.code === country);
    const digits = phoneNumber.replace(/\D/g, "");
    return digits.length === (countryData?.length || 10);
  };

  // Clean description - remove Wikipedia content and limit length
  const getCleanDescription = (desc) => {
    if (!desc) return "";
    if (desc.includes("Wikipedia") || desc.length > 1000) return "";
    let cleaned = desc.replace(/\n{2,}/g, "\n").trim();
    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 297) + "...";
    }
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    
    if (!treatment || !firstName || !lastName || !email || !phone) {
      setFormError("Todos los campos son obligatorios");
      return;
    }
    
    if (!email.includes("@")) {
      setFormError("Email inválido");
      return;
    }
    
    if (!validatePhone(phone, countryCode)) {
      const countryData = COUNTRIES.find(c => c.code === countryCode);
      setFormError(`El teléfono debe tener ${countryData?.length || 10} dígitos`);
      return;
    }
    
    if (!acceptTerms) {
      setFormError("Debes aceptar los términos y condiciones");
      return;
    }
    
    if (!turnstileToken) {
      setFormError("Por favor completa la verificación de seguridad");
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await api.post(`/events-v2/public/register/${slug}`, {
        treatment,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone.replace(/\D/g, ""),
        country_code: countryCode,
        specialty: isDoctor && specialty !== "none" ? specialty : null,
        accept_news: acceptNews,
        turnstile_token: turnstileToken
      });
      
      // Store registered contact info for team invitations
      setRegisteredContact({
        first_name: firstName,
        last_name: lastName,
        email,
        contact_id: response.data?.contact_id
      });
      
      // Show "One more thing" flow instead of direct success
      setShowTeamInvite(true);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Error al registrarse");
      // Reset CAPTCHA on error
      setTurnstileToken("");
    } finally {
      setSubmitting(false);
    }
  };

  // Add team member to invite list
  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { first_name: "", last_name: "", email: "", phone: "" }]);
  };

  // Remove team member from list
  const removeTeamMember = (index) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  // Update team member field
  const updateTeamMember = (index, field, value) => {
    const updated = [...teamMembers];
    updated[index][field] = value;
    setTeamMembers(updated);
  };

  // Submit team members
  const handleSubmitTeam = async () => {
    // Filter out empty entries
    const validMembers = teamMembers.filter(
      m => m.first_name && m.last_name && m.email
    );
    
    if (validMembers.length === 0) {
      setSuccess(true);
      setShowTeamInvite(false);
      return;
    }
    
    setSubmittingTeam(true);
    
    try {
      await api.post(`/events-v2/public/register-team/${slug}`, {
        team_members: validMembers,
        registered_by: registeredContact?.email
      });
      
      setSuccess(true);
      setShowTeamInvite(false);
    } catch (err) {
      setFormError(err.response?.data?.detail || "Error al registrar equipo");
    } finally {
      setSubmittingTeam(false);
    }
  };

  // Skip team invitations
  const skipTeamInvite = () => {
    setSuccess(true);
    setShowTeamInvite(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff3300]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-white mb-2">Evento no encontrado</h1>
          <p className="text-slate-500">El enlace puede estar incorrecto o el evento ya no está disponible.</p>
        </div>
      </div>
    );
  }

  // "One more thing..." - Team invitation flow
  if (showTeamInvite) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Success message */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">¡Registro Exitoso!</h1>
            <p className="text-slate-400">
              {registeredContact?.first_name}, te has registrado para el evento.
            </p>
          </div>

          {/* One more thing card */}
          <div className="bg-[#111] rounded-xl p-6 border border-[#222]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ff3300]/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-[#ff3300]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">One more thing...</h2>
                <p className="text-sm text-slate-400">¿Quién más de tu equipo participará?</p>
              </div>
            </div>

            {/* Team members list */}
            <div className="space-y-3 mb-4">
              {teamMembers.map((member, index) => (
                <div key={index} className="p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Persona {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTeamMember(index)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nombre *"
                      value={member.first_name}
                      onChange={(e) => updateTeamMember(index, "first_name", e.target.value)}
                      className="bg-[#111] border-[#333] text-white text-sm h-9"
                    />
                    <Input
                      placeholder="Apellido *"
                      value={member.last_name}
                      onChange={(e) => updateTeamMember(index, "last_name", e.target.value)}
                      className="bg-[#111] border-[#333] text-white text-sm h-9"
                    />
                    <Input
                      placeholder="Email *"
                      type="email"
                      value={member.email}
                      onChange={(e) => updateTeamMember(index, "email", e.target.value)}
                      className="bg-[#111] border-[#333] text-white text-sm h-9"
                    />
                    <Input
                      placeholder="Teléfono"
                      value={member.phone}
                      onChange={(e) => updateTeamMember(index, "phone", e.target.value)}
                      className="bg-[#111] border-[#333] text-white text-sm h-9"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add person button */}
            <Button
              variant="outline"
              onClick={addTeamMember}
              className="w-full border-dashed border-[#333] text-slate-400 hover:text-white hover:border-[#ff3300] mb-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar persona
            </Button>

            {formError && (
              <p className="text-red-400 text-sm mb-4 text-center">{formError}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={skipTeamInvite}
                className="flex-1 border-[#333] text-slate-400 hover:text-white"
              >
                Omitir
              </Button>
              <Button
                onClick={handleSubmitTeam}
                disabled={submittingTeam || teamMembers.length === 0}
                className="flex-1 bg-[#ff3300] hover:bg-[#ff3300]/90"
              >
                {submittingTeam ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Registrar {teamMembers.length > 0 ? `(${teamMembers.length})` : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">¡Registro Exitoso!</h1>
          <p className="text-slate-400 mb-6">
            Te has registrado para <span className="text-[#ff3300] font-semibold">{event?.display_title || event?.name}</span>
          </p>
          <div className="bg-[#111] rounded-lg p-4 border border-[#222] text-left">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(event?.webinar_date)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{event?.webinar_time} hrs</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-6">
            Recibirás un correo con los detalles del evento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-white text-gray-900'}`}>
      {/* Navigation - Exact copy from PublicWebsite */}
      <nav className={`fixed top-0 left-0 right-0 z-50 ${isDark ? 'bg-[#0a0a0a]/90' : 'bg-white/90'} backdrop-blur-md border-b ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-[#ff3000] to-[#f9a11d] flex items-center justify-center p-1.5 hover:scale-110 transition-transform cursor-pointer">
                <LeaderlixIsotipo className="w-full h-full" variant="white" animate={true} animationType="pulse" />
              </div>
              <span className="text-xl font-bold" style={{ fontFamily: "'Comfortaa', sans-serif" }}>leaderlix</span>
            </a>
            
            {/* Right side */}
            <div className="flex items-center gap-3">
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
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                Iniciar Sesión
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Full-Width Banner - scale technique for preview environment */}
      <section className="pt-16 relative">
        {event?.banner_image ? (
          <div 
            className="h-[60vh] overflow-hidden absolute inset-x-0 top-16"
            style={{ 
              transform: 'scaleX(1.02)',
              transformOrigin: 'center top'
            }}
          >
            <img 
              src={event.banner_image.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${event.banner_image}` : event.banner_image} 
              alt={event.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
          </div>
        ) : (
          <div 
            className="h-[60vh] bg-gradient-to-br from-[#ff3300]/30 via-purple-900/20 to-[#0a0a0a] absolute inset-x-0 top-16"
            style={{ 
              transform: 'scaleX(1.02)',
              transformOrigin: 'center top'
            }}
          />
        )}
        
        {/* Spacer to maintain layout flow */}
        <div className="h-[60vh] relative z-10">
          {/* Event Title Overlay */}
          <div className="absolute bottom-8 left-0 right-0 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                {event?.display_title || event?.name}
              </h1>
              {event?.short_description && (
                <p className="text-lg text-slate-200 max-w-2xl drop-shadow">
                  {event.short_description}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Event Details */}
            <div className="space-y-6">
              {/* Program Info Card */}
              {(event?.course_name || event?.competency_name || event?.level_name) && (
                <div className={`rounded-xl p-6 border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                  <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <BookOpen className="w-5 h-5 text-blue-500" />
                    Información del Programa
                  </h2>
                  
                  <div className="space-y-4">
                    {event?.course_name && (
                      <div className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Programa</div>
                          <div className="font-medium">{event.course_name}</div>
                        </div>
                      </div>
                    )}
                    
                    {event?.competency_name && (
                      <div className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Competencia</div>
                          <div className="font-medium">{event.competency_name}</div>
                        </div>
                      </div>
                    )}
                    
                    {event?.level_name && (
                      <div className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Nivel</div>
                          <div className="font-medium">{event.level_name}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Date/Time/Format Card */}
              <div className={`rounded-xl p-6 border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Calendar className="w-5 h-5 text-[#ff3300]" />
                  Detalles del Evento
                </h2>
                
                <div className="space-y-4">
                  <div className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    <div className="w-10 h-10 rounded-lg bg-[#ff3300]/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#ff3300]" />
                    </div>
                    <div>
                      <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Fecha</div>
                      <div className="font-medium">{formatDate(event?.webinar_date)}</div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Hora</div>
                      <div className="font-medium">{event?.webinar_time} hrs (Hora Centro de México)</div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className={`text-xs uppercase ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Formato</div>
                      <div className="font-medium">
                        {event?.format === "presencial" ? "Presencial" : "En línea"} (gratuito)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {event?.description && getCleanDescription(event.description) && (
                <div className={`rounded-xl p-6 border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                  <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Acerca del Evento</h3>
                  <p className={`whitespace-pre-line ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    {getCleanDescription(event.description)}
                  </p>
                </div>
              )}
            </div>

            {/* Registration Form */}
            <div className={`rounded-xl p-6 border h-fit sticky top-24 ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Regístrate Ahora
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Treatment */}
                <div>
                  <label className={`text-sm mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Tratamiento *</label>
                  <Select value={treatment} onValueChange={setTreatment}>
                    <SelectTrigger className={`${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TREATMENTS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Medical Specialty */}
                {isDoctor && specialties.length > 0 && (
                  <div>
                    <label className={`text-sm mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Especialidad Médica (opcional)</label>
                    <Select value={specialty} onValueChange={setSpecialty}>
                      <SelectTrigger className={`${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}>
                        <SelectValue placeholder="Selecciona especialidad..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin especificar</SelectItem>
                        {specialties.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-sm mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Nombre *</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Tu nombre"
                      className={`${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className={`text-sm mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Apellido *</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Tu apellido"
                      className={`${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                </div>
                
                {/* Email */}
                <div>
                  <label className={`text-sm mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Correo electrónico *</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className={`${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>
                
                {/* Phone */}
                <div>
                  <label className={`text-sm mb-1 block ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Teléfono *</label>
                  <div className="flex gap-2">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger className={`w-[120px] ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.dial} {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10 dígitos"
                      className={`flex-1 ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                </div>
                
                {/* Terms and Conditions Checkbox */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="acceptTerms"
                    checked={acceptTerms}
                    onCheckedChange={setAcceptTerms}
                    className="mt-0.5 border-[#333] data-[state=checked]:bg-[#ff3300] data-[state=checked]:border-[#ff3300]"
                  />
                  <label htmlFor="acceptTerms" className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    Agree to our{" "}
                    <a 
                      href="https://leaderlix.com/legal" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[#ff3300] hover:underline"
                    >
                      terms and conditions
                    </a>
                  </label>
                </div>
                
                {/* News Checkbox */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="acceptNews"
                    checked={acceptNews}
                    onCheckedChange={setAcceptNews}
                    className="mt-0.5 border-[#333] data-[state=checked]:bg-[#ff3300] data-[state=checked]:border-[#ff3300]"
                  />
                  <label htmlFor="acceptNews" className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                    Agree to receive relevant news about future events
                  </label>
                </div>
                
                {/* Turnstile CAPTCHA */}
                <div className="flex justify-center">
                  <Turnstile
                    sitekey={process.env.REACT_APP_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
                    onVerify={(token) => setTurnstileToken(token)}
                    onError={() => setTurnstileToken("")}
                    onExpire={() => setTurnstileToken("")}
                    theme={isDark ? "dark" : "light"}
                  />
                </div>
                
                {/* Error Message */}
                {formError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {formError}
                  </div>
                )}
                
                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || !acceptTerms || !turnstileToken}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-6 text-lg font-semibold disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                      Registrando...
                    </>
                  ) : (
                    "Registrarme Gratis"
                  )}
                </Button>
                
                <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                  Tu información está protegida y no será compartida con terceros.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Exact copy from PublicWebsite */}
      <footer className={`py-8 border-t ${isDark ? 'border-[#222] bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Leaderlix</span>
            </div>
            
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              © {new Date().getFullYear()} Leaderlix. Todos los derechos reservados.
            </p>
            
            <div className="flex gap-4 text-sm">
              <a href="/privacy" className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Privacidad</a>
              <a href="/terms" className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Términos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
