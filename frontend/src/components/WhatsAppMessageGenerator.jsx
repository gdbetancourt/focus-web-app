/**
 * WhatsAppMessageGenerator - Reusable component for generating WhatsApp messages
 * 
 * Can be used for:
 * - Single contact
 * - Multiple contacts (subgroup)
 * 
 * Features:
 * - Merge tags support
 * - Gemini variation
 * - URL generation
 * - Activity logging
 */
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import api from "../lib/api";
import {
  MessageSquare,
  Phone,
  Copy,
  ExternalLink,
  Sparkles,
  Loader2,
  User,
  Building2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// Available merge tags
const MERGE_TAGS = [
  { tag: "{contact_name}", label: "Nombre", description: "Nombre del contacto" },
  { tag: "{company}", label: "Empresa", description: "Empresa del contacto" },
  { tag: "{case_name}", label: "Caso", description: "Nombre del caso/proyecto" },
];

export function WhatsAppMessageGenerator({
  open,
  onOpenChange,
  contacts = [],
  caseData = null,
  groupName = "",
  onUrlsGenerated = () => {},
}) {
  // Message state
  const [message, setMessage] = useState("");
  const [useGeminiVariation, setUseGeminiVariation] = useState(false);
  
  // Loading states
  const [generating, setGenerating] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Results state
  const [generatedUrls, setGeneratedUrls] = useState([]);
  const [showResults, setShowResults] = useState(false);
  
  // Preview state
  const [previewContact, setPreviewContact] = useState(null);
  const [geminiPreviews, setGeminiPreviews] = useState([]);
  const [showGeminiPreview, setShowGeminiPreview] = useState(false);

  // Reset state when dialog opens
  const handleOpenChange = (open) => {
    if (!open) {
      // Reset on close
      setMessage("");
      setGeneratedUrls([]);
      setShowResults(false);
      setShowGeminiPreview(false);
      setGeminiPreviews([]);
    }
    onOpenChange(open);
  };

  // Insert merge tag at cursor
  const insertTag = (tag) => {
    setMessage(prev => prev + tag);
  };

  // Build variables for a contact
  const buildVariables = useCallback((contact) => {
    return {
      contact_name: contact.first_name || contact.name?.split(' ')[0] || "Contacto",
      company: contact.company || "",
      case_name: caseData?.name || "",
    };
  }, [caseData]);

  // Generate preview for selected contact
  const messagePreview = useMemo(() => {
    if (!previewContact && contacts.length > 0) {
      setPreviewContact(contacts[0]);
    }
    
    const contact = previewContact || contacts[0];
    if (!contact || !message) return message || "";
    
    const variables = buildVariables(contact);
    
    let preview = message;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      preview = preview.replace(regex, value || `[${key}]`);
    }
    
    return preview;
  }, [previewContact, contacts, message, buildVariables]);

  // Generate Gemini previews
  const generateGeminiPreview = async () => {
    if (!message || contacts.length === 0) return;
    
    setPreviewLoading(true);
    setShowGeminiPreview(true);
    setGeminiPreviews([]);
    
    try {
      const sampleContacts = contacts.slice(0, 3).map(c => buildVariables(c));
      
      const response = await api.post("/whatsapp-rules/preview-varied-messages", {
        template_message: message,
        sample_contacts: sampleContacts,
        num_previews: 3
      });
      
      setGeminiPreviews(response.data.previews || []);
    } catch (error) {
      console.error("Error generating preview:", error);
      toast.error("Error generando previsualización");
      setShowGeminiPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Generate WhatsApp URLs
  const generateUrls = async () => {
    if (!message || contacts.length === 0) {
      toast.error("Escribe un mensaje primero");
      return;
    }
    
    setGenerating(true);
    
    try {
      const urls = [];
      
      for (const contact of contacts) {
        if (!contact.phone) continue;
        
        // Build personalized message
        const variables = buildVariables(contact);
        let personalizedMessage = message;
        
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`\\{${key}\\}`, 'g');
          personalizedMessage = personalizedMessage.replace(regex, value || "");
        }
        
        // Clean phone number
        const phone = contact.phone.replace(/\D/g, '');
        
        // Generate WhatsApp URL
        const encodedMessage = encodeURIComponent(personalizedMessage);
        const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
        
        urls.push({
          contact_id: contact.id,
          contact_name: contact.first_name || contact.name?.split(' ')[0],
          phone: contact.phone,
          url: waUrl,
          message: personalizedMessage
        });
      }
      
      setGeneratedUrls(urls);
      setShowResults(true);
      
      // Log activity
      try {
        await api.post("/audit/log", {
          action: "whatsapp_urls_generated",
          case_id: caseData?.id,
          group_name: groupName,
          contact_count: urls.length,
          used_gemini: useGeminiVariation
        });
      } catch (e) {
        // Ignore audit errors
      }
      
      onUrlsGenerated(urls);
      toast.success(`${urls.length} enlaces generados`);
      
    } catch (error) {
      console.error("Error generating URLs:", error);
      toast.error("Error generando enlaces");
    } finally {
      setGenerating(false);
    }
  };

  // Copy all URLs
  const copyAllUrls = () => {
    const text = generatedUrls.map(u => `${u.contact_name}: ${u.url}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success("Enlaces copiados");
  };

  // Open single URL
  const openUrl = (url) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#111111] border-[#222222] max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            Enviar WhatsApp
            {contacts.length > 1 && (
              <Badge className="bg-green-500/20 text-green-400 border-0 ml-2">
                {contacts.length} contactos
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {groupName && `Grupo: ${groupName}`}
            {caseData?.name && ` • Caso: ${caseData.name}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Merge Tags */}
            <div>
              <Label className="text-slate-400 text-sm mb-2 block">Variables disponibles</Label>
              <div className="flex flex-wrap gap-2">
                {MERGE_TAGS.map(({ tag, label, description }) => (
                  <TooltipProvider key={tag}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertTag(tag)}
                          className="border-[#333] text-slate-300 hover:bg-[#222] text-xs"
                        >
                          {label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{description}</p>
                        <p className="text-xs text-slate-400">{tag}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div>
              <Label className="text-slate-400 text-sm mb-2 block">Mensaje</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hola {contact_name}, te escribo de parte de..."
                className="bg-[#0a0a0a] border-[#333] text-white min-h-[120px] resize-none"
              />
            </div>

            {/* Preview */}
            {message && contacts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-400 text-sm">Vista previa</Label>
                  {contacts.length > 1 && (
                    <select
                      value={previewContact?.id || ""}
                      onChange={(e) => setPreviewContact(contacts.find(c => c.id === e.target.value))}
                      className="bg-[#0a0a0a] border border-[#333] rounded text-white text-xs px-2 py-1"
                    >
                      {contacts.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.first_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="p-3 bg-[#0a0a0a] border border-[#333] rounded-lg">
                  <p className="text-white text-sm whitespace-pre-wrap">{messagePreview}</p>
                </div>
              </div>
            )}

            {/* Gemini Variation Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#333]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="text-white text-sm">Variación con Gemini</p>
                  <p className="text-xs text-slate-500">Cada mensaje será ligeramente diferente</p>
                </div>
              </div>
              <Switch
                checked={useGeminiVariation}
                onCheckedChange={setUseGeminiVariation}
              />
            </div>

            {/* Generated URLs Results */}
            {showResults && generatedUrls.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-slate-400 text-sm">
                    Enlaces generados ({generatedUrls.length})
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAllUrls}
                    className="text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copiar todos
                  </Button>
                </div>
                <ScrollArea className="h-[200px] border border-[#333] rounded-lg">
                  <div className="p-2 space-y-2">
                    {generatedUrls.map((item, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded border border-[#222]"
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-white text-sm">{item.contact_name}</span>
                          <span className="text-slate-500 text-xs">{item.phone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(item.url)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUrl(item.url)}
                            className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-[#222] pt-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-[#333] text-slate-300 hover:bg-[#1a1a1a]"
          >
            {showResults ? "Cerrar" : "Cancelar"}
          </Button>
          
          {!showResults && (
            <Button
              onClick={generateUrls}
              disabled={generating || !message || contacts.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Generar {contacts.length > 1 ? `${contacts.length} enlaces` : "enlace"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simple button for single contact
export function WhatsAppButton({ contact, onClick, className = "" }) {
  if (!contact?.phone) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={`h-6 w-6 p-0 text-green-400 hover:text-green-300 ${className}`}
          >
            <Phone className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Enviar WhatsApp</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Button for subgroup (multiple contacts)
export function WhatsAppGroupButton({ contacts, onClick, className = "" }) {
  const validContacts = contacts.filter(c => c.phone);
  if (validContacts.length === 0) return null;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            className={`border-green-600/50 text-green-400 hover:bg-green-500/10 hover:text-green-300 ${className}`}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            WhatsApp ({validContacts.length})
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Enviar WhatsApp a {validContacts.length} contactos</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
