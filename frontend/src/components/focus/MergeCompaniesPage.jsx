/**
 * MergeCompaniesPage - Focus section for reviewing and merging duplicate companies
 * 
 * Features:
 * - Weekly semaphore status
 * - List of duplicate domain candidates
 * - Merge or dismiss actions
 * - Weekly history tracker
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Building2,
  Merge,
  X,
  Loader2,
  RefreshCw,
  History,
  ChevronRight,
  Eye,
  Type,
  Percent
} from "lucide-react";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";

export default function MergeCompaniesPage({ onStatusChange }) {
  const section = getSectionById("merge-companies");
  
  const [semaphore, setSemaphore] = useState(null);
  const [preview, setPreview] = useState(null);
  const [weeklyHistory, setWeeklyHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processingDomain, setProcessingDomain] = useState(null);
  
  // Tab state for switching between domain and name candidates
  const [activeTab, setActiveTab] = useState("domain"); // "domain" | "similar-names"
  const [similarNames, setSimilarNames] = useState(null);
  
  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [primaryCompany, setPrimaryCompany] = useState(null);
  const [merging, setMerging] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [semaphoreRes, previewRes, similarNamesRes, historyRes] = await Promise.all([
        api.get("/companies/merge-candidates/semaphore"),
        api.get("/companies/auto-merge/preview?limit=50"),
        api.get("/companies/merge-candidates/similar-names?limit=50&min_similarity=85"),
        api.get("/companies/merge-candidates/weekly-history")
      ]);
      
      setSemaphore(semaphoreRes.data);
      
      // Transform domain groups to candidates format
      const groups = previewRes.data.groups || [];
      setPreview({
        ...previewRes.data,
        candidates: groups.map(g => ({
          domain: g.domain,
          matchType: "domain",
          company_count: g.company_count,
          companies: [
            g.primary,
            ...(g.secondaries || [])
          ].filter(Boolean)
        }))
      });
      
      // Transform similar names to same format
      const nameGroups = similarNamesRes.data.groups || [];
      setSimilarNames({
        ...similarNamesRes.data,
        candidates: nameGroups.map(g => ({
          normalizedName: g.normalized_name,
          matchType: g.match_type,
          similarityScore: g.similarity_score,
          company_count: g.company_count,
          companies: [
            g.primary,
            ...(g.secondaries || [])
          ].filter(Boolean)
        }))
      });
      
      setWeeklyHistory(historyRes.data);
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange(semaphoreRes.data.status);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  const handleDismiss = async (domain) => {
    setProcessingDomain(domain);
    try {
      await api.post("/companies/merge-candidates/dismiss", {
        domain,
        reason: "Manual dismiss from UI"
      });
      toast.success(`${domain} descartado`);
      await loadData();
    } catch (error) {
      console.error("Error dismissing candidate:", error);
      toast.error("Error al descartar");
    } finally {
      setProcessingDomain(null);
    }
  };

  const openMergeDialog = (candidate) => {
    setSelectedCandidate(candidate);
    // Set first company as primary by default
    setPrimaryCompany(candidate.companies[0]?.id || null);
    setMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!selectedCandidate || !primaryCompany) return;
    
    setMerging(true);
    try {
      // Get companies to merge (all except primary)
      const secondaryCompanies = selectedCandidate.companies
        .filter(c => c.id !== primaryCompany);
      
      // Merge each secondary into primary one by one
      for (const secondary of secondaryCompanies) {
        await api.post("/companies/merge", {
          primary_id: primaryCompany,
          secondary_id: secondary.id
        });
      }
      
      toast.success("Empresas combinadas exitosamente");
      setMergeDialogOpen(false);
      setSelectedCandidate(null);
      setPrimaryCompany(null);
      await loadData();
    } catch (error) {
      console.error("Error merging companies:", error);
      toast.error(error.response?.data?.detail || "Error al combinar");
    } finally {
      setMerging(false);
    }
  };

  const getSemaphoreColor = (status) => {
    switch (status) {
      case "green": return "bg-green-500";
      case "yellow": return "bg-yellow-500";
      case "red": return "bg-red-500";
      default: return "bg-slate-500";
    }
  };

  // Candidate Card component for both domain and name matches
  const CandidateCard = ({ candidate, type, onMerge, onDismiss, processing }) => {
    const identifier = type === "domain" ? candidate.domain : candidate.normalizedName;
    const icon = type === "domain" ? Globe : Type;
    const IconComponent = icon;
    
    return (
      <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#222] hover:border-[#333] transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <IconComponent className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-white">{identifier}</span>
              <Badge variant="outline" className="text-xs">
                {candidate.companies?.length || 0} empresas
              </Badge>
              {type === "name" && candidate.similarityScore && (
                <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
                  <Percent className="w-3 h-3 mr-1" />
                  {candidate.similarityScore}% similar
                </Badge>
              )}
              {type === "name" && candidate.matchType === "exact_normalized" && (
                <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                  Nombre idéntico
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              {candidate.companies?.slice(0, 4).map((company, cIdx) => (
                <div key={company.id || cIdx} className="flex items-center gap-2 text-sm text-slate-400">
                  <ChevronRight className="w-3 h-3" />
                  <span className="truncate">{company.name}</span>
                  {company.domain && type === "name" && (
                    <span className="text-xs text-slate-600 truncate">{company.domain}</span>
                  )}
                </div>
              ))}
              {candidate.companies?.length > 4 && (
                <p className="text-xs text-slate-500 ml-5">
                  +{candidate.companies.length - 4} más...
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onMerge}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              disabled={processing}
            >
              <Merge className="w-4 h-4 mr-1" />
              Combinar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <SectionLayout section={section} sectionId="merge-companies">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </SectionLayout>
    );
  }

  return (
    <SectionLayout section={section}>
      <div className="space-y-6">
        {/* Semaphore Status Card */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-3">
                <span className={`w-4 h-4 rounded-full ${getSemaphoreColor(semaphore?.status)}`} />
                Estado Semanal
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                className="border-[#333] text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                <p className="text-2xl font-bold text-white">{semaphore?.pending_count || 0}</p>
                <p className="text-xs text-slate-500">Por revisar</p>
              </div>
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                <p className="text-2xl font-bold text-green-400">{semaphore?.reviewed_this_week || 0}</p>
                <p className="text-xs text-slate-500">Revisados esta semana</p>
              </div>
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                <p className="text-2xl font-bold text-slate-400">S{semaphore?.iso_week}</p>
                <p className="text-xs text-slate-500">Semana actual</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Candidates List with Tabs */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Candidatos para Combinar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 bg-[#0a0a0a] mb-4">
                <TabsTrigger value="domain" className="data-[state=active]:bg-[#222] flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Por Dominio
                  {preview?.candidates?.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {preview.candidates.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="similar-names" className="data-[state=active]:bg-[#222] flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Nombres Similares
                  {similarNames?.candidates?.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {similarNames.candidates.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Domain Duplicates Tab */}
              <TabsContent value="domain">
                {!preview?.candidates || preview.candidates.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p className="text-slate-400">No hay duplicados de dominio pendientes</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {preview.candidates.map((candidate, idx) => (
                        <CandidateCard 
                          key={candidate.domain || idx}
                          candidate={candidate}
                          type="domain"
                          onMerge={() => openMergeDialog(candidate)}
                          onDismiss={() => handleDismiss(candidate.domain)}
                          processing={processingDomain === candidate.domain}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {/* Similar Names Tab */}
              <TabsContent value="similar-names">
                {!similarNames?.candidates || similarNames.candidates.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p className="text-slate-400">No hay nombres similares pendientes</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {similarNames.candidates.map((candidate, idx) => (
                        <CandidateCard 
                          key={candidate.normalizedName || idx}
                          candidate={candidate}
                          type="name"
                          onMerge={() => openMergeDialog(candidate)}
                          onDismiss={() => handleDismiss(candidate.normalizedName)}
                          processing={processingDomain === candidate.normalizedName}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Weekly History */}
        {weeklyHistory && (
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Historial Semanal {weeklyHistory.year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-10 gap-1">
                {weeklyHistory.weeks?.map((week) => {
                  const isCurrentWeek = week.week === weeklyHistory.current_week;
                  const hasActivity = week.reviewed_count > 0;
                  
                  return (
                    <div
                      key={week.week}
                      className={`
                        aspect-square rounded flex items-center justify-center text-xs
                        ${isCurrentWeek ? "ring-2 ring-blue-500" : ""}
                        ${hasActivity ? "bg-green-500/20 text-green-400" : "bg-[#0a0a0a] text-slate-600"}
                      `}
                      title={`Semana ${week.week}: ${week.reviewed_count} revisados`}
                    >
                      {week.reviewed_count > 0 ? week.reviewed_count : week.week}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Cada cuadro representa una semana. Verde = actividad registrada.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-green-400" />
              Combinar Empresas
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Selecciona la empresa principal. Las demás serán combinadas en ella.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCandidate && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-slate-400">
                Dominio: <span className="text-white font-medium">{selectedCandidate.domain}</span>
              </p>
              <div className="space-y-2">
                {selectedCandidate.companies?.map((company) => (
                  <div
                    key={company.id}
                    onClick={() => setPrimaryCompany(company.id)}
                    className={`
                      p-3 rounded-lg border cursor-pointer transition-all
                      ${primaryCompany === company.id
                        ? "bg-green-500/10 border-green-500/50 text-white"
                        : "bg-[#0a0a0a] border-[#222] text-slate-400 hover:border-[#333]"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{company.name}</p>
                        {company.domain && (
                          <p className="text-xs text-slate-500">{company.domain}</p>
                        )}
                      </div>
                      {primaryCompany === company.id && (
                        <Badge className="bg-green-500/20 text-green-400 border-0">
                          Principal
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMergeDialogOpen(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!primaryCompany || merging}
              className="bg-green-600 hover:bg-green-700"
            >
              {merging ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Merge className="w-4 h-4 mr-2" />
              )}
              Combinar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionLayout>
  );
}
