/**
 * ToQualifyTabContent - Qualify Stage 1 & 2 contacts with keyword learning
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";
import api from "../../lib/api";
import ContactSheet from "../ContactSheet";
import {
  User,
  Building2,
  Briefcase,
  Mail,
  Phone,
  Linkedin,
  Calendar,
  Clock,
  Check,
  RefreshCw,
  Edit,
  Globe,
  MapPin,
  ExternalLink,
} from "lucide-react";

export function ToQualifyTabContent({ buyerPersonas: externalBuyerPersonas = [] }) {
  const [currentContact, setCurrentContact] = useState(null);
  const [stats, setStats] = useState({ pending: 0, qualified: 0, discarded: 0, postponed: 0, weekly_progress: { qualified: 0, pending: 0, total: 0, percentage: 0 } });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Buyer personas state
  const [buyerPersonas, setBuyerPersonas] = useState(externalBuyerPersonas);
  
  // Keyword input
  const [keywordText, setKeywordText] = useState("");
  
  // Checkboxes state for each buyer persona
  const [personaCheckboxes, setPersonaCheckboxes] = useState({});
  
  // Edit contact dialog
  const [editContactOpen, setEditContactOpen] = useState(false);
  
  // Load buyer personas if not provided externally
  useEffect(() => {
    if (externalBuyerPersonas.length > 0) {
      setBuyerPersonas(externalBuyerPersonas);
    } else {
      const loadPersonas = async () => {
        try {
          const res = await api.get("/buyer-personas-db/");
          setBuyerPersonas(res.data || []);
        } catch (error) {
          console.error("Error loading buyer personas:", error);
        }
      };
      loadPersonas();
    }
  }, [externalBuyerPersonas]);
  
  // Initialize checkboxes when buyer personas load
  useEffect(() => {
    const initial = {};
    buyerPersonas.forEach(p => {
      const code = p.code || p.id || p.name?.toLowerCase();
      if (code !== "mateo" && code !== "ramona") {
        initial[code] = { addKeyword: true, reclassify: true };
      }
    });
    setPersonaCheckboxes(initial);
  }, [buyerPersonas]);
  
  // Update keyword when contact changes
  useEffect(() => {
    if (currentContact?.job_title) {
      setKeywordText(currentContact.job_title);
    } else {
      setKeywordText("");
    }
  }, [currentContact]);
  
  // Load next contact and stats
  const loadNext = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRes, statsRes] = await Promise.all([
        api.get("/prospection/to-qualify/next"),
        api.get("/prospection/to-qualify/stats")
      ]);
      
      setCurrentContact(nextRes.data.contact);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error loading contact:", error);
      toast.error("Error cargando contacto");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadNext();
  }, [loadNext]);
  
  // Qualify with keyword learning
  const handleQualify = async (buyerPersonaCode) => {
    if (!currentContact) return;
    setProcessing(true);
    
    const checkboxes = personaCheckboxes[buyerPersonaCode] || { addKeyword: false, reclassify: false };
    const isSpecialPersona = buyerPersonaCode === "mateo" || buyerPersonaCode === "ramona";
    
    try {
      const res = await api.post(`/prospection/to-qualify/${currentContact.id}/qualify`, {
        buyer_persona: buyerPersonaCode,
        add_keyword: !isSpecialPersona && checkboxes.addKeyword && !!keywordText.trim(),
        keyword_text: keywordText.trim(),
        reclassify_existing: !isSpecialPersona && checkboxes.reclassify && !!keywordText.trim()
      });
      
      const persona = buyerPersonas.find(p => (p.code || p.id || p.name?.toLowerCase()) === buyerPersonaCode);
      const personaName = persona?.display_name || persona?.name || buyerPersonaCode;
      
      let message = `${currentContact.name || currentContact.first_name} → ${personaName}`;
      
      if (res.data.keyword_added) {
        message += ` | Keyword agregado`;
      }
      if (res.data.reclassified_count > 0) {
        message += ` | ${res.data.reclassified_count} reclasificados`;
      }
      
      toast.success(message);
      loadNext();
    } catch (error) {
      console.error("Error qualifying:", error);
      toast.error("Error al calificar");
    } finally {
      setProcessing(false);
    }
  };
  
  // Postpone contact
  const handlePostpone = async () => {
    if (!currentContact) return;
    setProcessing(true);
    
    try {
      await api.post(`/prospection/to-qualify/${currentContact.id}/postpone`);
      toast.success("Contacto postergado");
      loadNext();
    } catch (error) {
      console.error("Error postponing:", error);
      toast.error("Error al postergar");
    } finally {
      setProcessing(false);
    }
  };
  
  // Toggle checkbox for a persona
  const toggleCheckbox = (personaCode, field) => {
    setPersonaCheckboxes(prev => ({
      ...prev,
      [personaCode]: {
        ...prev[personaCode],
        [field]: !prev[personaCode]?.[field]
      }
    }));
  };
  
  const contactName = currentContact?.name || 
    `${currentContact?.first_name || ''} ${currentContact?.last_name || ''}`.trim() ||
    "Sin nombre";

  // Filter personas for the right panel (exclude mateo and ramona)
  const qualifyPersonas = buyerPersonas.filter(p => {
    const code = p.code || p.id || p.name?.toLowerCase();
    return code !== "mateo" && code !== "ramona";
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
            Pendientes: {stats.weekly_progress?.pending?.toLocaleString() || stats.pending}
          </Badge>
          <Badge variant="outline" className="border-green-500/30 text-green-400">
            Calificados semana: {stats.weekly_progress?.qualified || 0}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadNext} className="border-[#333]">
          <RefreshCw className="w-4 h-4 mr-2" />
          Recargar
        </Button>
      </div>

      {/* Weekly Progress Indicator */}
      <div className="bg-[#111] border border-[#222] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Meta: Calificar todos los contactos outbound (sin Mateo/Ramona)</span>
          <span className="text-lg font-bold">
            <span className={stats.weekly_progress?.pending === 0 ? "text-green-400" : "text-white"}>
              {stats.weekly_progress?.qualified || 0}
            </span>
            <span className="text-slate-500 font-normal"> calificados esta semana</span>
            {stats.weekly_progress?.pending > 0 && (
              <span className="text-sm ml-2 text-yellow-400">
                ({stats.weekly_progress?.pending || 0} pendientes)
              </span>
            )}
          </span>
        </div>
        <div className="w-full h-3 bg-[#222] rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              stats.weekly_progress?.percentage >= 100 
                ? "bg-green-500" 
                : stats.weekly_progress?.percentage > 0
                  ? "bg-gradient-to-r from-amber-500 to-green-500"
                  : "bg-red-500/50"
            }`}
            style={{ width: `${Math.min(stats.weekly_progress?.percentage || 0, 100)}%` }}
          />
        </div>
      </div>

      {currentContact ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Contact Info */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#ff3300]/20 to-purple-500/20 p-4 border-b border-[#222]">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">{contactName}</h2>
                    {currentContact.job_title && (
                      <p className="text-slate-400 flex items-center gap-2 mt-1">
                        <Briefcase className="w-4 h-4" />
                        {currentContact.job_title}
                      </p>
                    )}
                    {currentContact.company && (
                      <p className="text-slate-400 flex items-center gap-2 mt-1">
                        <Building2 className="w-4 h-4" />
                        {currentContact.company}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditContactOpen(true)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Contact Details */}
              <div className="p-4 space-y-3">
                {currentContact.email && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">{currentContact.email}</span>
                  </div>
                )}
                {currentContact.phone && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">{currentContact.phone}</span>
                  </div>
                )}
                {currentContact.linkedin_url && (
                  <a 
                    href={currentContact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-blue-400 hover:text-blue-300"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span className="text-sm">Ver perfil de LinkedIn</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {currentContact.location && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">{currentContact.location}</span>
                  </div>
                )}
                {currentContact.first_connected_on_linkedin && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">Conectado: {currentContact.first_connected_on_linkedin}</span>
                  </div>
                )}
                
                {/* Current buyer persona */}
                {currentContact.buyer_persona && (
                  <div className="mt-4 pt-4 border-t border-[#222]">
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      Sugerido: {buyerPersonas.find(p => (p.code || p.id) === currentContact.buyer_persona)?.display_name || currentContact.buyer_persona}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Keyword Input */}
              <div className="p-4 border-t border-[#222]">
                <label className="text-sm text-slate-400 mb-2 block">Keyword para clasificación:</label>
                <Input
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  placeholder="Ingresa el cargo/keyword"
                  className="bg-[#0a0a0a] border-[#333] text-white"
                />
              </div>

              {/* Bottom Actions: Mateo, Ramona, Más tarde */}
              <div className="p-4 border-t border-[#222] flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleQualify("mateo")}
                  disabled={processing}
                  className="flex-1 border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                >
                  Mateo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleQualify("ramona")}
                  disabled={processing}
                  className="flex-1 border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                >
                  Ramona
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePostpone}
                  disabled={processing}
                  className="flex-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Más tarde
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right: Buyer Personas List */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-0">
              <div className="p-4 border-b border-[#222]">
                <h3 className="font-semibold text-white">Selecciona Buyer Persona</h3>
                <p className="text-xs text-slate-500 mt-1">Click para calificar</p>
              </div>
              <ScrollArea className="h-[500px]">
                <div className="p-2 space-y-2">
                  {qualifyPersonas.map(persona => {
                    const code = persona.code || persona.id || persona.name?.toLowerCase();
                    const checkboxes = personaCheckboxes[code] || { addKeyword: true, reclassify: true };
                    const isSuggested = code === currentContact?.buyer_persona;
                    
                    return (
                      <div
                        key={code}
                        className={`rounded-lg border p-3 transition-all ${
                          isSuggested 
                            ? "border-green-500/50 bg-green-500/10" 
                            : "border-[#333] bg-[#0a0a0a] hover:border-[#444] hover:bg-[#111]"
                        }`}
                      >
                        {/* Persona Header - Clickable */}
                        <button
                          onClick={() => handleQualify(code)}
                          disabled={processing}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`font-medium ${isSuggested ? "text-green-400" : "text-white"}`}>
                                {persona.display_name || persona.name}
                              </span>
                              {isSuggested && (
                                <Badge className="ml-2 bg-green-500/20 text-green-400 text-xs">
                                  Sugerido
                                </Badge>
                              )}
                            </div>
                            <Check className={`w-5 h-5 ${isSuggested ? "text-green-400" : "text-slate-600"}`} />
                          </div>
                          {persona.description && (
                            <p className="text-xs text-slate-500 mt-1">{persona.description}</p>
                          )}
                        </button>
                        
                        {/* Checkboxes */}
                        <div className="mt-3 pt-3 border-t border-[#222] flex flex-col gap-2">
                          <label 
                            className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={checkboxes.addKeyword}
                              onCheckedChange={() => toggleCheckbox(code, "addKeyword")}
                              className="h-4 w-4"
                            />
                            Agregar keyword a {persona.name || code}
                          </label>
                          <label 
                            className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={checkboxes.reclassify}
                              onCheckedChange={() => toggleCheckbox(code, "reclassify")}
                              className="h-4 w-4"
                            />
                            Reclasificar existentes con este cargo
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="py-16 text-center">
            <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">¡Todo calificado!</h3>
            <p className="text-slate-400">No hay más contactos pendientes de calificar</p>
          </CardContent>
        </Card>
      )}

      {/* Contact Edit Sheet */}
      <ContactSheet
        contact={currentContact}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        onUpdate={loadNext}
        buyerPersonas={buyerPersonas}
      />
    </div>
  );
}

export default ToQualifyTabContent;
