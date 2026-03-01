/**
 * CaseCreateDialog - Reusable dialog for creating new cases.
 * Based on CasesTab.jsx form (L121-143 + L254-386).
 * Used by PreProjectsPage (Stage 3) and CurrentCasesDeliveryPage (Stage 4).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import {
  STAGE_3_LABELS,
  STAGE_4_LABELS,
} from "../../constants/stages";
import api from "../../lib/api";
import { Plus, Loader2, X } from "lucide-react";

export function CaseCreateDialog({
  open,
  onOpenChange,
  defaultStage = "caso_solicitado",
  stageContext = "stage3",
  contactId = null,
  onCreated,
}) {
  const STAGE_OPTIONS = stageContext === "stage4" ? STAGE_4_LABELS : STAGE_3_LABELS;

  const [formData, setFormData] = useState({
    name: "",
    stage: defaultStage,
    company_names: [],
    notes: "",
  });
  const [companyInput, setCompanyInput] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      stage: defaultStage,
      company_names: [],
      notes: "",
    });
    setCompanyInput("");
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const addCompany = () => {
    const trimmed = companyInput.trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      company_names: [...prev.company_names, trimmed],
    }));
    setCompanyInput("");
  };

  const removeCompany = (idx) => {
    setFormData((prev) => ({
      ...prev,
      company_names: prev.company_names.filter((_, i) => i !== idx),
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || saving) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        stage: formData.stage,
        company_names: formData.company_names,
        notes: formData.notes,
      };
      if (contactId) {
        payload.contact_ids = [contactId];
      }

      const response = await api.post("/cases/", payload);

      toast.success(`Caso "${formData.name.trim()}" creado`);
      resetForm();
      onOpenChange(false);
      onCreated?.(response.data);
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Error al crear caso"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111] border-[#333] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Crear nuevo caso</DialogTitle>
          <DialogDescription>
            Completa los datos del caso. El nombre es obligatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label className="text-slate-400 text-sm">
              Nombre del caso *
            </Label>
            <Input
              placeholder="Ej: Propuesta de coaching para Empresa X"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="bg-[#0a0a0a] border-[#333] mt-1"
              autoFocus
            />
          </div>

          {/* Stage */}
          <div>
            <Label className="text-slate-400 text-sm">Etapa</Label>
            <Select
              value={formData.stage}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, stage: v }))
              }
            >
              <SelectTrigger className="bg-[#0a0a0a] border-[#333] mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_OPTIONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Companies */}
          <div>
            <Label className="text-slate-400 text-sm">Empresas</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Agregar empresa..."
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCompany();
                  }
                }}
                className="bg-[#0a0a0a] border-[#333] flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCompany}
                className="border-[#333]"
                type="button"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.company_names.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.company_names.map((company, idx) => (
                  <Badge
                    key={idx}
                    className="bg-orange-500/20 text-orange-400"
                  >
                    {company}
                    <button
                      onClick={() => removeCompany(idx)}
                      className="ml-1 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-slate-400 text-sm">Notas</Label>
            <Textarea
              placeholder="Notas sobre el caso..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="bg-[#0a0a0a] border-[#333] mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-[#333]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !formData.name.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear Caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CaseCreateDialog;
