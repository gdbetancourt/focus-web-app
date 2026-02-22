/**
 * WebinarHistoryList - Display list of webinar participations
 */
import { Calendar } from "lucide-react";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";

// Format watch time from seconds to human readable
const formatWatchTime = (seconds) => {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export function WebinarHistoryList({ webinars = [], loading = false }) {
  if (loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
        <p>Cargando webinars...</p>
      </div>
    );
  }

  if (webinars.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No webinar participation yet</p>
      </div>
    );
  }

  const attendedCount = webinars.filter(w => w.status === 'attended').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-slate-400 text-sm">
          Webinar History ({webinars.length})
        </Label>
        <div className="text-xs text-slate-500">
          Attended: {attendedCount}
        </div>
      </div>
      
      {webinars.map((webinar, idx) => (
        <WebinarCard key={webinar.event_id || idx} webinar={webinar} />
      ))}
    </div>
  );
}

function WebinarCard({ webinar }) {
  const isAttended = webinar.status === 'attended';
  
  return (
    <div 
      className={`p-3 rounded-lg border ${
        isAttended 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-[#1a1a1a] border-[#222]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs ${
              isAttended
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {isAttended ? '✓ Asistió' : '○ Registrado'}
            </Badge>
            {webinar.watch_time_seconds > 0 && (
              <span className="text-xs text-slate-400">
                ⏱ {formatWatchTime(webinar.watch_time_seconds)}
              </span>
            )}
          </div>
          <p className="text-white font-medium">
            {webinar.event_name || webinar.event_details?.name || 'Webinar'}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            {webinar.event_details?.webinar_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(webinar.event_details.webinar_date).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </span>
            )}
            {webinar.registered_at && (
              <span>
                Registrado: {new Date(webinar.registered_at).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short'
                })}
              </span>
            )}
          </div>
        </div>
        {webinar.event_details?.banner_image && (
          <img 
            src={webinar.event_details.banner_image} 
            alt="" 
            className="w-16 h-10 object-cover rounded"
          />
        )}
      </div>
    </div>
  );
}

export default WebinarHistoryList;
