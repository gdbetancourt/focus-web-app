import { useEffect, useState } from "react";
import { Calendar, ExternalLink, MapPin } from "lucide-react";

// Public events page with Leaderlix branding
// Fonts: GochiHand (titles), Arial (body)
// Colors: #ff3300 (accent), #000000 (text), #1c1e2c (secondary)

export default function PublicEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    loadPublicEvents();
  }, [filterDate]);

  const loadPublicEvents = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.append("date_from", filterDate);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/events/public?${params.toString()}`);
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1e2c]">
      {/* Google Font Import */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Gochi+Hand&display=swap');
          
          .font-gochi {
            font-family: 'Gochi Hand', cursive;
          }
          
          .font-body {
            font-family: Arial, sans-serif;
          }
          
          .accent-color {
            color: #ff3300;
          }
          
          .bg-accent {
            background-color: #ff3300;
          }
          
          .border-accent {
            border-color: #ff3300;
          }
          
          .hover-accent:hover {
            background-color: #ff3300;
          }
        `}
      </style>

      {/* Header */}
      <header className="bg-[#1c1e2c] border-b border-white/10 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="font-gochi text-4xl md:text-5xl text-white text-center">
            Próximos <span className="accent-color">Eventos</span>
          </h1>
          <p className="font-body text-white/60 text-center mt-2">
            Descubre nuestros webinars y masterclasses exclusivas
          </p>
        </div>
      </header>

      {/* Filter */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-4">
          <label className="font-body text-white/80 text-sm">Filtrar por fecha:</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-[#111111]/10 border border-white/20 rounded-lg px-4 py-2 text-white font-body text-sm focus:outline-none focus:border-[#ff3300]"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="font-body text-sm text-[#ff3300] hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-80 bg-[#111111]/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div 
                key={event.id}
                className="bg-[#111111]/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 hover:border-[#ff3300]/50 transition-all duration-300 hover:transform hover:-translate-y-1"
              >
                {/* Cover Image */}
                {event.cover_image ? (
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={event.cover_image} 
                      alt={event.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-[#ff3300]/20 to-[#1c1e2c] flex items-center justify-center">
                    <Calendar className="w-16 h-16 text-[#ff3300]/30" />
                  </div>
                )}
                
                <div className="p-6">
                  <h2 className="font-gochi text-2xl text-white mb-2 line-clamp-2">
                    {event.name}
                  </h2>
                  
                  {event.description && (
                    <p className="font-body text-white/60 text-sm mb-4 line-clamp-3">
                      {event.description}
                    </p>
                  )}
                  
                  <div className="space-y-2 mb-4">
                    {event.date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#ff3300]" />
                        <span className="font-body text-white/80 text-sm">
                          {formatDate(event.date)}
                          {event.time && ` • ${event.time}`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {event.url_website && (
                    <a
                      href={event.url_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full bg-[#ff3300] hover:bg-[#ff3300]/90 text-white font-body font-bold py-3 px-6 rounded-xl transition-all duration-300"
                    >
                      Registrarme
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="font-gochi text-2xl text-white mb-2">No hay eventos próximos</h3>
            <p className="font-body text-white/60">
              Vuelve pronto para ver nuestros próximos eventos
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1c1e2c] border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="font-body text-white/40 text-sm">
            © {new Date().getFullYear()} Leaderlix. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
