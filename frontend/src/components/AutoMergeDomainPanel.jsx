/**
 * AutoMergeDomainPanel - Component for managing automatic domain-based company merging
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
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
  AlertTriangle, 
  CheckCircle2, 
  Globe, 
  Building2, 
  Merge, 
  Play, 
  Eye, 
  Loader2,
  RefreshCw,
  History,
  BarChart3
} from "lucide-react";
import api from "../lib/api";

export function AutoMergeDomainPanel() {
  const [stats, setStats] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningMerge, setRunningMerge] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get("/companies/auto-merge/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get("/companies/auto-merge/preview?limit=20");
      setPreview(res.data);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Error cargando preview");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get("/companies/auto-merge/history?limit=5");
      setHistory(res.data.operations || []);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const runDryRun = async () => {
    setRunningMerge(true);
    try {
      const res = await api.post("/companies/auto-merge/run", {
        max_merges: 50,
        dry_run: true
      });
      setDryRunResult(res.data);
      setConfirmDialogOpen(true);
    } catch (error) {
      console.error("Error running dry run:", error);
      toast.error("Error ejecutando preview");
    } finally {
      setRunningMerge(false);
    }
  };

  const executeRealMerge = async () => {
    setRunningMerge(true);
    setConfirmDialogOpen(false);
    try {
      const res = await api.post("/companies/auto-merge/run", {
        max_merges: 50,
        dry_run: false
      });
      toast.success("Auto-merge iniciado en segundo plano");
      // Refresh after a delay
      setTimeout(() => {
        loadStats();
        loadHistory();
      }, 3000);
    } catch (error) {
      console.error("Error running merge:", error);
      toast.error("Error ejecutando merge");
    } finally {
      setRunningMerge(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="auto-merge-panel">
      {/* Stats Card */}
      <Card className="bg-[#111111] border-[#222222]" data-testid="auto-merge-stats-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-500" />
              <CardTitle className="text-white text-lg">Auto-Merge por Dominio</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStats}
              className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <CardDescription className="text-slate-400">
            Detecta y combina automáticamente empresas con dominios duplicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#222]">
                <p className="text-2xl font-bold text-white">{stats.duplicate_domain_groups}</p>
                <p className="text-sm text-slate-400">Dominios duplicados</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#222]">
                <p className="text-2xl font-bold text-yellow-500">{stats.total_companies_with_duplicates}</p>
                <p className="text-sm text-slate-400">Empresas afectadas</p>
              </div>
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#222]">
                <p className="text-2xl font-bold text-cyan-500">{stats.potential_merges}</p>
                <p className="text-sm text-slate-400">Merges posibles</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando estadísticas...
            </div>
          )}

          {/* Top duplicate domains */}
          {stats?.top_duplicate_domains?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-300 mb-2">Top dominios duplicados:</p>
              <div className="flex flex-wrap gap-2">
                {stats.top_duplicate_domains.slice(0, 5).map((item) => (
                  <Badge 
                    key={item.domain} 
                    className="bg-[#1a1a1a] text-slate-300 border border-[#333] hover:bg-[#222]"
                  >
                    <Globe className="w-3 h-3 mr-1" />
                    {item.domain} ({item.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#222]">
            <Button
              variant="outline"
              onClick={loadPreview}
              disabled={loading}
              className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
              data-testid="preview-btn"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Ver Preview
            </Button>
            <Button
              variant="outline"
              onClick={loadHistory}
              className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
              data-testid="history-btn"
            >
              <History className="w-4 h-4 mr-2" />
              Historial
            </Button>
            <Button
              onClick={runDryRun}
              disabled={runningMerge || !stats?.potential_merges}
              className="bg-yellow-600 hover:bg-yellow-700 text-white ml-auto"
              data-testid="execute-auto-merge-btn"
            >
              {runningMerge ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Ejecutar Auto-Merge
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Results */}
      {preview && (
        <Card className="bg-[#111111] border-[#222222]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">
              Preview: {preview.duplicate_domain_groups} grupos de dominios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-slate-400">Dominio</TableHead>
                    <TableHead className="text-slate-400">Empresas</TableHead>
                    <TableHead className="text-slate-400">Principal</TableHead>
                    <TableHead className="text-slate-400">A combinar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.groups.map((group) => (
                    <TableRow key={group.domain} className="border-[#222]">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-slate-500" />
                          <span className="text-cyan-400">{group.domain}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-900/30 text-yellow-400 border-0">
                          {group.company_count}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {group.primary && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-green-500" />
                            <span className="text-white">{group.primary.name}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {group.secondaries.slice(0, 3).map((s, idx) => (
                            <Badge 
                              key={`${s.id}-${idx}`} 
                              className="bg-red-900/30 text-red-400 border-0 text-xs"
                            >
                              {s.name?.substring(0, 20)}{s.name?.length > 20 ? '...' : ''}
                            </Badge>
                          ))}
                          {group.secondaries.length > 3 && (
                            <Badge className="bg-slate-800 text-slate-400 border-0 text-xs">
                              +{group.secondaries.length - 3} más
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="bg-[#111111] border-[#222222]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">Historial de Auto-Merge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((op) => (
                <div 
                  key={op.operation_id} 
                  className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#222]"
                >
                  <div className="flex items-center gap-3">
                    {op.dry_run ? (
                      <Eye className="w-4 h-4 text-blue-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                    <div>
                      <p className="text-white text-sm">
                        {op.merges_performed} merges {op.dry_run ? "(preview)" : "completados"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(op.run_at).toLocaleString('es-MX')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">
                      {op.total_contacts_updated} contactos, {op.total_cases_updated} casos
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="bg-[#111111] border-[#222222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="w-5 h-5 text-yellow-500" />
              Confirmar Auto-Merge
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Revisa los resultados del preview antes de ejecutar
            </DialogDescription>
          </DialogHeader>
          
          {dryRunResult && (
            <div className="space-y-4">
              {/* Warning */}
              <div className="p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-yellow-400 font-medium">Esta acción no se puede deshacer</p>
                    <p className="text-slate-400 mt-1">
                      Las empresas duplicadas se fusionarán permanentemente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0a0a] rounded-lg p-3 border border-[#222]">
                  <p className="text-xl font-bold text-cyan-400">{dryRunResult.merges_performed}</p>
                  <p className="text-xs text-slate-400">Merges a realizar</p>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-3 border border-[#222]">
                  <p className="text-xl font-bold text-yellow-400">{dryRunResult.total_contacts_updated}</p>
                  <p className="text-xs text-slate-400">Contactos a actualizar</p>
                </div>
              </div>

              {/* Sample merges */}
              {dryRunResult.merge_details?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">Ejemplo de merges:</p>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-2">
                      {dryRunResult.merge_details.slice(0, 5).map((merge, idx) => (
                        <div key={`merge-${idx}`} className="flex items-center gap-2 text-sm">
                          <Badge className="bg-red-900/30 text-red-400 border-0 text-xs">
                            {merge.secondary_name?.substring(0, 15)}...
                          </Badge>
                          <span className="text-slate-500">→</span>
                          <Badge className="bg-green-900/30 text-green-400 border-0 text-xs">
                            {merge.primary_name?.substring(0, 15)}...
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialogOpen(false)}
              className="border-[#333333] text-slate-300 hover:bg-[#1a1a1a]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={executeRealMerge}
              disabled={runningMerge}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {runningMerge ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Merge className="w-4 h-4 mr-2" />
                  Ejecutar Merge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
