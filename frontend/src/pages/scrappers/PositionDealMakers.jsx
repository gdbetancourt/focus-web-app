import React, { useState, useEffect } from 'react';
import { Users, Briefcase, RefreshCw, Play, History, Clock, Calendar, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, ChevronUp, ExternalLink, Target, TrendingUp, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/ui/collapsible';
import { toast } from 'sonner';
import api from '../../lib/api';
import ApifyStatusIndicator from '../../components/ApifyStatusIndicator';

const PositionDealMakers = () => {
  const [isSearching, setIsSearching] = useState({});
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('buyer-personas');
  const [expandedPersonas, setExpandedPersonas] = useState({});
  
  // State for search history
  const [expandedHistory, setExpandedHistory] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [loadingHistory, setLoadingHistory] = useState({});
  const [expandedRuns, setExpandedRuns] = useState({});
  
  // Traffic light status for this finder
  const [trafficStatus, setTrafficStatus] = useState(null);
  
  // Weekly progress and rate limit alert
  const [weeklyProgress, setWeeklyProgress] = useState(null);
  const [syncingKeywords, setSyncingKeywords] = useState(false);
  const [runningWeeklySearch, setRunningWeeklySearch] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [personasRes, runsRes, schedulesRes, summaryRes, trafficRes, progressRes] = await Promise.all([
        api.get('/buyer-personas-db/'),
        api.get('/scrappers/logs/runs?scrapper_id=deal_makers_by_position&limit=20'),
        api.get('/scheduler/schedules?schedule_type=buyer_persona').catch(() => ({ data: { schedules: [] } })),
        api.get('/scheduler/summary/deal_makers_by_position').catch(() => ({ data: {} })),
        api.get('/scheduler/traffic-light').catch(() => ({ data: { status: {} } })),
        api.get('/position-search/weekly-progress').catch(() => ({ data: null }))
      ]);
      
      setBuyerPersonas(personasRes.data || []);
      setRecentRuns(runsRes.data.runs || []);
      setSchedules(schedulesRes.data.schedules || []);
      setSummary(summaryRes.data);
      setTrafficStatus(trafficRes.data.status?.["1.1.1.3"] || null);
      setWeeklyProgress(progressRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading position data');
    } finally {
      setLoading(false);
    }
  };

  // Sync keywords from buyer personas
  const syncKeywords = async () => {
    setSyncingKeywords(true);
    try {
      const response = await api.post('/position-search/sync-keywords');
      if (response.data.success) {
        toast.success(`Keywords sincronizadas: ${response.data.synced} nuevas, ${response.data.skipped} existentes`);
        loadData();
      }
    } catch (error) {
      console.error('Error syncing keywords:', error);
      toast.error('Error al sincronizar keywords');
    } finally {
      setSyncingKeywords(false);
    }
  };

  // Run weekly search for all personas
  const runWeeklySearch = async () => {
    setRunningWeeklySearch(true);
    try {
      const response = await api.post('/position-search/run-weekly-search');
      if (response.data.success) {
        toast.success(`Búsqueda iniciada para ${response.data.started} buyer personas`);
        setTimeout(() => loadData(), 5000);
      }
    } catch (error) {
      console.error('Error running weekly search:', error);
      toast.error('Error al iniciar búsqueda semanal');
    } finally {
      setRunningWeeklySearch(false);
    }
  };

  // Resolve rate limit alert
  const resolveAlert = async (alertId) => {
    try {
      await api.post(`/position-search/resolve-alert/${alertId}`);
      toast.success('Alerta resuelta');
      loadData();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Error al resolver alerta');
    }
  };

  // Search by buyer persona - uses ALL keywords from that persona
  const searchByPersona = async (persona) => {
    setIsSearching(prev => ({ ...prev, [persona.code]: true }));
    try {
      // Get all keywords for this persona - use 'keywords' field or fallback to 'linkedin_keywords'
      let keywords = persona.keywords || persona.linkedin_keywords || [];
      
      // If keywords is a string, split by semicolon
      if (typeof keywords === 'string') {
        keywords = keywords.split(';').map(k => k.trim()).filter(k => k);
      }
      
      if (keywords.length === 0) {
        toast.error(`No keywords found for ${persona.display_name || persona.name}`);
        setIsSearching(prev => ({ ...prev, [persona.code]: false }));
        return;
      }

      const response = await api.post('/scrappers/search/deal-makers-by-position', {
        job_titles: keywords,
        use_buyer_personas: false,
        location: 'Mexico',
        limit: 50,
        buyer_persona: persona.code
      });
      
      if (response.data.success) {
        toast.success(`Searching ${keywords.length} keywords for ${persona.display_name || persona.name}`);
        
        // Create/update schedule for this buyer persona (every 15 days)
        await api.post('/scheduler/schedules', {
          schedule_type: 'buyer_persona',
          entity_id: persona.code,
          entity_name: persona.display_name || persona.name,
          frequency: 'biweekly',
          params: { persona_code: persona.code, keywords: keywords }
        });
        
        setTimeout(() => loadData(), 3000);
      }
    } catch (error) {
      console.error('Error starting search:', error);
      toast.error(error.response?.data?.detail || 'Failed to start search');
    } finally {
      setIsSearching(prev => ({ ...prev, [persona.code]: false }));
    }
  };

  // Get schedule for a buyer persona
  const getSchedule = (personaCode) => {
    return schedules.find(s => s.entity_id === personaCode);
  };

  // Format date for display
  const formatDate = (isoDate) => {
    if (!isoDate) return 'Never';
    const date = new Date(isoDate);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Calculate days until next run
  const getDaysUntil = (isoDate) => {
    if (!isoDate) return null;
    const next = new Date(isoDate);
    const now = new Date();
    const diff = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Toggle and load history for a buyer persona
  const toggleHistory = async (personaCode, personaName) => {
    const isExpanded = expandedHistory[personaCode];
    
    if (isExpanded) {
      setExpandedHistory(prev => ({ ...prev, [personaCode]: false }));
      return;
    }
    
    setExpandedHistory(prev => ({ ...prev, [personaCode]: true }));
    
    if (!historyData[personaCode]) {
      setLoadingHistory(prev => ({ ...prev, [personaCode]: true }));
      try {
        const [historyRes, contactsRes] = await Promise.all([
          api.get(`/scheduler/history/${personaCode}`),
          api.get(`/contacts?buyer_persona=${personaCode}&source=linkedin&limit=50`)
        ]);
        
        setHistoryData(prev => ({
          ...prev,
          [personaCode]: {
            runs: historyRes.data.history || [],
            contacts: contactsRes.data.contacts || []
          }
        }));
      } catch (error) {
        console.error('Error loading history:', error);
        toast.error('Error loading history');
      } finally {
        setLoadingHistory(prev => ({ ...prev, [personaCode]: false }));
      }
    }
  };

  // Toggle run expansion to show contacts
  const toggleRunExpansion = async (runId, buyerPersona) => {
    const isExpanded = expandedRuns[runId];
    
    if (isExpanded) {
      setExpandedRuns(prev => ({ ...prev, [runId]: null }));
      return;
    }
    
    try {
      const contactsRes = await api.get(`/contacts?buyer_persona=${buyerPersona}&source=linkedin&limit=20`);
      setExpandedRuns(prev => ({ 
        ...prev, 
        [runId]: contactsRes.data.contacts || [] 
      }));
    } catch (error) {
      console.error('Error loading run contacts:', error);
    }
  };

  const togglePersona = (code) => {
    setExpandedPersonas(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="position-deal-makers-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/20">
            <Briefcase className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Find by Position</h1>
            <p className="text-slate-500">
              Search LinkedIn profiles by buyer persona keywords (10 contacts/week goal)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ApifyStatusIndicator />
          <Button 
            onClick={syncKeywords} 
            variant="outline" 
            className="border-[#333] text-slate-300"
            disabled={syncingKeywords}
          >
            {syncingKeywords ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
            <span className="ml-2">Sync Keywords</span>
          </Button>
          <Button 
            onClick={runWeeklySearch} 
            className="bg-purple-500 hover:bg-purple-600"
            disabled={runningWeeklySearch}
          >
            {runningWeeklySearch ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="ml-2">Run Weekly Search</span>
          </Button>
          <Button onClick={loadData} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Rate Limit Alert */}
      {weeklyProgress?.rate_limit_alert && (
        <Card className="bg-red-500/10 border-red-500/50 border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <div>
                  <h3 className="text-red-400 font-bold">⚠️ Límite de Apify Alcanzado</h3>
                  <p className="text-red-300/80 text-sm">
                    {weeklyProgress.rate_limit_alert.message || 'Se alcanzó el límite de búsquedas. El semáforo está en rojo.'}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => resolveAlert(weeklyProgress.rate_limit_alert.id)}
                variant="outline"
                className="border-red-500 text-red-400 hover:bg-red-500/20"
              >
                Marcar como Resuelto
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Goal Status - Traffic Light */}
      {trafficStatus && (
        <Card className={`border-2 ${
          trafficStatus.status === 'green' ? 'bg-green-500/10 border-green-500/50' :
          trafficStatus.status === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50' :
          'bg-red-500/10 border-red-500/50'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Traffic Light Indicator */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  trafficStatus.status === 'green' ? 'bg-green-500' :
                  trafficStatus.status === 'yellow' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}>
                  {trafficStatus.status === 'green' ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : trafficStatus.status === 'yellow' ? (
                    <TrendingUp className="w-6 h-6 text-white" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-white" />
                  )}
                </div>
                
                {/* Status Text */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${
                      trafficStatus.status === 'green' ? 'text-green-400' :
                      trafficStatus.status === 'yellow' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {trafficStatus.status === 'green' ? '¡Meta Semanal Alcanzada!' :
                       trafficStatus.status === 'yellow' ? 'Progreso esta semana' :
                       'Sin contactos nuevos esta semana'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">
                    {trafficStatus.status === 'green' ? (
                      <>
                        <span className="text-green-400 font-semibold">{trafficStatus.contacts_this_week}</span> contactos encontrados esta semana 
                        <span className="text-slate-500"> (meta: {trafficStatus.goal})</span>
                      </>
                    ) : trafficStatus.status === 'yellow' ? (
                      <>
                        <span className="text-yellow-400 font-semibold">{trafficStatus.contacts_this_week}</span> de {trafficStatus.goal} contactos 
                        <span className="text-slate-500"> — faltan {trafficStatus.goal - trafficStatus.contacts_this_week} para alcanzar la meta</span>
                      </>
                    ) : (
                      <>
                        <span className="text-red-400 font-semibold">0</span> contactos encontrados 
                        <span className="text-slate-500"> — ejecuta búsquedas para encontrar Deal Makers</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              
              {/* Progress Badge */}
              <div className="text-right">
                <Badge className={`text-lg px-3 py-1 ${
                  trafficStatus.status === 'green' ? 'bg-green-500/20 text-green-400' :
                  trafficStatus.status === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  <Target className="w-4 h-4 mr-2" />
                  {trafficStatus.progress}
                </Badge>
                <p className="text-xs text-slate-500 mt-1">Meta semanal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{summary?.total_deal_makers_found || 0}</div>
            <div className="text-xs text-slate-500">Total DMs Found</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-400">{buyerPersonas.length}</div>
            <div className="text-xs text-slate-500">Buyer Personas</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{schedules.length}</div>
            <div className="text-xs text-slate-500">Scheduled</div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{summary?.successful_searches || 0}</div>
            <div className="text-xs text-slate-500">Successful Searches</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-purple-500/10 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-purple-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>
              <strong>Meta semanal:</strong> 10 contactos únicos por buyer persona. 
              Las búsquedas se ejecutan automáticamente cada <strong>domingo</strong> usando rotación de keywords.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="buyer-personas" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Users className="w-4 h-4 mr-2" />
            Buyer Personas
          </TabsTrigger>
          <TabsTrigger value="recent-searches" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <History className="w-4 h-4 mr-2" />
            Recent Searches ({recentRuns.length})
          </TabsTrigger>
        </TabsList>

        {/* Buyer Personas Tab */}
        <TabsContent value="buyer-personas" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Buyer Personas from WHO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {buyerPersonas.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No buyer personas found. Configure them in WHO section.</p>
                </div>
              ) : (
                buyerPersonas.map(persona => {
                  const schedule = getSchedule(persona.code);
                  const daysUntil = schedule ? getDaysUntil(schedule.next_run) : null;
                  // Handle keywords - use 'keywords' field (array) or fallback to 'linkedin_keywords'
                  let keywords = persona.keywords || persona.linkedin_keywords || [];
                  if (typeof keywords === 'string') {
                    keywords = keywords.split(';').map(k => k.trim()).filter(k => k);
                  }
                  
                  return (
                    <div key={persona.code} className="border border-[#222] rounded-lg overflow-hidden">
                      <Collapsible
                        open={expandedPersonas[persona.code]}
                        onOpenChange={() => togglePersona(persona.code)}
                      >
                        <div className="flex items-center justify-between p-4 hover:bg-[#1a1a1a] cursor-pointer transition-colors">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-4 flex-1 cursor-pointer">
                              <div className="text-slate-400">
                                {expandedPersonas[persona.code] ? (
                                  <ChevronDown className="w-5 h-5" />
                                ) : (
                                  <ChevronRight className="w-5 h-5" />
                                )}
                              </div>
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: persona.color || '#8b5cf6' }}
                              />
                              <span className="text-white font-medium">{persona.display_name || persona.name}</span>
                              <Badge variant="outline" className="border-[#333] text-slate-500">
                                {keywords.length} keywords
                              </Badge>
                            </div>
                          </CollapsibleTrigger>
                          
                          {/* Schedule Status Info */}
                          <div className="flex items-center gap-3 mr-4">
                            {schedule ? (
                              <div className="flex items-center gap-2 text-xs">
                                {/* Status Badge */}
                                {schedule.last_run_status === 'running' && (
                                  <Badge className="bg-blue-500/20 text-blue-400 animate-pulse">
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                    Running
                                  </Badge>
                                )}
                                {schedule.last_run_status === 'completed' && (
                                  <Badge className="bg-green-500/20 text-green-400">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Done
                                  </Badge>
                                )}
                                {schedule.last_run_status === 'failed' && (
                                  <Badge className="bg-red-500/20 text-red-400">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Failed
                                  </Badge>
                                )}
                                
                                {/* Last Run Date */}
                                <div className="flex items-center gap-1 text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(schedule.last_run)}
                                </div>
                                
                                {/* Days Until Next */}
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                                  daysUntil && daysUntil < 0 
                                    ? 'bg-red-500/10 text-red-400' 
                                    : daysUntil && daysUntil <= 7 
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'text-slate-500'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  {daysUntil !== null ? (
                                    daysUntil < 0 
                                      ? `${Math.abs(daysUntil)}d overdue` 
                                      : `${daysUntil}d`
                                  ) : 'Pending'}
                                </div>
                                
                                {/* Results Count */}
                                {schedule.last_run_results && (
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <Users className="w-3 h-3" />
                                    {schedule.last_run_results.deal_makers_added || schedule.last_run_results.results_count || 0}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600">Not scheduled</span>
                            )}
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              searchByPersona(persona);
                            }}
                            disabled={isSearching[persona.code] || keywords.length === 0}
                            className="bg-purple-500 hover:bg-purple-500/90"
                          >
                            {isSearching[persona.code] ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-1" />
                                Find DMs
                              </>
                            )}
                          </Button>
                          
                          {/* History Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHistory(persona.code, persona.display_name || persona.name);
                            }}
                            className="ml-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                          >
                            <History className="w-4 h-4 mr-1" />
                            {expandedHistory[persona.code] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                        </div>
                        
                        <CollapsibleContent>
                          <div className="border-t border-[#222] bg-[#0a0a0a] p-4">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                              LinkedIn Keywords
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {keywords.map((kw, idx) => (
                                <Badge 
                                  key={idx}
                                  variant="outline" 
                                  className="border-purple-500/30 text-purple-400"
                                >
                                  {kw}
                                </Badge>
                              ))}
                              {keywords.length === 0 && (
                                <span className="text-slate-600 text-sm">No keywords configured</span>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      
                      {/* Search History Section */}
                      {expandedHistory[persona.code] && (
                        <div className="border-t border-blue-500/30 bg-blue-500/5 p-4">
                          <div className="text-xs text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <History className="w-3 h-3" />
                            Search History & Found Contacts
                          </div>
                          
                          {loadingHistory[persona.code] ? (
                            <div className="flex items-center justify-center py-8">
                              <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                            </div>
                          ) : historyData[persona.code] ? (
                            <div className="space-y-4">
                              {/* Found Contacts Summary */}
                              <div className="bg-[#111] rounded-lg p-3 border border-[#222]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-white font-medium">
                                    {historyData[persona.code].contacts.length} Contacts Found
                                  </span>
                                  <Badge 
                                    className="text-white"
                                    style={{ backgroundColor: `${persona.color || '#8b5cf6'}40` }}
                                  >
                                    {persona.display_name || persona.name}
                                  </Badge>
                                </div>
                                
                                {/* Contact List */}
                                {historyData[persona.code].contacts.length > 0 ? (
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                    {historyData[persona.code].contacts.slice(0, 15).map((contact, idx) => (
                                      <div 
                                        key={contact.id || idx}
                                        className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-[#1a1a1a] rounded"
                                      >
                                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                          <span className="text-purple-400 text-xs font-bold">
                                            {contact.name?.charAt(0)?.toUpperCase() || "?"}
                                          </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <span className="text-white">{contact.name}</span>
                                          {contact.job_title && (
                                            <span className="text-slate-500 ml-2 text-xs">
                                              - {contact.job_title}
                                            </span>
                                          )}
                                        </div>
                                        {contact.linkedin_url && (
                                          <a 
                                            href={contact.linkedin_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                    {historyData[persona.code].contacts.length > 15 && (
                                      <div className="text-center text-slate-500 text-xs py-2">
                                        +{historyData[persona.code].contacts.length - 15} more contacts
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center text-slate-500 text-sm py-4">
                                    No contacts found yet. Run a search to find deal makers.
                                  </div>
                                )}
                              </div>
                              
                              {/* Search Runs */}
                              {historyData[persona.code].runs.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs text-slate-500 uppercase">Recent Runs</div>
                                  {historyData[persona.code].runs.slice(0, 5).map((run, idx) => (
                                    <div 
                                      key={run.id || idx}
                                      className="flex items-center justify-between py-2 px-3 bg-[#111] rounded border border-[#1a1a1a] text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        {run.status === 'completed' ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                                        ) : run.status === 'failed' ? (
                                          <AlertCircle className="w-4 h-4 text-red-400" />
                                        ) : (
                                          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                                        )}
                                        <span className="text-slate-400">
                                          {formatDate(run.started_at || run.completed_at)}
                                        </span>
                                      </div>
                                      <Badge className={run.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                                        {run.results?.results_count || run.results?.deal_makers_added || 0} found
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-slate-500 text-sm py-4">
                              No history available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Searches Tab */}
        <TabsContent value="recent-searches" className="space-y-4">
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-500" />
                Recent Searches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentRuns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No recent searches. Click &quot;Find DMs&quot; on a buyer persona to start.</p>
                </div>
              ) : (
                recentRuns.map(run => (
                  <div key={run.id} className="border border-[#222] rounded-lg overflow-hidden">
                    <div 
                      className={`p-4 cursor-pointer hover:bg-[#151515] transition-colors ${
                        run.status === 'completed' ? 'bg-green-500/5' : 
                        run.status === 'failed' ? 'bg-red-500/5' : 
                        'bg-blue-500/5'
                      }`}
                      onClick={() => toggleRunExpansion(run.id, run.params?.buyer_persona)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {run.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : run.status === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                          )}
                          <Briefcase className="w-4 h-4 text-slate-400" />
                          <span className="text-white font-medium">
                            {run.params?.buyer_persona || 'Position Search'}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 text-sm">
                            {run.params?.job_titles?.length || 0} titles
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 text-sm">
                            {run.started_at && new Date(run.started_at).toLocaleString('es-MX')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(run.results_count > 0 || run.results?.deal_makers_added > 0) && (
                            <Badge className="bg-purple-500/20 text-purple-400">
                              <Users className="w-3 h-3 mr-1" />
                              {run.results_count || run.results?.deal_makers_added} DMs
                            </Badge>
                          )}
                          <Badge className={`${
                            run.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                            run.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {run.status}
                          </Badge>
                          {expandedRuns[run.id] !== undefined ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                      
                      {/* Show job titles */}
                      <div className="flex flex-wrap gap-1">
                        {(run.params?.job_titles || []).slice(0, 8).map((title, idx) => (
                          <Badge key={idx} variant="outline" className="border-[#333] text-slate-400 text-xs">
                            {title}
                          </Badge>
                        ))}
                        {(run.params?.job_titles?.length || 0) > 8 && (
                          <Badge variant="outline" className="border-[#333] text-slate-500 text-xs">
                            +{run.params.job_titles.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Expanded Contacts List */}
                    {expandedRuns[run.id] && (
                      <div className="border-t border-[#222] bg-[#0a0a0a] p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          Contacts Found in This Search
                        </div>
                        {expandedRuns[run.id].length > 0 ? (
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {expandedRuns[run.id].map((contact, idx) => (
                              <div 
                                key={contact.id || idx}
                                className="flex items-center gap-2 py-2 px-3 text-sm hover:bg-[#111] rounded"
                              >
                                <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-purple-400 text-xs font-bold">
                                    {contact.name?.charAt(0)?.toUpperCase() || "?"}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white">{contact.name}</div>
                                  {contact.job_title && (
                                    <div className="text-slate-500 text-xs truncate">
                                      {contact.job_title} {contact.company && `@ ${contact.company}`}
                                    </div>
                                  )}
                                </div>
                                {contact.linkedin_url && (
                                  <a 
                                    href={contact.linkedin_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-slate-500 text-sm py-4">
                            No contacts available for this search
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PositionDealMakers;
