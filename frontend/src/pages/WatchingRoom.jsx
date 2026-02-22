import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import api from "../lib/api";
import {
  Play,
  Calendar,
  Clock,
  Users,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

export default function WatchingRoom() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [contactId, setContactId] = useState(null);
  const [watchTime, setWatchTime] = useState(0);
  const pingIntervalRef = useRef(null);

  // Get current user's contact ID
  useEffect(() => {
    const fetchUserContact = async () => {
      try {
        // Get user info from auth
        const userRes = await api.get("/auth/me");
        const email = userRes.data?.email;
        
        if (email) {
          // Find contact by email
          const contactRes = await api.get(`/contacts?search=${encodeURIComponent(email)}&limit=1`);
          const contact = contactRes.data?.contacts?.[0];
          if (contact) {
            setContactId(contact.id);
          }
        }
      } catch (err) {
        console.error("Error fetching user contact:", err);
      }
    };
    
    fetchUserContact();
  }, []);

  // Fetch watching room data
  useEffect(() => {
    const fetchWatchingRoom = async () => {
      if (!eventId || !contactId) return;
      
      try {
        setLoading(true);
        const res = await api.get(`/events-v2/${eventId}/watching-room?contact_id=${contactId}`);
        setEventData(res.data);
        setError(null);
      } catch (err) {
        console.error("Error loading watching room:", err);
        const errorMsg = err.response?.data?.detail || "Error loading watching room";
        setError(errorMsg);
        
        if (errorMsg.includes("inscrito") || errorMsg.includes("enrolled")) {
          toast.error("No estás inscrito en este webinar. Por favor regístrate primero.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (contactId) {
      fetchWatchingRoom();
    }
  }, [eventId, contactId]);

  // Start watch time ping interval
  useEffect(() => {
    if (!eventData || !contactId) return;

    // Send ping every 30 seconds to track watch time
    const sendPing = async () => {
      try {
        const res = await api.post(`/events-v2/${eventId}/watch-ping`, {
          contact_id: contactId
        });
        if (res.data?.watch_time_seconds) {
          setWatchTime(res.data.watch_time_seconds);
        }
      } catch (err) {
        console.error("Watch ping failed:", err);
      }
    };

    // Initial ping
    sendPing();

    // Set up interval
    pingIntervalRef.current = setInterval(sendPing, 30000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [eventData, contactId, eventId]);

  // Format watch time
  const formatWatchTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Card className="bg-[#111] border-[#222] max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-white mb-2">Acceso Denegado</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <Button
              onClick={() => navigate(-1)}
              className="bg-[#ff3300] hover:bg-[#e62e00]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!eventData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]" data-testid="watching-room-page">
      {/* Header */}
      <div className="border-b border-[#222] bg-[#111]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">{eventData.name}</h1>
                <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(eventData.webinar_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {eventData.webinar_time}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Watch Time Tracker */}
            <div className="flex items-center gap-3">
              <Badge className="bg-green-500/20 text-green-400 px-3 py-1">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Asistiendo
              </Badge>
              <div className="text-right">
                <p className="text-xs text-slate-500">Tiempo de visualización</p>
                <p className="text-lg font-mono text-white">{formatWatchTime(watchTime)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Video */}
          <div className="lg:col-span-2">
            <div className="relative w-full pb-[56.25%] bg-black rounded-xl overflow-hidden border border-[#222]">
              {eventData.youtube_embed_url ? (
                <iframe
                  src={eventData.youtube_embed_url}
                  className="absolute top-0 left-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={eventData.name}
                />
              ) : (
                <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <Play className="w-16 h-16 mb-4" />
                  <p className="text-lg">El video estará disponible pronto</p>
                  <p className="text-sm mt-2">{formatDate(eventData.webinar_date)} a las {eventData.webinar_time}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Event Info Card */}
            <Card className="bg-[#111] border-[#222]">
              <CardContent className="p-4">
                <h3 className="font-semibold text-white mb-3">Sobre este webinar</h3>
                {eventData.description ? (
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">
                    {eventData.description}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">Sin descripción</p>
                )}
              </CardContent>
            </Card>

            {/* Banner Image */}
            {eventData.banner_image && (
              <Card className="bg-[#111] border-[#222] overflow-hidden">
                <img
                  src={eventData.banner_image}
                  alt={eventData.name}
                  className="w-full h-auto"
                />
              </Card>
            )}

            {/* Status Card */}
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                  <div>
                    <p className="font-medium text-green-400">Asistencia Registrada</p>
                    <p className="text-sm text-green-300/70">
                      Tu participación se está registrando automáticamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
