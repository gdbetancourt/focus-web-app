import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { UserPlus, Check, Calendar, RefreshCw, Linkedin, Users, AlertCircle, Copy, ExternalLink, AlertTriangle, Save } from "lucide-react";
import api from "../lib/api";

export default function LinkedInInvitations() {
  const [profiles, setProfiles] = useState([
    { id: "gb", name: "GB", fullName: "Profile GB", checked: false },
    { id: "mg", name: "MG", fullName: "Profile MG", checked: false }
  ]);
  const [loading, setLoading] = useState(true);
  const [togglingProfile, setTogglingProfile] = useState(null);
  const [weekInfo, setWeekInfo] = useState({ weekKey: "", weekStart: "" });
  
  // LinkedIn Events state
  const [linkedinEvents, setLinkedinEvents] = useState([]);
  const [eventsMissingUrl, setEventsMissingUrl] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingUrl, setEditingUrl] = useState("");

  useEffect(() => {
    loadWeeklyTasks();
    loadLinkedinEvents();
  }, []);

  const loadWeeklyTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/scheduler/weekly-tasks");
      const linkedinTasks = res.data.tasks?.linkedin_invitations || {};
      
      setProfiles(prev => prev.map(p => ({
        ...p,
        checked: linkedinTasks[p.id]?.checked || false,
        checkedAt: linkedinTasks[p.id]?.checked_at || null
      })));
      
      setWeekInfo({
        weekKey: res.data.week_key,
        weekStart: res.data.week_start
      });
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Error loading weekly tasks");
    } finally {
      setLoading(false);
    }
  };

  const loadLinkedinEvents = async () => {
    try {
      setLoadingEvents(true);
      const res = await api.get("/mensajes-hoy/linkedin/active-events");
      setLinkedinEvents(res.data.events_with_url || []);
      setEventsMissingUrl(res.data.events_missing_url || []);
    } catch (error) {
      console.error("Error loading LinkedIn events:", error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const copyEventUrls = async () => {
    const urls = linkedinEvents.map(e => e.linkedin_url).filter(Boolean).join("\n");
    if (!urls) {
      toast.error("No hay URLs de eventos");
      return;
    }
    try {
      await navigator.clipboard.writeText(urls);
      toast.success(`${linkedinEvents.length} URLs copiadas`);
    } catch (error) {
      toast.error("Error copiando URLs");
    }
  };

  const saveLinkedInUrl = async (event) => {
    if (!editingUrl.trim()) {
      toast.error("Ingresa una URL de LinkedIn");
      return;
    }
    
    try {
      await api.post("/mensajes-hoy/linkedin/update-event-url", {
        event_id: event.id,
        linkedin_url: editingUrl.trim(),
        collection: event.collection
      });
      toast.success("URL de LinkedIn guardada");
      setEditingEventId(null);
      setEditingUrl("");
      loadLinkedinEvents();
    } catch (error) {
      toast.error("Error guardando URL");
    }
  };

  const toggleProfile = async (profileId) => {
    setTogglingProfile(profileId);
    try {
      const res = await api.post(`/scheduler/weekly-tasks/linkedin_invitations/${profileId}`);
      
      setProfiles(prev => prev.map(p => 
        p.id === profileId 
          ? { ...p, checked: res.data.checked, checkedAt: res.data.checked ? new Date().toISOString() : null }
          : p
      ));
      
      const profile = profiles.find(p => p.id === profileId);
      toast.success(res.data.checked 
        ? `${profile.name} marked as completed` 
        : `${profile.name} unmarked`
      );
    } catch (error) {
      toast.error("Error updating task");
    } finally {
      setTogglingProfile(null);
    }
  };

  const allCompleted = profiles.every(p => p.checked);
  
  // Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const today = new Date().getDay();
  const isMonday = today === 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="linkedin-invitations-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${allCompleted ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <Linkedin className={`w-6 h-6 ${allCompleted ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Max LinkedIn Event Invitations</h1>
            <p className="text-slate-500">
              Weekly bulk invitations from LinkedIn profiles (Every Monday)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${allCompleted ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {allCompleted ? "✓ Completed this week" : "Pending this week"}
          </Badge>
          <Button onClick={loadWeeklyTasks} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Alert for missing LinkedIn URLs */}
      {eventsMissingUrl.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-400 text-lg">
              <AlertTriangle className="w-5 h-5" />
              {eventsMissingUrl.length} evento(s) sin URL de LinkedIn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {eventsMissingUrl.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{event.name}</p>
                    <p className="text-xs text-slate-500">{event.date}</p>
                  </div>
                  {editingEventId === event.id ? (
                    <div className="flex items-center gap-2 flex-1 ml-4">
                      <Input
                        placeholder="https://linkedin.com/events/..."
                        value={editingUrl}
                        onChange={(e) => setEditingUrl(e.target.value)}
                        className="bg-[#111] border-[#333] text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => saveLinkedInUrl(event)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingEventId(null); setEditingUrl(""); }}
                        className="text-slate-400"
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => { setEditingEventId(event.id); setEditingUrl(""); }}
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      Agregar URL
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* LinkedIn Event URLs Section */}
      {linkedinEvents.length > 0 && (
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <Calendar className="w-5 h-5 text-purple-400" />
                URLs de Eventos LinkedIn Activos
              </CardTitle>
              <Button
                size="sm"
                onClick={copyEventUrls}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="copy-events-btn"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar URLs ({linkedinEvents.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedinEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="outline" 
                      className={event.status === "published" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}
                    >
                      {event.status}
                    </Badge>
                    <div>
                      <p className="text-white text-sm font-medium">{event.name}</p>
                      <p className="text-xs text-slate-500">{event.date}</p>
                    </div>
                  </div>
                  <a
                    href={event.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 p-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week Info */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-white font-medium">Week: {weekInfo.weekKey}</span>
              <span className="text-slate-500 ml-3">
                (Started: {weekInfo.weekStart ? new Date(weekInfo.weekStart).toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' }) : 'N/A'})
              </span>
            </div>
            {isMonday && !allCompleted && (
              <Badge className="bg-yellow-500/20 text-yellow-400 ml-auto">
                <AlertCircle className="w-3 h-3 mr-1" />
                Today is Monday - Time to send invitations!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profiles */}
      <div className="grid md:grid-cols-2 gap-6">
        {profiles.map(profile => (
          <Card 
            key={profile.id} 
            className={`bg-[#111] border-2 transition-all ${
              profile.checked 
                ? 'border-green-500/50' 
                : 'border-red-500/50'
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${profile.checked ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <Users className={`w-5 h-5 ${profile.checked ? 'text-green-500' : 'text-red-500'}`} />
                  </div>
                  Profile {profile.name}
                </CardTitle>
                <Badge className={profile.checked ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                  {profile.checked ? '✓ Done' : 'Pending'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-400 text-sm">
                Maximize bulk event invitations from this LinkedIn profile
              </p>
              
              {profile.checked && profile.checkedAt && (
                <p className="text-xs text-slate-500">
                  Completed: {new Date(profile.checkedAt).toLocaleString('es-MX')}
                </p>
              )}
              
              <Button
                onClick={() => toggleProfile(profile.id)}
                disabled={togglingProfile === profile.id}
                className={`w-full ${
                  profile.checked 
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {togglingProfile === profile.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : profile.checked ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Mark as Not Done
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Mark as Done
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instructions */}
      <Card className="bg-[#0a0a0a] border-[#222]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-400 text-sm">
          <p>1. Copy the LinkedIn event URLs above (if available)</p>
          <p>2. Log into each LinkedIn profile (GB and MG)</p>
          <p>3. Go to each event URL</p>
          <p>4. Click &quot;Invite connections&quot; and select all available</p>
          <p>5. Once done for a profile, mark it as completed above</p>
          <p className="text-yellow-400 mt-4">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            This task resets every Monday. Complete it weekly to keep the traffic light green.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
