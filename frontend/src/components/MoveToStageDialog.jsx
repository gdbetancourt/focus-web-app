/**
 * MoveToStageDialog - Quick stage change dialog
 * For full contact editing, use ContactSheet instead.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

const STAGE_NAMES = {
  1: "Prospect",
  2: "Nurture",
  3: "Close",
  4: "Deliver",
  5: "Repurchase"
};

export default function MoveToStageDialog({ 
  open, 
  onOpenChange, 
  contact, 
  targetStage: initialTargetStage = 2,
  onSuccess 
}) {
  const [targetStage, setTargetStage] = useState(initialTargetStage);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      // Default to next stage
      const nextStage = Math.min((contact.stage || 1) + 1, 5);
      setTargetStage(initialTargetStage || nextStage);
    }
  }, [contact, initialTargetStage]);

  const handleMove = async () => {
    if (!contact?.id) return;
    
    setSaving(true);
    try {
      await api.put(`/contacts/${contact.id}/stage?stage=${targetStage}`);
      toast.success(`Moved to ${STAGE_NAMES[targetStage]}`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error moving contact:", error);
      toast.error(error.response?.data?.detail || "Failed to move contact");
    } finally {
      setSaving(false);
    }
  };

  if (!contact) return null;

  const contactName = contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || "Contact";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-[#ff3300]" />
            Move Contact to Stage
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
            <p className="text-white font-medium">{contactName}</p>
            <p className="text-sm text-slate-400">
              Current: Stage {contact.stage} ({STAGE_NAMES[contact.stage] || "Unknown"})
            </p>
          </div>

          <div>
            <Label className="text-slate-400 mb-2 block">Move to Stage</Label>
            <Select value={String(targetStage)} onValueChange={(v) => setTargetStage(parseInt(v))}>
              <SelectTrigger className="bg-[#1a1a1a] border-[#333]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_NAMES).map(([key, name]) => (
                  <SelectItem key={key} value={key} disabled={parseInt(key) === contact.stage}>
                    {key}. {name} {parseInt(key) === contact.stage && "(Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#333]">
            Cancel
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={saving || targetStage === contact.stage}
            className="bg-[#ff3300] hover:bg-[#cc2900]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
            Move to {STAGE_NAMES[targetStage]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
