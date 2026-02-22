/**
 * MensajesHoy - Today's Messages Page
 * Refactored version with extracted tab components
 */
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import api from "../lib/api";
import ContactSheet from "../components/ContactSheet";
import {
  WhatsAppTabContent,
  LinkedInTabContent,
  EmailTabContent,
  GeneratedUrlsModal,
  AddPhoneDialog,
  AddLinkedinDialog,
  EmailPreviewDialog,
  EMAIL_RULE_COLORS,
} from "../components/mensajes-hoy";
import {
  MessageSquare,
  Linkedin,
  Mail,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

export default function MensajesHoy({ embedded = false, forceTab = null }) {
  const [activeTab, setActiveTab] = useState(forceTab || "whatsapp");
  const [stats, setStats] = useState(null);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  
  // Loading progress state for embedded mode
  const [loadingProgress, setLoadingProgress] = useState({
    isLoading: false,
    step: "",
    details: "",
    progress: 0,
  });
  
  // Generated URLs modal state
  const [generatedUrls, setGeneratedUrls] = useState([]);
  const [showUrlsModal, setShowUrlsModal] = useState(false);
  
  // Add Phone dialog state
  const [showAddPhoneDialog, setShowAddPhoneDialog] = useState(false);
  const [addPhoneContact, setAddPhoneContact] = useState(null);
  
  // Add LinkedIn dialog state
  const [showAddLinkedinDialog, setShowAddLinkedinDialog] = useState(false);
  const [addLinkedinContact, setAddLinkedinContact] = useState(null);
  
  // Email preview dialog state
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedEmailContact, setSelectedEmailContact] = useState(null);
  const [generatedEmail, setGeneratedEmail] = useState({ subject: "", body: "" });
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Edit contact state (ContactSheet modal)
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  // Traffic light state for WhatsApp badge
  const [trafficLight, setTrafficLight] = useState({ status: "red", pending: 0 });

  useEffect(() => {
    loadStats();
    loadBuyerPersonas();
  }, []);

  useEffect(() => {
    if (forceTab) {
      setActiveTab(forceTab);
    }
  }, [forceTab]);

  const loadStats = async () => {
    try {
      const res = await api.get("/mensajes-hoy/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadBuyerPersonas = async () => {
    try {
      const res = await api.get("/buyer-personas-db/");
      setBuyerPersonas(res.data || []);
    } catch (error) {
      console.error("Error loading buyer personas:", error);
    }
  };

  // Open edit contact modal
  const handleEditContact = (contact) => {
    const contactId = contact.id || contact.contact_id;
    
    if (!contactId) {
      toast.error("No se puede editar: ID de contacto no encontrado");
      return;
    }
    
    setEditingContact({
      id: contactId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      job_title: contact.job_title,
      linkedin_url: contact.linkedin_url,
      buyer_persona: contact.buyer_persona,
      address: contact.address,
    });
    setEditContactOpen(true);
  };

  // Handle contact update
  const handleContactUpdate = async () => {
    setEditContactOpen(false);
    setEditingContact(null);
    loadStats();
    toast.success("Contact updated");
  };

  // Show generated URLs modal
  const handleShowUrlsModal = (urls) => {
    setGeneratedUrls(urls);
    setShowUrlsModal(true);
  };

  // Add phone handler
  const handleAddPhone = async (phoneNumber) => {
    if (!addPhoneContact) return;
    
    try {
      await api.post("/mensajes-hoy/whatsapp/add-phone", {
        contact_id: addPhoneContact.contact_id,
        contact_type: addPhoneContact.contact_type,
        phone: phoneNumber
      });
      
      toast.success("Phone added");
      setShowAddPhoneDialog(false);
      setAddPhoneContact(null);
    } catch (error) {
      toast.error("Error adding phone");
    }
  };

  // Add LinkedIn handler
  const handleAddLinkedin = async (linkedinUrl) => {
    if (!addLinkedinContact) return;
    
    try {
      await api.put(`/contacts/${addLinkedinContact.contact_id}`, {
        linkedin_url: linkedinUrl
      });
      toast.success("LinkedIn added successfully");
      setShowAddLinkedinDialog(false);
      setAddLinkedinContact(null);
    } catch (error) {
      toast.error("Error adding LinkedIn");
    }
  };

  // Generate email with Gemini
  const handleGenerateEmail = async (contact) => {
    setSelectedEmailContact(contact);
    setIsGeneratingEmail(true);
    setShowEmailPreview(true);
    setGeneratedEmail({ subject: "", body: "" });
    
    try {
      const res = await api.post("/email-individual/generate", {
        contact_id: contact.contact_id,
        rule_type: contact.rule_type,
        webinar_name: contact.webinar_name,
        webinar_date: contact.webinar_date,
        webinar_link: contact.webinar_link
      });
      
      setGeneratedEmail({
        subject: res.data.subject,
        body: res.data.body
      });
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error("Error generating email");
      setShowEmailPreview(false);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // Send email via Gmail API
  const handleSendEmail = async () => {
    if (!selectedEmailContact || !generatedEmail.subject || !generatedEmail.body) {
      toast.error("Missing email content");
      return;
    }
    
    setIsSendingEmail(true);
    try {
      await api.post("/email-individual/send", {
        contact_id: selectedEmailContact.contact_id,
        rule_type: selectedEmailContact.rule_type,
        subject: generatedEmail.subject,
        body: generatedEmail.body
      });
      
      toast.success(`Email sent to ${selectedEmailContact.email}`);
      setShowEmailPreview(false);
      setSelectedEmailContact(null);
      setGeneratedEmail({ subject: "", body: "" });
      loadStats();
    } catch (error) {
      console.error("Error sending email:", error);
      const errorMsg = error.response?.data?.detail || "Error sending email";
      toast.error(errorMsg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Loading state for embedded mode
  if (embedded && loadingProgress.isLoading) {
    return (
      <div className="space-y-4" data-testid="mensajes-loading-progress">
        <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-lg ${
              forceTab === "whatsapp" ? "bg-green-500/20" : 
              forceTab === "linkedin" ? "bg-blue-500/20" : 
              forceTab === "email" ? "bg-purple-500/20" : "bg-[#ff3300]/20"
            }`}>
              {forceTab === "whatsapp" ? (
                <MessageSquare className="w-5 h-5 text-green-400 animate-pulse" />
              ) : forceTab === "linkedin" ? (
                <Linkedin className="w-5 h-5 text-blue-400 animate-pulse" />
              ) : forceTab === "email" ? (
                <Mail className="w-5 h-5 text-purple-400 animate-pulse" />
              ) : (
                <RefreshCw className="w-5 h-5 text-[#ff3300] animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{loadingProgress.step}</p>
              {loadingProgress.details && (
                <p className="text-slate-400 text-xs mt-1">{loadingProgress.details}</p>
              )}
            </div>
            {loadingProgress.progress < 100 ? (
              <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
          </div>
          <Progress value={loadingProgress.progress} className="h-2 bg-[#222]" />
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500">
              {loadingProgress.progress < 100 ? "Preparando datos..." : "¡Listo!"}
            </span>
            <span className={loadingProgress.progress === 100 ? "text-green-400 font-medium" : "text-slate-400"}>
              {loadingProgress.progress}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Embedded without forceTab - simplified version
  if (embedded && !forceTab) {
    return (
      <div className="space-y-4" data-testid="mensajes-hoy-embedded">
        {stats && (
          <div className="flex gap-4 text-sm mb-4">
            <div className="text-center">
              <p className="text-xl font-bold text-green-400">{stats.contacted_today?.whatsapp || 0}</p>
              <p className="text-xs text-slate-500">WhatsApp hoy</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-blue-400">{stats.contacted_today?.linkedin || 0}</p>
              <p className="text-xs text-slate-500">LinkedIn hoy</p>
            </div>
          </div>
        )}
        <p className="text-slate-400 text-sm">
          Ver mensajes completos en <a href="/todays-focus" className="text-[#ff3300] hover:underline">Today&apos;s Focus</a>
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${embedded && forceTab ? '' : ''}`} data-testid="mensajes-hoy-page">
      {/* Header - Only show if not embedded with forceTab */}
      {!(embedded && forceTab) && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#ff3300]/20">
              <MessageSquare className="w-6 h-6 text-[#ff3300]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Today&apos;s Messages</h1>
              <p className="text-sm text-slate-500">Contacts that need a message today based on configured rules</p>
            </div>
          </div>
          
          {/* Stats */}
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{stats.contacted_today?.whatsapp || 0}</p>
                <p className="text-xs text-slate-500">WhatsApp today</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">{stats.contacted_today?.linkedin || 0}</p>
                <p className="text-xs text-slate-500">LinkedIn today</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={!forceTab ? setActiveTab : undefined} className="w-full">
        {/* TabsList - Hidden when embedded with forceTab but still present for Radix */}
        <TabsList className={`bg-[#111] border border-[#222] grid grid-cols-3 w-full max-w-2xl ${embedded && forceTab ? 'hidden' : ''}`}>
          <TabsTrigger value="whatsapp" className="data-[state=active]:bg-green-600">
            <MessageSquare className="w-4 h-4 mr-2" />
            WhatsApp
            <Badge className={`ml-2 ${trafficLight.status === 'green' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {trafficLight.status === 'green' ? '✓' : trafficLight.pending}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="data-[state=active]:bg-blue-600">
            <Linkedin className="w-4 h-4 mr-2" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-purple-600">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
        </TabsList>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-6">
          <WhatsAppTabContent
            embedded={embedded}
            onEditContact={handleEditContact}
            onShowUrlsModal={handleShowUrlsModal}
            onLoadStats={loadStats}
          />
        </TabsContent>

        {/* LinkedIn Tab */}
        <TabsContent value="linkedin" className="space-y-6">
          <LinkedInTabContent
            embedded={embedded}
            onEditContact={handleEditContact}
            onAddLinkedin={(contact) => {
              setAddLinkedinContact(contact);
              setShowAddLinkedinDialog(true);
            }}
            onLoadStats={loadStats}
          />
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <EmailTabContent
            embedded={embedded}
            onGenerateEmail={handleGenerateEmail}
            onLoadStats={loadStats}
          />
        </TabsContent>
      </Tabs>

      {/* Modals and Dialogs */}
      <GeneratedUrlsModal
        open={showUrlsModal}
        onOpenChange={setShowUrlsModal}
        urls={generatedUrls}
      />

      <AddPhoneDialog
        open={showAddPhoneDialog}
        onOpenChange={setShowAddPhoneDialog}
        contact={addPhoneContact}
        onSave={handleAddPhone}
      />

      <AddLinkedinDialog
        open={showAddLinkedinDialog}
        onOpenChange={setShowAddLinkedinDialog}
        contact={addLinkedinContact}
        onSave={handleAddLinkedin}
      />

      <EmailPreviewDialog
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
        contact={selectedEmailContact}
        email={generatedEmail}
        onEmailChange={setGeneratedEmail}
        onSend={handleSendEmail}
        onRegenerate={() => selectedEmailContact && handleGenerateEmail(selectedEmailContact)}
        isGenerating={isGeneratingEmail}
        isSending={isSendingEmail}
      />

      <ContactSheet
        contact={editingContact}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        onUpdate={handleContactUpdate}
        buyerPersonas={buyerPersonas}
      />
    </div>
  );
}
