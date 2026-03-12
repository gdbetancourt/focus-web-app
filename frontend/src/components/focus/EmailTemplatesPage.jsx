/**
 * EmailTemplatesPage — Editor for the 5 webinar campaign email templates.
 * Plain HTML textarea editor (no rich-text library). Merge tags as copiable chips.
 */
import { useState, useEffect, useCallback } from "react";
import { Mail, Copy, Eye, Save, Check, AlertCircle } from "lucide-react";
import api from "../../lib/api";

const CAMPAIGN_TYPES = [
  { key: "invitation_d14", label: "Invitación (D-14)" },
  { key: "reminder_d7", label: "Recordatorio (D-7)" },
  { key: "reminder_d3", label: "Recordatorio (D-3)" },
  { key: "reminder_d1", label: "Recordatorio (D-1)" },
  { key: "followup_d1", label: "Follow-up (D+1)" },
];

const MERGE_TAGS = [
  "{{nombre}}",
  "{{evento_titulo}}",
  "{{evento_fecha}}",
  "{{evento_hora}}",
  "{{evento_link}}",
  "{{evento_descripcion}}",
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState("invitation_d14");
  const [form, setForm] = useState({ subject: "", body_html: "", body_text: "" });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [copiedTag, setCopiedTag] = useState(null);
  const [showBodyText, setShowBodyText] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/email-templates/");
      setTemplates(res.data);
      const current = res.data.find((t) => t.campaign_type === selected);
      if (current) {
        setForm({
          subject: current.subject,
          body_html: current.body_html,
          body_text: current.body_text || "",
        });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error cargando plantillas" });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const selectTemplate = (key) => {
    setSelected(key);
    setPreview(null);
    setMessage(null);
    const tpl = templates.find((t) => t.campaign_type === key);
    if (tpl) {
      setForm({
        subject: tpl.subject,
        body_html: tpl.body_html,
        body_text: tpl.body_text || "",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/email-templates/${selected}`, {
        subject: form.subject,
        body_html: form.body_html,
        body_text: form.body_text || null,
      });
      setMessage({ type: "success", text: "Plantilla guardada" });
      loadTemplates();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const res = await api.get(`/email-templates/preview/${selected}`);
      setPreview(res.data);
    } catch (err) {
      setMessage({ type: "error", text: "Error al generar vista previa" });
    }
  };

  const copyTag = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const currentTemplate = templates.find((t) => t.campaign_type === selected);

  if (loading) {
    return (
      <div className="p-6 text-slate-400">Cargando plantillas...</div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold text-white">Email Templates</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {CAMPAIGN_TYPES.map((ct) => (
          <button
            key={ct.key}
            onClick={() => selectTemplate(ct.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              selected === ct.key
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Body HTML */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Body HTML</label>
            <textarea
              value={form.body_html}
              onChange={(e) => setForm({ ...form, body_html: e.target.value })}
              rows={14}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ minHeight: "300px" }}
            />
          </div>

          {/* Body Text (collapsible) */}
          <div>
            <button
              onClick={() => setShowBodyText(!showBodyText)}
              className="text-sm text-slate-400 hover:text-slate-200 mb-1"
            >
              {showBodyText ? "- Ocultar" : "+ Mostrar"} Body Text (opcional)
            </button>
            {showBodyText && (
              <textarea
                value={form.body_text}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                rows={6}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Versión texto plano (opcional)"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 items-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
            >
              <Eye className="w-4 h-4" />
              Vista previa
            </button>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${
                message.type === "success"
                  ? "bg-green-900/50 text-green-300"
                  : "bg-red-900/50 text-red-300"
              }`}
            >
              {message.type === "success" ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {message.text}
            </div>
          )}

          {/* Updated info */}
          {currentTemplate && currentTemplate.updated_at && (
            <div className="text-xs text-slate-500">
              Actualizado: {new Date(currentTemplate.updated_at).toLocaleString("es-MX")}
              {currentTemplate.updated_by && ` por ${currentTemplate.updated_by}`}
            </div>
          )}
        </div>

        {/* Sidebar: Merge Tags + Preview */}
        <div className="space-y-4">
          {/* Merge Tags */}
          <div className="bg-slate-800/50 border border-slate-700 rounded p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Merge Tags disponibles</h3>
            <div className="flex flex-wrap gap-2">
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => copyTag(tag)}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-mono transition-colors"
                  title="Click para copiar"
                >
                  {copiedTag === tag ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-slate-800/50 border border-slate-700 rounded p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Vista previa</h3>
              <div className="text-xs text-slate-400 mb-2">
                <strong>Subject:</strong> {preview.subject}
              </div>
              <div
                className="bg-white rounded p-3 text-sm text-black"
                dangerouslySetInnerHTML={{ __html: preview.body_html }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
