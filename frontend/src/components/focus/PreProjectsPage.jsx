/**
 * PreProjectsPage - Eleventh section in the Focus system (Daily)
 * 
 * Shows all Stage 3 cases with special emphasis on pending quotes.
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { QuotesTabContent } from "../todays-focus/QuotesTabContent";
import { FileText, Briefcase, DollarSign, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, ExternalLink, Building2, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import api from "../../lib/api";

const SECTION = getSectionById("pre-projects");

// Stage labels for Stage 3 cases
const STAGE_LABELS = {
  caso_solicitado: "Caso Solicitado",
  caso_presentado: "Caso Presentado",
  interes_en_caso: "Interés en Caso",
  cierre_administrativo: "En Cierre Administrativo"
};

const STAGE_COLORS = {
  caso_solicitado: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  caso_presentado: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  interes_en_caso: "bg-green-500/20 text-green-400 border-green-500/50",
  cierre_administrativo: "bg-amber-500/20 text-amber-400 border-amber-500/50"
};

export default function PreProjectsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [quotesCases, setQuotesCases] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  
  // All Stage 3 cases
  const [allCases, setAllCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [expandedCases, setExpandedCases] = useState({});

  const formatCurrency = (amount, currency = "MXN") => {
    if (!amount) return "-";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
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

  const loadAllCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const res = await api.get("/cases/");
      // Filter to only active cases (Stage 3)
      const activeCases = (res.data.cases || []).filter(c => c.status === 'active');
      setAllCases(activeCases);
    } catch (error) {
      console.error("Error loading cases:", error);
    } finally {
      setLoadingCases(false);
    }
  }, []);

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
    loadAllCases();
  }, [refreshQuotesCases, loadAllCases]);

  // Get IDs of cases that need quotes
  const casesNeedingQuoteIds = new Set(quotesCases.map(c => c.id));

  // Group cases by stage
  const casesByStage = allCases.reduce((acc, c) => {
    const stage = c.stage || 'caso_solicitado';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(c);
    return acc;
  }, {});

  const toggleCase = (caseId) => {
    setExpandedCases(prev => ({ ...prev, [caseId]: !prev[caseId] }));
  };

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={true}
      currentStatus={trafficStatus}
      icon={FileText}
    >
      <div className="space-y-6">
        {/* Pending Quotes Section - Highlighted */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-amber-400">Cotizaciones Pendientes</h2>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 ml-2">
              {quotesCases.length}
            </Badge>
          </div>
          <QuotesTabContent
            quotesCases={quotesCases}
            loadingQuotes={loadingQuotes}
            onRefresh={refreshQuotesCases}
            formatCurrency={formatCurrency}
          />
        </div>

        {/* All Stage 3 Cases */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-400" />
              Todos los Casos (Stage 3)
            </h2>
            <Badge className="bg-slate-700 text-slate-300">
              {allCases.length} casos activos
            </Badge>
          </div>

          {loadingCases ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#ff3300]"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(STAGE_LABELS).map(([stageKey, stageLabel]) => {
                const stageCases = casesByStage[stageKey] || [];
                if (stageCases.length === 0) return null;

                return (
                  <div key={stageKey} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={STAGE_COLORS[stageKey]}>
                        {stageLabel}
                      </Badge>
                      <span className="text-xs text-slate-500">({stageCases.length})</span>
                    </div>

                    <div className="grid gap-2">
                      {stageCases.map((caseItem) => {
                        const needsQuote = casesNeedingQuoteIds.has(caseItem.id);
                        const isExpanded = expandedCases[caseItem.id];

                        return (
                          <Collapsible key={caseItem.id} open={isExpanded} onOpenChange={() => toggleCase(caseItem.id)}>
                            <Card className={`bg-[#111] border ${needsQuote ? 'border-amber-500/50' : 'border-[#222]'}`}>
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
                                          <span className="text-sm font-medium text-white">
                                            {caseItem.name || 'Sin nombre'}
                                          </span>
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
                                      <span className="text-white ml-2">
                                        {formatCurrency(caseItem.amount, caseItem.currency)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-slate-500">Creado:</span>
                                      <span className="text-white ml-2">
                                        {caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString('es-MX') : '-'}
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
                  </div>
                );
              })}

              {allCases.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No hay casos activos en Stage 3
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SectionLayout>
  );
}
