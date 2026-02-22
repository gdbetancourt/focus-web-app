import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function GmailCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Conectando...");

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus("error");
      setMessage("Autorización cancelada o denegada");
      setTimeout(() => navigate('/settings'), 3000);
      return;
    }

    if (code && state) {
      handleCallback(code, state);
    } else {
      setStatus("error");
      setMessage("Parámetros de OAuth inválidos");
      setTimeout(() => navigate('/settings'), 3000);
    }
  }, [searchParams, navigate]);

  const handleCallback = async (code, state) => {
    try {
      // Check if it's a Drive callback based on state prefix
      if (state && state.startsWith('drive_')) {
        setMessage("Conectando con Google Drive...");
        const response = await api.post("/drive/callback", { code, state });
        setStatus("success");
        setMessage(response.data.message);
        toast.success("Google Drive conectado exitosamente");
        setTimeout(() => navigate('/settings'), 2000);
        return;
      }
      
      // Default to Gmail/Calendar callback
      setMessage("Conectando con Gmail...");
      const response = await api.post(`/gmail/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
      setStatus("success");
      setMessage(response.data.message);
      toast.success("Conectado exitosamente");
      setTimeout(() => navigate('/settings'), 2000);
    } catch (error) {
      setStatus("error");
      const errorMsg = error.response?.data?.detail || "Error de conexión";
      setMessage(errorMsg);
      toast.error(errorMsg);
      setTimeout(() => navigate('/settings'), 3000);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {status === "processing" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-orange-500 animate-spin" />
              <h2 className="text-xl font-bold text-white mb-2">Conectando</h2>
              <p className="text-slate-500">{message}</p>
            </>
          )}
          
          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
              <h2 className="text-xl font-bold text-white mb-2">¡Conexión exitosa!</h2>
              <p className="text-slate-500">{message}</p>
              <p className="text-sm text-slate-400 mt-4">Redirigiendo a configuración...</p>
            </>
          )}
          
          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-bold text-white mb-2">Error de conexión</h2>
              <p className="text-slate-500">{message}</p>
              <p className="text-sm text-slate-400 mt-4">Redirigiendo a configuración...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
