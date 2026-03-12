/**
 * EmailMetricsPage — Campaign metrics dashboard for webinar emails.
 * Level 1: list of webinars with aggregated stats.
 * Level 2: drill-down into a single webinar's campaigns + send log.
 */
import { useState, useEffect, useCallback } from "react";
import { BarChart3, ArrowLeft, Mail, Check, X, Clock, Eye } from "lucide-react";
import api from "../../lib/api";

const STATUS_STYLES = {
  pending: "bg-yellow-900/40 text-yellow-300",
  sent: "bg-green-900/40 text-green-300",
  failed: "bg-red-900/40 text-red-300",
  cancelled: "bg-slate-700 text-slate-400",
  processing: "bg-blue-900/40 text-blue-300",
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] || "bg-slate-700 text-slate-400"}`}>
      {status}
    </span>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ── Level 2: Event detail ─────────────────────────────────────────

function EventDetail({ eventId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/webinar-emails/metrics/${eventId}`);
        setData(res.data);
      } catch (err) {
        console.error("Error loading event metrics:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  if (loading) return <div className="p-6 text-slate-400">Cargando...</div>;
  if (!data) return <div className="p-6 text-red-400">Error al cargar evento</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-white">{data.event_title}</h2>
          <div className="text-sm text-slate-400">
            {data.event_date ? new Date(data.event_date).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : "Sin fecha"}
          </div>
        </div>
      </div>

      {/* Campaign cards */}
      {data.campaigns.length === 0 ? (
        <div className="text-slate-500 text-sm">No hay campañas para este evento.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {data.campaigns.map((c) => (
            <div key={c.campaign_id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">{c.label}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="text-xs text-slate-400 mb-3">
                Programada: {c.scheduled_send_at ? new Date(c.scheduled_send_at).toLocaleString("es-MX") : "—"}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Dest." value={c.total_recipients} />
                <Stat label="Env." value={c.total_sent} />
                <Stat label="Abier." value={c.total_opened} />
                <Stat label="Fall." value={c.total_failed} />
              </div>
              {c.total_sent > 0 && (
                <div className="mt-3 text-center">
                  <span className="text-sm font-medium text-blue-400">
                    {(c.open_rate * 100).toFixed(1)}% apertura
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Send log table */}
      {data.send_log.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Registro de envíos (últimos 100)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Campaña</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Estado</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Abierto</th>
                </tr>
              </thead>
              <tbody>
                {data.send_log.map((sl, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-white font-mono text-xs">{sl.email}</td>
                    <td className="py-2 px-3 text-slate-400 text-xs">{sl.campaign_type}</td>
                    <td className="py-2 px-3">
                      {sl.status === "sent" ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs"><Check className="w-3 h-3" /> Enviado</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs"><X className="w-3 h-3" /> Fallido</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {sl.opened_at ? (
                        <span className="flex items-center gap-1 text-blue-400"><Eye className="w-3 h-3" /> {new Date(sl.opened_at).toLocaleString("es-MX")}</span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Level 1: Webinar list ─────────────────────────────────────────

export default function EmailMetricsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/webinar-emails/metrics");
      setEvents(res.data);
    } catch (err) {
      console.error("Error loading metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (selectedEvent) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <EventDetail eventId={selectedEvent} onBack={() => setSelectedEvent(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold text-white">Métricas Email</h1>
      </div>

      {loading ? (
        <div className="text-slate-400">Cargando métricas...</div>
      ) : events.length === 0 ? (
        <div className="text-slate-500">No hay webinars con campañas en los últimos 90 días.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Webinar</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Fecha</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">
                  <Clock className="w-4 h-4 inline" /> Pendientes
                </th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">
                  <Mail className="w-4 h-4 inline" /> Enviadas
                </th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">
                  <Eye className="w-4 h-4 inline" /> Abiertas
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const pending = ev.campaigns.filter((c) => c.status === "pending").length;
                const totalSent = ev.campaigns.reduce((s, c) => s + c.total_sent, 0);
                const totalOpened = ev.campaigns.reduce((s, c) => s + c.total_opened, 0);
                return (
                  <tr
                    key={ev.event_id}
                    onClick={() => setSelectedEvent(ev.event_id)}
                    className="border-b border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 text-white font-medium">{ev.event_title}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {ev.event_date ? new Date(ev.event_date).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {pending > 0 ? (
                        <span className="text-yellow-400 font-medium">{pending}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-white font-medium">{totalSent}</td>
                    <td className="py-3 px-3 text-center text-blue-400 font-medium">{totalOpened}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
