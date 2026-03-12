/**
 * LinkedInJournalPage — LIJ-01 Redesign
 * Timeline + Cases list with Google Places autocomplete for event creation.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { toast } from "sonner";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Check,
  Trash2,
  MapPin,
} from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";

const SECTION = getSectionById("linkedin-journal");

const STAGE_BADGE = {
  ganados: "bg-green-500/20 text-green-400",
  contenidos_transcritos: "bg-blue-500/20 text-blue-400",
  reporte_presentado: "bg-purple-500/20 text-purple-400",
  caso_publicado: "bg-emerald-500/20 text-emerald-400",
  concluidos: "bg-zinc-500/20 text-zinc-400",
};

// ── Google Places hook ──────────────────────────────────────────

function useGooglePlaces(inputRef, onSelect) {
  const autocompleteRef = useRef(null);

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;
    if (!apiKey || !inputRef.current) return;

    let mounted = true;
    const loader = new Loader({ apiKey, libraries: ["places"] });

    loader.importLibrary("places").then((places) => {
      if (!mounted || !inputRef.current) return;
      const ac = new places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place && place.geometry) {
          onSelect({
            location_text: place.formatted_address || place.name || "",
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
        } else if (place) {
          onSelect({
            location_text: place.name || "",
            latitude: null,
            longitude: null,
          });
        }
      });
      autocompleteRef.current = ac;
    }).catch(() => {
      // API key missing or invalid — degrade gracefully
    });

    return () => { mounted = false; };
  }, [inputRef, onSelect]);
}

// ── Helpers ─────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function daysLabel(days) {
  if (days === 0) return "Hoy";
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? "s" : ""}`;
  return `En ${days} día${days !== 1 ? "s" : ""}`;
}

function postTypeLabel(rec) {
  if (rec == null) return "Inmediata";
  return `Aniversario año ${rec}`;
}

// ── Main Component ──────────────────────────────────────────────

export default function LinkedInJournalPage() {
  const [timeline, setTimeline] = useState([]);
  const [cases, setCases] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(true);

  const loadTimeline = useCallback(async () => {
    try {
      const res = await api.get("/linkedin/journal/timeline");
      setTimeline(res.data || []);
    } catch (err) {
      console.error("Error loading timeline:", err);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const loadCases = useCallback(async () => {
    try {
      const res = await api.get("/linkedin/journal/cases");
      setCases(res.data || []);
    } catch (err) {
      console.error("Error loading cases:", err);
    } finally {
      setCasesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
    loadCases();
  }, [loadTimeline, loadCases]);

  const reloadAll = () => {
    loadTimeline();
    loadCases();
  };

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus="gray"
      statusHistory={[]}
      icon={CalendarClock}
    >
      {/* ── Timeline Section ── */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          Publicaciones pendientes
        </h2>
        {timelineLoading ? (
          <div className="flex items-center justify-center h-24 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando timeline...
          </div>
        ) : timeline.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-6 text-center text-slate-500">
              No hay publicaciones pendientes.
            </CardContent>
          </Card>
        ) : (
          <TimelineTable items={timeline} onReload={reloadAll} />
        )}
      </div>

      {/* ── Cases Section ── */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Casos Stage 4/5
        </h2>
        {casesLoading ? (
          <div className="flex items-center justify-center h-24 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando casos...
          </div>
        ) : cases.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-6 text-center text-slate-500">
              No hay casos en Stage 4/5.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <CaseRow key={c.id} caseData={c} onReload={reloadAll} />
            ))}
          </div>
        )}
      </div>
    </SectionLayout>
  );
}

// ── Timeline Table ──────────────────────────────────────────────

