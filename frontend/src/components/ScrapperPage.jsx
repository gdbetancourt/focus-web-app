import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Play,
  Settings,
  Users,
  RefreshCw,
  Eye,
  ExternalLink,
  CheckCircle,
  XCircle,
  Linkedin,
  Building2,
  MapPin,
  Activity,
  Loader2,
  Calendar,
  FileText
} from "lucide-react";

// Days of the week
const DAYS = [
  { id: 0, name: "Sunday", short: "Sun" },
  { id: 1, name: "Monday", short: "Mon" },
  { id: 2, name: "Tuesday", short: "Tue" },
  { id: 3, name: "Wednesday", short: "Wed" },
  { id: 4, name: "Thursday", short: "Thu" },
  { id: 5, name: "Friday", short: "Fri" },
  { id: 6, name: "Saturday", short: "Sat" },
];

// Hours for scheduler
const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`
}));

export default function ScrapperPage({ scrapperId, name, description, icon: Icon, color }) {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState([]);
  const [logs, setLogs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [schedule, setSchedule] = useState({ enabled: false, days: [1, 3, 5], hour: 9 });
  const [showScheduleEdit, setShowScheduleEdit] = useState(false);
  const [showOpportunityDetail, setShowOpportunityDetail] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    loadData();
    // Load schedule from localStorage
    const savedSchedules = localStorage.getItem('scrapper_schedules');
    if (savedSchedules) {
      const schedules = JSON.parse(savedSchedules);
      if (schedules[scrapperId]) {
        setSchedule(schedules[scrapperId]);
      }
    }
  }, [scrapperId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oppsRes, logsRes, runsRes] = await Promise.all([
        api.get(`/scrappers/opportunities?source=${scrapperId}&limit=200`),
        api.get(`/scrappers/logs?scrapper_id=${scrapperId}&limit=100`),
        api.get(`/scrappers/logs/runs?scrapper_id=${scrapperId}&limit=50`)
      ]);
      
      setOpportunities(oppsRes.data.opportunities || []);
      setLogs(logsRes.data.logs || []);
      setRuns(runsRes.data.runs || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const runScrapper = async () => {
    setRunning(true);
    try {
      const res = await api.post(`/scrappers/run/${scrapperId}`);
      toast.success(`Scrapper started. Run ID: ${res.data.run_id}`);
      
      // Poll for status
      const runId = res.data.run_id;
      const checkStatus = async () => {
        try {
          const statusRes = await api.get(`/scrappers/run/${runId}/status`);
          if (statusRes.data.status === "running") {
            setTimeout(checkStatus, 3000);
          } else {
            setRunning(false);
            loadData();
            if (statusRes.data.status === "completed") {
              toast.success(`Scrapper completed: ${statusRes.data.results?.opportunities_created || 0} new opportunities`);
            } else {
              toast.error(`Scrapper failed: ${statusRes.data.error}`);
            }
          }
        } catch (e) {
          setRunning(false);
        }
      };
      setTimeout(checkStatus, 3000);
    } catch (error) {
      setRunning(false);
      toast.error("Error starting scrapper");
    }
  };

  const saveSchedule = () => {
    const savedSchedules = localStorage.getItem('scrapper_schedules');
    const schedules = savedSchedules ? JSON.parse(savedSchedules) : {};
    schedules[scrapperId] = schedule;
    localStorage.setItem('scrapper_schedules', JSON.stringify(schedules));
    toast.success("Schedule saved");
    setShowScheduleEdit(false);
  };

  const updateOpportunityStatus = async (oppId, status) => {
    try {
      await api.put(`/scrappers/opportunities/${oppId}/status`, null, {
        params: { status }
      });
      toast.success("Status updated");
      loadData();
    } catch (error) {
      toast.error("Error updating status");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      qualified: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      converted: "bg-green-500/20 text-green-400 border-green-500/30",
      discarded: "bg-slate-500/20 text-slate-400 border-slate-500/30"
    };
    const labels = {
      new: "New",
      contacted: "Contacted",
      qualified: "Qualified",
      converted: "Converted",
      discarded: "Discarded"
    };
    return <Badge className={`${styles[status] || styles.new} border`}>{labels[status] || status}</Badge>;
  };

  const getLogLevelBadge = (level) => {
    const styles = {
      INFO: "bg-blue-500/20 text-blue-400",
      SUCCESS: "bg-green-500/20 text-green-400",
      WARN: "bg-yellow-500/20 text-yellow-400",
      ERROR: "bg-red-500/20 text-red-400"
    };
    return <Badge className={styles[level] || "bg-slate-500/20"}>{level}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid={`scrapper-${scrapperId}-loading`}>
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={`scrapper-${scrapperId}-page`}>
      {/* Header with Run Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div 
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">{name}</h1>
            <p className="text-slate-400 text-sm">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="border-[#333] text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={runScrapper}
            disabled={running}
            className="btn-primary"
            data-testid={`run-scrapper-${scrapperId}`}
          >
            {running ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Now
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{opportunities.length}</p>
            <p className="text-xs text-slate-400">Total Results</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold" style={{ color }}>
              {opportunities.filter(o => o.status === 'new').length}
            </p>
            <p className="text-xs text-slate-400">New</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">
              {runs.filter(r => r.status === 'completed').length}
            </p>
            <p className="text-xs text-slate-400">Successful Runs</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-400">
              {runs.filter(r => r.status === 'failed').length}
            </p>
            <p className="text-xs text-slate-400">Failed Runs</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Schedule */}
      <Card className="stat-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color }} />
              Weekly Schedule
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleEdit(true)}
              className="border-[#333] text-slate-300"
              data-testid={`configure-schedule-${scrapperId}`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={schedule.enabled} disabled />
              <span className={schedule.enabled ? "text-green-400" : "text-slate-500"}>
                {schedule.enabled ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex gap-1 flex-wrap">
                {DAYS.map(day => (
                  <div
                    key={day.id}
                    className={`px-3 py-1.5 rounded text-xs font-medium ${
                      schedule.days?.includes(day.id)
                        ? 'text-white'
                        : 'bg-[#1a1a1a] text-slate-600'
                    }`}
                    style={schedule.days?.includes(day.id) ? { backgroundColor: `${color}30`, color } : {}}
                  >
                    {day.short}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span className="text-white font-mono text-lg">
                {schedule.hour?.toString().padStart(2, '0')}:00
              </span>
              <p className="text-xs text-slate-500">Scheduled time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card className="stat-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-white">
            <Activity className="w-5 h-5" style={{ color }} />
            Recent Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No runs yet</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {runs.slice(0, 10).map(run => (
                <div key={run.id} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                  <div className="flex items-center gap-3">
                    {run.status === "completed" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : run.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                    <div>
                      <p className="text-sm text-white">
                        {run.status === "completed" ? "Completed" : run.status === "failed" ? "Failed" : "Running"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(run.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    {run.results?.opportunities_created !== undefined && (
                      <span className="text-green-400">+{run.results.opportunities_created} new</span>
                    )}
                    {run.error && (
                      <span className="text-red-400 truncate max-w-[150px] block">{run.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="stat-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-white">
            <span className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color }} />
              Results ({opportunities.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No results yet</p>
              <p className="text-sm">Run the scrapper to generate leads</p>
            </div>
          ) : (
            <div className="border border-[#222] rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222] hover:bg-[#111]">
                    <TableHead className="text-slate-300">Contact</TableHead>
                    <TableHead className="text-slate-300">Company</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Date</TableHead>
                    <TableHead className="text-right text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.slice(0, 20).map(opp => (
                    <TableRow key={opp.id} className="border-[#222] hover:bg-[#111]">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                            <Linkedin className="w-4 h-4" style={{ color }} />
                          </div>
                          <div>
                            <p className="font-medium text-white">{opp.author_name || "Unknown"}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">
                              {opp.author_headline || "-"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300">{opp.company || "-"}</TableCell>
                      <TableCell>{getStatusBadge(opp.status)}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {opp.created_at ? new Date(opp.created_at).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowOpportunityDetail(opp)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {opp.profile_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(opp.profile_url, "_blank")}
                              className="text-slate-400 hover:text-white"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="stat-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-white">
            <FileText className="w-5 h-5" style={{ color }} />
            Execution Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No logs available</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {logs.slice(0, 20).map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-[#0f0f0f] rounded-lg text-sm">
                  {getLogLevelBadge(log.level)}
                  <div className="flex-1">
                    <p className="text-white">{log.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Edit Dialog */}
      <Dialog open={showScheduleEdit} onOpenChange={setShowScheduleEdit}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">Configure Schedule - {name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Enable Automatic Runs</Label>
              <Switch
                checked={schedule.enabled}
                onCheckedChange={(checked) => setSchedule(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {/* Days Selection */}
            <div className="space-y-2">
              <Label className="text-slate-300">Active Days</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(day => {
                  const isSelected = schedule.days?.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      onClick={() => {
                        const currentDays = schedule.days || [];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== day.id)
                          : [...currentDays, day.id];
                        setSchedule(prev => ({ ...prev, days: newDays }));
                      }}
                      className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-[#ff3300] text-white'
                          : 'bg-[#1a1a1a] text-slate-500 hover:bg-[#222]'
                      }`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <Label className="text-slate-300">Run Time</Label>
              <Select
                value={schedule.hour?.toString() || "9"}
                onValueChange={(v) => setSchedule(prev => ({ ...prev, hour: parseInt(v) }))}
              >
                <SelectTrigger className="bg-[#0f0f0f] border-[#333] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map(hour => (
                    <SelectItem key={hour.value} value={hour.value.toString()}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleEdit(false)} className="border-[#333] text-slate-300">
              Cancel
            </Button>
            <Button onClick={saveSchedule} className="btn-primary">
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opportunity Detail Dialog */}
      <Dialog open={!!showOpportunityDetail} onOpenChange={() => setShowOpportunityDetail(null)}>
        <DialogContent className="bg-[#111] border-[#222] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Linkedin className="w-5 h-5 text-[#0099ff]" />
              Opportunity Detail
            </DialogTitle>
          </DialogHeader>
          {showOpportunityDetail && (
            <div className="space-y-4 py-4">
              {/* Contact Info */}
              <div className="p-4 bg-[#0f0f0f] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg text-white">{showOpportunityDetail.author_name || "Unknown"}</h3>
                  {getStatusBadge(showOpportunityDetail.status)}
                </div>
                {showOpportunityDetail.author_headline && (
                  <p className="text-sm text-slate-400">{showOpportunityDetail.author_headline}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  {showOpportunityDetail.company && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <Building2 className="w-4 h-4" />
                      {showOpportunityDetail.company}
                    </span>
                  )}
                  {showOpportunityDetail.author_location && (
                    <span className="flex items-center gap-1 text-slate-400">
                      <MapPin className="w-4 h-4" />
                      {showOpportunityDetail.author_location}
                    </span>
                  )}
                </div>
              </div>

              {/* Post Content */}
              {showOpportunityDetail.post_content && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Post Content</Label>
                  <div className="p-3 bg-[#0f0f0f] rounded-lg text-sm text-slate-300 max-h-40 overflow-y-auto">
                    {showOpportunityDetail.post_content}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex gap-2">
                {showOpportunityDetail.profile_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(showOpportunityDetail.profile_url, "_blank")}
                    className="border-[#333] text-slate-300"
                  >
                    <Linkedin className="w-4 h-4 mr-2" />
                    View Profile
                  </Button>
                )}
                {showOpportunityDetail.post_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(showOpportunityDetail.post_url, "_blank")}
                    className="border-[#333] text-slate-300"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Post
                  </Button>
                )}
              </div>

              {/* Status Actions */}
              <div className="space-y-2">
                <Label className="text-slate-300">Change Status</Label>
                <div className="flex flex-wrap gap-2">
                  {["new", "contacted", "qualified", "converted", "discarded"].map(status => (
                    <Button
                      key={status}
                      variant={showOpportunityDetail.status === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        updateOpportunityStatus(showOpportunityDetail.id, status);
                        setShowOpportunityDetail({ ...showOpportunityDetail, status });
                      }}
                      className={showOpportunityDetail.status === status ? "btn-primary" : "border-[#333] text-slate-300"}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-slate-500 pt-4 border-t border-[#222]">
                <p>Source: {showOpportunityDetail.source_scrapper}</p>
                {showOpportunityDetail.keyword_matched && <p>Keyword: {showOpportunityDetail.keyword_matched}</p>}
                <p>Created: {new Date(showOpportunityDetail.created_at).toLocaleString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
