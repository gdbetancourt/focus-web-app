import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getSettings, updateSettings } from "../lib/api";
import api from "../lib/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  Settings as SettingsIcon, 
  Key,
  Mail,
  Save,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Unplug,
  Send,
  Video,
  Zap,
  Calendar,
  Phone,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  Users,
  Clock,
  Play,
  Pause,
  Building2,
  Pill,
  RefreshCw,
  Plus,
  FileText,
  Link2,
  Tag,
  Database
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import UrlMigrationCard from "../components/UrlMigrationCard";
import EmailRulesSettings from "../components/settings/EmailRulesSettings";
import WebinarEmailSettings from "../components/settings/WebinarEmailSettings";
import BuyerPersonasDB from "./BuyerPersonasDB";
import JobKeywords from "./JobKeywords";
import AdminPanel from "./AdminPanel";

export default function Settings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    hubspot_token: "",
    hubspot_list_id: "",
    sender_email: "",
    apify_token: ""
  });
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    email: null,
    connected_at: null
  });
  const [calendarStatus, setCalendarStatus] = useState({
    connected: false,
    email: null,
    connected_at: null
  });
  const [driveStatus, setDriveStatus] = useState({
    connected: false,
    connected_at: null
  });
  const [senderName, setSenderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  
  // Admin Tools State
  const [phoneResetDialog, setPhoneResetDialog] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [resettingPhones, setResettingPhones] = useState(false);
  const [preImportCheck, setPreImportCheck] = useState(null);
  const [loadingPreCheck, setLoadingPreCheck] = useState(false);
  const [duplicateEmailsDialog, setDuplicateEmailsDialog] = useState(false);
  const [duplicateEmails, setDuplicateEmails] = useState(null);
  
  // Scheduled Tasks State
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [schedulerInfo, setSchedulerInfo] = useState(null);
  const [createScheduleDialog, setCreateScheduleDialog] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    schedule_type: "medical_society",
    entity_id: "",
    entity_name: "",
    frequency: "weekly",
    params: {}
  });
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  useEffect(() => {
    loadSettings();
    checkGmailStatus();
    checkCalendarStatus();
    checkDriveStatus();
    loadSchedules();
    loadSchedulerInfo();
    
    // Handle OAuth callback - both Gmail and Calendar use the same callback endpoint
    // The backend determines which type based on the stored state
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, [searchParams]);

  const loadSettings = async () => {
    try {
      const response = await getSettings();
      setSettings({
        hubspot_token: response.data.hubspot_token || "",
        hubspot_list_id: response.data.hubspot_list_id || "",
        sender_email: response.data.sender_email || "",
        apify_token: response.data.apify_token || ""
      });
      setSenderName(response.data.sender_name || "Leaderlix");
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkGmailStatus = async () => {
    try {
      const response = await api.get("/gmail/status");
      setGmailStatus(response.data);
    } catch (error) {
      console.error("Error checking Gmail status:", error);
    }
  };

  const checkCalendarStatus = async () => {
    try {
      const response = await api.get("/calendar/status");
      setCalendarStatus(response.data);
    } catch (error) {
      console.error("Error checking Calendar status:", error);
    }
  };

  const checkDriveStatus = async () => {
    try {
      const response = await api.get("/drive/status");
      setDriveStatus(response.data);
    } catch (error) {
      console.error("Error checking Drive status:", error);
    }
  };

  const handleOAuthCallback = async (code, state) => {
    console.log("OAuth callback - code:", code?.substring(0, 20) + "...", "state:", state);
    try {
      // Check if it's a Drive callback
      if (state && state.startsWith('drive_')) {
        console.log("Detected Drive callback");
        const response = await api.post("/drive/callback", { code, state });
        toast.success(response.data.message);
        checkDriveStatus();
        navigate('/settings', { replace: true });
        return;
      }
      
      // Both Gmail and Calendar use the same callback endpoint
      // Backend determines type based on stored state
      const response = await api.post(`/gmail/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
      toast.success(response.data.message);
      // Refresh both statuses since we don't know which type it was
      checkGmailStatus();
      checkCalendarStatus();
      // Clean URL
      navigate('/settings', { replace: true });
    } catch (error) {
      console.error("OAuth callback error:", error);
      toast.error(error.response?.data?.detail || "Error de conexión");
      navigate('/settings', { replace: true });
    }
  };

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const response = await api.get("/gmail/auth-url");
      // Redirect to Google OAuth
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al iniciar conexión con Gmail");
      setConnectingGmail(false);
    }
  };

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await api.get("/calendar/auth-url");
      // Redirect to Google OAuth
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al iniciar conexión con Calendar");
      setConnectingCalendar(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm("¿Estás seguro de desconectar Gmail? No podrás enviar correos hasta reconectar.")) {
      return;
    }
    
    try {
      await api.post("/gmail/disconnect");
      toast.success("Gmail desconectado");
      setGmailStatus({ connected: false, email: null, connected_at: null });
    } catch (error) {
      toast.error("Error al desconectar Gmail");
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!window.confirm("¿Estás seguro de desconectar Google Calendar?")) {
      return;
    }
    
    try {
      await api.post("/calendar/disconnect");
      toast.success("Google Calendar desconectado");
      setCalendarStatus({ connected: false, email: null, connected_at: null });
    } catch (error) {
      toast.error("Error al desconectar Calendar");
    }
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    try {
      const response = await api.get("/drive/auth-url");
      // Redirect to Google OAuth
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al iniciar conexión con Google Drive");
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!window.confirm("¿Estás seguro de desconectar Google Drive? No podrás generar documentos en Google Docs hasta reconectar.")) {
      return;
    }
    
    try {
      await api.post("/drive/disconnect");
      toast.success("Google Drive desconectado");
      setDriveStatus({ connected: false, connected_at: null });
    } catch (error) {
      toast.error("Error al desconectar Google Drive");
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Ingresa un email para la prueba");
      return;
    }
    
    setTestingEmail(true);
    try {
      const response = await api.post(`/gmail/test-send?to_email=${encodeURIComponent(testEmail)}`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enviar email de prueba");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveSenderName = async () => {
    try {
      await api.put(`/settings/sender-name?sender_name=${encodeURIComponent(senderName)}`);
      toast.success("Nombre del remitente actualizado");
    } catch (error) {
      toast.error("Error al guardar el nombre");
    }
  };

  // ============ ADMIN TOOLS ============
  
  const handlePreImportCheck = async () => {
    setLoadingPreCheck(true);
    try {
      const response = await api.get("/contacts/admin/pre-import-check");
      setPreImportCheck(response.data);
    } catch (error) {
      toast.error("Error checking import readiness");
    } finally {
      setLoadingPreCheck(false);
    }
  };

  const handleCheckDuplicateEmails = async () => {
    try {
      const response = await api.get("/contacts/admin/duplicate-email-check");
      setDuplicateEmails(response.data);
      setDuplicateEmailsDialog(true);
    } catch (error) {
      toast.error("Error checking duplicate emails");
    }
  };

  const handleResetPhones = async () => {
    if (confirmationText !== "RESET PHONES") {
      toast.error("Please type 'RESET PHONES' exactly to confirm");
      return;
    }
    
    setResettingPhones(true);
    try {
      const response = await api.post("/contacts/admin/reset-phones", {
        confirmation_text: confirmationText
      });
      toast.success(response.data.message);
      setPhoneResetDialog(false);
      setConfirmationText("");
      // Refresh pre-import check
      handlePreImportCheck();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error resetting phone numbers");
    } finally {
      setResettingPhones(false);
    }
  };

  // ============ SCHEDULED TASKS ============
  
  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const response = await api.get("/scheduler/schedules?active_only=false");
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error("Error loading schedules:", error);
      toast.error("Error loading scheduled tasks");
    } finally {
      setLoadingSchedules(false);
    }
  };

  const loadSchedulerInfo = async () => {
    try {
      const response = await api.get("/scheduler/status");
      setSchedulerInfo(response.data);
    } catch (error) {
      console.error("Error loading scheduler info:", error);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.entity_id || !newSchedule.entity_name) {
      toast.error("Entity ID and name are required");
      return;
    }
    
    setCreatingSchedule(true);
    try {
      await api.post("/scheduler/schedules", newSchedule);
      toast.success("Schedule created successfully");
      setCreateScheduleDialog(false);
      setNewSchedule({
        schedule_type: "medical_society",
        entity_id: "",
        entity_name: "",
        frequency: "weekly",
        params: {}
      });
      loadSchedules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error creating schedule");
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleToggleSchedule = async (scheduleId, currentActive) => {
    try {
      await api.put(`/scheduler/schedules/${scheduleId}`, {
        active: !currentActive
      });
      toast.success(currentActive ? "Schedule paused" : "Schedule activated");
      loadSchedules();
    } catch (error) {
      toast.error("Error updating schedule");
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Delete this schedule?")) return;
    
    try {
      await api.delete(`/scheduler/schedules/${scheduleId}`);
      toast.success("Schedule deleted");
      loadSchedules();
    } catch (error) {
      toast.error("Error deleting schedule");
    }
  };

  const handleTriggerSchedule = async (scheduleId) => {
    try {
      await api.post(`/scheduler/run/${scheduleId}`);
      toast.success("Schedule triggered");
      setTimeout(() => loadSchedules(), 2000);
    } catch (error) {
      toast.error("Error triggering schedule");
    }
  };

  const getScheduleTypeBadge = (type) => {
    const badges = {
      medical_society: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", icon: Building2 },
      pharma_pipeline: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30", icon: Pill },
      business_unit: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30", icon: Building2 },
      keyword: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", icon: Clock },
      buyer_persona: { bg: "bg-pink-500/20", text: "text-pink-400", border: "border-pink-500/30", icon: Users },
      small_business: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", icon: Building2 }
    };
    return badges[type] || badges.business_unit;
  };

  const getStatusBadge = (status) => {
    if (status === "running") return { bg: "bg-blue-500/20", text: "text-blue-400", label: "Running" };
    if (status === "completed") return { bg: "bg-green-500/20", text: "text-green-400", label: "Completed" };
    if (status === "failed") return { bg: "bg-red-500/20", text: "text-red-400", label: "Failed" };
    return { bg: "bg-slate-500/20", text: "text-slate-400", label: "Pending" };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        hubspot_list_id: settings.hubspot_list_id
      };
      
      // Only update tokens if they were changed (not masked)
      if (settings.hubspot_token && !settings.hubspot_token.startsWith("***")) {
        updateData.hubspot_token = settings.hubspot_token;
      }
      
      if (settings.apify_token && !settings.apify_token.startsWith("***")) {
        updateData.apify_token = settings.apify_token;
      }
      
      await updateSettings(updateData);
      toast.success("Configuración guardada");
      loadSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight">Configuración</h1>
        <p className="text-slate-500 mt-1">Configura las integraciones del sistema</p>
      </div>

      {/* Gmail Connection - MOST IMPORTANT */}
      <Card className={gmailStatus.connected ? "border-emerald-200 bg-emerald-50/30" : "border-orange-200 bg-orange-50/30"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${gmailStatus.connected ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                <Mail className={`w-6 h-6 ${gmailStatus.connected ? 'text-emerald-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <CardTitle className="text-xl">Gmail para Envío de Correos</CardTitle>
                <CardDescription>
                  {gmailStatus.connected 
                    ? `Conectado como ${gmailStatus.email}` 
                    : "Conecta tu cuenta de Gmail para enviar correos"}
                </CardDescription>
              </div>
            </div>
            <Badge className={gmailStatus.connected ? "badge-success" : "badge-warning"}>
              {gmailStatus.connected ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Conectado
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  No conectado
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {gmailStatus.connected ? (
            <>
              <div className="p-4 bg-[#111111] rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{gmailStatus.email}</p>
                    <p className="text-sm text-slate-500">
                      Conectado el {new Date(gmailStatus.connected_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDisconnectGmail}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Unplug className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                </div>
              </div>

              {/* Sender Name */}
              <div className="p-4 bg-[#111111] rounded-lg border">
                <Label className="text-sm font-medium">Nombre del remitente</Label>
                <p className="text-xs text-slate-500 mb-2">Este nombre aparecerá como remitente en los correos</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Ej: Perla de Leaderlix"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="flex-1"
                    data-testid="sender-name-input"
                  />
                  <Button 
                    onClick={handleSaveSenderName}
                    variant="outline"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
              
              {/* Test Email */}
              <div className="p-4 bg-[#111111] rounded-lg border">
                <Label className="text-sm font-medium">Enviar email de prueba</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1"
                    data-testid="test-email-input"
                  />
                  <Button 
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="btn-accent"
                    data-testid="send-test-email-btn"
                  >
                    {testingEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar prueba
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Envía un correo de prueba para verificar que todo funciona correctamente
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-[#111111] rounded-lg border border-orange-200">
                <p className="text-slate-200 mb-4">
                  Para enviar correos desde <strong>perla@leaderlix.com</strong>, necesitas autorizar la aplicación:
                </p>
                <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2 mb-4">
                  <li>Haz clic en &quot;Conectar Gmail&quot;</li>
                  <li>Inicia sesión con <strong>perla@leaderlix.com</strong></li>
                  <li>Autoriza los permisos solicitados</li>
                  <li>Serás redirigido de vuelta automáticamente</li>
                </ol>
                <Button 
                  onClick={handleConnectGmail}
                  disabled={connectingGmail}
                  className="btn-accent w-full"
                  data-testid="connect-gmail-btn"
                >
                  {connectingGmail ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  {connectingGmail ? "Conectando..." : "Conectar Gmail"}
                </Button>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <strong>⚠️ Importante:</strong> Sin conectar Gmail, el sistema no podrá enviar correos. 
                  Los correos se prepararán y programarán, pero no se enviarán hasta que conectes tu cuenta.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar Connection */}
      <Card className={calendarStatus.connected ? "border-emerald-200 bg-emerald-50/30" : "border-blue-200 bg-blue-50/30"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${calendarStatus.connected ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                <Calendar className={`w-6 h-6 ${calendarStatus.connected ? 'text-emerald-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <CardTitle className="text-xl">Google Calendar</CardTitle>
                <CardDescription>
                  {calendarStatus.connected 
                    ? `Conectado como ${calendarStatus.email}` 
                    : "Conecta tu calendario para confirmaciones de WhatsApp"}
                </CardDescription>
              </div>
            </div>
            <Badge className={calendarStatus.connected ? "badge-success" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}>
              {calendarStatus.connected ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Conectado
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  No conectado
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendarStatus.connected ? (
            <div className="p-4 bg-[#111111] rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{calendarStatus.email}</p>
                  <p className="text-sm text-slate-500">
                    Conectado el {new Date(calendarStatus.connected_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDisconnectCalendar}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Unplug className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 bg-[#111111] rounded-lg border border-blue-200">
                <p className="text-slate-200 mb-4">
                  Conecta tu Google Calendar para habilitar las confirmaciones de WhatsApp:
                </p>
                <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2 mb-4">
                  <li>Haz clic en &quot;Conectar Calendar&quot;</li>
                  <li>Inicia sesión con tu cuenta de Google</li>
                  <li>Autoriza acceso de solo lectura a tu calendario</li>
                  <li>Serás redirigido de vuelta automáticamente</li>
                </ol>
                <Button 
                  onClick={handleConnectCalendar}
                  disabled={connectingCalendar}
                  className="btn-accent w-full"
                  data-testid="connect-calendar-btn"
                >
                  {connectingCalendar ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4 mr-2" />
                  )}
                  {connectingCalendar ? "Conectando..." : "Conectar Google Calendar"}
                </Button>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>ℹ️ Para qué sirve:</strong> Al conectar tu calendario, podrás generar mensajes de 
                  confirmación de WhatsApp para tus reuniones de los próximos 7 días, cruzando los asistentes 
                  con contactos en FOCUS.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Drive Connection */}
      <Card className="stat-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 ${driveStatus.connected ? 'bg-green-100' : 'bg-slate-100'} rounded-xl`}>
              <FileText className={`w-6 h-6 ${driveStatus.connected ? 'text-green-600' : 'text-slate-600'}`} />
            </div>
            <div>
              <CardTitle className="text-xl">Google Drive / Docs</CardTitle>
              <CardDescription>Para generar cotizaciones en Google Docs</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {driveStatus.connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="font-medium text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Google Drive conectado
                  </p>
                  {driveStatus.connected_at && (
                    <p className="text-sm text-green-600 mt-1">
                      Conectado: {new Date(driveStatus.connected_at).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDisconnectDrive}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Unplug className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </div>
              <p className="text-sm text-slate-600">
                ✅ Puedes generar documentos de cotización en Google Docs desde el Cotizador.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-slate-600">
                  Conecta tu Google Drive para generar cotizaciones profesionales en Google Docs:
                </p>
                <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
                  <li>Genera documentos basados en la plantilla de cotización</li>
                  <li>Los documentos se guardan automáticamente en tu Drive</li>
                  <li>Accede a los enlaces desde el listado de cotizaciones</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleConnectDrive}
                disabled={connectingDrive}
                className="btn-accent w-full"
                data-testid="connect-drive-btn"
              >
                {connectingDrive ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                {connectingDrive ? "Conectando..." : "Conectar Google Drive"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* HubSpot Settings */}
      <Card className="stat-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Key className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-xl">HubSpot</CardTitle>
              <CardDescription>Configuración de la API de HubSpot</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hubspot_token">Private App Access Token</Label>
              <Input
                id="hubspot_token"
                type="password"
                value={settings.hubspot_token}
                onChange={(e) => setSettings({ ...settings, hubspot_token: e.target.value })}
                placeholder="pat-na1-..."
                data-testid="hubspot-token"
              />
              <p className="text-xs text-slate-500">
                Token de tu Private App en HubSpot
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hubspot_list_id">ID de la Lista</Label>
              <Input
                id="hubspot_list_id"
                value={settings.hubspot_list_id}
                onChange={(e) => setSettings({ ...settings, hubspot_list_id: e.target.value })}
                placeholder="13417"
                data-testid="hubspot-list-id"
              />
              <p className="text-xs text-slate-500">
                ID de la lista de contactos a usar
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {settings.hubspot_token ? (
              <Badge className="badge-success">
                <CheckCircle className="w-3 h-3 mr-1" />
                Configurado
              </Badge>
            ) : (
              <Badge className="badge-warning">
                <AlertCircle className="w-3 h-3 mr-1" />
                No configurado
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Tokens - Apify, etc. */}
      <Card className="stat-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-xl">API Tokens</CardTitle>
              <CardDescription>Tokens para integraciones externas (Apify, etc.)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Apify Token */}
            <div className="p-4 bg-[#111111] rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-pink-400" />
                <Label className="text-sm font-medium">Apify Token</Label>
              </div>
              <Input
                type="password"
                value={settings.apify_token}
                onChange={(e) => setSettings({ ...settings, apify_token: e.target.value })}
                placeholder="apify_api_..."
                className="mb-2"
                data-testid="apify-token"
              />
              <p className="text-xs text-slate-500">
                Token para obtener videos trending de TikTok en la sección Attract.{" "}
                <a 
                  href="https://console.apify.com/account/integrations" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline inline-flex items-center gap-1"
                >
                  Obtener token <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {settings.apify_token ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Apify Configurado
                </Badge>
              ) : (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Apify no configurado (usando datos mock)
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn URL Migration */}
      <UrlMigrationCard />

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#111111]/10 rounded-xl">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Información de Envío</h3>
              <p className="text-slate-300 mt-1 text-sm">
                Los correos se enviarán de <strong>Lunes a Jueves</strong>, 
                en las ventanas de <strong>8:00-11:00 AM</strong> y <strong>4:00-6:00 PM</strong> (hora Ciudad de México).
                Cada contacto recibirá su correo en un horario diferente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Tasks Section */}
      <Card className="stat-card border-blue-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl text-blue-400">Scheduled Tasks</CardTitle>
                <CardDescription>Manage automated scraping schedules for Medical Societies and Pharma Pipelines</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => { loadSchedules(); loadSchedulerInfo(); }}
                disabled={loadingSchedules}
                data-testid="refresh-schedules-btn"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingSchedules ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                onClick={() => setCreateScheduleDialog(true)}
                className="bg-blue-500 hover:bg-blue-600"
                data-testid="create-schedule-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Schedule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-[#111111] rounded-lg border">
              <p className="text-2xl font-bold text-white">{schedules.length}</p>
              <p className="text-xs text-slate-400">Total Schedules</p>
            </div>
            <div className="p-3 bg-[#111111] rounded-lg border">
              <p className="text-2xl font-bold text-green-400">{schedules.filter(s => s.active).length}</p>
              <p className="text-xs text-slate-400">Active</p>
            </div>
            <div className="p-3 bg-[#111111] rounded-lg border">
              <p className="text-2xl font-bold text-blue-400">{schedules.filter(s => s.schedule_type === 'medical_society').length}</p>
              <p className="text-xs text-slate-400">Medical Societies</p>
            </div>
            <div className="p-3 bg-[#111111] rounded-lg border">
              <p className="text-2xl font-bold text-purple-400">{schedules.filter(s => s.schedule_type === 'pharma_pipeline').length}</p>
              <p className="text-xs text-slate-400">Pharma Pipelines</p>
            </div>
          </div>

          {/* Schedules List */}
          <div className="space-y-3">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              All Scheduled Tasks ({schedules.length})
            </h4>
            
            {loadingSchedules ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                <p className="text-sm text-slate-400 mt-2">Loading schedules...</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 bg-[#111111] rounded-lg border">
                <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-slate-400">No scheduled tasks yet</p>
                <p className="text-xs text-slate-500 mt-1">Create a schedule for Medical Societies or Pharma Pipelines</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {schedules.map(schedule => {
                  const typeBadge = getScheduleTypeBadge(schedule.schedule_type);
                  const statusBadge = getStatusBadge(schedule.last_run_status);
                  const TypeIcon = typeBadge.icon;
                  
                  return (
                    <div 
                      key={schedule.id} 
                      className={`p-4 bg-[#111111] rounded-lg border ${schedule.active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}
                      data-testid={`schedule-item-${schedule.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-2 rounded-lg ${typeBadge.bg}`}>
                            <TypeIcon className={`w-4 h-4 ${typeBadge.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">{schedule.entity_name}</span>
                              <Badge className={`${typeBadge.bg} ${typeBadge.text} ${typeBadge.border} text-xs`}>
                                {schedule.schedule_type.replace('_', ' ')}
                              </Badge>
                              <Badge className={`${statusBadge.bg} ${statusBadge.text} text-xs`}>
                                {statusBadge.label}
                              </Badge>
                              {!schedule.active && (
                                <Badge className="bg-slate-500/20 text-slate-400 text-xs">Paused</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                              <span>Frequency: {schedule.frequency}</span>
                              {schedule.last_run && (
                                <span>Last run: {new Date(schedule.last_run).toLocaleString()}</span>
                              )}
                              {schedule.next_run && (
                                <span className="text-blue-400">Next: {new Date(schedule.next_run).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTriggerSchedule(schedule.id)}
                            className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            title="Run now"
                            data-testid={`run-schedule-${schedule.id}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSchedule(schedule.id, schedule.active)}
                            className={schedule.active ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10" : "text-green-400 hover:text-green-300 hover:bg-green-500/10"}
                            title={schedule.active ? "Pause" : "Activate"}
                            data-testid={`toggle-schedule-${schedule.id}`}
                          >
                            {schedule.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Delete"
                            data-testid={`delete-schedule-${schedule.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Schedule Dialog */}
      <Dialog open={createScheduleDialog} onOpenChange={setCreateScheduleDialog}>
        <DialogContent className="max-w-md bg-[#0f0f0f] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              Create Scheduled Task
            </DialogTitle>
            <DialogDescription>
              Schedule automatic scraping for Medical Societies or Pharma Pipelines
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm text-slate-400">Schedule Type</Label>
              <Select
                value={newSchedule.schedule_type}
                onValueChange={(v) => setNewSchedule(prev => ({ ...prev, schedule_type: v }))}
              >
                <SelectTrigger className="mt-1 bg-[#111] border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medical_society">Medical Society Scraping</SelectItem>
                  <SelectItem value="pharma_pipeline">Pharma Pipeline Scraping</SelectItem>
                  <SelectItem value="business_unit">Business Unit Search</SelectItem>
                  <SelectItem value="keyword">Keyword Search</SelectItem>
                  <SelectItem value="buyer_persona">Buyer Persona Search</SelectItem>
                  <SelectItem value="small_business">Small Business Search</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm text-slate-400">Entity ID</Label>
              <Input
                value={newSchedule.entity_id}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, entity_id: e.target.value }))}
                placeholder="e.g., all_societies or pfizer_pipeline"
                className="mt-1 bg-[#111] border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Unique identifier for this schedule
              </p>
            </div>
            
            <div>
              <Label className="text-sm text-slate-400">Entity Name</Label>
              <Input
                value={newSchedule.entity_name}
                onChange={(e) => setNewSchedule(prev => ({ ...prev, entity_name: e.target.value }))}
                placeholder="e.g., All Medical Societies"
                className="mt-1 bg-[#111] border-slate-700"
              />
              <p className="text-xs text-slate-500 mt-1">
                Human-readable name for this schedule
              </p>
            </div>
            
            <div>
              <Label className="text-sm text-slate-400">Frequency</Label>
              <Select
                value={newSchedule.frequency}
                onValueChange={(v) => setNewSchedule(prev => ({ ...prev, frequency: v }))}
              >
                <SelectTrigger className="mt-1 bg-[#111] border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly (15 days)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="bimonthly">Bimonthly (60 days)</SelectItem>
                  <SelectItem value="quarterly">Quarterly (90 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateScheduleDialog(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSchedule}
              disabled={creatingSchedule || !newSchedule.entity_id || !newSchedule.entity_name}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="confirm-create-schedule-btn"
            >
              {creatingSchedule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Tools Section */}
      <Card className="stat-card border-red-500/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-red-400">Admin Tools</CardTitle>
              <CardDescription>Data maintenance and import preparation tools</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pre-Import Readiness Check */}
          <div className="p-4 bg-[#111111] rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-white flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Pre-Import Readiness Check
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Check if the system is ready for a CSV import with email merge
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handlePreImportCheck}
                disabled={loadingPreCheck}
                data-testid="pre-import-check-btn"
              >
                {loadingPreCheck ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run Check"}
              </Button>
            </div>
            
            {preImportCheck && (
              <div className="space-y-3 mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <Badge className={preImportCheck.is_ready_for_import ? "badge-success" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                    {preImportCheck.is_ready_for_import ? (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Ready for Import</>
                    ) : (
                      <><AlertCircle className="w-3 h-3 mr-1" /> Not Ready</>
                    )}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-2 bg-slate-800 rounded">
                    <p className="text-slate-400">Total Contacts</p>
                    <p className="text-white font-bold">{preImportCheck.stats?.total_contacts || 0}</p>
                  </div>
                  <div className="p-2 bg-slate-800 rounded">
                    <p className="text-slate-400">With Phones</p>
                    <p className="text-white font-bold">{preImportCheck.stats?.contacts_with_phones || 0}</p>
                  </div>
                  <div className="p-2 bg-slate-800 rounded">
                    <p className="text-slate-400">Email Duplicates</p>
                    <p className={`font-bold ${preImportCheck.stats?.duplicate_email_groups > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {preImportCheck.stats?.duplicate_email_groups || 0}
                    </p>
                  </div>
                </div>
                
                {preImportCheck.blockers?.length > 0 && (
                  <div className="p-3 bg-red-500/10 rounded border border-red-500/30">
                    <p className="text-red-400 font-medium text-sm mb-2">⛔ Blockers:</p>
                    {preImportCheck.blockers.map((b, i) => (
                      <p key={i} className="text-sm text-red-300">{b.message}</p>
                    ))}
                  </div>
                )}
                
                {preImportCheck.warnings?.length > 0 && (
                  <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/30">
                    <p className="text-yellow-400 font-medium text-sm mb-2">⚠️ Warnings:</p>
                    {preImportCheck.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-yellow-300">{w.message}</p>
                    ))}
                  </div>
                )}
                
                {preImportCheck.last_phone_reset && (
                  <p className="text-xs text-slate-500">
                    Last phone reset: {new Date(preImportCheck.last_phone_reset.performed_at).toLocaleString()} 
                    ({preImportCheck.last_phone_reset.contacts_affected} contacts)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Check Duplicate Emails */}
          <div className="p-4 bg-[#111111] rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-white flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Check Duplicate Emails
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Find contacts sharing the same email address
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleCheckDuplicateEmails}
                data-testid="check-duplicates-btn"
              >
                Check Duplicates
              </Button>
            </div>
          </div>

          {/* Reset All Phone Numbers - DESTRUCTIVE */}
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-red-400 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Reset All Phone Numbers
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  ⚠️ DESTRUCTIVE: Clears all phone data from all contacts to prepare for reimport
                </p>
              </div>
              <Button 
                variant="destructive"
                onClick={() => setPhoneResetDialog(true)}
                data-testid="reset-phones-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset Phones
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phone Reset Confirmation Dialog */}
      <Dialog open={phoneResetDialog} onOpenChange={setPhoneResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Confirm Phone Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL phone numbers from ALL contacts in the database.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-sm text-red-300">
                <strong>Warning:</strong> This operation will:
              </p>
              <ul className="list-disc list-inside text-sm text-red-300 mt-2 space-y-1">
                <li>Clear <code>phones[]</code> array for all contacts</li>
                <li>Set <code>phone</code> field to null</li>
                <li>Remove all phone validation flags</li>
              </ul>
            </div>
            
            <div>
              <Label className="text-sm">Type <strong className="text-red-400">RESET PHONES</strong> to confirm:</Label>
              <Input
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="RESET PHONES"
                className="mt-2"
                data-testid="reset-confirmation-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPhoneResetDialog(false); setConfirmationText(""); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleResetPhones}
              disabled={confirmationText !== "RESET PHONES" || resettingPhones}
              data-testid="confirm-reset-btn"
            >
              {resettingPhones ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {resettingPhones ? "Resetting..." : "Reset All Phones"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Emails Dialog */}
      <Dialog open={duplicateEmailsDialog} onOpenChange={setDuplicateEmailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Duplicate Email Report
            </DialogTitle>
            <DialogDescription>
              Contacts sharing the same email address
            </DialogDescription>
          </DialogHeader>
          
          {duplicateEmails && (
            <div className="space-y-4 py-4">
              <div className="flex gap-4">
                <div className="p-3 bg-slate-800 rounded flex-1 text-center">
                  <p className="text-2xl font-bold text-white">{duplicateEmails.total_duplicate_groups}</p>
                  <p className="text-xs text-slate-400">Duplicate Groups</p>
                </div>
                <div className="p-3 bg-slate-800 rounded flex-1 text-center">
                  <p className="text-2xl font-bold text-white">{duplicateEmails.total_affected_contacts}</p>
                  <p className="text-xs text-slate-400">Affected Contacts</p>
                </div>
              </div>
              
              {duplicateEmails.has_duplicates ? (
                <div className="space-y-3">
                  <p className="text-sm text-yellow-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {duplicateEmails.recommendation}
                  </p>
                  
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {duplicateEmails.duplicate_groups.map((group, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded border border-slate-700">
                        <p className="text-sm font-medium text-white mb-2">
                          {group.email} <Badge className="ml-2">{group.count} contacts</Badge>
                        </p>
                        <div className="space-y-1">
                          {group.contacts.map((c, cidx) => (
                            <p key={cidx} className="text-xs text-slate-400">
                              • {c.name} {c.company && `(${c.company})`}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 rounded border border-emerald-500/30">
                  <p className="text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {duplicateEmails.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setDuplicateEmailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Rules Section */}
      <EmailRulesSettings />

      {/* Webinar Emails Section */}
      <WebinarEmailSettings />

      {/* Buyer Personas & Keywords Section */}
      <Card className="stat-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Buyer Personas & Keywords</CardTitle>
              <CardDescription>Manage buyer personas and job classification keywords</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personas" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-800 p-1 mb-4">
              <TabsTrigger 
                value="personas" 
                className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]"
              >
                <Users className="w-4 h-4" />
                Buyer Personas
              </TabsTrigger>
              <TabsTrigger 
                value="keywords" 
                className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]"
              >
                <Tag className="w-4 h-4" />
                Keywords
              </TabsTrigger>
            </TabsList>
            <TabsContent value="personas">
              <BuyerPersonasDB />
            </TabsContent>
            <TabsContent value="keywords">
              <JobKeywords />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Data Sources Section */}
      <Card className="stat-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-100 rounded-xl">
              <Database className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Data Sources</CardTitle>
              <CardDescription>System information and data source management</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AdminPanel />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="btn-accent"
          data-testid="save-settings-btn"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  );
}
