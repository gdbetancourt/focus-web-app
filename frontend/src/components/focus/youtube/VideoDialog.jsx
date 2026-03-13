import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api from "../../../lib/api";
import { getStageByKey, FORMAT_BADGES } from "./constants";
import FileUploadField from "./FileUploadField";

export default function VideoDialog({ open, onOpenChange, video, onSaved }) {
  const isEdit = !!video;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    video_format: "long",
    target_publish_date: "",
    description: "",
    notebook_lm_link: "",
    youtube_url: "",
    notes: "",
  });

  useEffect(() => {
    if (video) {
      setForm({
        title: video.title || "",
        video_format: video.video_format || "long",
        target_publish_date: video.target_publish_date || "",
        description: video.description || "",
        notebook_lm_link: video.notebook_lm_link || "",
        youtube_url: video.youtube_url || "",
        notes: video.notes || "",
      });
    } else {
      setForm({
        title: "",
        video_format: "long",
        target_publish_date: "",
        description: "",
        notebook_lm_link: "",
        youtube_url: "",
        notes: "",
      });
    }
  }, [video, open]);

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("El tema es obligatorio");
    if (!form.target_publish_date) return toast.error("La fecha es obligatoria");
    if (!form.video_format) return toast.error("El formato es obligatorio");

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/youtube-ideas/videos/${video.id}`, {
          title: form.title,
          description: form.description,
          video_format: form.video_format,
          target_publish_date: form.target_publish_date,
          notebook_lm_link: form.notebook_lm_link,
          youtube_url: form.youtube_url,
          notes: form.notes,
        });
        toast.success("Video actualizado");
      } else {
        await api.post("/youtube-ideas/videos", {
          title: form.title,
          video_format: form.video_format,
          target_publish_date: form.target_publish_date,
          description: form.description,
          notes: form.notes,
        });
        toast.success("Video creado");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const stage = video ? getStageByKey(video.status) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-[#222] max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {isEdit ? "Editar Video" : "Nuevo Video"}
            {stage && (
              <Badge className={`${stage.badgeColor} text-xs`}>
                {stage.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title / Tema */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">
              Tema <span className="text-red-400">*</span>
            </label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Titulo del video..."
            />
          </div>

          {/* Format + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Formato <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none"
                value={form.video_format}
                onChange={(e) => setForm({ ...form, video_format: e.target.value })}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Fecha publicacion <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none"
                value={form.target_publish_date}
                onChange={(e) =>
                  setForm({ ...form, target_publish_date: e.target.value })
                }
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Descripcion</label>
            <textarea
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* NotebookLM Link — stage 2+ */}
          {isEdit && (
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Link NotebookLM
                {video?.status !== "programado" && (
                  <span className="text-red-400"> *</span>
                )}
              </label>
              <input
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none"
                value={form.notebook_lm_link}
                onChange={(e) =>
                  setForm({ ...form, notebook_lm_link: e.target.value })
                }
                placeholder="https://notebooklm.google.com/..."
              />
            </div>
          )}

          {/* File uploads — stage 3/4/5 */}
          {isEdit && (
            <div className="space-y-3 border-t border-[#222] pt-3">
              <h4 className="text-sm font-medium text-slate-300">Archivos</h4>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Reporte de patrones e insights
                </label>
                <FileUploadField
                  videoId={video.id}
                  stage="reporte"
                  currentFileId={video.report_file_id}
                  onUploaded={onSaved}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Metodos aplicados
                </label>
                <FileUploadField
                  videoId={video.id}
                  stage="metodos"
                  currentFileId={video.methods_file_id}
                  onUploaded={onSaved}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Guion redactado
                </label>
                <FileUploadField
                  videoId={video.id}
                  stage="guion"
                  currentFileId={video.script_file_id}
                  onUploaded={onSaved}
                />
              </div>
            </div>
          )}

          {/* YouTube URL — stage 7 */}
          {isEdit && (
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                Link de YouTube
              </label>
              <input
                className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none"
                value={form.youtube_url}
                onChange={(e) =>
                  setForm({ ...form, youtube_url: e.target.value })
                }
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm text-slate-400 block mb-1">Notas</label>
            <textarea
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm focus:border-[#ff3300] focus:outline-none resize-none"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-[#333]"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : isEdit ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
