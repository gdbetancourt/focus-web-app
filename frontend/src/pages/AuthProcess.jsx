/**
 * AuthProcess - Processes OAuth callback token and sets session cookie
 * This page is shown briefly after Google OAuth redirect
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../lib/api';

export default function AuthProcess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('Iniciando...');
  
  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/';
    
    console.log('[AuthProcess] Starting with token:', token ? 'present' : 'missing');
    console.log('[AuthProcess] Redirect target:', redirect);
    
    if (!token) {
      setError('No se recibió token de autenticación');
      setStatus('Error: sin token');
      setTimeout(() => navigate('/'), 3000);
      return;
    }
    
    setStatus('Estableciendo sesión...');
    
    // Call backend to set the session cookie
    api.post('/auth/set-session', { token }, { withCredentials: true })
      .then(response => {
        console.log('[AuthProcess] Set-session response:', response.data);
        if (response.data.success) {
          setStatus('Sesión establecida, redirigiendo...');
          // Use window.location for full page reload to ensure cookie is sent
          window.location.href = redirect;
        } else {
          setError('Error al establecer la sesión');
          setStatus('Error en respuesta');
          setTimeout(() => navigate('/'), 3000);
        }
      })
      .catch(err => {
        console.error('[AuthProcess] Error:', err);
        console.error('[AuthProcess] Error response:', err.response?.data);
        setError(err.response?.data?.detail || 'Error al procesar la autenticación');
        setStatus('Error: ' + (err.response?.data?.detail || err.message));
        setTimeout(() => navigate('/'), 3000);
      });
  }, [searchParams, navigate]);
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="text-red-500">
            <p className="text-xl mb-2">{error}</p>
            <p className="text-gray-400 text-sm">Redirigiendo...</p>
          </div>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-white text-lg">Procesando autenticación...</p>
            <p className="text-gray-400 text-sm mt-2">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
