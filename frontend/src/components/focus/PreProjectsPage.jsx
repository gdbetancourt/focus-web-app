/**
 * PreProjectsPage - Eleventh section in the Focus system (Daily)
 *
 * Shows all Stage 3 cases with special emphasis on pending quotes.
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { QuotesTabContent } from "../todays-focus/QuotesTabContent";
import {
  FileText,
  Briefcase,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Building2,
  Users,
  Plus,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import api from "../../lib/api";
import { CaseCreateDialog } from "./CaseCreateDialog";

const SECTION = getSectionById("pre-projects");
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 50, 100];

const STAGE_LABELS = {
  caso_solicitado: "Caso Solicitado",
  caso_presentado: "Caso Presentado",
  interes_en_caso: "Interés en Caso",
  cierre_administrativo: "En Cierre Administrativo",
  descartado: "Descartado",
};

const STAGE_COLORS = {
  caso_solicitado: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  caso_presentado: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  interes_en_caso: "bg-green-500/20 text-green-400 border-green-500/50",
  cierre_administrativo: "bg-amber-500/20 text-amber-400 border-amber-500/50",
  descartado: "bg-red-500/20 text-red-400 border-red-500/50",
};

const STAGE_QUERY_PARAMS = {
  caso_solicitado: { stage: "caso_solicitado", status: "active" },
  caso_presentado: { stage: "caso_presentado", status: "active" },
  interes_en_caso: { stage: "interes_en_caso", status: "active" },
  cierre_administrativo: { stage: "cierre_administrativo", status: "active" },
  descartado: { stage: "descartado" },
};

export default function PreProjectsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [quotesCases, setQuotesCases] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  const [loadingCases, setLoadingCases] = useState(true);
  const [expandedCases, setExpandedCases] = useState({});
  const [expandedStages, setExpandedStages] = useState({});
  const [stagePageSize, setStagePageSize] = useState({});
  const [stageCurrentPage, setStageCurrentPage] = useState({});
  const [stageCounts, setStageCounts] = useState({});
  const [stageCases, setStageCases] = useState({});
  const [stageLoading, setStageLoading] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const formatCurrency = (amount, currency = "MXN") => {
    if (!amount) return "-";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStagePageSize = (stageKey) => stagePageSize[stageKey] || DEFAULT_PAGE_SIZE;
  const getStageCount = (stageKey) => stageCounts[stageKey] || 0;

  const setCaseExpanded = (caseId, open) => {
    setExpandedCases((prev) => ({ ...prev, [caseId]: open }));
  };

  const setStageExpanded = (stageKey, open) => {
    setExpandedStages((prev) => ({ ...prev, [stageKey]: open }));
  };

  const setAllStagesExpanded = (open) => {
    const nextState = Object.keys(STAGE_LABELS).reduce((acc, key) => {
      acc[key] = open;
      return acc;
    }, {});
    setExpandedStages(nextState);
  };

  const refreshQuotesCases = useCallback(async () => {
    setLoadingQuotes(true);
    try {
      const res = await api.get("/todays-focus/quotes-cases");
      setQuotesCases(res.data.cases || []);
    } catch (error) {
      console.error("Error loading quotes:", error);
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  const fetchStagePage = useCallback(async (stageKey, page, pageSize) => {
    setStageLoading((prev) => ({ ...prev, [stageKey]: true }));
    try {
      const skip = (page - 1) * pageSize;
      const params = { limit: pageSize, skip, ...STAGE_QUERY_PARAMS[stageKey] };
      const res = await api.get("/cases/", { params });
      const batch = res.data.cases || [];
      const filteredTotal = res.data.pagination?.filtered_total;

      setStageCases((prev) => ({ ...prev, [stageKey]: batch }));
      setStageCurrentPage((prev) => ({ ...prev, [stageKey]: page }));
      if (typeof filteredTotal === "number") {
        setStageCounts((prev) => ({ ...prev, [stageKey]: filteredTotal }));
      }
    } catch (error) {
      console.error(`Error loading stage page (${stageKey}):`, error);
      setStageCases((prev) => ({ ...prev, [stageKey]: [] }));
    } finally {
      setStageLoading((prev) => ({ ...prev, [stageKey]: false }));
    }
  }, []);

  const loadCasesSummaryAndFirstPages = useCallback(async () => {
    setLoadingCases(true);
    try {
      const summaryRes = await api.get("/cases/", { params: { limit: 1, skip: 0 } });
      const stats = summaryRes.data.stats || {};
      const nextCounts = {
        caso_solicitado: stats.caso_solicitado || 0,
        caso_presentado: stats.caso_presentado || 0,
        interes_en_caso: stats.interes_en_caso || 0,
        cierre_administrativo: stats.cierre_administrativo || 0,
        descartado: stats.descartado || 0,
      };

      setStageCounts(nextCounts);
      setStageCurrentPage({});
      setStagePageSize({});

      await Promise.all(
        Object.keys(STAGE_LABELS).map(async (stageKey) => {
          if (nextCounts[stageKey] > 0) {
            await fetchStagePage(stageKey, 1, DEFAULT_PAGE_SIZE);
          } else {
            setStageCases((prev) => ({ ...prev, [stageKey]: [] }));
          }
        })
      );
    } catch (error) {
      console.error("Error loading cases summary:", error);
    } finally {
      setLoadingCases(false);
    }
  }, [fetchStagePage]);

  const setPageSizeForStage = async (stageKey, size) => {
    setStagePageSize((prev) => ({ ...prev, [stageKey]: size }));
    await fetchStagePage(stageKey, 1, size);
  };

  const setPageForStage = async (stageKey, page) => {
    await fetchStagePage(stageKey, page, getStagePageSize(stageKey));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const statusRes = await api.get("/focus/traffic-light-status");
        setTrafficStatus(statusRes.data["pre-projects"] || "gray");
      } catch (error) {
        console.error("Error loading status:", error);
      }
    };

    loadData();
    refreshQuotesCases();
    loadCasesSummaryAndFirstPages();
  }, [refreshQuotesCases, loadCasesSummaryAndFirstPages]);

  const casesNeedingQuoteIds = new Set(quotesCases.map((c) => c.id));
  const totalCases = Object.keys(STAGE_LABELS).reduce((sum, key) => sum + getStageCount(key), 0);

  return (
    <SectionLayout
      title={SECTION.label}
          sectionId={SECTION.id}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={true}
      currentStatus={trafficStatus}
      icon={FileText}
    >
      <div className="space-y-6">
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-amber-400">Cotizaciones Pendientes</h2>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 ml-2">{quotesCases.length}</Badge>
          </div>
          <QuotesTabContent
            quotesCases={quotesCases}
            loadingQuotes={loadingQuotes}
            onRefresh={refreshQuotesCases}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-400" />
              Todos los Casos (Stage 3)
            </h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Crear Caso
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
                onClick={() => setAllStagesExpanded(false)}
              >
                Colapsar todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
                onClick={() => setAllStagesExpanded(true)}
              >
                Desplegar todos
              </Button>
              <Badge className="bg-slate-700 text-slate-300">{totalCases} casos</Badge>
            </div>
          </div>

          {loadingCases ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ff3300]"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(STAGE_LABELS).map(([stageKey, stageLabel]) => {
                const count = getStageCount(stageKey);
                const isStageExpanded = expandedStages[stageKey] ?? true;
                const pageSize = getStagePageSize(stageKey);
                const totalPages = Math.max(1, Math.ceil(count / pageSize));
                const currentPage = Math.min(stageCurrentPage[stageKey] || 1, totalPages);
                const pageStart = (currentPage - 1) * pageSize;
                const currentCases = stageCases[stageKey] || [];
                const isLoadingStage = !!stageLoading[stageKey];

                return (
                  <Collapsible
                    key={stageKey}
                    open={isStageExpanded}
                    onOpenChange={async (open) => {
                      setStageExpanded(stageKey, open);
                      if (open && currentCases.length === 0 && count > 0 && !isLoadingStage) {
                        await fetchStagePage(stageKey, 1, pageSize);
                      }
                    }}
                  >
                    <div className="space-y-2">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between px-3 py-2 h-auto bg-[#0d0d0d] border border-[#222] hover:bg-[#141414]"
                        >
                          <div className="flex items-center gap-2">
                            {isStageExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <Badge className={STAGE_COLORS[stageKey]}>{stageLabel}</Badge>
                            <span className="text-xs text-slate-400">({count})</span>
                          </div>
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="pt-1">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <div className="text-xs text-slate-400">
                              {count === 0
                                ? "0 resultados"
                                : `${pageStart + 1}-${Math.min(pageStart + currentCases.length, count)} de ${count}`}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Por página</span>
                              <select
                                value={pageSize}
                                onChange={(e) => setPageSizeForStage(stageKey, Number(e.target.value))}
                                className="bg-[#0f0f0f] border border-[#333] text-slate-200 text-xs rounded px-2 py-1"
                              >
                                {PAGE_SIZE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 border-[#333] text-slate-300"
                                onClick={() => setPageForStage(stageKey, Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1 || isLoadingStage}
                              >
                                Anterior
                              </Button>
                              <span className="text-xs text-slate-300 min-w-[54px] text-center">
                                {currentPage}/{totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 border-[#333] text-slate-300"
                                onClick={() => setPageForStage(stageKey, Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages || isLoadingStage}
                              >
                                Siguiente
                              </Button>
                            </div>
                          </div>

                          {isLoadingStage && (
                            <div className="text-sm text-slate-400 py-4 text-center border border-[#222] rounded-md">
                              Cargando...
                            </div>
                          )}

                          {!isLoadingStage && count === 0 && (
                            <div className="text-sm text-slate-500 py-4 text-center border border-[#222] rounded-md">
                              No hay casos en este estado
                            </div>
                          )}

                          {!isLoadingStage && currentCases.length > 0 && (
                            <div className="grid gap-2">
                              {currentCases.map((caseItem) => {
                                const needsQuote = casesNeedingQuoteIds.has(caseItem.id);
                                const isExpanded = expandedCases[caseItem.id];

                                return (
                                  <Collapsible
                                    key={caseItem.id}
                                    open={isExpanded}
                                    onOpenChange={(open) => setCaseExpanded(caseItem.id, open)}
                                  >
                                    <Card className={`bg-[#111] border ${needsQuote ? "border-amber-500/50" : "border-[#222]"}`}>
                                      <CollapsibleTrigger asChild>
                                        <CardContent className="p-3 cursor-pointer hover:bg-[#151515]">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                              )}
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-medium text-white">{caseItem.name || "Sin nombre"}</span>
                                                  {needsQuote && (
                                                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                                      <DollarSign className="w-3 h-3 mr-1" />
                                                      Cotización pendiente
                                                    </Badge>
                                                  )}
                                                  {caseItem.quotes?.length > 0 && (
                                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                                      {caseItem.quotes.length} cotización(es)
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                  {caseItem.company_names?.length > 0 && (
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                      <Building2 className="w-3 h-3" />
                                                      {caseItem.company_names[0]}
                                                    </span>
                                                  )}
                                                  {caseItem.contact_ids?.length > 0 && (
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                      <Users className="w-3 h-3" />
                                                      {caseItem.contact_ids.length} contactos
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {caseItem.hubspot_deal_url && (
                                                <a
                                                  href={caseItem.hubspot_deal_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-slate-400 hover:text-[#ff3300]"
                                                >
                                                  <ExternalLink className="w-4 h-4" />
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </CollapsibleTrigger>

                                      <CollapsibleContent>
                                        <div className="px-3 pb-3 pt-0 border-t border-[#222]">
                                          <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                              <span className="text-slate-500">Monto:</span>
                                              <span className="text-white ml-2">{formatCurrency(caseItem.amount, caseItem.currency)}</span>
                                            </div>
                                            <div>
                                              <span className="text-slate-500">Creado:</span>
                                              <span className="text-white ml-2">
                                                {caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString("es-MX") : "-"}
                                              </span>
                                            </div>
                                            {caseItem.quotes?.length > 0 && (
                                              <div className="col-span-2">
                                                <span className="text-slate-500">Cotizaciones:</span>
                                                <div className="mt-1 space-y-1">
                                                  {caseItem.quotes.map((quote, idx) => (
                                                    <a
                                                      key={idx}
                                                      href={quote.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="flex items-center gap-2 text-[#ff3300] hover:underline"
                                                    >
                                                      <FileText className="w-3 h-3" />
                                                      {quote.title || `Cotización ${idx + 1}`}
                                                    </a>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Card>
                                  </Collapsible>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}

              {totalCases === 0 && <div className="text-center py-8 text-slate-500">No hay casos en Stage 3</div>}
            </div>
          )}
        </div>
      </div>

      <CaseCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultStage="caso_solicitado"
        onCreated={() => loadCasesSummaryAndFirstPages()}
      />
    </SectionLayout>
  );
}
