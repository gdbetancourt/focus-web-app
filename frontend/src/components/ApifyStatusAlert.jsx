import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import api from "../lib/api";

/**
 * ApifyStatusAlert - Displays Apify account status and available credits
 * Use in modules 1.1.1.1, 1.1.1.2, 1.1.1.3 that depend on Apify
 */
export default function ApifyStatusAlert({ onStatusChange }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkApifyStatus();
  }, []);

  const checkApifyStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get("/attract/apify/status");
      setStatus(res.data);
      if (onStatusChange) {
        onStatusChange(res.data);
      }
    } catch (error) {
      console.error("Error checking Apify status:", error);
      setStatus({
        connected: false,
        error: "Error connecting to Apify",
        credits_available: false
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm p-3 bg-[#111] rounded-lg border border-[#222]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Verificando estado de Apify...
      </div>
    );
  }

  if (!status) return null;

  // Not connected or error
  if (!status.connected) {
    return (
      <Alert className="bg-red-500/10 border-red-500/30">
        <XCircle className="w-4 h-4 text-red-400" />
        <AlertTitle className="text-red-400">Apify No Conectado</AlertTitle>
        <AlertDescription className="text-red-300/70">
          {status.error || "No se pudo conectar con Apify. Configura el token en Settings."}
        </AlertDescription>
      </Alert>
    );
  }

  // Connected but low credits
  if (!status.credits_available) {
    return (
      <Alert className="bg-yellow-500/10 border-yellow-500/30">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        <AlertTitle className="text-yellow-400 flex items-center gap-2">
          Créditos Apify Bajos
          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
            ${status.remaining_usd?.toFixed(2) || '0.00'} disponibles
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-yellow-300/70">
          Plan: {status.plan_name} • Usado: ${status.usage_monthly_usd?.toFixed(2)} / ${status.monthly_limit_usd}
        </AlertDescription>
      </Alert>
    );
  }

  // Connected with credits available
  return (
    <Alert className="bg-green-500/10 border-green-500/30">
      <CheckCircle className="w-4 h-4 text-green-400" />
      <AlertTitle className="text-green-400 flex items-center gap-2">
        Apify Activo
        <Badge variant="outline" className="border-green-500/30 text-green-400">
          ${status.remaining_usd?.toFixed(2)} disponibles
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkApifyStatus}
          className="ml-auto h-6 w-6 p-0 text-green-400 hover:text-green-300"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </AlertTitle>
      <AlertDescription className="text-green-300/70">
        {status.username} • Plan: {status.plan_name} • Usado: ${status.usage_monthly_usd?.toFixed(2)} de ${status.monthly_limit_usd}
      </AlertDescription>
    </Alert>
  );
}
