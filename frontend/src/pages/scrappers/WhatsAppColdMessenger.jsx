import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, Building, Phone, Copy, ExternalLink, RefreshCw, Check, Edit2, ChevronDown, ChevronUp, MapPin, Star, Filter, CheckCircle2, Clock, History, Eye, EyeOff, Link, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import api from '../../lib/api';

const DEFAULT_TEMPLATES = [
  {
    id: 'intro',
    name: 'Introduction',
    message: 'Hola {nombre}, soy de Leaderlix. Vi su negocio {negocio} y me gustaría presentarle nuestros servicios de capacitación para el sector salud. ¿Tendría unos minutos para platicar?'
  },
  {
    id: 'followup',
    name: 'Follow-up',
    message: 'Hola {nombre}, ¿cómo está? Le escribo para dar seguimiento a mi mensaje anterior. En Leaderlix ofrecemos programas de capacitación especializados que podrían beneficiar a {negocio}. ¿Le interesaría agendar una llamada?'
  },
  {
    id: 'promo',
    name: 'Promotion',
    message: 'Hola {nombre}, buenas noticias de Leaderlix. Tenemos un programa especial de capacitación para profesionales de la salud. ¿Le gustaría conocer más detalles?'
  }
];

const WhatsAppColdMessenger = () => {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATES[0]);
  const [customMessage, setCustomMessage] = useState(DEFAULT_TEMPLATES[0].message);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [contactedMap, setContactedMap] = useState({});
  const [hideContacted, setHideContacted] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [messageLogs, setMessageLogs] = useState([]);
  const [viewMode, setViewMode] = useState("grouped"); // grouped, urls
  
  // Weekly task checkbox
  const [weeklyTaskChecked, setWeeklyTaskChecked] = useState(false);
  const [togglingTask, setTogglingTask] = useState(false);

  useEffect(() => {
    loadBusinesses();
    loadContactedStatus();
    loadWeeklyTask();
  }, []);
  
  // Load weekly task status
  const loadWeeklyTask = async () => {
    try {
      const res = await api.get('/scheduler/weekly-tasks');
      setWeeklyTaskChecked(res.data.tasks?.small_business?.all?.checked || false);
    } catch (error) {
      console.error('Error loading weekly task:', error);
    }
  };
  
  // Toggle weekly task
  const toggleWeeklyTask = async () => {
    setTogglingTask(true);
    try {
      const res = await api.post('/scheduler/weekly-tasks/small_business/all');
      setWeeklyTaskChecked(res.data.checked);
      toast.success(res.data.checked ? 'Weekly task marked as completed' : 'Weekly task unmarked');
    } catch (error) {
      toast.error('Error updating task');
    } finally {
      setTogglingTask(false);
    }
  };

  const loadContactedStatus = async () => {
    try {
      const res = await api.get('/scrappers/whatsapp/contacted-businesses');
      setContactedMap(res.data.contacted || {});
    } catch (error) {
      console.error('Error loading contacted status:', error);
    }
  };

  const loadMessageLogs = async () => {
    try {
      const res = await api.get('/scrappers/whatsapp/message-logs', { params: { limit: 50 } });
      setMessageLogs(res.data.logs || []);
    } catch (error) {
      console.error('Error loading message logs:', error);
    }
  };

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/scrappers/small-business', { params: { limit: 500 } });
      // Filter only businesses with phone numbers
      const withPhone = (res.data.businesses || []).filter(b => b.phone);
      setBusinesses(withPhone);
      
      // Auto-expand first 3 cities
      const cities = [...new Set(withPhone.map(b => b.city).filter(Boolean))];
      setExpandedGroups(cities.slice(0, 3));
    } catch (error) {
      console.error('Error loading businesses:', error);
      toast.error('Error loading businesses');
    } finally {
      setLoading(false);
    }
  };

  // Format phone for WhatsApp (remove spaces, dashes, and + sign)
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return null;
    // Remove all non-numeric characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    // Remove leading + for WhatsApp API
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    // Ensure it starts with country code
    if (cleaned.startsWith('52') || cleaned.startsWith('1')) {
      return cleaned;
    }
    // Assume Mexico if no country code
    if (cleaned.length === 10) {
      return '52' + cleaned;
    }
    return cleaned;
  };

  // Generate personalized message
  const generateMessage = (business) => {
    return customMessage
      .replace(/{nombre}/g, business.name?.split(' ')[0] || 'Estimado/a')
      .replace(/{negocio}/g, business.name || 'su negocio')
      .replace(/{categoria}/g, business.category || 'salud')
      .replace(/{ciudad}/g, business.city || 'su ciudad');
  };

  // Generate WhatsApp link
  const generateWhatsAppLink = (business) => {
    const phone = formatPhoneForWhatsApp(business.phone);
    if (!phone) return null;
    const message = encodeURIComponent(generateMessage(business));
    return `https://api.whatsapp.com/send?phone=${phone}&text=${message}`;
  };

  // Copy link to clipboard
  const copyLink = async (business) => {
    const link = generateWhatsAppLink(business);
    if (!link) {
      toast.error('No valid phone number');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(business.id);
      toast.success('Link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // Open WhatsApp directly and log the message
  const openWhatsApp = async (business) => {
    const link = generateWhatsAppLink(business);
    if (!link) {
      toast.error('No valid phone number');
      return;
    }
    
    // Log the message
    try {
      await api.post('/scrappers/whatsapp/log-message', {
        business_id: business.id,
        business_name: business.name,
        phone: business.phone,
        template_used: selectedTemplate.name,
        message_sent: generateMessage(business)
      });
      
      // Update local state
      setContactedMap(prev => ({
        ...prev,
        [business.id]: {
          last_contacted_at: new Date().toISOString(),
          contact_count: (prev[business.id]?.contact_count || 0) + 1
        }
      }));
      
      toast.success('Message logged!');
    } catch (error) {
      console.error('Error logging message:', error);
    }
    
    window.open(link, '_blank');
  };

  // Filter businesses
  const filteredBusinesses = businesses.filter(b => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!b.name?.toLowerCase().includes(search) && 
          !b.category?.toLowerCase().includes(search) &&
          !b.address?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filterCity && b.city !== filterCity) return false;
    if (filterCategory && b.category !== filterCategory) return false;
    if (hideContacted && contactedMap[b.id]) return false;
    return true;
  });

  // Count contacted businesses
  const contactedCount = businesses.filter(b => contactedMap[b.id]).length;
  const notContactedCount = businesses.length - contactedCount;

  // Group by city
  const groupedByCity = filteredBusinesses.reduce((acc, b) => {
    const city = b.city || 'Unknown';
    if (!acc[city]) acc[city] = [];
    acc[city].push(b);
    return acc;
  }, {});

  // Sort groups by count
  const sortedGroups = Object.entries(groupedByCity)
    .sort((a, b) => b[1].length - a[1].length);

  // Get unique cities and categories for filters
  const cities = [...new Set(businesses.map(b => b.city).filter(Boolean))];
  const categories = [...new Set(businesses.map(b => b.category).filter(Boolean))];

  const expandAll = () => setExpandedGroups(Object.keys(groupedByCity));
  const collapseAll = () => setExpandedGroups([]);

  // Copy all links for a city
  const copyAllLinks = async (city) => {
    const businessesInCity = groupedByCity[city] || [];
    const links = businessesInCity
      .map(b => generateWhatsAppLink(b))
      .filter(Boolean)
      .join('\n');
    
    if (!links) {
      toast.error('No valid links to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(links);
      toast.success(`Copied ${businessesInCity.length} links!`);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };
  
  // Get all WhatsApp URLs for display
  const getAllUrls = () => {
    return filteredBusinesses
      .map(b => generateWhatsAppLink(b))
      .filter(Boolean)
      .join('\n');
  };
  
  // Copy all URLs
  const copyAllUrls = async () => {
    const urls = getAllUrls();
    if (!urls) {
      toast.error('No valid URLs to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(urls);
      toast.success(`Copied ${filteredBusinesses.length} URLs!`);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // Delete a business
  const deleteBusiness = async (businessId) => {
    try {
      await api.delete(`/scrappers/small-business/${businessId}`);
      setBusinesses(prev => prev.filter(b => b.id !== businessId));
      toast.success('Business deleted');
    } catch (error) {
      console.error('Error deleting business:', error);
      toast.error('Failed to delete business');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="whatsapp-cold-messenger-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Weekly Task Checkbox */}
          <button 
            onClick={toggleWeeklyTask}
            disabled={togglingTask}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors ${
              weeklyTaskChecked 
                ? 'bg-green-500 border-green-500' 
                : 'border-yellow-500 hover:bg-yellow-500/10'
            }`}
            title={weeklyTaskChecked ? "Weekly task completed - Click to unmark" : "Mark weekly task as completed"}
          >
            {weeklyTaskChecked && <Check className="w-5 h-5 text-white" />}
          </button>
          <div className="p-3 rounded-lg bg-green-500/20">
            <MessageCircle className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">WhatsApp Cold Messenger</h1>
            <p className="text-slate-500">
              Send personalized messages to businesses via WhatsApp
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              loadMessageLogs();
              setShowHistoryDialog(true);
            }}
            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
          >
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowTemplateDialog(true)}
            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Template
          </Button>
          <Button onClick={() => { loadBusinesses(); loadContactedStatus(); }} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{businesses.length}</p>
            <p className="text-xs text-slate-500">Total Businesses</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">{contactedCount}</p>
            <p className="text-xs text-slate-500">Contacted</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-orange-400">{notContactedCount}</p>
            <p className="text-xs text-slate-500">Not Contacted</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-400">{cities.length}</p>
            <p className="text-xs text-slate-500">Cities</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-400">{categories.length}</p>
            <p className="text-xs text-slate-500">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Message Preview */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-500" />
            Message Template: {selectedTemplate.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm bg-[#0a0a0a] p-3 rounded-lg border border-[#222]">
            {customMessage}
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Variables: {'{nombre}'}, {'{negocio}'}, {'{categoria}'}, {'{ciudad}'}
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name, category, address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            <Select value={filterCity || "all"} onValueChange={(v) => setFilterCity(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-[#333] text-white">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px] bg-[#0a0a0a] border-[#333] text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded-lg">
              <Switch 
                checked={hideContacted} 
                onCheckedChange={setHideContacted}
                className="data-[state=checked]:bg-green-600"
              />
              <span className="text-sm text-slate-400 flex items-center gap-1">
                {hideContacted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {hideContacted ? 'Hiding' : 'Show'} contacted
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business List Grouped by City */}
      {filteredBusinesses.length === 0 ? (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-12 text-center">
            <Building className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-white mb-2">No Businesses Found</h3>
            <p className="text-slate-500">
              Use &quot;Find Small Business&quot; (1.1.4) to search for businesses on Google Maps
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">
              Businesses by City ({sortedGroups.length} cities, {filteredBusinesses.length} total)
            </h3>
            <div className="flex gap-2">
              <Button 
                variant={viewMode === "grouped" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setViewMode("grouped")} 
                className={viewMode === "grouped" ? "bg-green-600" : "border-[#333] text-slate-300"}
              >
                <Building className="w-4 h-4 mr-1" /> Grouped
              </Button>
              <Button 
                variant={viewMode === "urls" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setViewMode("urls")} 
                className={viewMode === "urls" ? "bg-green-600" : "border-[#333] text-slate-300"}
              >
                <Link className="w-4 h-4 mr-1" /> URLs
              </Button>
              {viewMode === "grouped" && (
                <>
                  <Button variant="outline" size="sm" onClick={expandAll} className="border-[#333] text-slate-300">
                    <ChevronDown className="w-4 h-4 mr-1" /> Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll} className="border-[#333] text-slate-300">
                    <ChevronUp className="w-4 h-4 mr-1" /> Collapse All
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* URLs View */}
          {viewMode === "urls" && (
            <Card className="bg-[#111] border-[#222]">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Link className="w-4 h-4 text-green-500" />
                    WhatsApp API Links
                  </CardTitle>
                  <Button onClick={copyAllUrls} variant="outline" size="sm" className="border-green-500/50 text-green-400">
                    <Copy className="w-4 h-4 mr-1" /> Copy All ({filteredBusinesses.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={getAllUrls()}
                  readOnly
                  className="bg-[#0a0a0a] border-[#333] text-slate-300 font-mono text-xs min-h-[300px]"
                  placeholder="No WhatsApp URLs available"
                />
                <p className="text-xs text-slate-500 mt-2">
                  {filteredBusinesses.length} WhatsApp links ready to copy
                </p>
              </CardContent>
            </Card>
          )}
          
          {/* Grouped View */}
          {viewMode === "grouped" && (
            <Accordion 
            type="multiple" 
            value={expandedGroups}
            onValueChange={setExpandedGroups}
            className="space-y-2"
          >
            {sortedGroups.map(([city, cityBusinesses]) => (
              <AccordionItem 
                key={city} 
                value={city}
                className="border border-[#222] rounded-lg overflow-hidden bg-[#0f0f0f]"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[#151515]">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <MapPin className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="font-medium text-white">{city}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-500/20 text-green-400">
                        {cityBusinesses.length} businesses
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyAllLinks(city);
                        }}
                        className="text-slate-400 hover:text-green-400"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {cityBusinesses.map(business => {
                      const isContacted = contactedMap[business.id];
                      return (
                        <div 
                          key={business.id}
                          className={`flex items-center justify-between p-3 bg-[#111] rounded-lg border transition-colors ${
                            isContacted 
                              ? 'border-green-500/30 bg-green-500/5' 
                              : 'border-[#222] hover:border-green-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isContacted ? 'bg-green-500/30' : 'bg-green-500/20'
                            }`}>
                              {isContacted ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              ) : (
                                <Building className="w-5 h-5 text-green-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-white truncate">{business.name}</p>
                                {isContacted && (
                                  <Badge className="bg-green-500/20 text-green-400 text-xs">
                                    Contacted {isContacted.contact_count > 1 ? `(${isContacted.contact_count}x)` : ''}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                {business.category && (
                                  <span className="flex items-center gap-1">
                                    <Filter className="w-3 h-3" />
                                    {business.category}
                                  </span>
                                )}
                                {business.rating > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Star className="w-3 h-3 text-yellow-500" />
                                    {business.rating}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" />
                                {business.phone}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyLink(business)}
                              className="text-slate-400 hover:text-green-400"
                            >
                              {copiedId === business.id ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteBusiness(business.id)}
                              className="text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openWhatsApp(business)}
                              className={`text-white ${
                                isContacted 
                                  ? 'bg-blue-600 hover:bg-blue-700' 
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              <MessageCircle className="w-4 h-4 mr-1" />
                              {isContacted ? 'Follow-up' : 'WhatsApp'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          )}
        </div>
      )}

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Message Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Template</label>
              <Select 
                value={selectedTemplate.id} 
                onValueChange={(v) => {
                  const template = DEFAULT_TEMPLATES.find(t => t.id === v);
                  if (template) {
                    setSelectedTemplate(template);
                    setCustomMessage(template.message);
                  }
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Message</label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white min-h-[150px]"
                placeholder="Enter your message..."
              />
              <p className="text-xs text-slate-600 mt-2">
                Available variables: {'{nombre}'} (first name), {'{negocio}'} (business name), {'{categoria}'} (category), {'{ciudad}'} (city)
              </p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Preview:</p>
              <p className="text-sm text-slate-300">
                {customMessage
                  .replace(/{nombre}/g, 'Juan')
                  .replace(/{negocio}/g, 'Clínica Dental ABC')
                  .replace(/{categoria}/g, 'Dentista')
                  .replace(/{ciudad}/g, 'Guadalajara')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={() => setShowTemplateDialog(false)} className="bg-green-600 hover:bg-green-700">
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Message History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {messageLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages sent yet</p>
              </div>
            ) : (
              messageLogs.map(log => (
                <div key={log.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-white">{log.business_name}</span>
                    </div>
                    <Badge className="bg-slate-700 text-slate-300 text-xs">
                      {log.template_used}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                    <Phone className="w-3 h-3" />
                    {log.phone}
                  </p>
                  <p className="text-sm text-slate-400 bg-slate-800 p-2 rounded text-ellipsis overflow-hidden" style={{maxHeight: '60px'}}>
                    {log.message_sent}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.sent_at).toLocaleString()}
                    {log.sent_by && <span className="ml-2">by {log.sent_by}</span>}
                  </p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)} className="border-slate-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppColdMessenger;
