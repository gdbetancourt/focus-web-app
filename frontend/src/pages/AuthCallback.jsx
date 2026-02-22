import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setGoogleUser, checkAuth } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          setError("No se encontró el token de sesión");
          setTimeout(() => navigate("/", { replace: true }), 2000);
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Exchange session_id for user session
        const response = await api.post("/auth/google/session", 
          { session_id: sessionId },
          { withCredentials: true }
        );

        if (response.data?.success && response.data?.user) {
          // Set user in context directly - this avoids needing refresh
          setGoogleUser(response.data.user);
          toast.success(`¡Bienvenido, ${response.data.user?.name || 'Usuario'}!`);
          // Clear the hash fragment and navigate to home
          // Using window.location to ensure hash is cleared (navigate doesn't clear hash)
          window.history.replaceState(null, '', '/');
          navigate("/", { replace: true });
        } else {
          throw new Error("Error al procesar la sesión");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        const message = err.response?.data?.detail || "Error de autenticación";
        setError(message);
        toast.error(message);
        setTimeout(() => navigate("/", { replace: true }), 3000);
      }
    };

    processAuth();
  }, [location, navigate, setGoogleUser]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, hsl(220, 25%, 4%) 0%, hsl(220, 20%, 8%) 50%, hsl(14, 30%, 8%) 100%)'
      }}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-2">{error}</p>
          <p className="text-slate-500 text-sm">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, hsl(220, 25%, 4%) 0%, hsl(220, 20%, 8%) 50%, hsl(14, 30%, 8%) 100%)'
    }}>
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300] mx-auto mb-4" />
        <p className="text-slate-400">Procesando autenticación...</p>
      </div>
    </div>
  );
}
