/**
 * WebinarsTab - Webinar participation history for ContactSheet
 * Extracted from ContactSheet.jsx for maintainability
 */
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Calendar, Loader2 } from "lucide-react";

// Format watch time helper
const formatWatchTime = (seconds) => {
  if (!seconds) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export function WebinarsTab({
  webinarHistory,
  loadingWebinars
}) {
  return (
    <div className="space-y-4">
      {loadingWebinars ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-green-400" />
        </div>
      ) : webinarHistory.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No webinar participation yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-slate-400 text-sm">
              Webinar History ({webinarHistory.length})
            </Label>
            <div className="text-xs text-slate-500">
              Attended: {webinarHistory.filter(w => w.status === 'attended').length}
            </div>
          </div>
          {webinarHistory.map((webinar, idx) => (
            <div 
              key={webinar.event_id || idx} 
              className={`p-3 rounded-lg border ${
                webinar.status === 'attended' 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-[#1a1a1a] border-[#222]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${
                      webinar.status === 'attended'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {webinar.status === 'attended' ? '✓ Asistió' : '○ Registrado'}
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
          ))}
        </div>
      )}
    </div>
  );
}

export default WebinarsTab;
