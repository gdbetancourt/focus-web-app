/**
 * IceBreakerTabContent - Combined LinkedIn workflow tab
 * 
 * Section 1: LinkedIn searches queue for ice breaker follow-up (2+ weeks old)
 * Section 2: Qualified LinkedIn contacts (Stage 1 qualified + Stage 2)
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import api from "../../lib/api";
import {
  Snowflake,
  RefreshCw,
  Copy,
  Building2,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  Linkedin,
  Users,
} from "lucide-react";

// Import LinkedIn contacts component
import { LinkedInTabContent } from "../mensajes-hoy/LinkedInTabContent";

export function IceBreakerTabContent({ onEditContact, onAddLinkedin }) {
  const [activeSection, setActiveSection] = useState("searches");
  
  // Searches state
  const [searches, setSearches] = useState([]);
  const [loadingSearches, setLoadingSearches] = useState(true);
  const [searchStats, setSearchStats] = useState({ ready_count: 0, pending_count: 0, done_count: 0 });

  const loadSearches = useCallback(async () => {
    setLoadingSearches(true);
    try {
      const res = await api.get("/todays-focus/ice-breaker");
      setSearches(res.data.searches || []);
      setSearchStats({
        ready_count: res.data.ready_count || 0,
        pending_count: res.data.pending_count || 0,
        done_count: res.data.done_count || 0
      });
    } catch (error) {
      console.error("Error loading ice breaker data:", error);
      toast.error("Error al cargar búsquedas");
    } finally {
      setLoadingSearches(false);
    }
  }, []);

  useEffect(() => {
    loadSearches();
  }, [loadSearches]);

  // Copy URL to clipboard
  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada al portapapeles");
    } catch (error) {
      toast.error("Error al copiar");
    }
  };

  // Mark search as done
  const handleMarkDone = async (searchId) => {
    try {
      await api.post(`/todays-focus/ice-breaker/${searchId}/mark-done`);
      setSearches(prev => prev.map(s => 
        s.id === searchId ? { ...s, is_done_this_cycle: true } : s
      ));
      setSearchStats(prev => ({
        ...prev,
        ready_count: prev.ready_count - 1,
        done_count: prev.done_count + 1
      }));
      toast.success("Marcado como completado");
    } catch (error) {
      toast.error("Error al marcar");
    }
  };

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  };

  return (
    <div className="space-y-4" data-testid="ice-breaker-tab">
      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <TabsList className="bg-[#111] border border-[#222] p-1 w-full grid grid-cols-2">
          <TabsTrigger 
            value="searches" 
            className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white gap-2"
            data-testid="icebreaker-tab-searches"
          >
            <Search className="w-4 h-4" />
            Búsquedas Ice Breaker
            {searchStats.ready_count > 0 && (
              <Badge className="ml-1 bg-green-500/20 text-green-400 text-xs">
                {searchStats.ready_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="contacts" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-2"
            data-testid="icebreaker-tab-contacts"
          >
            <Users className="w-4 h-4" />
            Contactos LinkedIn
          </TabsTrigger>
        </TabsList>

        {/* Section 1: LinkedIn Searches Queue */}
        <TabsContent value="searches" className="mt-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="border-b border-[#222]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Snowflake className="w-5 h-5 text-cyan-400" />
                  Búsquedas para Ice Breaker
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-400">
                    {searchStats.ready_count} listos
                  </Badge>
                  <Badge className="bg-slate-500/20 text-slate-400">
                    {searchStats.pending_count} pendientes
                  </Badge>
                  {searchStats.done_count > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-400">
                      {searchStats.done_count} hechos
                    </Badge>
                  )}
                  <Button 
                    onClick={loadSearches} 
                    variant="outline" 
                    size="sm"
                    className="border-[#333]"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingSearches ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Búsquedas programadas para seguimiento. Las listas (2+ semanas) aparecen activas, las pendientes en gris.
              </p>
            </CardHeader>
            <CardContent className="p-4">
              {loadingSearches ? (
                <div className="p-8 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Cargando...
                </div>
              ) : searches.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Snowflake className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-lg font-medium text-white mb-2">Sin búsquedas programadas</p>
                  <p>Las búsquedas aparecerán aquí cuando las prospectes en el tab de Prospección.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searches.map((search) => {
                    const isReady = search.is_ready && !search.is_done_this_cycle;
                    const isDone = search.is_done_this_cycle;
                    const isPending = !search.is_ready;
                    
                    return (
                      <div 
                        key={search.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isDone 
                            ? 'bg-[#0a0a0a] border-[#1a1a1a] opacity-50' 
                            : isReady 
                              ? 'bg-[#111] border-green-500/30 hover:border-green-500/50' 
                              : 'bg-[#0a0a0a] border-[#1a1a1a] opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {/* Left side - Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <Search className={`w-4 h-4 shrink-0 ${isReady ? 'text-green-400' : 'text-slate-500'}`} />
                              <span className={`font-medium truncate ${isReady ? 'text-white' : 'text-slate-400'}`}>
                                {search.keyword}
                              </span>
                              {search.prospected_by && (
                                <Badge variant="outline" className="border-[#333] text-slate-500 text-xs shrink-0">
                                  {search.prospected_by}
                                </Badge>
                              )}
                              {isDone && (
                                <Badge className="bg-blue-500/20 text-blue-400 text-xs shrink-0">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Hecho
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                                <span className={isReady ? 'text-slate-300' : 'text-slate-500'}>
                                  {search.company_name}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                {isReady ? (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                    <span className="text-green-400">
                                      Listo (hace {search.days_since_prospected} días)
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-slate-500">
                                      {formatDate(search.ready_date)} ({search.days_until_ready} días)
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Right side - Actions */}
                          <div className="flex items-center gap-2 ml-4">
                            {isReady && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCopyUrl(search.url)}
                                  className="h-8 border-[#333] text-slate-400 hover:text-white"
                                  title="Copiar URL"
                                >
                                  <Copy className="w-3.5 h-3.5 mr-1" />
                                  Copiar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkDone(search.id)}
                                  className="h-8 bg-green-600 hover:bg-green-700"
                                  title="Marcar como completado"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  Hecho
                                </Button>
                              </>
                            )}
                            {isPending && (
                              <Badge variant="outline" className="border-[#333] text-slate-500">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(search.ready_date)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Info about workflow */}
              <div className="mt-6 p-4 bg-[#0a0a0a] rounded-lg border border-[#222]">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-400" />
                  ¿Cómo funciona?
                </h4>
                <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
                  <li>En <strong>Prospección</strong> copias una búsqueda de LinkedIn y agregas contactos</li>
                  <li>La búsqueda aparece aquí en gris con la fecha en que estará lista</li>
                  <li>2 semanas después, se activa en verde - copia el link y envía mensajes de ice breaker</li>
                  <li>Marca como &quot;Hecho&quot; cuando termines</li>
                  <li>La próxima vez que prospectes esa búsqueda, el ciclo se repite</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Section 2: Qualified LinkedIn Contacts */}
        <TabsContent value="contacts" className="mt-4">
          <LinkedInTabContent 
            embedded={true}
            onEditContact={onEditContact}
            onAddLinkedin={onAddLinkedin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default IceBreakerTabContent;
