import React, { useState, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

// Language Context for public pages
const LanguageContext = createContext({ lang: 'es', setLang: () => {} });
export const usePublicLanguage = () => useContext(LanguageContext);

/**
 * Public Layout - Header and Footer for public-facing pages
 * Used by: Legal, Blog, Events, Muro, Learn pages, Programs
 */
export default function PublicLayout({ children }) {
  const navigate = useNavigate();
  const [lang, setLang] = useState('es');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#222]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/public" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Leaderlix</span>
            </Link>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/public" className="text-gray-400 hover:text-white transition-colors">
                Inicio
              </Link>
              <Link to="/learn" className="text-gray-400 hover:text-white transition-colors">
                Cursos
              </Link>
              <Link to="/blog" className="text-gray-400 hover:text-white transition-colors">
                Blog
              </Link>
              <Link to="/muro" className="text-gray-400 hover:text-white transition-colors">
                Testimonios
              </Link>
            </div>
            
            {/* Language Selector + Sign In */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#111] border border-[#333] rounded-lg p-0.5">
                <button
                  onClick={() => setLang('es')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    lang === 'es' 
                      ? 'bg-orange-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ES
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    lang === 'en' 
                      ? 'bg-orange-500 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>
              <Button
                onClick={() => navigate('/public')}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
              >
                {lang === 'es' ? 'Iniciar Sesión' : 'Sign In'}
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content with Language Context */}
      <LanguageContext.Provider value={{ lang, setLang }}>
        <main className="flex-1">
          {children}
        </main>
      </LanguageContext.Provider>
      
      {/* Footer */}
      <footer className="py-8 border-t border-[#222] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/public" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Leaderlix</span>
            </Link>
            
            <p className="text-sm text-gray-500">
              © 2026 Leaderlix. Todos los derechos reservados.
            </p>
            
            <div className="flex gap-4 text-sm">
              <Link to="/legal" className="text-gray-500 hover:text-white transition-colors">
                Privacidad
              </Link>
              <Link to="/legal" className="text-gray-500 hover:text-white transition-colors">
                Términos
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
