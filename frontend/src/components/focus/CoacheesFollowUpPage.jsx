/**
 * CoacheesFollowUpPage
 * FOCUS section — daily
 * Sends weekly WhatsApp follow-up to coachees (tag "Coachee", Stage 4).
 * Contacts not messaged in 7+ days appear here.
 */
import { useState, useEffect, useCallback } from "react";
import { getSectionById } from "./focusSections";
import SectionLayout from "./SectionLayout";
import {
  UserPlus,
  MessageCircle,
  ExternalLink,
  Copy,
  Phone,
  Mail,
  User,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Save,
  Info,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { toast } from "sonner";
import api from "../../lib/api";

const SECTION = getSectionById("coachees-follow-up");

const MERGE_TAGS = ["{{first_name}}", "{{last_name}}", "{{name}}", "{{email}}"];

// ─────────────────────────────────────────────
// Item Card
// ─────────────────────────────────────────────

function ItemCard({ item, onCopied }) {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    setCopying(true);
    try {
      try {
        await navigator.clipboard.writeText(item.message_text);
      } catch {
        // clipboard unavailable
      }
      await api.post(`/coachees-followup/items/${item.item_id}/copy`);
      toast.success("Mensaje copiado");
      onCopied?.();
    } catch (err) {
      toast.error("Error al marcar como copiado");
    } finally {
      setCopying(false);
    }
  };

  const handleWhatsApp = async () => {
    try {
      await api.post(`/coachees-followup/items/${item.item_id}/copy`);
      onCopied?.();
    } catch {
      // silent
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
        {/* Left: contact info */}
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
          {item.contact_email && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.contact_email}</span>
            </div>
          )}
          {item.to_phone_e164 && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{item.to_phone_e164}</span>
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {item.whatsapp_link && (
            <a
              href={item.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsApp}
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
// No-phone card
// ─────────────────────────────────────────────

function NoPhoneCard({ item, onPhoneAdded }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!phone.trim()) return;
    setSaving(true);
    try {
      await api.post(`/coachees-followup/items/${item.item_id}/add-phone`, { phone });
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
          {item.contact_email && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.contact_email}</span>
            </div>
          )}
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
// Template Editor
// ─────────────────────────────────────────────

function TemplateEditor({ template, onSaved }) {
  const [value, setValue] = useState(template || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(template || "");
    setDirty(false);
  }, [template]);

  const handleChange = (e) => {
    setValue(e.target.value);
    setDirty(e.target.value !== template);
  };

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await api.put("/coachees-followup/template", { message_template: value });
      toast.success("Template guardado");
      setDirty(false);
      onSaved?.(value);
    } catch (err) {
      toast.error("Error al guardar el template");
    } finally {
      setSaving(false);
    }
  };

  const insertTag = (tag) => {
    setValue((prev) => prev + tag);
    setDirty(true);
  };

  return (
    <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#222] mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300">Template del mensaje</span>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        rows={3}
        className="w-full bg-[#111] border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-none focus:outline-none focus:border-slate-500"
        placeholder="Escribe el template del mensaje..."
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-500 mr-1">Merge tags:</span>
          {MERGE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => insertTag(tag)}
              className="text-xs px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>

        {dirty && (
          <Button
            size="sm"
            className="btn-accent text-xs"
            onClick={handleSave}
            disabled={saving || !value.trim()}
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Save className="w-3 h-3 mr-1" />
            )}
            Guardar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function CoacheesFollowUpPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [items, setItems] = useState([]);
  const [noPhone, setNoPhone] = useState([]);
  const [template, setTemplate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/focus/traffic-light-status");
      setTrafficStatus(res.data["coachees-follow-up"] || "gray");
    } catch {
      setTrafficStatus("gray");
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/coachees-followup/items");
      setItems(res.data.items || []);
      setNoPhone(res.data.no_phone || []);
      setTemplate(res.data.template || "");
    } catch {
      toast.error("Error al cargar los coachees");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate on mount
  useEffect(() => {
    let cancelled = false;
    const autoGenerate = async () => {
      setGenerating(true);
      try {
        const res = await api.post("/coachees-followup/generate");
        if (!cancelled) {
          setItems(res.data.items || []);
          setNoPhone(res.data.no_phone || []);
          setTemplate(res.data.template || "");
        }
      } catch {
        if (!cancelled) await loadItems();
      } finally {
        if (!cancelled) setGenerating(false);
      }
      if (!cancelled) await loadStatus();
    };
    autoGenerate();
    return () => { cancelled = true; };
  }, [loadItems, loadStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/coachees-followup/generate");
      setItems(res.data.items || []);
      setNoPhone(res.data.no_phone || []);
      setTemplate(res.data.template || "");
      await loadStatus();

      const total = (res.data.items || []).length;
      const noPhoneCount = (res.data.no_phone || []).length;

      if (total + noPhoneCount > 0) {
        let msg = `${total} coachees pendientes`;
        if (noPhoneCount > 0) msg += `, ${noPhoneCount} sin teléfono`;
        toast.success(msg);
      } else {
        toast.info("No hay coachees pendientes de seguimiento");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al generar seguimientos");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadItems(), loadStatus()]);
  }, [loadItems, loadStatus]);

  const handleTemplateSaved = (newTemplate) => {
    setTemplate(newTemplate);
  };

  // Copy all
  const [copyingAll, setCopyingAll] = useState(false);
  const pendingItems = items.filter((i) => i.status !== "copied");

  const handleCopyAll = async () => {
    if (!pendingItems.length) return;
    setCopyingAll(true);
    try {
      const allText = pendingItems.map((i) => i.message_text).join("\n\n---\n\n");
      try { await navigator.clipboard.writeText(allText); } catch {}
      await api.post("/coachees-followup/items/copy-bulk", {
        item_ids: pendingItems.map((i) => i.item_id),
      });
      toast.success(`${pendingItems.length} mensaje${pendingItems.length > 1 ? "s" : ""} copiado${pendingItems.length > 1 ? "s" : ""}`);
      await handleRefresh();
    } catch {
      toast.error("Error al copiar todos los mensajes");
    } finally {
      setCopyingAll(false);
    }
  };

  const customTrafficRules = {
    red: "Hay coachees pendientes y ningún mensaje ha sido enviado hoy",
    yellow: "Algunos mensajes enviados pero quedan coachees pendientes",
    green: "Todos los coachees han sido contactados o no hay pendientes",
  };

  return (
    <SectionLayout
      title={SECTION?.label || "Coachees Follow Up"}
      subheadline={SECTION?.subheadline || "Envía seguimiento semanal por WhatsApp a todos los coachees activos en Stage 4."}
      steps={SECTION?.steps || []}
      trafficRules={customTrafficRules}
      isDaily={true}
      currentStatus={trafficStatus}
      icon={UserPlus}
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

        {pendingItems.length > 0 && (
          <Button
            variant="outline"
            onClick={handleCopyAll}
            disabled={copyingAll}
            className="border-slate-600 text-slate-300 hover:border-green-500 hover:text-green-400"
          >
            {copyingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Copiando...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copiar todos ({pendingItems.length})
              </>
            )}
          </Button>
        )}

        {(loading || generating) && (
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        )}

        {pendingItems.length > 0 && (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {pendingItems.length} pendiente{pendingItems.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Template editor */}
      <TemplateEditor template={template} onSaved={handleTemplateSaved} />

      {/* Items list */}
      {(items.length > 0 || noPhone.length > 0) && (
        <div className="space-y-3">
          {/* Pending items */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <ItemCard
                  key={item.item_id}
                  item={item}
                  onCopied={handleRefresh}
                />
              ))}
            </div>
          )}

          {/* No phone */}
          {noPhone.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-400">
                  Sin teléfono ({noPhone.length})
                </span>
              </div>
              <div className="space-y-2">
                {noPhone.map((item) => (
                  <NoPhoneCard
                    key={item.item_id}
                    item={item}
                    onPhoneAdded={handleRefresh}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && noPhone.length === 0 && !generating && !loading && (
        <div className="text-center py-12">
          <UserPlus className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            Sin coachees pendientes
          </h3>
          <p className="text-slate-400 text-sm">
            Todos los coachees en Stage 4 han sido contactados en los últimos 7 días.
          </p>
        </div>
      )}
    </SectionLayout>
  );
}
