import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { ScrollArea } from "../components/ui/scroll-area";
import api from "../lib/api";
import { CompanyEditorDialog } from "../components/CompanyEditorDialog";
import { 
  Building2,
  Search,
  Globe,
  Factory,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  Loader2,
  Target,
  Inbox,
  Save,
  Merge,
  AlertTriangle,
  Check,
  RefreshCw
} from "lucide-react";

const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

export default function Companies() {
  // Core data state
  const [industries, setIndustries] = useState([]);
  const [industryCounts, setIndustryCounts] = useState({}); // Counts by industry_code
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Loaded companies per industry (lazy loading)
  const [companiesByIndustry, setCompaniesByIndustry] = useState({});
  const [loadingIndustry, setLoadingIndustry] = useState(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Accordion state
  const [expandedIndustries, setExpandedIndustries] = useState([]);
  
  // Pagination state per industry: { industryCode: { page: 1, pageSize: 5 } }
  const [industryPagination, setIndustryPagination] = useState({});
  const [industryTotals, setIndustryTotals] = useState({});
  
  // Industry edit dialog
  const [editingIndustry, setEditingIndustry] = useState(null);
  const [industryFormData, setIndustryFormData] = useState({
    name: "",
    code: "",
    description: "",
    color: "#6366f1",
    classification: "inbound"
  });
  const [savingIndustry, setSavingIndustry] = useState(false);
  
  // Company editor dialog
  const [fullEditorOpen, setFullEditorOpen] = useState(false);
  const [fullEditorCompany, setFullEditorCompany] = useState(null);

  // Industry selection for merge
  const [selectedIndustries, setSelectedIndustries] = useState([]); // Array of industry objects
  const [selectionBlock, setSelectionBlock] = useState(null); // 'outbound' or 'inbound' - restricts selection to one block
  const [mergeMode, setMergeMode] = useState(false);
  
  // Merge dialog
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [targetIndustry, setTargetIndustry] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergePreview, setMergePreview] = useState(null);

  // Load initial data (industries + counts)
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load industries and company counts in parallel
      const [industriesRes, countsRes] = await Promise.all([
        api.get("/industries-v2", { params: { limit: 200 } }),
        api.get("/unified-companies/counts-by-industry")
      ]);
      
      setIndustries(industriesRes.data.industries || []);
      setIndustryCounts(countsRes.data.counts || {});
      setTotalCompanies(countsRes.data.total || 0);
      
      // Clear loaded companies to refresh
      setCompaniesByIndustry({});
      setIndustryPagination({});
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  // Load companies for a specific industry (lazy loading)
  const loadCompaniesForIndustry = useCallback(async (industryCode, page = 1, pageSize = DEFAULT_PAGE_SIZE) => {
    setLoadingIndustry(industryCode);
    try {
      const skip = (page - 1) * pageSize;
      const response = await api.get("/unified-companies", {
        params: {
          industry_code: industryCode,
          limit: pageSize,
          skip: skip
        }
      });
      
      const total = response.data.total || 0;
      const maxPage = Math.ceil(total / pageSize) || 1;
      
      // If current page is out of range, reset to page 1
      const validPage = page > maxPage ? 1 : page;
      if (page > maxPage && page !== 1) {
        // Reload with page 1
        const reloadSkip = 0;
        const reloadResponse = await api.get("/unified-companies", {
          params: {
            industry_code: industryCode,
            limit: pageSize,
            skip: reloadSkip
          }
        });
        setCompaniesByIndustry(prev => ({
          ...prev,
          [industryCode]: reloadResponse.data.companies || []
        }));
        setIndustryTotals(prev => ({
          ...prev,
          [industryCode]: reloadResponse.data.total || 0
        }));
        setIndustryPagination(prev => ({
          ...prev,
          [industryCode]: { page: 1, pageSize }
        }));
      } else {
        setCompaniesByIndustry(prev => ({
          ...prev,
          [industryCode]: response.data.companies || []
        }));
        setIndustryTotals(prev => ({
          ...prev,
          [industryCode]: total
        }));
        setIndustryPagination(prev => ({
          ...prev,
          [industryCode]: { page: validPage, pageSize }
        }));
      }
    } catch (error) {
      console.error(`Error loading companies for ${industryCode}:`, error);
      toast.error("Error cargando empresas");
    } finally {
      setLoadingIndustry(null);
    }
  }, []);

  // Handle accordion expand/collapse
  const handleAccordionChange = useCallback((values) => {
    setExpandedIndustries(values);
    
    // Load companies for newly expanded industries
    values.forEach(industryCode => {
      if (!companiesByIndustry[industryCode]) {
        const pagination = industryPagination[industryCode] || { page: 1, pageSize: DEFAULT_PAGE_SIZE };
        loadCompaniesForIndustry(industryCode, pagination.page, pagination.pageSize);
      }
    });
  }, [companiesByIndustry, industryPagination, loadCompaniesForIndustry]);

  // Search companies (server-side)
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const debounceSearch = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get("/unified-companies", {
          params: {
            search: searchTerm,
            limit: 50
          }
        });
        setSearchResults(response.data.companies || []);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(debounceSearch);
  }, [searchTerm]);

  // Build industry list with company counts, split by classification
  const { outboundIndustries, inboundIndustries } = useMemo(() => {
    // Create maps for lookup by code
    const industryByCode = {};
    industries.forEach(ind => {
      industryByCode[ind.code] = ind;
    });
    
    // Get all industry codes that have companies from the counts
    const industryCodesWithCompanies = Object.keys(industryCounts);
    
    // Build list with counts - match by code
    const allIndustryData = industryCodesWithCompanies.map(code => {
      // Try to find industry by code
      let industryInfo = industryByCode[code];
      
      if (!industryInfo) {
        // Create a placeholder for unknown industries
        industryInfo = {
          id: `unknown_${code}`,
          code: code,
          name: code === "sin_industria" ? "Sin Industria" : code,
          classification: "inbound",
          color: "#666666"
        };
      }
      
      return {
        ...industryInfo,
        // Use the original code for grouping
        groupKey: code,
        companyCount: industryCounts[code] || 0
      };
    });
    
    // Sort: by company count desc, industries with 0 at end
    const sortIndustries = (list) => {
      return list.sort((a, b) => {
        if (a.companyCount === 0 && b.companyCount > 0) return 1;
        if (b.companyCount === 0 && a.companyCount > 0) return -1;
        return b.companyCount - a.companyCount;
      });
    };
    
    // Split by classification
    const outbound = sortIndustries(
      allIndustryData.filter(ind => ind.classification === "outbound")
    );
    const inbound = sortIndustries(
      allIndustryData.filter(ind => ind.classification !== "outbound")
    );
    
    return { outboundIndustries: outbound, inboundIndustries: inbound };
  }, [industries, industryCounts]);

  // Get pagination state for industry
  const getIndustryPagination = (groupKey) => {
    return industryPagination[groupKey] || { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  };

  // Get current page for industry
  const getIndustryPage = (groupKey) => {
    return getIndustryPagination(groupKey).page;
  };

  // Get page size for industry
  const getIndustryPageSize = (groupKey) => {
    return getIndustryPagination(groupKey).pageSize;
  };

  // Change page for industry
  const changeIndustryPage = (groupKey, page) => {
    const pageSize = getIndustryPageSize(groupKey);
    loadCompaniesForIndustry(groupKey, page, pageSize);
  };

  // Change page size for industry
  const changeIndustryPageSize = (groupKey, newPageSize) => {
    // Reset to page 1 when changing page size
    loadCompaniesForIndustry(groupKey, 1, newPageSize);
  };

  // Get paginated companies for industry (from loaded data)
  const getPaginatedCompanies = (groupKey) => {
    return companiesByIndustry[groupKey] || [];
  };

  // Get total pages for industry
  const getTotalPages = (groupKey) => {
    const total = industryTotals[groupKey] || industryCounts[groupKey] || 0;
    const pageSize = getIndustryPageSize(groupKey);
    return Math.ceil(total / pageSize) || 1;
  };

  // Get total companies for industry
  const getIndustryTotal = (groupKey) => {
    return industryTotals[groupKey] || industryCounts[groupKey] || 0;
  };

  // Refresh industry data after actions (create, merge, etc.)
  const refreshIndustryData = useCallback(async (industryCode) => {
    if (industryCode && expandedIndustries.includes(industryCode)) {
      const pagination = getIndustryPagination(industryCode);
      await loadCompaniesForIndustry(industryCode, pagination.page, pagination.pageSize);
    }
    // Also refresh counts
    try {
      const countsRes = await api.get("/unified-companies/counts-by-industry");
      setIndustryCounts(countsRes.data.counts || {});
      setTotalCompanies(countsRes.data.total || 0);
    } catch (error) {
      console.error("Error refreshing counts:", error);
    }
  }, [expandedIndustries, loadCompaniesForIndustry]);

  // Open industry edit dialog
  const openEditIndustryDialog = (industry, e) => {
    e?.stopPropagation();
    setEditingIndustry(industry);
    setIndustryFormData({
      name: industry.name || "",
      code: industry.code || "",
      description: industry.description || "",
      color: industry.color || "#6366f1",
      classification: industry.classification || "inbound"
    });
  };

  // Save industry
  const saveIndustry = async () => {
    if (!editingIndustry) return;
    
    setSavingIndustry(true);
    try {
      await api.put(`/industries/${editingIndustry.id}`, industryFormData);
      toast.success("Industria actualizada");
      setEditingIndustry(null);
      await loadData();
    } catch (error) {
      console.error("Error saving industry:", error);
      toast.error(error.response?.data?.detail || "Error al guardar industria");
    } finally {
      setSavingIndustry(false);
    }
  };

  // Open company editor
  const openCompanyEditor = (company) => {
    setFullEditorCompany(company);
    setFullEditorOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Toggle merge mode
  const toggleMergeMode = () => {
    if (mergeMode) {
      // Exit merge mode - clear selections
      setSelectedIndustries([]);
      setSelectionBlock(null);
      setTargetIndustry(null);
    }
    setMergeMode(!mergeMode);
  };

  // Handle industry selection for merge
  const handleIndustrySelection = (industry, classification) => {
    const isSelected = selectedIndustries.some(ind => ind.id === industry.id);
    
    if (isSelected) {
      // Deselect
      const newSelection = selectedIndustries.filter(ind => ind.id !== industry.id);
      setSelectedIndustries(newSelection);
      
      // Clear selection block if no more selections
      if (newSelection.length === 0) {
        setSelectionBlock(null);
      }
      
      // Reset target if it was deselected
      if (targetIndustry?.id === industry.id) {
        setTargetIndustry(newSelection[0] || null);
      }
    } else {
      // Select - only if same classification block or no block set yet
      if (selectionBlock && selectionBlock !== classification) {
        toast.error("Solo puedes seleccionar industrias del mismo bloque (Outbound o Inbound)");
        return;
      }
      
      const newSelection = [...selectedIndustries, industry];
      setSelectedIndustries(newSelection);
      setSelectionBlock(classification);
      
      // Set first selected as target
      if (!targetIndustry) {
        setTargetIndustry(industry);
      }
    }
  };

  // Open merge dialog
  const openMergeDialog = async () => {
    if (selectedIndustries.length < 2) {
      toast.error("Selecciona al menos 2 industrias para fusionar");
      return;
    }
    
    // Ensure we have a target
    if (!targetIndustry) {
      setTargetIndustry(selectedIndustries[0]);
    }
    
    // Get merge preview from API
    try {
      const secondaryIds = selectedIndustries
        .filter(ind => ind.id !== targetIndustry?.id)
        .map(ind => ind.id)
        .join(",");
      
      const response = await api.get("/industries-v2/merge/preview", {
        params: {
          primary_id: targetIndustry?.id || selectedIndustries[0].id,
          secondary_ids: secondaryIds
        }
      });
      setMergePreview(response.data);
    } catch (error) {
      console.error("Error getting merge preview:", error);
      setMergePreview(null);
    }
    
    setMergeDialogOpen(true);
  };

  // Execute merge
  const executeMerge = async () => {
    if (!targetIndustry || selectedIndustries.length < 2) return;
    
    setMerging(true);
    try {
      const industriesToMerge = selectedIndustries
        .filter(ind => ind.id !== targetIndustry.id)
        .map(ind => ind.id);
      
      await api.post("/industries-v2/merge", {
        primary_industry_id: targetIndustry.id,
        industries_to_merge: industriesToMerge
      });
      
      toast.success(`${industriesToMerge.length} industria(s) fusionada(s) en "${targetIndustry.name}"`);
      
      // Reset state
      setMergeDialogOpen(false);
      setMergeMode(false);
      setSelectedIndustries([]);
      setSelectionBlock(null);
      setTargetIndustry(null);
      setMergePreview(null);
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error("Error merging industries:", error);
      toast.error(error.response?.data?.detail || "Error al fusionar industrias");
    } finally {
      setMerging(false);
    }
  };

  // Render industry accordion item
  const renderIndustryAccordion = (industry, classification) => {
    const groupKey = industry.groupKey || industry.code;
    const loadedCompanies = companiesByIndustry[groupKey] || [];
    const paginatedCompanies = getPaginatedCompanies(groupKey);
    const currentPage = getIndustryPage(groupKey);
    const currentPageSize = getIndustryPageSize(groupKey);
    const totalPages = getTotalPages(groupKey);
    const totalCompaniesInIndustry = getIndustryTotal(groupKey);
    const isLoadingThisIndustry = loadingIndustry === groupKey;
    
    const isSelected = selectedIndustries.some(ind => ind.id === industry.id);
    const isTarget = targetIndustry?.id === industry.id;
    const isDisabled = selectionBlock && selectionBlock !== classification;
    
    // Calculate display range
    const startItem = ((currentPage - 1) * currentPageSize) + 1;
    const endItem = Math.min(currentPage * currentPageSize, totalCompaniesInIndustry);
    
    return (
      <AccordionItem 
        key={groupKey} 
        value={groupKey}
        className={`border rounded-lg mb-2 overflow-hidden bg-[#0a0a0a] ${
          isSelected 
            ? isTarget 
              ? "border-green-500 ring-1 ring-green-500/50" 
              : "border-blue-500 ring-1 ring-blue-500/50"
            : "border-[#222]"
        }`}
        data-testid={`industry-accordion-${industry.code}`}
      >
        <AccordionTrigger className="px-4 py-3 hover:bg-[#111] hover:no-underline [&[data-state=open]]:bg-[#111]">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-3">
              {/* Merge mode checkbox */}
              {mergeMode && (
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleIndustrySelection(industry, classification)}
                    disabled={isDisabled}
                    className={`w-5 h-5 ${isDisabled ? "opacity-30" : ""}`}
                    data-testid={`industry-checkbox-${industry.code}`}
                  />
                </div>
              )}
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${industry.color || '#666'}20` }}
              >
                <Factory className="w-4 h-4" style={{ color: industry.color || '#666' }} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{industry.name}</span>
                  {mergeMode && isTarget && (
                    <Badge className="bg-green-500/20 text-green-400 text-xs py-0 px-1.5 border-0">
                      Destino
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs py-0 px-1.5">
                    {industry.code}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {industry.companyCount.toLocaleString()} empresa{industry.companyCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Set as target button in merge mode */}
              {mergeMode && isSelected && !isTarget && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTargetIndustry(industry);
                  }}
                >
                  Hacer destino
                </Button>
              )}
              <Badge 
                className={`text-xs ${
                  industry.classification === "outbound" 
                    ? "bg-green-500/20 text-green-400" 
                    : "bg-slate-500/20 text-slate-400"
                }`}
              >
                {industry.classification === "outbound" ? (
                  <><Target className="w-3 h-3 mr-1" /> Outbound</>
                ) : (
                  <><Inbox className="w-3 h-3 mr-1" /> Inbound</>
                )}
              </Badge>
              {!mergeMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                  onClick={(e) => openEditIndustryDialog(industry, e)}
                  title="Editar industria"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 pb-4">
          {isLoadingThisIndustry && loadedCompanies.length === 0 ? (
            <div className="py-6 text-center text-slate-500">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
              <p>Cargando empresas...</p>
            </div>
          ) : loadedCompanies.length === 0 && !isLoadingThisIndustry ? (
            <div className="py-6 text-center text-slate-500">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay empresas en esta industria</p>
            </div>
          ) : (
            <>
              {/* Company list */}
              <div className="space-y-2">
                {isLoadingThisIndustry && (
                  <div className="text-center py-2">
                    <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />
                    <span className="text-xs text-slate-500">Actualizando...</span>
                  </div>
                )}
                {paginatedCompanies.map((company) => (
                  <div 
                    key={company.id || company.name}
                    className="p-3 bg-[#111] rounded-lg border border-[#222] hover:border-[#333] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{company.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {company.domain && (
                              <a 
                                href={`https://${company.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#ff3300] hover:underline"
                              >
                                <Globe className="w-3 h-3" />
                                {company.domain}
                              </a>
                            )}
                            {company.aliases?.length > 0 && (
                              <span className="text-xs text-slate-500">
                                +{company.aliases.length} alias
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCompanyEditor(company)}
                        className="text-slate-400 hover:text-white h-8 w-8 p-0"
                        title="Editar empresa"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {(totalCompaniesInIndustry > DEFAULT_PAGE_SIZE || totalPages > 1) && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#222] flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {totalCompaniesInIndustry > 0 
                        ? `${startItem}-${endItem} de ${totalCompaniesInIndustry.toLocaleString()}`
                        : "0 empresas"
                      }
                    </span>
                    <Select
                      value={String(currentPageSize)}
                      onValueChange={(value) => changeIndustryPageSize(groupKey, parseInt(value))}
                      disabled={isLoadingThisIndustry}
                    >
                      <SelectTrigger className="h-7 w-[70px] text-xs border-[#333] bg-[#0a0a0a]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map(size => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-slate-500">por página</span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeIndustryPage(groupKey, currentPage - 1)}
                        disabled={currentPage <= 1 || isLoadingThisIndustry}
                        className="h-7 w-7 p-0 border-[#333]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-slate-400 px-2">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeIndustryPage(groupKey, currentPage + 1)}
                        disabled={currentPage >= totalPages || isLoadingThisIndustry}
                        className="h-7 w-7 p-0 border-[#333]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="companies-list">
      {/* Merge Mode Toolbar */}
      {mergeMode && (
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Merge className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="font-medium text-white">Modo Fusión de Industrias</p>
                  <p className="text-sm text-slate-400">
                    {selectedIndustries.length === 0 
                      ? "Selecciona las industrias que deseas fusionar"
                      : `${selectedIndustries.length} industria(s) seleccionada(s)`}
                    {selectionBlock && (
                      <span className="ml-1 text-slate-500">
                        (bloque {selectionBlock === "outbound" ? "Outbound" : "Inbound"})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={toggleMergeMode}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={openMergeDialog}
                  disabled={selectedIndustries.length < 2}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Merge className="w-4 h-4 mr-2" />
                  Fusionar ({selectedIndustries.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {!mergeMode && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={toggleMergeMode}
            className="border-[#333] text-slate-300 hover:bg-[#222]"
          >
            <Merge className="w-4 h-4 mr-2" />
            Fusionar Industrias
          </Button>
        </div>
      )}

      {/* Search Bar */}
      <Card className="bg-[#111111] border-[#222222]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Empresas</p>
                <p className="text-xl font-semibold text-white">{totalCompanies.toLocaleString()}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="border-[#333] text-slate-400 hover:text-white"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-500/20 rounded-lg">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <Label className="text-sm text-slate-400 mb-1 block">Buscar Empresas</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Buscar por nombre, dominio o alias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 bg-[#0a0a0a] border-[#333] text-white"
                  data-testid="company-search-input"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          {searching && (
            <p className="text-xs text-slate-500 mt-2 ml-12">
              <Loader2 className="w-3 h-3 inline-block animate-spin mr-1" />
              Buscando...
            </p>
          )}
          {searchTerm && searchTerm.length >= 2 && !searching && searchResults.length > 0 && (
            <div className="mt-3 ml-12">
              <p className="text-xs text-slate-500 mb-2">
                {searchResults.length} empresa{searchResults.length !== 1 ? 's' : ''} encontrada{searchResults.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {searchResults.slice(0, 10).map(company => (
                  <div 
                    key={company.id || company.name}
                    className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-[#222] hover:border-[#333] cursor-pointer"
                    onClick={() => openCompanyEditor(company)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-sm text-white truncate">{company.name}</span>
                      {company.domain && (
                        <span className="text-xs text-slate-500 truncate hidden sm:block">{company.domain}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {company.industry_code || 'sin_industria'}
                    </Badge>
                  </div>
                ))}
                {searchResults.length > 10 && (
                  <p className="text-xs text-slate-500 text-center py-1">
                    +{searchResults.length - 10} más...
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outbound Industries Block */}
      {outboundIndustries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Industrias Outbound</h2>
            <Badge className="bg-green-500/20 text-green-400 border-0">
              {outboundIndustries.length}
            </Badge>
          </div>
          <Accordion 
            type="multiple" 
            value={expandedIndustries}
            onValueChange={handleAccordionChange}
          >
            {outboundIndustries.map(ind => renderIndustryAccordion(ind, "outbound"))}
          </Accordion>
        </div>
      )}

      {/* Inbound Industries Block */}
      {inboundIndustries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Industrias Inbound</h2>
            <Badge className="bg-slate-500/20 text-slate-400 border-0">
              {inboundIndustries.length}
            </Badge>
          </div>
          <Accordion 
            type="multiple" 
            value={expandedIndustries}
            onValueChange={handleAccordionChange}
          >
            {inboundIndustries.map(ind => renderIndustryAccordion(ind, "inbound"))}
          </Accordion>
        </div>
      )}

      {/* Empty state */}
      {outboundIndustries.length === 0 && inboundIndustries.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Factory className="w-12 h-12 mx-auto mb-3 opacity-50" />
          {searchTerm ? (
            <>
              <p>No se encontraron empresas para "{searchTerm}"</p>
              <Button variant="link" onClick={clearSearch} className="text-blue-400 mt-2">
                Limpiar búsqueda
              </Button>
            </>
          ) : (
            <p>No hay industrias configuradas</p>
          )}
        </div>
      )}

      {/* Industry Edit Dialog */}
      <Dialog open={!!editingIndustry} onOpenChange={(open) => !open && setEditingIndustry(null)}>
        <DialogContent className="bg-[#111111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Industria</DialogTitle>
            <DialogDescription className="text-slate-500">
              Actualizar los datos de la industria
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="industry-name">Nombre</Label>
              <Input
                id="industry-name"
                value={industryFormData.name}
                onChange={(e) => setIndustryFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-[#0a0a0a] border-[#222]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry-code">Código</Label>
              <Input
                id="industry-code"
                value={industryFormData.code}
                disabled
                className="bg-[#0a0a0a] border-[#222] opacity-50"
              />
              <p className="text-xs text-slate-500">El código no se puede modificar</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry-description">Descripción</Label>
              <Textarea
                id="industry-description"
                value={industryFormData.description}
                onChange={(e) => setIndustryFormData(prev => ({ ...prev, description: e.target.value }))}
                className="bg-[#0a0a0a] border-[#222]"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="industry-color"
                  type="color"
                  value={industryFormData.color}
                  onChange={(e) => setIndustryFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-16 h-10 p-1 bg-[#0a0a0a] border-[#222]"
                />
                <Input
                  value={industryFormData.color}
                  onChange={(e) => setIndustryFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#6366f1"
                  className="flex-1 bg-[#0a0a0a] border-[#222]"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry-classification">Clasificación</Label>
              <Select
                value={industryFormData.classification}
                onValueChange={(value) => setIndustryFormData(prev => ({ ...prev, classification: value }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#222]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#222]">
                  <SelectItem value="inbound">
                    <span className="flex items-center gap-2">
                      <Inbox className="w-4 h-4" /> Inbound
                    </span>
                  </SelectItem>
                  <SelectItem value="outbound">
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4" /> Outbound
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditingIndustry(null)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={saveIndustry}
              disabled={savingIndustry}
              className="bg-[#ff3300] hover:bg-[#cc2900]"
            >
              {savingIndustry ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Editor Dialog */}
      <CompanyEditorDialog
        open={fullEditorOpen}
        onOpenChange={setFullEditorOpen}
        companyId={fullEditorCompany?.id}
        companyName={fullEditorCompany?.name}
        onSaved={async () => {
          // Refresh data after save
          await loadData();
          // Also refresh the specific industry if expanded
          if (fullEditorCompany?.industry_code) {
            await refreshIndustryData(fullEditorCompany.industry_code);
          }
          setFullEditorOpen(false);
        }}
      />

      {/* Merge Industries Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="bg-[#111111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-blue-400" />
              Fusionar Industrias
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Las industrias seleccionadas se fusionarán en la industria destino.
              Las empresas serán reasignadas automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Target Industry */}
            <div className="space-y-2">
              <Label className="text-slate-400">Industria Destino (se conserva)</Label>
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-white font-medium">{targetIndustry?.name}</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {targetIndustry?.code}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Industries to merge */}
            <div className="space-y-2">
              <Label className="text-slate-400">Industrias a fusionar (se eliminarán)</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedIndustries
                  .filter(ind => ind.id !== targetIndustry?.id)
                  .map(industry => (
                    <div key={industry.id} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-slate-300">{industry.name}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {industry.code}
                        </Badge>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            {/* Preview info */}
            {mergePreview && (
              <div className="p-3 bg-[#0a0a0a] border border-[#222] rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-slate-400">
                    <span className="text-white font-medium">{mergePreview.total_companies_affected}</span> empresa(s) serán reasignadas a "{targetIndustry?.name}"
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setMergeDialogOpen(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={executeMerge}
              disabled={merging}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {merging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fusionando...
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Confirmar Fusión
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
