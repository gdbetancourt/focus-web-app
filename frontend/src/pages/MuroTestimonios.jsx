import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Star,
  Quote,
  Video,
  RefreshCw,
  Filter,
  Play,
  ArrowLeft,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import PublicLayout from "../components/PublicLayout";

// Anti-copy styles
const antiCopyStyles = {
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
};

export default function MuroTestimonios() {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState("_all");
  const [selectedFormato, setSelectedFormato] = useState("_all");
  const [selectedTestimonial, setSelectedTestimonial] = useState(null);
  const [options, setOptions] = useState({ industries: [], formatos: [] });

  // Prevent right-click context menu on testimonial content
  const handleContextMenu = (e) => {
    e.preventDefault();
    return false;
  };

  // Prevent copy keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent Ctrl+C, Ctrl+A, Ctrl+X
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'x'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch public testimonials (no auth required, no credentials)
      const [testimonialsRes, optionsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/testimonials/public?limit=50`)
          .then(r => r.json()),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/testimonials/public/options`)
          .then(r => r.json())
          .catch(() => ({ industries: [], formatos: [] })),
      ]);

      setTestimonials(testimonialsRes.testimonials || []);
      // Remove duplicates from formatos by name
      const seenNames = new Set();
      const uniqueFormatos = (optionsRes?.formatos || []).filter(f => {
        if (seenNames.has(f.name)) return false;
        seenNames.add(f.name);
        return true;
      });
      setOptions({
        industries: optionsRes?.industries || [],
        formatos: uniqueFormatos,
      });
    } catch (error) {
      console.error("Error loading testimonials:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTestimonials = testimonials.filter((t) => {
    if (selectedIndustry !== "_all" && t.industria_id !== selectedIndustry)
      return false;
    if (selectedFormato !== "_all" && t.formato_id !== selectedFormato)
      return false;
    return true;
  });

  const renderStars = (rating) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-slate-600"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10]">
      {/* SEO: noindex to prevent search engine indexing */}
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <title>Testimonios | Leaderlix</title>
      </Helmet>
      
      {/* Header */}
      <header className="bg-[#111] border-b border-[#222] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Muro de Testimonios
                </h1>
                <p className="text-sm text-slate-500">
                  Lo que dicen nuestros clientes
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-[#333]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Industria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas las industrias</SelectItem>
                  {options.industries.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedFormato} onValueChange={setSelectedFormato}>
                <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-[#333]">
                  <SelectValue placeholder="Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos los formatos</SelectItem>
                  {options.formatos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="flex items-center gap-4 mb-8">
          <Badge className="bg-[#ff3300]/20 text-[#ff3300] border-0">
            {filteredTestimonials.length} testimonios
          </Badge>
          {selectedIndustry !== "_all" && (
            <Badge
              variant="outline"
              className="border-[#333] cursor-pointer"
              onClick={() => setSelectedIndustry("_all")}
            >
              {options.industries.find((i) => i.id === selectedIndustry)?.name}{" "}
              ×
            </Badge>
          )}
          {selectedFormato !== "_all" && (
            <Badge
              variant="outline"
              className="border-[#333] cursor-pointer"
              onClick={() => setSelectedFormato("_all")}
            >
              {options.formatos.find((f) => f.id === selectedFormato)?.name} ×
            </Badge>
          )}
        </div>

        {/* Testimonials Grid */}
        {filteredTestimonials.length === 0 ? (
          <div className="text-center py-20">
            <Quote className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-white mb-2">
              No hay testimonios
            </h3>
            <p className="text-slate-400">
              {testimonials.length > 0
                ? "Ajusta los filtros para ver más resultados"
                : "Aún no hay testimonios publicados"}
            </p>
          </div>
        ) : (
          <div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            onContextMenu={handleContextMenu}
            style={antiCopyStyles}
          >
            {filteredTestimonials.map((testimonial) => (
              <Card
                key={testimonial.id}
                className="bg-[#111] border-[#222] hover:border-[#ff3300]/50 transition-colors cursor-pointer select-none"
                onClick={() => setSelectedTestimonial(testimonial)}
                onContextMenu={handleContextMenu}
              >
                <CardContent className="p-6" style={antiCopyStyles}>
                  {/* Quote */}
                  <div className="relative mb-4">
                    <Quote className="absolute -top-2 -left-2 w-8 h-8 text-[#ff3300]/20" />
                    <p className="text-slate-300 pl-6 line-clamp-4 italic select-none" style={antiCopyStyles}>
                      &ldquo;{testimonial.testimonio}&rdquo;
                    </p>
                  </div>

                  {/* Author */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#222]">
                    <div>
                      <p className="font-semibold text-white">
                        {testimonial.nombre}{" "}
                        {testimonial.apellido && testimonial.apellido}
                      </p>
                      {/* Cargo y Empresa */}
                      {(testimonial.cargo || testimonial.empresa) && (
                        <p className="text-sm text-slate-400">
                          {testimonial.cargo}
                          {testimonial.cargo && testimonial.empresa && " · "}
                          {testimonial.empresa}
                        </p>
                      )}
                      {testimonial.industria_name && (
                        <p className="text-xs text-slate-500">
                          {testimonial.industria_name}
                        </p>
                      )}
                    </div>

                    {/* Ratings */}
                    <div className="flex flex-col items-end gap-1">
                      {testimonial.rating_resultados &&
                        renderStars(testimonial.rating_resultados)}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {testimonial.formato_name && (
                      <Badge
                        variant="outline"
                        className="border-[#333] text-xs text-slate-400"
                      >
                        {testimonial.formato_name}
                      </Badge>
                    )}
                    {testimonial.programa_name && (
                      <Badge
                        variant="outline"
                        className="border-[#333] text-xs text-slate-400"
                      >
                        {testimonial.programa_name}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#111] border-t border-[#222] py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Leaderlix. Todos los derechos
            reservados.
          </p>
        </div>
      </footer>

      {/* Testimonial Detail Modal */}
      {selectedTestimonial && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTestimonial(null)}
          onContextMenu={handleContextMenu}
        >
          <div 
            className="bg-[#111] border border-[#333] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto select-none"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={handleContextMenu}
            style={antiCopyStyles}
          >
            <div className="p-6 border-b border-[#222]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Testimonio</h2>
                <button 
                  onClick={() => setSelectedTestimonial(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6" style={antiCopyStyles}>
              {/* Full Quote - Protected */}
              <div className="relative mb-6">
                <Quote className="absolute -top-2 -left-2 w-12 h-12 text-[#ff3300]/20" />
                <p className="text-lg text-slate-200 pl-10 italic leading-relaxed select-none" style={antiCopyStyles}>
                  &ldquo;{selectedTestimonial.testimonio}&rdquo;
                </p>
              </div>
              
              {/* Author Info */}
              <div className="bg-[#0a0a0a] rounded-lg p-4 mb-4">
                <p className="text-lg font-semibold text-white">
                  {selectedTestimonial.nombre} {selectedTestimonial.apellido}
                </p>
                {(selectedTestimonial.cargo || selectedTestimonial.empresa) && (
                  <p className="text-slate-400">
                    {selectedTestimonial.cargo}
                    {selectedTestimonial.cargo && selectedTestimonial.empresa && " en "}
                    <span className="text-slate-300">{selectedTestimonial.empresa}</span>
                  </p>
                )}
                {selectedTestimonial.industria_name && (
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedTestimonial.industria_name}
                  </p>
                )}
              </div>
              
              {/* Ratings */}
              {selectedTestimonial.rating_resultados && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-slate-400">Calificación:</span>
                  {renderStars(selectedTestimonial.rating_resultados)}
                </div>
              )}
              
              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {selectedTestimonial.formato_name && (
                  <Badge variant="outline" className="border-[#ff3300]/50 text-[#ff3300]">
                    {selectedTestimonial.formato_name}
                  </Badge>
                )}
                {selectedTestimonial.programa_name && (
                  <Badge variant="outline" className="border-[#333]">
                    {selectedTestimonial.programa_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
