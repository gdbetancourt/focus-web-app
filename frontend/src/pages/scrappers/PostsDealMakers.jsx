import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import api from "../../lib/api";
import ApifyStatusIndicator from "../../components/ApifyStatusIndicator";
import {
  FileText,
  RefreshCw,
  Play,
  Plus,
  Settings,
  History,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  ExternalLink,
  AlertCircle,
  Target,
  TrendingUp
} from "lucide-react";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Every 2 months" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "semiannual", label: "Every 6 months" },
  { value: "annual", label: "Yearly" }
];

export default function PostsDealMakers() {
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [customKeyword, setCustomKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [runs, setRuns] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(["events", "medical_council"]);
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // Traffic light status for this finder
  const [trafficStatus, setTrafficStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("keywords");
  const [bulkAction, setBulkAction] = useState("");
  
  // State for search history
  const [expandedHistory, setExpandedHistory] = useState({});
  const [historyData, setHistoryData] = useState({});
  const [loadingHistory, setLoadingHistory] = useState({});
  const [expandedRuns, setExpandedRuns] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [kwRes, runsRes, schedulesRes, summaryRes, trafficRes] = await Promise.all([
        api.get("/settings/linkedin-keywords"),
        api.get("/scrappers/logs/runs?scrapper_id=deal_makers_by_post&limit=20"),
        api.get("/scheduler/schedules?schedule_type=keyword").catch(() => ({ data: { schedules: [] } })),
        api.get("/scheduler/summary/deal_makers_by_post").catch(() => ({ data: {} })),
        api.get("/scheduler/traffic-light").catch(() => ({ data: { status: {} } }))
      ]);
      
      setKeywords(kwRes.data || []);
      setRuns(runsRes.data.runs || []);
      setSchedules(schedulesRes.data.schedules || []);
      setSummary(summaryRes.data);
      setTrafficStatus(trafficRes.data.status?.["1.1.1.2"] || null);
      // Select active keywords by default
      setSelectedKeywords(kwRes.data.filter(k => k.active).map(k => k.keyword));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyword = (keyword) => {
    setSelectedKeywords(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const addCustomKeyword = async () => {
    if (!customKeyword.trim()) return;
    
    try {
      await api.post("/settings/linkedin-keywords", null, {
        params: { keyword: customKeyword.trim(), category: "custom" }
      });
      setCustomKeyword("");
      loadData();
      toast.success("Keyword added");
    } catch (error) {
      toast.error("Error adding keyword");
    }
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedKeywords.length === 0) return;
    
    try {
      if (bulkAction === "activate") {
        await api.put("/settings/linkedin-keywords/bulk", {
          keywords: selectedKeywords,
          active: true
        });
        toast.success(`Activated ${selectedKeywords.length} keywords`);
      } else if (bulkAction === "deactivate") {
        await api.put("/settings/linkedin-keywords/bulk", {
          keywords: selectedKeywords,
          active: false
        });
        toast.success(`Deactivated ${selectedKeywords.length} keywords`);
      } else if (bulkAction === "delete") {
        await api.delete("/settings/linkedin-keywords/bulk", {
          data: { keywords: selectedKeywords }
        });
        toast.success(`Deleted ${selectedKeywords.length} keywords`);
        setSelectedKeywords([]);
      }
      loadData();
      setBulkAction("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error performing bulk action");
    }
  };

  // Update keyword frequency
  const updateKeywordFrequency = async (keyword, frequency) => {
    try {
      // Create or update schedule for this keyword
      await api.post("/scheduler/schedules", {
        schedule_type: "keyword",
        entity_id: keyword.id,
        entity_name: keyword.keyword,
        frequency: frequency,
        params: { keyword: keyword.keyword, category: keyword.category }
      });
      toast.success(`Schedule updated for "${keyword.keyword}"`);
      loadData();
    } catch (error) {
      toast.error("Error updating schedule");
    }
  };

  // Get schedule for a keyword
  const getSchedule = (keywordId) => {
    return schedules.find(s => s.entity_id === keywordId);
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

  // Toggle and load history for a keyword
  const toggleHistory = async (keywordId, keyword) => {
    const isExpanded = expandedHistory[keywordId];
    
    if (isExpanded) {
      setExpandedHistory(prev => ({ ...prev, [keywordId]: false }));
      return;
    }
    
    setExpandedHistory(prev => ({ ...prev, [keywordId]: true }));
    
    if (!historyData[keywordId]) {
      setLoadingHistory(prev => ({ ...prev, [keywordId]: true }));
      try {
        const [historyRes, contactsRes] = await Promise.all([
          api.get(`/scheduler/history/${keywordId}`),
          api.get(`/contacts?source=linkedin_post&search=${encodeURIComponent(keyword)}&limit=50`)
        ]);
        
        setHistoryData(prev => ({
          ...prev,
          [keywordId]: {
            runs: historyRes.data.history || [],
            contacts: contactsRes.data.contacts || []
          }
        }));
      } catch (error) {
        console.error("Error loading history:", error);
        toast.error("Error loading history");
      } finally {
        setLoadingHistory(prev => ({ ...prev, [keywordId]: false }));
      }
    }
  };

  // Toggle run expansion to show contacts
  const toggleRunExpansion = async (runId, keywords) => {
    const isExpanded = expandedRuns[runId];
    
    if (isExpanded) {
      setExpandedRuns(prev => ({ ...prev, [runId]: null }));
      return;
    }
    
    // Load contacts for this run
    try {
      const searchTerms = keywords?.slice(0, 3).join("|") || "";
      const contactsRes = await api.get(`/contacts?source=linkedin_post&search=${encodeURIComponent(searchTerms)}&limit=20`);
      setExpandedRuns(prev => ({ 
        ...prev, 
        [runId]: contactsRes.data.contacts || [] 
      }));
    } catch (error) {
      console.error("Error loading run contacts:", error);
    }
  };

  const startSearch = async () => {
    if (selectedKeywords.length === 0) {
      toast.error("Select at least one keyword");
      return;
    }
    
    setSearching(true);
    try {
      await api.post("/scrappers/search/deal-makers-by-post", {
        keywords: selectedKeywords,
        use_saved_keywords: false,
        limit: 50
      });
      toast.success(`Searching ${selectedKeywords.length} keywords`);
      
      // Create schedules for searched keywords
      for (const kw of keywords.filter(k => selectedKeywords.includes(k.keyword))) {
        const existingSchedule = getSchedule(kw.id);
        if (!existingSchedule) {
          await api.post("/scheduler/schedules", {
            schedule_type: "keyword",
            entity_id: kw.id,
            entity_name: kw.keyword,
            frequency: "monthly",
            params: { keyword: kw.keyword, category: kw.category }
          });
        }
      }
      
      setTimeout(loadData, 5000);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error starting search");
    } finally {
      setSearching(false);
    }
  };

  // Group keywords by category
  const groupedKeywords = keywords.reduce((acc, kw) => {
    const cat = kw.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(kw);
    return acc;
  }, {});

  const categoryLabels = {
    events: "Events & Conferences",
    transitions: "Career Transitions",
    medical_council: "Medical Councils (Mexico)",
    custom: "Custom Keywords",
    other: "Other"
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="posts-deal-makers-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#ff3300]/20">
            <FileText className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Find Deal Makers by Post</h1>
            <p className="text-slate-500">
              Find people posting about medical congresses and events
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <ApifyStatusIndicator />
          <Button onClick={loadData} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            onClick={startSearch} 
            disabled={searching || selectedKeywords.length === 0}
            className="bg-[#ff3300] hover:bg-[#ff3300]/90"
          >
            {searching ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Search ({selectedKeywords.length})
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{summary?.total_deal_makers_found || 0}</p>
            <p className="text-xs text-slate-500">Total DMs Found</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{keywords.length}</p>
            <p className="text-xs text-slate-500">Total Keywords</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-[#ff3300]">{selectedKeywords.length}</p>
            <p className="text-xs text-slate-500">Selected</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-400">{schedules.length}</p>
            <p className="text-xs text-slate-500">Scheduled</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">{summary?.successful_searches || 0}</p>
            <p className="text-xs text-slate-500">Successful Searches</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111] border border-[#222]">
          <TabsTrigger value="keywords" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
            <Settings className="w-4 h-4 mr-2" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="recent-searches" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
            <History className="w-4 h-4 mr-2" />
            Recent Searches ({runs.length})
          </TabsTrigger>
        </TabsList>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          {/* Bulk Actions */}
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">Bulk Actions:</span>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activate">Activate Selected</SelectItem>
                    <SelectItem value="deactivate">Deactivate Selected</SelectItem>
                    <SelectItem value="delete">Delete Selected</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleBulkAction}
                  disabled={!bulkAction || selectedKeywords.length === 0}
                  variant="outline"
                  className="border-[#333]"
                >
                  Apply ({selectedKeywords.length})
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  className="border-[#333] text-slate-400"
                  onClick={() => setSelectedKeywords(keywords.map(k => k.keyword))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  className="border-[#333] text-slate-400"
                  onClick={() => setSelectedKeywords([])}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add Custom Keyword */}
          <Card className="bg-[#111] border-[#222]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Add Custom Keyword</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter keyword to search in posts..."
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomKeyword()}
                  className="bg-[#0a0a0a] border-[#333] text-white"
                />
                <Button onClick={addCustomKeyword} className="bg-[#ff3300]">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Keywords by Category */}
          <Card className="bg-[#111] border-[#222]">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#ff3300]" />
                Search Keywords
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion 
                type="multiple" 
                value={expandedCategories}
                onValueChange={setExpandedCategories}
                className="space-y-2"
              >
                {Object.entries(groupedKeywords).map(([category, kws]) => (
                  <AccordionItem 
                    key={category} 
                    value={category}
                    className="border border-[#222] rounded-lg overflow-hidden bg-[#0f0f0f]"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[#151515]">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium text-white">
                          {categoryLabels[category] || category}
                        </span>
                        <Badge className="bg-slate-700 text-slate-300">
                          {kws.filter(k => selectedKeywords.includes(k.keyword)).length}/{kws.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-2">
                        {kws.map(kw => {
                          const schedule = getSchedule(kw.id);
                          const daysUntil = schedule ? getDaysUntil(schedule.next_run) : null;
                          return (
                            <div key={kw.id} className="border border-[#222] rounded-lg overflow-hidden">
                              <div 
                                className={`flex items-center justify-between p-3 transition-colors ${
                                  selectedKeywords.includes(kw.keyword)
                                    ? 'bg-[#ff3300]/10'
                                    : 'bg-[#0a0a0a] hover:bg-[#111]'
                                }`}
                              >
                                <div 
                                  className="flex items-center gap-3 flex-1 cursor-pointer"
                                  onClick={() => toggleKeyword(kw.keyword)}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    selectedKeywords.includes(kw.keyword) 
                                      ? 'bg-[#ff3300] border-[#ff3300]' 
                                      : 'border-slate-600'
                                  }`}>
                                    {selectedKeywords.includes(kw.keyword) && (
                                      <CheckCircle2 className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                  <span className={`text-sm ${selectedKeywords.includes(kw.keyword) ? 'text-white' : 'text-slate-400'}`}>
                                    {kw.keyword}
                                  </span>
                                  {!kw.active && (
                                    <Badge variant="outline" className="border-red-500/50 text-red-400 text-xs">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Schedule Status Info */}
                                <div className="flex items-center gap-2 mr-2">
                                  {schedule && (
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
                                      
                                      {/* Last Run */}
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
                                  )}
                                </div>
                                
                                {/* Frequency Selector */}
                                <Select 
                                  value={schedule?.frequency || ""} 
                                  onValueChange={(v) => updateKeywordFrequency(kw, v)}
                                >
                                  <SelectTrigger 
                                    className="w-[100px] h-8 bg-[#0a0a0a] border-[#333] text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <SelectValue placeholder="Schedule" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FREQUENCY_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                
                                {/* History Button */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHistory(kw.id, kw.keyword);
                                  }}
                                  className="ml-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                                >
                                  <History className="w-4 h-4 mr-1" />
                                  {expandedHistory[kw.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </Button>
                              </div>
                              
                              {/* Search History Section */}
                              {expandedHistory[kw.id] && (
                                <div className="border-t border-blue-500/30 bg-blue-500/5 p-4">
                                  <div className="text-xs text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <History className="w-3 h-3" />
                                    Search History & Found Contacts
                                  </div>
                                  
                                  {loadingHistory[kw.id] ? (
                                    <div className="flex items-center justify-center py-8">
                                      <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                                    </div>
                                  ) : historyData[kw.id] ? (
                                    <div className="space-y-4">
                                      {/* Found Contacts Summary */}
                                      <div className="bg-[#111] rounded-lg p-3 border border-[#222]">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-white font-medium">
                                            {historyData[kw.id].contacts.length} Contacts Found
                                          </span>
                                          <Badge className="bg-[#ff3300]/20 text-[#ff3300]">
                                            &quot;{kw.keyword}&quot;
                                          </Badge>
                                        </div>
                                        
                                        {/* Contact List */}
                                        {historyData[kw.id].contacts.length > 0 ? (
                                          <div className="max-h-48 overflow-y-auto space-y-1">
                                            {historyData[kw.id].contacts.slice(0, 15).map((contact, idx) => (
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
                                            {historyData[kw.id].contacts.length > 15 && (
                                              <div className="text-center text-slate-500 text-xs py-2">
                                                +{historyData[kw.id].contacts.length - 15} more contacts
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
                                      {historyData[kw.id].runs.length > 0 && (
                                        <div className="space-y-2">
                                          <div className="text-xs text-slate-500 uppercase">Recent Runs</div>
                                          {historyData[kw.id].runs.slice(0, 5).map((run, idx) => (
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
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
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
                  <p>No recent searches. Select keywords and click &quot;Search&quot;.</p>
                </div>
              ) : (
                runs.map(run => (
                  <div key={run.id} className="border border-[#222] rounded-lg overflow-hidden">
                    <div 
                      className={`p-4 cursor-pointer hover:bg-[#151515] transition-colors ${
                        run.status === 'completed' ? 'bg-green-500/5' : 
                        run.status === 'failed' ? 'bg-red-500/5' : 
                        'bg-blue-500/5'
                      }`}
                      onClick={() => toggleRunExpansion(run.id, run.params?.keywords)}
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
                          <span className="text-white font-medium">
                            {run.params?.keywords?.length || 0} keywords searched
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 text-sm">
                            {run.started_at && new Date(run.started_at).toLocaleString("es-MX")}
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
                      
                      {/* Show keywords */}
                      <div className="flex flex-wrap gap-1">
                        {(run.params?.keywords || []).slice(0, 10).map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="border-[#333] text-slate-400 text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {(run.params?.keywords?.length || 0) > 10 && (
                          <Badge variant="outline" className="border-[#333] text-slate-500 text-xs">
                            +{run.params.keywords.length - 10} more
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
                                <div className="w-7 h-7 rounded-full bg-[#ff3300]/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[#ff3300] text-xs font-bold">
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
}
