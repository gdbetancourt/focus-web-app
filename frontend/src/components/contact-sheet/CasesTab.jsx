/**
 * CasesTab - Cases management tab for ContactSheet
 * Extracted from ContactSheet.jsx for maintainability
 */
import { useState, useCallback } from "react";
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
import api from "../../lib/api";
import {
  isStage4, getStageLabel, getStageColor
} from "../../constants/stages";
import { Briefcase, Building2, Plus, Loader2, X } from "lucide-react";

// Stage grouping for search results
const groupCasesByStage = (cases) => {
  const groups = {
    stage3: { label: "Cierre (S3)", color: "blue", cases: [] },
    stage4: { label: "Entrega (S4)", color: "emerald", cases: [] },
    other: { label: "Otros", color: "slate", cases: [] }
  };
  
  cases.forEach(c => {
    if (isStage4(c.stage)) {
      groups.stage4.cases.push(c);
    } else if (c.stage?.startsWith("caso_") || c.stage?.includes("cierre")) {
      groups.stage3.cases.push(c);
    } else {
      groups.other.cases.push(c);
    }
  });
  
  return groups;
};

export function CasesTab({
  contactId,
  contactName,
  caseHistory,
  loadingCases,
  onCasesUpdate
}) {
  // Panel states
  const [addingCase, setAddingCase] = useState(false);
  const [creatingNewCase, setCreatingNewCase] = useState(false);
  
  // Search state
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [caseSearchResults, setCaseSearchResults] = useState([]);
  const [searchingCases, setSearchingCases] = useState(false);
  
  // New case form
  const [newCaseData, setNewCaseData] = useState({
    name: "",
    stage: "caso_solicitado",
    company_names: [],
    notes: ""
  });
  const [newCaseCompanyInput, setNewCaseCompanyInput] = useState("");
  const [savingNewCase, setSavingNewCase] = useState(false);

  // Debounced search
  const searchCases = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setCaseSearchResults([]);
      return;
    }
    
    setSearchingCases(true);
    try {
      const response = await api.get("/cases/", { 
        params: { search: query, limit: 30 } 
      });
      setCaseSearchResults(response.data || []);
    } catch (error) {
      console.error("Error searching cases:", error);
    } finally {
      setSearchingCases(false);
    }
  }, []);

  const addContactToCase = async (caseItem) => {
    if (!contactId) return;
    
    try {
      await api.post(`/cases/${caseItem.id}/contacts`, {
        contact_id: contactId
      });
      toast.success(`Contacto agregado al caso "${caseItem.name}"`);
      setAddingCase(false);
      setCaseSearchQuery("");
      setCaseSearchResults([]);
      onCasesUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al agregar contacto al caso");
    }
  };

  const removeContactFromCase = async (caseId) => {
    if (!contactId) return;
    
    try {
      await api.delete(`/cases/${caseId}/contacts/${contactId}`);
      toast.success("Contacto eliminado del caso");
      onCasesUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar contacto del caso");
    }
  };

  const createNewCase = async () => {
    if (!newCaseData.name.trim() || savingNewCase) return;
    
    setSavingNewCase(true);
    try {
      const response = await api.post("/cases/", {
        name: newCaseData.name.trim(),
        stage: newCaseData.stage,
        company_names: newCaseData.company_names,
        notes: newCaseData.notes,
        contact_ids: [contactId]
      });
      
      toast.success(`Caso "${newCaseData.name}" creado`);
      setCreatingNewCase(false);
      setNewCaseData({ name: "", stage: "caso_solicitado", company_names: [], notes: "" });
      setAddingCase(false);
      onCasesUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear caso");
    } finally {
      setSavingNewCase(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Case Button */}
      <div className="flex items-center justify-between">
        <Label className="text-slate-400 text-sm">
          Casos asociados ({caseHistory.length})
        </Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAddingCase(!addingCase);
            setCreatingNewCase(false);
          }}
          className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
          data-testid="add-case-btn"
        >
          <Plus className="w-4 h-4 mr-1" />
          {addingCase ? "Cancelar" : "Agregar Caso"}
        </Button>
      </div>

      {/* Add/Search Case Panel */}
      {addingCase && !creatingNewCase && (
        <div className="p-4 bg-[#1a1a1a] border border-orange-500/30 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-white">Buscar caso existente</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreatingNewCase(true)}
              className="text-orange-400 hover:text-orange-300"
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear nuevo caso
            </Button>
          </div>
          
          <Input
            placeholder="Buscar por nombre, número o empresa..."
            value={caseSearchQuery}
            onChange={(e) => {
              setCaseSearchQuery(e.target.value);
              searchCases(e.target.value);
            }}
            className="bg-[#0a0a0a] border-[#333]"
            data-testid="case-search-input"
          />
          
          {searchingCases ? (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-400" />
            </div>
          ) : caseSearchResults.length > 0 ? (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {Object.entries(groupCasesByStage(caseSearchResults)).map(([stage, data]) => (
                data.cases.length > 0 && (
                  <div key={stage}>
                    <p className={`text-xs font-medium mb-1 text-${data.color}-400`}>
                      {data.label} ({data.cases.length})
                    </p>
                    {data.cases.map((caseItem) => {
                      const isAlreadyAdded = caseHistory.some(ch => ch.id === caseItem.id);
                      return (
                        <div
                          key={caseItem.id}
                          className={`p-2 rounded border cursor-pointer transition-colors ${
                            isAlreadyAdded 
                              ? 'bg-slate-800/50 border-slate-700 opacity-50' 
                              : 'bg-[#0a0a0a] border-[#333] hover:border-orange-500/50'
                          }`}
                          onClick={() => !isAlreadyAdded && addContactToCase(caseItem)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{caseItem.name}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {caseItem.company_names?.join(", ") || "Sin empresa"}
                              </p>
                            </div>
                            {isAlreadyAdded ? (
                              <Badge className="text-xs bg-slate-600">Ya agregado</Badge>
                            ) : (
                              <Plus className="w-4 h-4 text-orange-400 shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ))}
            </div>
          ) : caseSearchQuery.length > 0 ? (
            <div className="text-center py-4 text-slate-500">
              <p>No se encontraron casos</p>
              <Button
                variant="link"
                onClick={() => setCreatingNewCase(true)}
                className="text-orange-400 mt-2"
              >
                Crear nuevo caso
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Create New Case Panel */}
      {creatingNewCase && (
        <div className="p-4 bg-[#1a1a1a] border border-orange-500/30 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-white text-lg">Crear nuevo caso</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreatingNewCase(false)}
              className="text-slate-400"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-slate-400 text-sm">Nombre del caso *</Label>
              <Input
                placeholder="Ej: Propuesta de coaching para Empresa X"
                value={newCaseData.name}
                onChange={(e) => setNewCaseData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-[#0a0a0a] border-[#333] mt-1"
              />
            </div>
            
            <div>
              <Label className="text-slate-400 text-sm">Estado</Label>
              <Select
                value={newCaseData.stage}
                onValueChange={(v) => setNewCaseData(prev => ({ ...prev, stage: v }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#333] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caso_solicitado">Solicitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-slate-400 text-sm">Empresas</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Agregar empresa..."
                  value={newCaseCompanyInput}
                  onChange={(e) => setNewCaseCompanyInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newCaseCompanyInput.trim()) {
                      setNewCaseData(prev => ({
                        ...prev,
                        company_names: [...prev.company_names, newCaseCompanyInput.trim()]
                      }));
                      setNewCaseCompanyInput("");
                    }
                  }}
                  className="bg-[#0a0a0a] border-[#333] flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newCaseCompanyInput.trim()) {
                      setNewCaseData(prev => ({
                        ...prev,
                        company_names: [...prev.company_names, newCaseCompanyInput.trim()]
                      }));
                      setNewCaseCompanyInput("");
                    }
                  }}
                  className="border-[#333]"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {newCaseData.company_names.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {newCaseData.company_names.map((company, idx) => (
                    <Badge key={idx} className="bg-orange-500/20 text-orange-400">
                      {company}
                      <button
                        onClick={() => setNewCaseData(prev => ({
                          ...prev,
                          company_names: prev.company_names.filter((_, i) => i !== idx)
                        }))}
                        className="ml-1 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <Label className="text-slate-400 text-sm">Notas</Label>
              <Textarea
                placeholder="Notas sobre el caso..."
                value={newCaseData.notes}
                onChange={(e) => setNewCaseData(prev => ({ ...prev, notes: e.target.value }))}
                className="bg-[#0a0a0a] border-[#333] mt-1"
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreatingNewCase(false);
                setNewCaseData({ name: "", stage: "caso_solicitado", company_names: [], notes: "" });
              }}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={createNewCase}
              disabled={savingNewCase || !newCaseData.name.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {savingNewCase && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Caso
            </Button>
          </div>
        </div>
      )}

      {/* Case History */}
      {loadingCases ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-400" />
        </div>
      ) : caseHistory.length === 0 && !addingCase ? (
        <div className="text-center py-8 text-slate-500">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay casos asociados</p>
          <p className="text-xs mt-1">Haz clic en "Agregar Caso" para asociar uno</p>
        </div>
      ) : caseHistory.length > 0 && (
        <div className="space-y-3">
          {caseHistory.map((caseItem, idx) => (
            <div 
              key={caseItem.id || idx} 
              className={`p-3 rounded-lg border ${
                caseItem.status === 'descartado' 
                  ? 'bg-red-500/10 border-red-500/30 opacity-60' 
                  : 'bg-orange-500/10 border-orange-500/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {isStage4(caseItem.stage) && (
                      <Badge className="text-xs bg-emerald-500/20 text-emerald-400">
                        S4
                      </Badge>
                    )}
                    <Badge className={`text-xs ${getStageColor(caseItem.stage)}`}>
                      {getStageLabel(caseItem.stage)}
                    </Badge>
                    {caseItem.status === 'descartado' && (
                      <Badge className="text-xs bg-red-500/20 text-red-400">
                        Descartado
                      </Badge>
                    )}
                  </div>
                  <p className="text-white font-medium">{caseItem.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    {caseItem.company_names?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {caseItem.company_names.join(", ")}
                      </span>
                    )}
                    {caseItem.created_at && (
                      <span>
                        {new Date(caseItem.created_at).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeContactFromCase(caseItem.id)}
                  className="shrink-0 p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  title="Eliminar de este caso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CasesTab;
