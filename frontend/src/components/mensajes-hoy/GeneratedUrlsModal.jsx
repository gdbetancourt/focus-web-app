/**
 * Generated WhatsApp URLs Modal
 * Shows generated URLs for manual copy when clipboard API fails
 */
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Check } from "lucide-react";

export function GeneratedUrlsModal({ 
  open, 
  onOpenChange, 
  urls = [] 
}) {
  const handleSelectAll = () => {
    const textarea = document.getElementById("generated-urls-textarea");
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] border-[#333] max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            {urls.length} URLs de WhatsApp Generados
          </DialogTitle>
          <DialogDescription>
            Selecciona todo el texto y copia con Ctrl+C (Cmd+C en Mac)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            id="generated-urls-textarea"
            readOnly
            value={urls.join("\n")}
            className="w-full h-64 p-3 bg-[#0a0a0a] border border-[#333] rounded-lg text-sm text-slate-300 font-mono resize-none focus:border-[#ff3300] focus:ring-1 focus:ring-[#ff3300]"
            onFocus={(e) => e.target.select()}
            onClick={(e) => e.target.select()}
          />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="bg-slate-800 px-2 py-1 rounded">1. Clic en el texto</span>
            <span>→</span>
            <span className="bg-slate-800 px-2 py-1 rounded">2. Ctrl+A</span>
            <span>→</span>
            <span className="bg-slate-800 px-2 py-1 rounded">3. Ctrl+C</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleSelectAll}
            className="border-[#333]"
          >
            Seleccionar Todo
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
          >
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GeneratedUrlsModal;
