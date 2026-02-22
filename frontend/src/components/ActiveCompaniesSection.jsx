/**
 * ActiveCompaniesSection - Manage active companies for prospection
 * Shows companies from Stage 4/5 contacts/cases with merge and search management
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Building2,
  RefreshCw,
  Search,
  Merge,
  Power,
  PowerOff,
  Check,
  X,
  Plus,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Wrench,
  Users,
  Loader2,
} from "lucide-react";

export function ActiveCompaniesSection() {
  const [activeCompanies, setActiveCompanies] = useState([]);
  const [inactiveCompanies, setInactiveCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState([]);
  const [targetCompany, setTargetCompany] = useState(null);
  const [targetName, setTargetName] = useState("");
  const [merging, setMerging] = useState(false);
  
  // Add search dialog
  const [addSearchOpen, setAddSearchOpen] = useState(false);
  const [addSearchCompany, setAddSearchCompany] = useState(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addingSearch, setAddingSearch] = useState(false);
  
  // Migration state
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [migrating, setMigrating] = useState(false);
  
  // Manual fix dialog state
  const [manualFixOpen, setManualFixOpen] = useState(false);
  const [manualFixId, setManualFixId] = useState("");
  const [manualFixName, setManualFixName] = useState("");
  const [fixingManual, setFixingManual] = useState(false);
  
  // Propagation state
  const [propagationDialogOpen, setPropagationDialogOpen] = useState(false);
  const [propagationCompany, setPropagationCompany] = useState(null);
  const [propagationPreview, setPropagationPreview] = useState(null);
  const [propagating, setPropagating] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [inboundPage, setInboundPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/prospection/companies/all?include_inactive=true");
      setActiveCompanies(res.data.active || []);
      setInactiveCompanies(res.data.inactive || []);
    } catch (error) {
      console.error("Error loading active companies:", error);
      toast.error("Error cargando empresas activas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Filter companies by search term
  const filterCompanies = (companies) => {
    if (!searchTerm) return companies;
    const term = searchTerm.toLowerCase();
    return companies.filter(c => 
      c.name?.toLowerCase().includes(term)
    );
  };

  // Toggle company classification (active = outbound)
  const handleToggleActive = async (company) => {
    const wasInbound = !company.is_active && company.classification !== "outbound";
    const willBeOutbound = wasInbound;
    
    try {
      const res = await api.patch(`/prospection/companies/${company.id}/toggle-active`);
      const newStatus = company.is_active ? "Inbound" : "Outbound";
      toast.success(`${company.name} marcada como ${newStatus}`);
      
      // If changing to Outbound, automatically open propagation dialog
      if (willBeOutbound) {
        // Update company object with new classification for the dialog
        const updatedCompany = {
          ...company,
          is_active: true,
          classification: "outbound"
        };
        setPropagationCompany(updatedCompany);
        setPropagationPreview(null);
        setPropagationDialogOpen(true);
        
        // Get preview
        try {
          const previewRes = await api.get(`/unified-companies/${company.id}/propagation-preview`, {
            params: { target_classification: "outbound" }
          });
          setPropagationPreview(previewRes.data);
        } catch (error) {
          console.error("Error getting propagation preview:", error);
          setPropagationPreview({ affected_count: 0, affected_contacts: [] });
        }
      }
      
      loadCompanies();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Error al cambiar clasificación");
    }
  };

  // Open propagation dialog
  const openPropagationDialog = async (company) => {
    setPropagationCompany(company);
    setPropagationPreview(null);
    setPropagationDialogOpen(true);
    
    // Get preview
    try {
      const targetClassification = company.classification || (company.is_active ? "outbound" : "inbound");
      const res = await api.get(`/unified-companies/${company.id}/propagation-preview`, {
        params: { target_classification: targetClassification }
      });
      setPropagationPreview(res.data);
    } catch (error) {
      console.error("Error getting propagation preview:", error);
    }
  };

  // Execute propagation
  const executePropagation = async () => {
    if (!propagationCompany) return;
    
    setPropagating(true);
    try {
      const targetClassification = propagationCompany.classification || (propagationCompany.is_active ? "outbound" : "inbound");
      await api.post(`/unified-companies/${propagationCompany.id}/propagate-classification`, {
        classification: targetClassification
      });
      toast.success(`Clasificación propagada a ${propagationPreview?.affected_count || 0} contactos`);
      setPropagationDialogOpen(false);
      loadCompanies();
    } catch (error) {
      console.error("Error propagating classification:", error);
      toast.error("Error al propagar clasificación");
    } finally {
      setPropagating(false);
    }
  };

  // Handle merge selection
  const toggleMergeSelection = (company) => {
    setSelectedForMerge(prev => {
      const isSelected = prev.find(c => c.id === company.id);
      if (isSelected) {
        // If removing the target, clear target
        if (targetCompany?.id === company.id) {
          setTargetCompany(null);
          setTargetName("");
        }
        return prev.filter(c => c.id !== company.id);
      } else {
        return [...prev, company];
      }
    });
  };

  // Set target company for merge
  const handleSetTarget = (company) => {
    setTargetCompany(company);
    setTargetName(company.name);
  };

  // Execute merge
  const handleMerge = async () => {
    if (!targetCompany || selectedForMerge.length < 2 || !targetName.trim()) {
      toast.error("Selecciona al menos 2 empresas, elige la principal y escribe el nombre final");
      return;
    }

    setMerging(true);
    try {
      const sourceIds = selectedForMerge
        .filter(c => c.id !== targetCompany.id)
        .map(c => c.id);

      const res = await api.post("/prospection/companies/merge", {
        source_ids: sourceIds,
        target_id: targetCompany.id,
        target_name: targetName.trim()
      });

      toast.success(`Empresas combinadas: ${res.data.contacts_updated} contactos y ${res.data.cases_updated} casos actualizados`);
      setMergeDialogOpen(false);
      setSelectedForMerge([]);
      setTargetCompany(null);
      setTargetName("");
      loadCompanies();
    } catch (error) {
      console.error("Error merging:", error);
      toast.error(error.response?.data?.detail || "Error al combinar empresas");
    } finally {
      setMerging(false);
    }
  };

  // Add search to company
  const handleAddSearch = async () => {
    if (!addSearchCompany || !newKeyword.trim() || !newUrl.trim()) return;

    setAddingSearch(true);
    try {
      await api.post(`/prospection/companies/${addSearchCompany.id}/searches`, {
        keyword: newKeyword.trim(),
        url: newUrl.trim()
      });

      toast.success("Búsqueda agregada");
      setAddSearchOpen(false);
      setNewKeyword("");
      setNewUrl("");
      setAddSearchCompany(null);
      loadCompanies();
    } catch (error) {
      console.error("Error adding search:", error);
      toast.error("Error al agregar búsqueda");
    } finally {
      setAddingSearch(false);
    }
  };

  // Delete search
  const handleDeleteSearch = async (searchId) => {
    try {
      await api.delete(`/prospection/searches/${searchId}`);
      toast.success("Búsqueda eliminada");
      loadCompanies();
    } catch (error) {
      console.error("Error deleting search:", error);
      toast.error("Error al eliminar");
    }
  };

  // Check migration status
  const checkMigrationStatus = async () => {
    try {
      const res = await api.get("/companies/migration/check-numeric-names");
      setMigrationStatus(res.data);
    } catch (error) {
      console.error("Error checking migration:", error);
    }
  };

  // Run automatic migration
  const runMigration = async () => {
    setMigrating(true);
    try {
      const res = await api.post("/companies/migration/fix-numeric-names");
      toast.success(`Migración completada: ${res.data.fixed} contactos corregidos`);
      if (res.data.not_found > 0) {
        toast.info(`${res.data.not_found} IDs no encontrados en HubSpot`);
      }
      setMigrationStatus(null);
      loadCompanies();
      checkMigrationStatus();
    } catch (error) {
      console.error("Error running migration:", error);
      toast.error("Error en la migración");
    } finally {
      setMigrating(false);
    }
  };

  // Manual fix for a specific company ID
  const handleManualFix = async () => {
    if (!manualFixId || !manualFixName.trim()) return;

    setFixingManual(true);
    try {
      const res = await api.post(`/companies/migration/manual-name-fix?company_id=${manualFixId}&new_name=${encodeURIComponent(manualFixName.trim())}`);
      toast.success(`Corregido: ${res.data.contacts_updated} contactos, ${res.data.cases_updated} casos`);
      setManualFixOpen(false);
      setManualFixId("");
      setManualFixName("");
      loadCompanies();
      checkMigrationStatus();
    } catch (error) {
      console.error("Error manual fix:", error);
      toast.error("Error al corregir");
    } finally {
      setFixingManual(false);
    }
  };

  // Load migration status on mount
  useEffect(() => {
    checkMigrationStatus();
  }, []);

  // Check if company name looks like an ID (numeric or weird format)
  const isInvalidCompanyName = (name) => {
    if (!name) return true;
    // Check if it's just numbers
    if (/^\d+$/.test(name)) return true;
    // Check if it's a HubSpot ID format
    if (/^[a-f0-9]{8,}$/i.test(name)) return true;
    return false;
  };

  const filteredActive = filterCompanies(activeCompanies);
  const filteredInactive = filterCompanies(inactiveCompanies);

  // Separate valid and invalid company names
  const validActiveCompanies = filteredActive.filter(c => !isInvalidCompanyName(c.name));
  const invalidActiveCompanies = filteredActive.filter(c => isInvalidCompanyName(c.name));
  
  // Pagination for outbound companies
  const totalOutboundPages = Math.ceil(validActiveCompanies.length / ITEMS_PER_PAGE);
  const paginatedOutbound = validActiveCompanies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  // Pagination for inbound companies
  const totalInboundPages = Math.ceil(filteredInactive.length / ITEMS_PER_PAGE);
  const paginatedInbound = filteredInactive.slice(
    (inboundPage - 1) * ITEMS_PER_PAGE,
    inboundPage * ITEMS_PER_PAGE
  );
  
  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
    setInboundPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="active-companies-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="active-companies-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 bg-[#0a0a0a] border-[#333]"
            />
          </div>
          <Badge variant="outline" className="border-green-500/30 text-green-400">
            {activeCompanies.length} outbound
          </Badge>
          <Badge variant="outline" className="border-slate-500/30 text-slate-400">
            {inactiveCompanies.length} inbound
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {selectedForMerge.length >= 2 && (
            <Button
              onClick={() => setMergeDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Merge className="w-4 h-4 mr-2" />
              Combinar ({selectedForMerge.length})
            </Button>
          )}
          <Button variant="outline" onClick={loadCompanies} className="border-[#333]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Migration Card - Show if there are numeric IDs */}
      {migrationStatus && migrationStatus.total_numeric_company_ids > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Wrench className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-400 font-medium">
                  {migrationStatus.total_contacts_affected} contactos con IDs numéricos en empresa
                </p>
                <p className="text-sm text-yellow-400/70 mt-1">
                  Se detectaron {migrationStatus.total_numeric_company_ids} IDs de HubSpot usados como nombre de empresa.
                  Puedes corregirlos automáticamente o manualmente.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Button
                    size="sm"
                    onClick={runMigration}
                    disabled={migrating}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    {migrating ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wrench className="w-4 h-4 mr-2" />
                    )}
                    Corregir Automáticamente
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setManualFixOpen(true)}
                    className="border-yellow-500/30 text-yellow-400"
                  >
                    Corregir Manualmente
                  </Button>
                  <span className="text-xs text-yellow-400/50 ml-2">
                    IDs: {migrationStatus.numeric_ids.slice(0, 3).map(i => i.hubspot_company_id).join(", ")}
                    {migrationStatus.numeric_ids.length > 3 && "..."}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Companies (Outbound) */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Power className="w-5 h-5 text-green-400" />
            Empresas Outbound ({validActiveCompanies.length})
          </CardTitle>
          <p className="text-sm text-slate-500">
            Empresas clasificadas como Outbound (asociadas a casos ganados)
          </p>
        </CardHeader>
        <CardContent>
          {validActiveCompanies.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay empresas outbound</p>
            </div>
          ) : (
          <>
            <div className="border rounded-lg border-[#222] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedForMerge.length === validActiveCompanies.length && validActiveCompanies.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedForMerge(validActiveCompanies);
                          } else {
                            setSelectedForMerge([]);
                            setTargetCompany(null);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Empresa</TableHead>
                    <TableHead className="text-slate-400">Búsquedas</TableHead>
                    <TableHead className="text-slate-400">Desde</TableHead>
                    <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOutbound.map(company => {
                    const isSelected = selectedForMerge.find(c => c.id === company.id);
                    const isTarget = targetCompany?.id === company.id;

                    return (
                      <TableRow key={company.id} className={`border-[#222] ${isTarget ? 'bg-purple-500/10' : ''}`}>
                        <TableCell>
                          <Checkbox
                            checked={!!isSelected}
                            onCheckedChange={() => toggleMergeSelection(company)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <span className="text-white font-medium">{company.name}</span>
                            {isTarget && (
                              <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                                Principal
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-[#333]">
                            {company.searches?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {company.active_since 
                            ? new Date(company.active_since).toLocaleDateString('es-MX')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isSelected && selectedForMerge.length >= 2 && !isTarget && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSetTarget(company)}
                                className="h-8 px-2 text-purple-400 hover:text-purple-300"
                                title="Marcar como empresa principal"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAddSearchCompany(company);
                                setAddSearchOpen(true);
                              }}
                              className="h-8 px-2 text-blue-400 hover:text-blue-300"
                              title="Agregar búsqueda"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openPropagationDialog(company)}
                              className="h-8 px-2 text-cyan-400 hover:text-cyan-300"
                              title="Propagar clasificación a contactos"
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleActive(company)}
                              className="h-8 px-2 text-red-400 hover:text-red-300"
                              title="Cambiar a Inbound"
                            >
                              <PowerOff className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination for Outbound */}
            {totalOutboundPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <span className="text-sm text-slate-500">
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, validActiveCompanies.length)} de {validActiveCompanies.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="border-[#333]"
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-400">
                    Página {currentPage} de {totalOutboundPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.min(totalOutboundPages, p + 1))}
                    disabled={currentPage === totalOutboundPages}
                    className="border-[#333]"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Inactive Companies (Inbound) */}
      {filteredInactive.length > 0 && (
        <Card className="bg-[#0a0a0a] border-[#222]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-400">
              <PowerOff className="w-5 h-5" />
              Empresas Inbound ({filteredInactive.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="inactive" className="border-[#222]">
                <AccordionTrigger className="text-slate-400 hover:no-underline">
                  Ver empresas inbound ({filteredInactive.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 mt-2">
                    {paginatedInbound.map(company => (
                      <div
                        key={company.id}
                        className="flex items-center justify-between p-3 bg-[#111] rounded-lg border border-[#222]"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-400">{company.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(company)}
                          className="h-8 border-green-500/30 text-green-400"
                        >
                          <Power className="w-4 h-4 mr-1" />
                          Outbound
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Pagination for Inbound */}
                  {totalInboundPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#222]">
                      <span className="text-sm text-slate-500">
                        Mostrando {(inboundPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(inboundPage * ITEMS_PER_PAGE, filteredInactive.length)} de {filteredInactive.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInboundPage(p => Math.max(1, p - 1))}
                          disabled={inboundPage === 1}
                          className="border-[#333]"
                        >
                          Anterior
                        </Button>
                        <span className="text-sm text-slate-400">
                          Página {inboundPage} de {totalInboundPages}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInboundPage(p => Math.min(totalInboundPages, p + 1))}
                          disabled={inboundPage === totalInboundPages}
                          className="border-[#333]"
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-purple-400" />
              Combinar Empresas
            </DialogTitle>
            <DialogDescription>
              Selecciona la empresa principal y el nombre final. Todos los contactos y casos serán actualizados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Empresas a combinar:</label>
              <div className="space-y-2">
                {selectedForMerge.map(company => (
                  <div
                    key={company.id}
                    className={`flex items-center justify-between p-2 rounded border ${
                      targetCompany?.id === company.id 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-[#333] bg-[#0a0a0a]'
                    }`}
                  >
                    <span className="text-white">{company.name}</span>
                    <Button
                      size="sm"
                      variant={targetCompany?.id === company.id ? "default" : "outline"}
                      onClick={() => handleSetTarget(company)}
                      className={targetCompany?.id === company.id ? "bg-purple-600" : "border-[#333]"}
                    >
                      {targetCompany?.id === company.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        "Principal"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {targetCompany && (
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Nombre final:</label>
                <Input
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="Nombre de la empresa combinada"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !targetCompany || !targetName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {merging ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Combinar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Search Dialog */}
      <Dialog open={addSearchOpen} onOpenChange={setAddSearchOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">
              Agregar búsqueda - {addSearchCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Keyword</label>
              <Input
                placeholder="Ej: marketing, recursos humanos"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">URL de búsqueda de LinkedIn</label>
              <Input
                placeholder="https://linkedin.com/search/results/people/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSearchOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleAddSearch}
              disabled={addingSearch || !newKeyword.trim() || !newUrl.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {addingSearch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Fix Dialog */}
      <Dialog open={manualFixOpen} onOpenChange={setManualFixOpen}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-yellow-400" />
              Corregir Nombre de Empresa Manualmente
            </DialogTitle>
            <DialogDescription>
              Ingresa el ID de HubSpot y el nombre correcto de la empresa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">ID de HubSpot (número)</label>
              <Input
                placeholder="Ej: 12345678"
                value={manualFixId}
                onChange={(e) => setManualFixId(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Nombre correcto de la empresa</label>
              <Input
                placeholder="Ej: Empresa ABC S.A. de C.V."
                value={manualFixName}
                onChange={(e) => setManualFixName(e.target.value)}
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            {migrationStatus && (
              <div className="p-3 bg-[#0a0a0a] rounded border border-[#333]">
                <p className="text-xs text-slate-500 mb-2">IDs detectados:</p>
                <div className="flex flex-wrap gap-2">
                  {migrationStatus.numeric_ids.map(item => (
                    <Button
                      key={item.hubspot_company_id}
                      size="sm"
                      variant="outline"
                      onClick={() => setManualFixId(item.hubspot_company_id)}
                      className={`border-[#333] text-xs ${manualFixId === item.hubspot_company_id ? 'border-yellow-500 text-yellow-400' : ''}`}
                    >
                      {item.hubspot_company_id} ({item.contacts_count})
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualFixOpen(false)} className="border-[#333]">
              Cancelar
            </Button>
            <Button
              onClick={handleManualFix}
              disabled={fixingManual || !manualFixId || !manualFixName.trim()}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {fixingManual ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Corregir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Propagation Dialog */}
      <Dialog open={propagationDialogOpen} onOpenChange={setPropagationDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Propagar Clasificación
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Actualizar la clasificación de todos los contactos asociados a esta empresa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <p className="text-sm text-slate-400">Empresa:</p>
              <p className="text-white font-medium">{propagationCompany?.name}</p>
            </div>
            
            <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <p className="text-sm text-slate-400">Clasificación actual:</p>
              <Badge 
                className={`mt-1 ${
                  propagationCompany?.is_active || propagationCompany?.classification === "outbound"
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-slate-500/20 text-slate-400"
                }`}
              >
                {propagationCompany?.is_active || propagationCompany?.classification === "outbound" ? "Outbound" : "Inbound"}
              </Badge>
            </div>
            
            {propagationPreview ? (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-400">
                  <span className="font-bold">{propagationPreview.affected_count}</span> contactos serán actualizados
                </p>
                {propagationPreview.affected_contacts?.length > 0 && (
                  <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {propagationPreview.affected_contacts.slice(0, 5).map(contact => (
                      <li key={contact.id} className="text-xs text-slate-400">
                        {contact.name}
                      </li>
                    ))}
                    {propagationPreview.affected_contacts.length > 5 && (
                      <li className="text-xs text-slate-500">
                        ...y {propagationPreview.affected_contacts.length - 5} más
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-slate-400 text-sm">Calculando contactos afectados...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPropagationDialogOpen(false)} 
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={executePropagation}
              disabled={propagating || !propagationPreview}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {propagating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Propagando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ActiveCompaniesSection;
