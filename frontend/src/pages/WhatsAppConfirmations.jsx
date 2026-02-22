import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { 
  MessageCircle, 
  Calendar, 
  Copy, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  Loader2,
  Clock,
  User,
  Phone,
  Mail,
  RefreshCw,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function WhatsAppConfirmations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [confirmationsStatus, setConfirmationsStatus] = useState(null);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkCalendarStatus();
    checkConfirmationsStatus();
  }, []);

  const checkCalendarStatus = async () => {
    try {
      const response = await api.get("/calendar/status");
      setCalendarStatus(response.data);
    } catch (error) {
      console.error("Error checking calendar status:", error);
      setCalendarStatus({ connected: false });
    }
  };

  const checkConfirmationsStatus = async () => {
    try {
      const response = await api.get("/whatsapp-confirmations/status");
      setConfirmationsStatus(response.data);
    } catch (error) {
      console.error("Error checking confirmations status:", error);
    }
  };

  const generateConfirmations = async () => {
    setLoading(true);
    setResults(null);
    
    try {
      const response = await api.post("/whatsapp-confirmations/generate?days=7");
      setResults(response.data);
      
      // Log execution
      await api.post(`/whatsapp-confirmations/log-execution?items_count=${response.data.items.length}&alerts_count=${response.data.alerts.length}`);
      
      // Refresh status
      checkConfirmationsStatus();
      
      if (response.data.items.length > 0) {
        toast.success(`Generated ${response.data.items.length} WhatsApp confirmations`);
      } else {
        toast.info("No matching contacts found for upcoming meetings");
      }
    } catch (error) {
      console.error("Error generating confirmations:", error);
      toast.error(error.response?.data?.detail || "Error generating confirmations");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!results?.clipboard_text) return;
    
    try {
      await navigator.clipboard.writeText(results.clipboard_text);
      setCopied(true);
      toast.success(`Copied ${results.items.length} WhatsApp links to clipboard`);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error("Error copying to clipboard");
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = () => {
    if (!confirmationsStatus) return null;
    
    const colors = {
      green: "bg-green-500/20 text-green-400 border-green-500/30",
      yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      red: "bg-red-500/20 text-red-400 border-red-500/30"
    };
    
    return (
      <Badge className={colors[confirmationsStatus.status] || colors.yellow}>
        {confirmationsStatus.status === "green" && <CheckCircle className="w-3 h-3 mr-1" />}
        {confirmationsStatus.status === "yellow" && <Clock className="w-3 h-3 mr-1" />}
        {confirmationsStatus.status === "red" && <AlertTriangle className="w-3 h-3 mr-1" />}
        {confirmationsStatus.message}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="whatsapp-confirmations-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            WhatsApp Confirmations
          </h1>
          <p className="text-slate-500 mt-1">
            Generate confirmation messages for upcoming meetings (next 7 days)
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Calendar Connection Status */}
      {!calendarStatus?.connected && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <AlertTriangle className="h-4 w-4 text-orange-400" />
          <AlertDescription className="text-orange-300">
            <strong>Google Calendar not connected.</strong> Please connect your calendar in{" "}
            <Button 
              variant="link" 
              className="text-orange-400 p-0 h-auto"
              onClick={() => navigate("/settings")}
            >
              Settings
            </Button>
            {" "}to use this feature.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Action Card */}
      <Card className="stat-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <MessageCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Generate Confirmations (7 Days)</CardTitle>
                <CardDescription>
                  Reads your calendar, matches attendees with FOCUS contacts, and generates WhatsApp links
                </CardDescription>
              </div>
            </div>
            {calendarStatus?.connected && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Calendar className="w-3 h-3 mr-1" />
                {calendarStatus.email}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={generateConfirmations}
              disabled={loading || !calendarStatus?.connected}
              className="btn-accent"
              data-testid="generate-confirmations-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate WhatsApp Confirmations
                </>
              )}
            </Button>
            
            {results && results.items.length > 0 && (
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className={copied ? "border-green-500 text-green-500" : ""}
                data-testid="copy-links-btn"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy All Links ({results.items.length})
                  </>
                )}
              </Button>
            )}
          </div>

          {confirmationsStatus?.last_execution && (
            <p className="text-sm text-slate-500 mt-3">
              Last execution: {formatDateTime(confirmationsStatus.last_execution)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="stat-card">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-white">{results.total_events}</div>
                <p className="text-sm text-slate-500">Events Found</p>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-400">{results.matched_contacts}</div>
                <p className="text-sm text-slate-500">Confirmations Ready</p>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-400">{results.alerts.length}</div>
                <p className="text-sm text-slate-500">Missing Phone</p>
              </CardContent>
            </Card>
            <Card className="stat-card">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-slate-400">{results.unmatched_attendees}</div>
                <p className="text-sm text-slate-500">Not in FOCUS</p>
              </CardContent>
            </Card>
          </div>

          {/* Confirmations List */}
          {results.items.length > 0 && (
            <Card className="stat-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Contacts Ready for Confirmation ({results.items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 bg-[#1a1a1a] rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors"
                      data-testid={`confirmation-item-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-white">{item.contact_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Mail className="w-3 h-3" />
                            {item.contact_email}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Phone className="w-3 h-3" />
                            {item.to_phone_e164}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(item.start_datetime)} ({item.timezone})
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <a
                            href={item.whatsapp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Open WhatsApp
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      
                      <div className="mt-3 p-3 bg-[#111111] rounded border border-slate-800">
                        <p className="text-sm text-slate-300 italic">&quot;{item.message_text}&quot;</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerts Section */}
          {results.alerts.length > 0 && (
            <Card className="stat-card border-yellow-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="w-5 h-5" />
                  Contacts Missing Phone ({results.alerts.length})
                </CardTitle>
                <CardDescription>
                  These contacts exist in FOCUS but don&apos;t have a valid phone number for WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.alerts.map((alert, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between"
                      data-testid={`alert-item-${idx}`}
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-yellow-400" />
                        <div>
                          <span className="font-medium text-white">{alert.contact_name || alert.contact_email}</span>
                          <p className="text-sm text-slate-400">{alert.contact_email}</p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400">
                        Event: {formatDateTime(alert.event_start_datetime)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {results.items.length === 0 && results.alerts.length === 0 && (
            <Card className="stat-card">
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Confirmations to Send</h3>
                <p className="text-slate-400">
                  No meetings found with attendees matching FOCUS contacts in the next 7 days.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Help Card */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#111111]/10 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">How it works</h3>
              <ul className="text-slate-300 mt-2 text-sm space-y-1 list-disc list-inside">
                <li>Reads events from your Google Calendar for the next 7 days</li>
                <li>Matches attendee emails with contacts in FOCUS</li>
                <li>Generates personalized WhatsApp messages with meeting details</li>
                <li>Run on <strong>Monday, Wednesday, and Friday</strong> to keep the semaphore green</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