function TimelineTable({ items, onReload }) {
  return (
    <div className="rounded-lg border border-[#222] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#0a0a0a] text-zinc-500 text-xs">
            <th className="px-3 py-2 text-left w-8"></th>
            <th className="px-3 py-2 text-left">Evento</th>
            <th className="px-3 py-2 text-left">Caso</th>
            <th className="px-3 py-2 text-left">Fecha evento</th>
            <th className="px-3 py-2 text-left">Publicar el</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Días</th>
            <th className="px-3 py-2 text-center w-16">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <TimelineRow key={item.id} item={item} onReload={onReload} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineRow({ item, onReload }) {
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState(false);

  const days = item.days_until;
  const isOverdue = days < 0;
  const isToday = days === 0;
  const isSoon = days > 0 && days <= 7;

  let rowBg = "";
  if (isOverdue) rowBg = "bg-red-950/20";
  else if (isToday) rowBg = "bg-yellow-950/20";

  let dotColor = "bg-zinc-600";
  if (isOverdue) dotColor = "bg-red-500";
  else if (isToday || isSoon) dotColor = "bg-yellow-500";

  const handleMark = async () => {
    setMarking(true);
    try {
      await api.patch(`/linkedin/journal/${item.id}/mark-published`);
      setDone(true);
      toast.success("Publicado. Aniversario generado.");
      setTimeout(() => onReload(), 800);
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al marcar";
      toast.error(msg);
      setMarking(false);
    }
  };

  return (
    <tr className={`border-t border-[#222] ${rowBg} hover:bg-[#151515] transition-colors`}>
      <td className="px-3 py-2">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
      </td>
      <td className="px-3 py-2 text-zinc-300">{item.event_name}</td>
      <td className="px-3 py-2 text-zinc-400">{item.case_name}</td>
      <td className="px-3 py-2 text-zinc-500">{formatDate(item.event_date)}</td>
      <td className="px-3 py-2 text-zinc-300">{formatDate(item.scheduled_date)}</td>
      <td className="px-3 py-2">
        <span className="text-xs text-zinc-500">{postTypeLabel(item.recurrence_year)}</span>
      </td>
      <td className="px-3 py-2">
        {isToday ? (
          <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">HOY</Badge>
        ) : isSoon ? (
          <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">{daysLabel(days)}</Badge>
        ) : (
          <span className={`text-xs ${isOverdue ? "text-red-400" : "text-zinc-500"}`}>
            {daysLabel(days)}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {done ? (
          <Check className="w-5 h-5 text-green-400 mx-auto" />
        ) : marking ? (
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto" />
        ) : (
          <button
            onClick={handleMark}
            className="w-5 h-5 rounded border border-zinc-600 hover:border-green-400 hover:bg-green-400/10 transition-colors mx-auto block"
            title="Marcar como publicado"
          />
        )}
      </td>
    </tr>
  );
}

// ── Case Row (expandable) ───────────────────────────────────────

function CaseRow({ caseData, onReload }) {
  const [open, setOpen] = useState(false);
  const eventCount = caseData.events?.length || 0;

  return (
    <Card className="bg-[#111] border-[#222]">
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#151515] transition-colors"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          )}
          <span className="text-sm text-white font-medium flex-1 truncate">
            {caseData.name}
          </span>
          <Badge className={STAGE_BADGE[caseData.stage] || "bg-zinc-700 text-zinc-300"}>
            {caseData.stage}
          </Badge>
          <span className="text-xs text-zinc-500 ml-2">
            {eventCount} evento{eventCount !== 1 ? "s" : ""}
          </span>
        </button>

        {open && (
          <CaseDetail caseData={caseData} onReload={onReload} />
        )}
      </CardContent>
    </Card>
  );
}

function CaseDetail({ caseData, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const events = caseData.events || [];

  return (
    <div className="px-4 pb-4 border-t border-[#222]">
      {events.length === 0 && !showForm && (
        <p className="text-sm text-zinc-500 py-3">Sin eventos registrados</p>
      )}

      {events.map((ev) => (
        <EventDetail key={ev.id} event={ev} onReload={onReload} />
      ))}

      {showForm ? (
        <AddEventForm
          caseId={caseData.id}
          onCreated={() => { setShowForm(false); onReload(); }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button
          onClick={() => setShowForm(true)}
          variant="ghost"
          size="sm"
          className="mt-2 text-blue-400 hover:text-blue-300"
        >
          <Plus className="w-4 h-4 mr-1" /> Agregar evento
        </Button>
      )}
    </div>
  );
}

// ── Event Detail ────────────────────────────────────────────────

function EventDetail({ event, onReload }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar evento "${event.name}" y todas sus publicaciones?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/case-events/${event.id}`);
      toast.success("Evento eliminado");
      onReload();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
      setDeleting(false);
    }
  };

  return (
    <div className="py-3 border-b border-[#1a1a1a] last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-white font-medium">{event.name}</p>
          <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" />
            {event.location_text}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Fecha: {formatDate(event.event_date)}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-zinc-600 hover:text-red-400 transition-colors p-1"
          title="Eliminar evento"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Posts list */}
      {event.posts && event.posts.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {event.posts.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                p.status === "published" ? "bg-green-500" :
                p.status === "skipped" ? "bg-yellow-500" : "bg-blue-500"
              }`} />
              <span className="text-zinc-400">{formatDate(p.scheduled_date)}</span>
              <span className="text-zinc-600">{postTypeLabel(p.recurrence_year)}</span>
              <Badge className={`text-[10px] px-1.5 py-0 ${
                p.status === "published" ? "bg-green-500/20 text-green-400" :
                p.status === "skipped" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-blue-500/20 text-blue-400"
              }`}>
                {p.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Event Form ──────────────────────────────────────────────

function AddEventForm({ caseId, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [eventDate, setEventDate] = useState("");
  const [saving, setSaving] = useState(false);

  const placeInputRef = useRef(null);

  const handlePlaceSelect = useCallback((place) => {
    setLocationText(place.location_text);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
  }, []);

  useGooglePlaces(placeInputRef, handlePlaceSelect);

  const handleSubmit = async () => {
    if (!name.trim() || !locationText.trim() || !eventDate) return;
    setSaving(true);
    try {
      await api.post("/case-events", {
        case_id: caseId,
        name: name.trim(),
        location_text: locationText.trim(),
        latitude,
        longitude,
        event_date: eventDate,
      });
      toast.success("Evento creado y publicación programada");
      onCreated();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al crear evento";
      toast.error(msg);
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg bg-[#0a0a0a] border border-[#222] space-y-3">
      <div>
        <label className="text-xs text-zinc-400 block mb-1">Nombre del evento</label>
        <input
          className="w-full rounded-md border border-[#333] bg-[#111] text-white p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Conferencia Liderazgo CDMX 2024"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400 block mb-1">Lugar (Google Places)</label>
        <input
          ref={placeInputRef}
          className="w-full rounded-md border border-[#333] bg-[#111] text-white p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          defaultValue={locationText}
          onChange={(e) => {
            setLocationText(e.target.value);
            setLatitude(null);
            setLongitude(null);
          }}
          placeholder="Busca un lugar..."
        />
        {latitude && (
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Coordenadas: {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </p>
        )}
      </div>
      <div>
        <label className="text-xs text-zinc-400 block mb-1">Fecha del evento</label>
        <input
          type="date"
          className="w-full rounded-md border border-[#333] bg-[#111] text-white p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={saving || !name.trim() || !locationText.trim() || !eventDate}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Guardar evento
        </Button>
        <Button
          onClick={onCancel}
          variant="ghost"
          size="sm"
          className="text-zinc-400"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
