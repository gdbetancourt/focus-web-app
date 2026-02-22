/**
 * URL Migration Component
 * Allows migrating LinkedIn URN URLs to clean vanity URLs using Apify
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import api from "../lib/api";
import {
  RefreshCw,
  Link2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  DollarSign,
} from "lucide-react";

export function UrlMigrationCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/position-search/url-migration/status");
      setStatus(res.data);
      
      // If migration in progress, start polling
      if (res.data.migration_in_progress && !polling) {
        setPolling(true);
      } else if (!res.data.migration_in_progress && polling) {
        setPolling(false);
      }
    } catch (error) {
      console.error("Error loading migration status:", error);
    } finally {
      setLoading(false);
    }
  }, [polling]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Poll for updates when migration is in progress
  useEffect(() => {
    if (!polling) return;
    
    const interval = setInterval(() => {
      loadStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [polling, loadStatus]);

  const startMigration = async (limit = null) => {
    setStarting(true);
    try {
      const params = limit ? { limit } : {};
      const res = await api.post("/position-search/url-migration/start", null, { params });
      toast.success(res.data.message);
      loadStatus();
    } catch (error) {
      console.error("Error starting migration:", error);
      toast.error(error.response?.data?.detail || "Error al iniciar migración");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const urnCount = status?.urn_urls_count || 0;
  const cleanCount = status?.clean_urls_count || 0;
  const migrationJob = status?.migration_job;
  const inProgress = status?.migration_in_progress;

  const estimatedCost = (urnCount * 0.004).toFixed(2);

  return (
    <Card className="bg-[#111] border-[#222]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-400" />
          Migración de URLs de LinkedIn
        </CardTitle>
        <CardDescription className="text-slate-400">
          Convertir URLs con formato URN (ACwAAA...) a URLs limpias (/in/nombre)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#222]">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-slate-400">URLs con URN</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">{urnCount}</p>
          </div>
          <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#222]">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-slate-400">URLs limpias</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{cleanCount}</p>
          </div>
        </div>

        {/* Migration Progress */}
        {inProgress && migrationJob && (
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Migración en progreso (búsqueda por nombre)...
              </span>
              <span className="text-sm text-slate-400">
                {migrationJob.processed}/{migrationJob.total}
              </span>
            </div>
            <Progress 
              value={(migrationJob.processed / migrationJob.total) * 100} 
              className="h-2"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                Migrados: {migrationJob.migrated}
              </span>
              <span className="flex items-center gap-1 text-yellow-400">
                Omitidos: {migrationJob.skipped || 0}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-400" />
                Fallidos: {migrationJob.failed}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Buscando perfiles por nombre y validando empresa...
            </p>
          </div>
        )}

        {/* Completed Job Summary */}
        {!inProgress && migrationJob && migrationJob.status === "completed" && (
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Última migración completada</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Total:</span>
                <span className="text-white ml-1">{migrationJob.total}</span>
              </div>
              <div>
                <span className="text-slate-500">Migrados:</span>
                <span className="text-green-400 ml-1">{migrationJob.migrated}</span>
              </div>
              <div>
                <span className="text-slate-500">Omitidos:</span>
                <span className="text-yellow-400 ml-1">{migrationJob.skipped || 0}</span>
              </div>
              <div>
                <span className="text-slate-500">Fallidos:</span>
                <span className="text-red-400 ml-1">{migrationJob.failed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {urnCount > 0 && !inProgress && (
          <div className="pt-4 border-t border-[#222]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Costo estimado: <span className="text-white font-medium">${estimatedCost} USD</span>
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Búsqueda por nombre + validación empresa (~$0.008/perfil)
                </p>
              </div>
              
              <div className="flex gap-2">
                {/* Test with 10 */}
                <Button 
                  variant="outline"
                  className="border-[#333]"
                  disabled={starting}
                  onClick={() => startMigration(10)}
                >
                  {starting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Probar (10)
                </Button>
                
                {/* Full migration */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={starting}
                    >
                      {starting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Migrar Todo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#111] border-[#222]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">¿Iniciar migración completa?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        Esta acción buscará {urnCount} contactos por nombre en LinkedIn.
                        <br /><br />
                        <strong className="text-white">Costo estimado: ${estimatedCost} USD</strong>
                        <br /><br />
                        <strong className="text-yellow-400">Tiempo estimado: ~{Math.ceil(urnCount * 10 / 60)} minutos</strong>
                        <br /><br />
                        El proceso se ejecutará en segundo plano.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-[#333]">Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => startMigration()}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Confirmar e Iniciar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        )}

        {/* All clean message */}
        {urnCount === 0 && (
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-400 font-medium">¡Todas las URLs están limpias!</p>
            <p className="text-sm text-slate-500">No hay URLs con formato URN para migrar</p>
          </div>
        )}

        {/* Refresh button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadStatus}
          className="w-full border-[#333]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar Estado
        </Button>
      </CardContent>
    </Card>
  );
}

export default UrlMigrationCard;
