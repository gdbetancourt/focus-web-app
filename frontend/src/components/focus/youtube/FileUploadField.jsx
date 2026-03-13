import { useRef, useState } from "react";
import { Button } from "../../ui/button";
import { Upload, FileText, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import api from "../../../lib/api";

export default function FileUploadField({ videoId, stage, currentFileId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(
        `/youtube-ideas/videos/${videoId}/upload-file?stage=${stage}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      toast.success(`Archivo "${file.name}" subido`);
      onUploaded?.(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al subir archivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async () => {
    if (!currentFileId) return;
    try {
      const res = await api.get(`/youtube-ideas/files/${currentFileId}/download`, {
        responseType: "blob",
      });
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : "archivo";
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv,.json,.pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        size="sm"
        variant="outline"
        className="border-[#333] text-slate-300 h-8"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
        ) : (
          <Upload className="w-3.5 h-3.5 mr-1" />
        )}
        {currentFileId ? "Reemplazar" : "Subir archivo"}
      </Button>
      {currentFileId && (
        <Button
          size="sm"
          variant="ghost"
          className="text-blue-400 h-8"
          onClick={handleDownload}
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          Descargar
        </Button>
      )}
    </div>
  );
}
