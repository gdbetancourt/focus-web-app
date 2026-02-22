import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import api from "../../lib/api";
import ApifyStatusIndicator from "../../components/ApifyStatusIndicator";
import {
  RefreshCw,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pill,
  FlaskConical,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  History,
  ExternalLink,
  Target,
  TrendingUp
} from "lucide-react";

export default function MoleculesDealMakers() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState({});
  const [filterArea, setFilterArea] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [runs, setRuns] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("business-units");
  
  // State for expanded search history per business unit
  const [expandedHistory, setExpandedHistory] = useState({});
  const [historyData, setHistoryData] = useState({}); // { groupKey: { runs: [], contacts: [] } }
  const [loadingHistory, setLoadingHistory] = useState({});
  
  // Traffic light status for this finder
  const [trafficStatus, setTrafficStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [medsRes, runsRes, schedulesRes, summaryRes, trafficRes] = await Promise.all([
        api.get("/scrappers/pharma/medications?limit=500"),
        api.get("/scrappers/logs/runs?scrapper_id=molecules_deal_makers&limit=20"),
        api.get("/scheduler/schedules?schedule_type=business_unit").catch(() => ({ data: { schedules: [] } })),
        api.get("/scheduler/summary/molecules_deal_makers").catch(() => ({ data: {} })),
        api.get("/scheduler/traffic-light").catch(() => ({ data: { status: {} } }))
      ]);
      
      setMedications(medsRes.data.medications || medsRes.data || []);
      setRuns(runsRes.data.runs || []);
      setSchedules(schedulesRes.data.schedules || []);
      setSummary(summaryRes.data);
      setTrafficStatus(trafficRes.data.status?.["1.1.1.1"] || null);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchDealMakers = async (companyName, therapeuticArea, groupKey) => {
    setSearching(prev => ({ ...prev, [groupKey]: true }));
    try {
      // Get current schedule to use its frequency
      const schedule = getSchedule(groupKey);
      const frequency = schedule?.frequency || "monthly";
      
      await api.post("/scrappers/search/molecules-deal-makers", null, {
        params: { company_name: companyName, therapeutic_area: therapeuticArea }
      });
      toast.success(`Searching deal makers for ${therapeuticArea} at ${companyName}`);
      
      // Create/update schedule for this business unit - this now resets the clock
      await api.post("/scheduler/schedules", {
        schedule_type: "business_unit",
        entity_id: groupKey,
        entity_name: `${companyName} - ${therapeuticArea}`,
        frequency: frequency,
        params: { company: companyName, therapeutic_area: therapeuticArea }
      });
      
      setTimeout(loadData, 3000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error starting search");
    } finally {
      setSearching(prev => ({ ...prev, [groupKey]: false }));
    }
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  // Update schedule frequency for a business unit
  const updateScheduleFrequency = async (unit, frequency) => {
    try {
      // Create or update schedule
      await api.post("/scheduler/schedules", {
        schedule_type: "business_unit",
        entity_id: unit.key,
        entity_name: `${unit.company} - ${unit.area}`,
        frequency: frequency,
        params: { company: unit.company, therapeutic_area: unit.area }
      });
      toast.success(`Schedule updated to ${frequency}`);
      loadData();
    } catch (error) {
      toast.error("Error updating schedule");
    }
  };

  // Get schedule for a business unit
  const getSchedule = (groupKey) => {
    return schedules.find(s => s.entity_id === groupKey);
  };

  // Toggle and load history for a business unit
  const toggleHistory = async (groupKey, company, area) => {
    const isExpanded = expandedHistory[groupKey];
    
    if (isExpanded) {
      // Collapse
      setExpandedHistory(prev => ({ ...prev, [groupKey]: false }));
      return;
    }
    
    // Expand and load data if not already loaded
    setExpandedHistory(prev => ({ ...prev, [groupKey]: true }));
    
    if (!historyData[groupKey]) {
      setLoadingHistory(prev => ({ ...prev, [groupKey]: true }));
      try {
        // Load search history for this business unit
        const [historyRes, contactsRes] = await Promise.all([
          api.get(`/scheduler/history/${groupKey}`),
          api.get(`/contacts?source=molecules&company=${encodeURIComponent(company)}&limit=100`)
        ]);
        
        setHistoryData(prev => ({
          ...prev,
          [groupKey]: {
            runs: historyRes.data.history || [],
            contacts: contactsRes.data.contacts || []
          }
        }));
      } catch (error) {
        console.error("Error loading history:", error);
        toast.error("Error loading history");
      } finally {
        setLoadingHistory(prev => ({ ...prev, [groupKey]: false }));
      }
    }
  };

  // Format date for display
  const formatDate = (isoDate) => {
    if (!isoDate) return "Never";
    const date = new Date(isoDate);
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  };

  // Calculate days until next run
  const getDaysUntil = (isoDate) => {
    if (!isoDate) return null;
    const next = new Date(isoDate);
    const now = new Date();
    const diff = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Get unique companies and areas for filters
  const companies = [...new Set(medications.map(m => m.empresa).filter(Boolean))].sort();
  const areas = [...new Set(medications.map(m => m.area_terapeutica).filter(Boolean))].sort();

  // Filter medications
  const filteredMeds = medications.filter(m => {
    if (filterArea && m.area_terapeutica !== filterArea) return false;
    if (filterCompany && m.empresa !== filterCompany) return false;
    return true;
  });

  // Group by Therapeutic Area + Company (Business Units with upcoming launches)
  const groupedData = filteredMeds.reduce((acc, med) => {
    const area = med.area_terapeutica || "Unknown";
    const company = med.empresa || "Unknown";
    const groupKey = `${area}|||${company}`;
    
    if (!acc[groupKey]) {
      acc[groupKey] = {
        area,
        company,
        molecules: []
      };
    }
    acc[groupKey].molecules.push({
      name: med.molecula || med.nombre,
      phase: med.fase || "Unknown",
      id: med.id
    });
    return acc;
  }, {});

  // Convert to array and sort by area then company
  const businessUnits = Object.entries(groupedData)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => {
      const areaCompare = a.area.localeCompare(b.area);
      if (areaCompare !== 0) return areaCompare;
      return a.company.localeCompare(b.company);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="molecules-deal-makers-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#ff3300]/20">
            <FlaskConical className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Find Business Units Deal Makers</h1>
            <p className="text-slate-500">
              Search decision makers by business units with upcoming launches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ApifyStatusIndicator />
          <Button onClick={loadData} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

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
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{summary.total_deal_makers_found || 0}</div>
              <div className="text-xs text-slate-500">Total DMs Found</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-400">{summary.successful_searches || 0}</div>
              <div className="text-xs text-slate-500">Successful Searches</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-white">{businessUnits.length}</div>
              <div className="text-xs text-slate-500">Business Units</div>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-400">{schedules.length}</div>
              <div className="text-xs text-slate-500">Scheduled</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="business-units" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
            <Building2 className="w-4 h-4 mr-2" />
            Business Units
          </TabsTrigger>
          <TabsTrigger value="recent-searches" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
            <History className="w-4 h-4 mr-2" />
            Recent Searches ({runs.length})
          </TabsTrigger>
        </TabsList>

        {/* Business Units Tab */}
        <TabsContent value="business-units" className="space-y-4">
          {/* Filters */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <Select value={filterArea || "all"} onValueChange={(v) => setFilterArea(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[200px] bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue placeholder="Therapeutic Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {areas.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCompany || "all"} onValueChange={(v) => setFilterCompany(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[200px] bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue placeholder="Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 flex justify-end">
                  <Badge variant="outline" className="border-[#333] text-slate-400">
                    {businessUnits.length} Business Units
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Units List */}
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#ff3300]" />
                Business Units with Upcoming Launches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {businessUnits.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No business units found. Scrape pharmaceutical pipelines first.</p>
                </div>
              ) : (
                businessUnits.map(unit => {
                  const schedule = getSchedule(unit.key);
                  const daysUntil = schedule ? getDaysUntil(schedule.next_run) : null;
                  
                  return (
                    <Collapsible
                      key={unit.key}
                      open={expandedGroups[unit.key]}
                      onOpenChange={() => toggleGroup(unit.key)}
                    >
                      <div className="border border-[#222] rounded-lg overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 hover:bg-[#1a1a1a] cursor-pointer transition-colors">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="text-slate-400">
                                {expandedGroups[unit.key] ? (
                                  <ChevronDown className="w-5 h-5" />
                                ) : (
                                  <ChevronRight className="w-5 h-5" />
                                )}
                              </div>
                              <Badge className="bg-purple-500/20 text-purple-400 shrink-0">
                                {unit.area}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-500" />
                                <span className="text-white font-medium">{unit.company}</span>
                              </div>
                              <Badge variant="outline" className="border-[#333] text-slate-500">
                                {unit.molecules.length} molecules
                              </Badge>
                            </div>
                            
                            {/* Schedule Info */}
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
                                        : `${daysUntil}d until next`
                                    ) : 'Pending'}
                                  </div>
                                  
                                  {/* Results Summary */}
                                  {schedule.last_run_results && (
                                    <div className="flex items-center gap-1 text-slate-400">
                                      <Users className="w-3 h-3" />
                                      {schedule.last_run_results.deal_makers_added || schedule.last_run_results.results_count || 0} found
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 border-slate-600">
                                  Not scheduled
                                </Badge>
                              )}
                            </div>
                            
                            {/* Frequency Selector */}
                            <Select 
                              value={schedule?.frequency || "monthly"}
                              onValueChange={(val) => updateScheduleFrequency(unit, val)}
                            >
                              <SelectTrigger 
                                className="w-[100px] h-8 text-xs bg-[#111] border-[#333]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SelectValue placeholder="Freq" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="biweekly">Biweekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                searchDealMakers(unit.company, unit.area, unit.key);
                              }}
                              disabled={searching[unit.key]}
                              className="bg-[#ff3300] hover:bg-[#ff3300]/90"
                            >
                              {searching[unit.key] ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Users className="w-4 h-4 mr-1" />
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
                                toggleHistory(unit.key, unit.company, unit.area);
                              }}
                              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                            >
                              <History className="w-4 h-4 mr-1" />
                              History
                              {expandedHistory[unit.key] ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                            </Button>
                          </div>
                        </CollapsibleTrigger>
                        
                        {/* Search History Section */}
                        {expandedHistory[unit.key] && (
                          <div className="border-t border-blue-500/30 bg-blue-500/5 p-4">
                            <div className="text-xs text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <History className="w-3 h-3" />
                              Search History & Found Contacts
                            </div>
                            
                            {loadingHistory[unit.key] ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                              </div>
                            ) : historyData[unit.key] ? (
                              <div className="space-y-4">
                                {/* Found Contacts Summary */}
                                <div className="bg-[#111] rounded-lg p-3 border border-[#222]">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-medium">
                                      {historyData[unit.key].contacts.length} Contacts Found
                                    </span>
                                    <Badge className="bg-green-500/20 text-green-400">
                                      From {unit.company}
                                    </Badge>
                                  </div>
                                  
                                  {/* Contact List */}
                                  {historyData[unit.key].contacts.length > 0 ? (
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {historyData[unit.key].contacts.slice(0, 20).map((contact, idx) => (
                                        <div 
                                          key={contact.id || idx}
                                          className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-[#1a1a1a] rounded"
                                        >
                                          <div className="w-6 h-6 rounded-full bg-[#ff3300]/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[#ff3300] text-xs font-bold">
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
                                      {historyData[unit.key].contacts.length > 20 && (
                                        <div className="text-center text-slate-500 text-xs py-2">
                                          +{historyData[unit.key].contacts.length - 20} more contacts
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
                                {historyData[unit.key].runs.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-xs text-slate-500 uppercase">Recent Runs</div>
                                    {historyData[unit.key].runs.slice(0, 5).map((run, idx) => (
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
                        
                        <CollapsibleContent>
                          <div className="border-t border-[#222] bg-[#0a0a0a] p-4">
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                              Molecules in Pipeline
                            </div>
                            <div className="grid gap-2">
                              {unit.molecules.map((mol, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-center justify-between py-2 px-3 bg-[#111] rounded border border-[#1a1a1a]"
                                >
                                  <div className="flex items-center gap-3">
                                    <Pill className="w-4 h-4 text-[#ff3300]" />
                                    <span className="text-white">{mol.name}</span>
                                  </div>
                                  <Badge 
                                    variant="outline" 
                                    className={`
                                      ${mol.phase.toLowerCase().includes('phase 3') ? 'border-green-500/50 text-green-400' : ''}
                                      ${mol.phase.toLowerCase().includes('phase 2') ? 'border-yellow-500/50 text-yellow-400' : ''}
                                      ${mol.phase.toLowerCase().includes('phase 1') ? 'border-blue-500/50 text-blue-400' : ''}
                                      ${mol.phase.toLowerCase().includes('approved') ? 'border-emerald-500/50 text-emerald-400' : ''}
                                      ${mol.phase.toLowerCase().includes('filed') ? 'border-purple-500/50 text-purple-400' : ''}
                                      ${!mol.phase.toLowerCase().includes('phase') && !mol.phase.toLowerCase().includes('approved') && !mol.phase.toLowerCase().includes('filed') ? 'border-slate-500/50 text-slate-400' : ''}
                                    `}
                                  >
                                    {mol.phase}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
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
                <History className="w-5 h-5 text-[#ff3300]" />
                Recent Searches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {runs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No recent searches. Start by clicking &quot;Find DMs&quot; on a business unit.</p>
                </div>
              ) : (
                runs.map(run => (
                  <div 
                    key={run.id}
                    className={`p-4 rounded-lg border ${run.status === 'completed' ? 'border-green-500/30 bg-green-500/5' : run.status === 'failed' ? 'border-red-500/30 bg-red-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-white font-medium">{run.params?.company || "Unknown"}</span>
                        <span className="text-slate-500">•</span>
                        <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                          {run.params?.therapeutic_area || "Unknown Area"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {run.results?.searches_performed > 0 && (
                          <Badge className="bg-blue-500/10 text-blue-400 text-xs">{run.results?.searches_performed} searches</Badge>
                        )}
                        {(run.results_count > 0 || run.results?.deal_makers_added > 0) && (
                          <Badge className="bg-white/10 text-white text-xs">{run.results_count || run.results?.deal_makers_added} DMs</Badge>
                        )}
                        <Badge className={`text-xs ${run.status === 'completed' ? 'bg-green-500/20 text-green-400' : run.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Search queries */}
                    <div className="mt-2 p-2 bg-[#0a0a0a] rounded border border-[#222] max-h-32 overflow-y-auto">
                      <div className="text-xs text-slate-500 mb-1">
                        Search Queries ({run.search_queries?.length || run.params?.keywords?.length || 1}):
                      </div>
                      <div className="space-y-1">
                        {run.search_queries ? (
                          run.search_queries.map((query, idx) => (
                            <code key={idx} className="block text-xs text-[#ff3300] font-mono">
                              {query}
                            </code>
                          ))
                        ) : (
                          (run.params?.keywords || []).map((keyword, idx) => (
                            <code key={idx} className="block text-xs text-[#ff3300] font-mono">
                              {run.params?.company} {keyword} Mexico
                            </code>
                          ))
                        )}
                      </div>
                    </div>
                    
                    {run.results?.duplicates_skipped > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        {run.results.duplicates_skipped} duplicates skipped, {run.results.filtered_non_mexico || 0} non-Mexico filtered
                      </div>
                    )}
                    
                    <div className="mt-2 text-xs text-slate-600">
                      {run.started_at && new Date(run.started_at).toLocaleString("es-MX")}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
