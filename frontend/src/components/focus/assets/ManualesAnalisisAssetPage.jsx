/**
 * ManualesAnalisisAssetPage — Upload, list, and download analysis manuals.
 * Files stored in PostgreSQL for Claude readability.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../ui/dialog";
import { toast } from "sonner";
import api from "../../../lib/api";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import {
  FileText,
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Upload,
} from "lucide-react";

const SECTION = getAssetSectionById("manuales-analisis");

const ACCEPTED_FORMATS = ".txt,.md,.csv,.json,.pdf";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const EXT_COLORS = {
  pdf: "bg-red-500/20 text-red-400",
  txt: "bg-blue-500/20 text-blue-400",
  md: "bg-purple-500/20 text-purple-400",
  csv: "bg-green-500/20 text-green-400",
  json: "bg-yellow-500/20 text-yellow-400",
};

function getExtBadge(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const color = EXT_COLORS[ext] || "bg-slate-500/20 text-slate-400";
  return <Badge className={`${color} text-xs`}>.{ext}</Badge>;
}

export default function ManualesAnalisisAssetPage() {
  const [manuales, setManuales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadManuales = useCallback(async () => {
    try {
      const res = await api.get("/manuales-analisis/");
      setManuales(res.data || []);
    } catch (error) {
      console.error("Error loading manuales:", error);
      toast.error("Error al cargar manuales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManuales();
  }, [loadManuales]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      await api.post("/manuales-analisis/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Manual subido exitosamente");
      setUploadOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadManuales();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Error al subir el archivo"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (manual) => {
    try {
      const res = await api.get(`/manuales-analisis/${manual.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = manual.original_filename || manual.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Error al descargar el archivo");
    }
  };

  const handleDelete = async (manual) => {
    if (!window.confirm(`¿Eliminar "${manual.filename}"?`)) return;
    try {
      await api.delete(`/manuales-analisis/${manual.id}`);
      toast.success("Manual eliminado");
      loadManuales();
    } catch (error) {
      toast.error("Error al eliminar el manual");
    }
  };

  return (
    <AssetLayout
      title={SECTION?.label || "Manuales de Análisis"}
      icon={FileText}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Manuales ({manuales.length})
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setLoading(true);
              loadManuales();
            }}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar Manual
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Cargando manuales...
        </div>
      ) : manuales.length === 0 ? (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="py-8 text-center text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            No hay manuales subidos. Usa "Agregar Manual" para comenzar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {manuales.map((manual) => (
            <Card key={manual.id} className="bg-[#111] border-[#222]">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium truncate">
                          {manual.filename}
                        </span>
                        {getExtBadge(manual.filename)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{formatFileSize(manual.file_size)}</span>
                        <span>{formatDate(manual.created_at)}</span>
                        {manual.uploaded_by && (
                          <span>Por: {manual.uploaded_by}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(manual)}
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-8"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Descargar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(manual)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Agregar Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">
                Archivo <span className="text-red-400">*</span>
              </label>
              <div
                className="border-2 border-dashed border-[#333] rounded-lg p-6 text-center cursor-pointer hover:border-[#ff3300]/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                {selectedFile ? (
                  <div>
                    <p className="text-white font-medium">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-400">
                      Click para seleccionar archivo
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Formatos: .txt, .md, .csv, .json, .pdf
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FORMATS}
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="bg-[#ff3300] hover:bg-[#cc2900]"
            >
              {uploading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "Subir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AssetLayout>
  );
}
