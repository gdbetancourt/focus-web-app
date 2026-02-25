/**
 * MeetingsConfirmationsPage
 * FOCUS section — daily, navigation_order=1
 * Confirms upcoming meetings via WhatsApp.
 * Spec: docs/product (Google Docs manuals v1.1)
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
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
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
      if (total > 0) {
        toast.success(`${total} confirmaciones generadas`);
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
