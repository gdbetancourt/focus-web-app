/**
 * MeetingsConfirmationsPage
 * FOCUS section — daily, navigation_order=1
 * Confirms upcoming meetings via WhatsApp.
 * Spec: docs/product (Google Docs manuals v1.1 / v1.2)
 */
import { useState, useEffect, useCallback } from "react";
import { getSectionById } from "./focusSections";
import SectionLayout from "./SectionLayout";
import {
  CalendarCheck,
  MessageCircle,
  ExternalLink,
  Copy,
  Clock,
  Phone,
  Mail,
  User,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from "sonner";
import api from "../../lib/api";

const SECTION = getSectionById("meetings-confirmations");

// ─────────────────────────────────────────────
// Item Card
// ─────────────────────────────────────────────

function ItemCard({ item, showSnooze = false, onCopied, onSnoozed }) {
  const [copying, setCopying] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  const handleCopy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(item.message_text);
      await api.post(`/meetings-confirmations/items/${item.item_id}/copy`);
      toast.success("Mensaje copiado");
      onCopied?.();
    } catch (err) {
      toast.error("Error al copiar el mensaje");
    } finally {
      setCopying(false);
    }
  };

  const handleSnooze = async () => {
    setSnoozing(true);
    try {
      const res = await api.post(`/meetings-confirmations/items/${item.item_id}/snooze`);
      toast.success(`Pospuesto al ${res.data.snooze_until}`);
      onSnoozed?.();
    } catch (err) {
      toast.error("Error al posponer");
    } finally {
      setSnoozing(false);
    }
  };

  const isCopied = item.status === "copied";

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        isCopied
          ? "bg-green-500/5 border-green-500/20"
          : "bg-[#1a1a1a] border-slate-700 hover:border-slate-600"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: contact + event info */}
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-white truncate">{item.contact_name}</span>
            {isCopied && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs shrink-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                Copiado
              </Badge>
            )}
            {item.contact_was_created && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs shrink-0">
                Contacto nuevo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{item.attendee_email}</span>
          </div>
          {item.to_phone_e164 && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{item.to_phone_e164}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{formatLocalDate(item.start_datetime)}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {item.whatsapp_link && (
            <a
              href={item.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {!isCopied && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-slate-600 hover:border-green-500 hover:text-green-400"
              onClick={handleCopy}
              disabled={copying}
            >
              {copying ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Copiar
            </Button>
          )}
          {showSnooze && !isCopied && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={handleSnooze}
              disabled={snoozing}
            >
              {snoozing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Clock className="w-3 h-3 mr-1" />
              )}
              Posponer
            </Button>
          )}
        </div>
      </div>

      {/* Message preview */}
      <div className="mt-3 p-2.5 bg-[#111] rounded border border-slate-800">
        <p className="text-xs text-slate-300 italic leading-relaxed">
          &quot;{item.message_text}&quot;
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// No-phone item card
// ─────────────────────────────────────────────

function NoPhoneCard({ item, onPhoneAdded }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await api.post(`/meetings-confirmations/items/${item.item_id}/add-phone`, { phone });
      toast.success("Teléfono agregado");
      setEditing(false);
      setPhone("");
      onPhoneAdded?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar el teléfono");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="font-medium text-white truncate">{item.contact_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{item.attendee_email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{formatLocalDate(item.start_datetime)}</span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 shrink-0"
          onClick={() => setEditing(!editing)}
        >
          <Phone className="w-3 h-3 mr-1" />
          Agregar teléfono
        </Button>
      </div>

      {editing && (
        <div className="mt-3 flex gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+52 55 1234 5678"
            className="bg-[#0a0a0a] border-[#333] text-sm h-8"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button
            size="sm"
            className="btn-accent h-8 text-xs shrink-0"
            onClick={handleSave}
            disabled={saving || !phone.trim()}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-slate-500"
            onClick={() => { setEditing(false); setPhone(""); }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Bucket Accordion
// ─────────────────────────────────────────────

function BucketAccordion({ label, items, defaultOpen = false, showSnooze = false, showCopyAll = false, onRefresh }) {
  const [open, setOpen] = useState(defaultOpen);

  const pendingItems = items.filter((i) => i.status !== "copied");
  const pendingIds = pendingItems.map((i) => i.item_id);
  const [copyingAll, setCopyingAll] = useState(false);

  const handleCopyAll = async () => {
    if (!pendingIds.length) return;
    setCopyingAll(true);
    try {
      await Promise.all(
        pendingItems.map((item) => navigator.clipboard.writeText(item.message_text).catch(() => {}))
      );
      await api.post("/meetings-confirmations/items/copy-bulk", { item_ids: pendingIds });
      toast.success(`${pendingIds.length} mensaje${pendingIds.length > 1 ? "s" : ""} copiado${pendingIds.length > 1 ? "s" : ""}`);
      onRefresh?.();
    } catch (err) {
      toast.error("Error al copiar todos los mensajes");
    } finally {
      setCopyingAll(false);
    }
  };

  if (!items.length) return null;

  const allCopied = items.every((i) => i.status === "copied");

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a1a] hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-white">{label}</span>
          <Badge className={allCopied ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-slate-700 text-slate-300 border-slate-600"}>
            {items.length}
          </Badge>
          {allCopied && <CheckCircle className="w-4 h-4 text-green-400" />}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {open && (
        <div className="p-4 space-y-3 bg-[#111]">
          {showCopyAll && pendingItems.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:border-green-500 hover:text-green-400 text-xs"
              onClick={handleCopyAll}
              disabled={copyingAll}
            >
              {copyingAll ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Copy className="w-3 h-3 mr-1" />
              )}
              Copiar todos ({pendingItems.length})
            </Button>
          )}
          {items.map((item) => (
            <ItemCard
              key={item.item_id}
              item={item}
              showSnooze={showSnooze}
              onCopied={onRefresh}
              onSnoozed={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Debugger Panel — Eligibility search
// ─────────────────────────────────────────────

const BUCKET_LABELS = {
  today: "Hoy",
  tomorrow: "Mañana",
  upcoming: "Próximos 21 días",
  no_phone: "Sin teléfono",
};

const BUCKET_COLORS = {
  today: "bg-red-500/20 text-red-400 border-red-500/30",
  tomorrow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  no_phone: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const FILTER_LABELS = {
  valid_event: "ID de evento válido",
  event_not_gcal_cancelled: "Evento no cancelado en Google Calendar",
  not_all_day: "No es evento de día completo",
  not_self: "No es el dueño del calendario (self)",
  not_declined: "No rechazó la invitación (declined)",
  not_internal_domain: "Dominio externo (no @leaderlix.com)",
};

function DebuggerPanel() {
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleEvaluate = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.get(`/meetings-confirmations/debug?email=${encodeURIComponent(email)}`);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al evaluar el email");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setEmailInput("");
    setResult(null);
    setError(null);
  };

  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <Search className="w-4 h-4 text-blue-400" />
          Diagnóstico de elegibilidad
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Input row */}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="email@empresa.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEvaluate()}
            className="bg-[#0a0a0a] border-[#333] text-white flex-1"
          />
          <Button
            size="sm"
            onClick={handleEvaluate}
            disabled={loading || !emailInput.trim()}
            className="btn-accent shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Evaluar"}
          </Button>
          {(result || error) && (
            <Button size="sm" variant="outline" onClick={handleClear} className="border-[#333] shrink-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">

            {/* ── A: Contact ── */}
            <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Contacto en unified_contacts
              </p>
              {result.contact.found ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-white text-sm font-medium">{result.contact.name}</span>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      Encontrado
                    </Badge>
                  </div>
                  <div className="ml-6 flex flex-wrap gap-2 text-xs text-slate-500">
                    {result.contact.stage != null && (
                      <span>Stage {result.contact.stage}</span>
                    )}
                    {result.contact.source && (
                      <span>source: {result.contact.source}</span>
                    )}
                    <span className={result.contact.has_phone ? "text-green-400" : "text-orange-400"}>
                      {result.contact.has_phone ? "Con teléfono" : "Sin teléfono"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-white text-sm">No encontrado</span>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                      Se autocrearía
                    </Badge>
                  </div>
                  <p className="ml-6 text-xs text-slate-500">
                    Se crearía con: nombre &ldquo;{result.contact.derived_name}&rdquo;,
                    stage=1, source=calendar_import, sin teléfono (quedaría en Sin teléfono)
                  </p>
                </div>
              )}
            </div>

            {/* ── B: Events ── */}
            <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Eventos relevantes
                </p>
                <span className="text-xs text-slate-500">
                  {result.events_with_email}/{result.total_events_scanned} eventos escaneados
                </span>
              </div>

              {result.events.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  Este email no aparece en ningún evento de los próximos 21 días.
                </p>
              ) : (
                result.events.map((ev, idx) => (
                  <DebugEventCard key={ev.event_id || idx} event={ev} />
                ))
              )}
            </div>

            {/* ── D: Summary ── */}
            <div className={`p-3 rounded-lg border ${
              result.classifications_count > 0
                ? "bg-green-500/10 border-green-500/30"
                : "bg-slate-800/50 border-slate-700"
            }`}>
              {result.classifications_count > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-400">
                    ✅ {result.classifications_count} evento{result.classifications_count > 1 ? "s" : ""} pasaría{result.classifications_count > 1 ? "n" : ""} los filtros
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.events.filter(e => e.overall_pass).map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
                        <Badge className={BUCKET_COLORS[ev.bucket] || "bg-slate-700 text-slate-300"}>
                          {BUCKET_LABELS[ev.bucket] || ev.bucket}
                        </Badge>
                        <span className="text-slate-500 truncate max-w-[180px]">{ev.summary}</span>
                        <span className="text-slate-600">{ev.start_date_local}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  ❌ Ningún evento pasa todos los filtros
                  {result.events_with_email === 0
                    ? " — el email no aparece en eventos del período."
                    : ` — ${result.events_with_email} evento${result.events_with_email > 1 ? "s" : ""} encontrado${result.events_with_email > 1 ? "s" : ""} pero ninguno cumple las reglas.`}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DebugEventCard({ event }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded border ${event.overall_pass ? "border-green-500/30 bg-green-500/5" : "border-slate-700 bg-[#111]"}`}>
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {event.overall_pass ? (
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
          )}
          <span className="text-sm text-white truncate">{event.summary}</span>
          <span className="text-xs text-slate-500 shrink-0">{event.start_date_local}</span>
          {event.bucket && (
            <Badge className={`text-xs shrink-0 ${BUCKET_COLORS[event.bucket] || ""}`}>
              {BUCKET_LABELS[event.bucket] || event.bucket}
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expanded: filter checklist */}
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-[#222]">
          {/* Skip reason banner */}
          {!event.overall_pass && event.skip_reason && (
            <div className="mt-2 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
              Razón de exclusión: {event.skip_reason}
            </div>
          )}
          <div className="mt-2 space-y-1">
            {event.filters.map((f, idx) => (
              <div key={idx} className={`flex items-start gap-2 px-2 py-1 rounded text-xs ${f.passed ? "" : "bg-red-500/5"}`}>
                {f.passed ? (
                  <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className={`font-medium ${f.passed ? "text-slate-400" : "text-red-400"}`}>
                    {FILTER_LABELS[f.filter_name] || f.filter_name}
                  </span>
                  <span className="text-slate-600 ml-1">— {f.reason}</span>
                  {f.value && !f.passed && (
                    <span className="ml-1 text-slate-500">[valor: {f.value}]</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {event.overall_pass && event.projected_status && (
            <div className="mt-2 pt-2 border-t border-[#222] text-xs text-slate-400">
              Estado proyectado:{" "}
              <span className={event.projected_status === "pending" ? "text-green-400" : "text-orange-400"}>
                {event.projected_status === "pending" ? "pending (tiene teléfono)" : "no_phone (sin teléfono)"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatLocalDate(isoStr) {
  if (!isoStr) return "";
  try {
    return new Date(isoStr).toLocaleString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Mexico_City",
    });
  } catch {
    return isoStr;
  }
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function MeetingsConfirmationsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [buckets, setBuckets] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/focus/traffic-light-status");
      setTrafficStatus(res.data["meetings-confirmations"] || "gray");
    } catch {
      setTrafficStatus("gray");
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await api.get("/meetings-confirmations/items");
      setBuckets(res.data);
    } catch (err) {
      toast.error("Error al cargar las confirmaciones");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadItems();
  }, [loadStatus, loadItems]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/meetings-confirmations/generate");
      setBuckets(res.data.buckets);
      await loadStatus();
      const total =
        res.data.buckets.today.length +
        res.data.buckets.tomorrow.length +
        res.data.buckets.upcoming.length;
      const noPhone = res.data.buckets.no_phone?.length || 0;
      const created = res.data.total_contacts_created || 0;

      if (total + noPhone > 0) {
        let msg = `${total} confirmaciones generadas`;
        if (noPhone > 0) msg += `, ${noPhone} sin teléfono`;
        if (created > 0) msg += ` (${created} contacto${created > 1 ? "s" : ""} autocreado${created > 1 ? "s" : ""})`;
        toast.success(msg);
      } else {
        toast.info("No hay reuniones con contactos externos en los próximos 21 días");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al generar confirmaciones");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadItems(), loadStatus()]);
  }, [loadItems, loadStatus]);

  const totalToday = buckets
    ? buckets.today.filter((i) => i.status !== "copied").length
    : 0;

  const customTrafficRules = {
    red: "Hay reuniones de hoy sin confirmar y ningún mensaje ha sido copiado",
    yellow: "Algunos mensajes han sido copiados pero aún hay reuniones sin confirmar",
    green: "Todas las reuniones de hoy han sido confirmadas",
  };

  return (
    <SectionLayout
      title={SECTION?.label || "Meetings Confirmations"}
      subheadline={SECTION?.subheadline || "Confirma por WhatsApp las reuniones próximas con contactos externos."}
      steps={SECTION?.steps || []}
      trafficRules={customTrafficRules}
      isDaily={true}
      currentStatus={trafficStatus}
      icon={CalendarCheck}
    >
      {/* Generate button */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-accent"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generar / Actualizar
            </>
          )}
        </Button>

        {loadingItems && (
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        )}

        {buckets && totalToday > 0 && (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {totalToday} pendiente{totalToday > 1 ? "s" : ""} hoy
          </Badge>
        )}
      </div>

      {/* Debugger panel */}
      <div className="mb-6">
        <DebuggerPanel />
      </div>

      {/* Buckets */}
      {buckets && (
        <div className="space-y-3">
          {/* Today */}
          <BucketAccordion
            label="Hoy"
            items={buckets.today}
            defaultOpen={true}
            showSnooze={true}
            showCopyAll={true}
            onRefresh={handleRefresh}
          />

          {/* Tomorrow */}
          <BucketAccordion
            label="Mañana"
            items={buckets.tomorrow}
            defaultOpen={false}
            showSnooze={false}
            showCopyAll={false}
            onRefresh={handleRefresh}
          />

          {/* Upcoming 21 days */}
          <BucketAccordion
            label="Próximos 21 días"
            items={buckets.upcoming}
            defaultOpen={false}
            showSnooze={false}
            showCopyAll={false}
            onRefresh={handleRefresh}
          />

          {/* No phone */}
          {buckets.no_phone.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-400">
                  Sin teléfono ({buckets.no_phone.length})
                </span>
              </div>
              <div className="space-y-2">
                {buckets.no_phone.map((item) => (
                  <NoPhoneCard
                    key={item.item_id}
                    item={item}
                    onPhoneAdded={handleRefresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {buckets.today.length === 0 &&
            buckets.tomorrow.length === 0 &&
            buckets.upcoming.length === 0 &&
            buckets.no_phone.length === 0 && (
              <div className="text-center py-12">
                <CalendarCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Sin reuniones pendientes
                </h3>
                <p className="text-slate-400 text-sm">
                  No hay reuniones con contactos externos en los próximos 21 días.
                </p>
              </div>
            )}
        </div>
      )}
    </SectionLayout>
  );
}
