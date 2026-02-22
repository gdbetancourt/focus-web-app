import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  User,
  Calendar,
  BarChart3,
} from "lucide-react";

const SESSION_TYPES = [
  { value: "coaching", label: "Coaching 1:1" },
  { value: "mentoring", label: "Mentoring" },
  { value: "training", label: "Training" },
  { value: "workshop", label: "Workshop" },
  { value: "other", label: "Other" },
];

const SESSION_TYPE_COLORS = {
  coaching: "bg-blue-500/20 text-blue-400",
  mentoring: "bg-purple-500/20 text-purple-400",
  training: "bg-green-500/20 text-green-400",
  workshop: "bg-orange-500/20 text-orange-400",
  other: "bg-slate-500/20 text-slate-400",
};

export default function TimeTracker() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState("week");

  const [formData, setFormData] = useState({
    contact_name: "",
    contact_email: "",
    description: "",
    duration_minutes: 60,
    session_date: new Date().toISOString().split("T")[0],
    session_type: "coaching",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadStats();
  }, [statsPeriod]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesRes, studentsRes] = await Promise.all([
        api.get("/time-tracker/entries?limit=50"),
        api.get("/time-tracker/contacts/students"),
      ]);
      setEntries(entriesRes.data.entries || []);
      setStudents(studentsRes.data.contacts || []);
      await loadStats();
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error loading time tracker data");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get(`/time-tracker/stats?period=${statsPeriod}`);
      setStats(res.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const openDialog = (entry = null) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData({
        contact_name: entry.contact_name || "",
        contact_email: entry.contact_email || "",
        description: entry.description || "",
        duration_minutes: entry.duration_minutes || 60,
        session_date: entry.session_date || new Date().toISOString().split("T")[0],
        session_type: entry.session_type || "coaching",
      });
    } else {
      setEditingEntry(null);
      setFormData({
        contact_name: "",
        contact_email: "",
        description: "",
        duration_minutes: 60,
        session_date: new Date().toISOString().split("T")[0],
        session_type: "coaching",
      });
    }
    setDialogOpen(true);
  };

  const saveEntry = async () => {
    if (!formData.contact_name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    if (formData.duration_minutes <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    try {
      if (editingEntry) {
        await api.put(`/time-tracker/entries/${editingEntry.id}`, formData);
        toast.success("Entry updated");
      } else {
        await api.post("/time-tracker/entries", formData);
        toast.success("Entry created");
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error saving entry");
    }
  };

  const deleteEntry = async (entryId) => {
    if (!window.confirm("Delete this time entry?")) return;
    try {
      await api.delete(`/time-tracker/entries/${entryId}`);
      toast.success("Entry deleted");
      loadData();
    } catch (error) {
      toast.error("Error deleting entry");
    }
  };

  const selectStudent = (studentName) => {
    const student = students.find((s) => s.name === studentName);
    setFormData((prev) => ({
      ...prev,
      contact_name: student?.name || studentName,
      contact_email: student?.email || "",
    }));
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="time-tracker-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="time-tracker-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#ff3300]/20">
            <Clock className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Time Tracker</h1>
            <p className="text-sm text-slate-500">Track coaching sessions and time spent with students</p>
          </div>
        </div>
        <Button onClick={() => openDialog()} className="bg-[#ff3300] hover:bg-[#cc2900]" data-testid="new-entry-btn">
          <Plus className="w-4 h-4 mr-2" />
          Log Time
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats?.total_hours || 0}</p>
            <p className="text-xs text-slate-500">Hours ({statsPeriod})</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{stats?.total_sessions || 0}</p>
            <p className="text-xs text-slate-500">Sessions</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {Object.keys(stats?.by_contact || {}).length}
            </p>
            <p className="text-xs text-slate-500">Students</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <Select value={statsPeriod} onValueChange={setStatsPeriod}>
              <SelectTrigger className="bg-transparent border-none text-white h-auto p-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">Time Period</p>
          </CardContent>
        </Card>
      </div>

      {/* By Type Breakdown */}
      {stats?.by_type && Object.keys(stats.by_type).length > 0 && (
        <Card className="bg-[#111] border-[#222]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              By Session Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.by_type).map(([type, data]) => (
                <div key={type} className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-2 rounded-lg">
                  <Badge className={SESSION_TYPE_COLORS[type] || SESSION_TYPE_COLORS.other}>
                    {SESSION_TYPES.find((t) => t.value === type)?.label || type}
                  </Badge>
                  <span className="text-white font-medium">{formatDuration(data.minutes)}</span>
                  <span className="text-slate-500 text-sm">({data.sessions} sessions)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entries Table */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Calendar className="w-5 h-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No time entries yet</p>
              <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
                Log your first session
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden border-[#222]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222] hover:bg-[#0a0a0a]">
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400">Student</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Description</TableHead>
                    <TableHead className="text-center text-slate-400">Duration</TableHead>
                    <TableHead className="text-right text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="border-[#222] hover:bg-[#0a0a0a]">
                      <TableCell className="text-slate-300 whitespace-nowrap">
                        {entry.session_date}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{entry.contact_name}</p>
                          {entry.contact_email && (
                            <p className="text-xs text-slate-500">{entry.contact_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={SESSION_TYPE_COLORS[entry.session_type] || SESSION_TYPE_COLORS.other}>
                          {SESSION_TYPES.find((t) => t.value === entry.session_type)?.label || entry.session_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-slate-400 truncate">{entry.description || "-"}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-[#333] text-white">
                          {formatDuration(entry.duration_minutes)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(entry)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEntry(entry.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* New/Edit Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111] border-[#222] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#ff3300]" />
              {editingEntry ? "Edit Time Entry" : "Log Time"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Student Selection */}
            <div className="space-y-2">
              <Label className="text-slate-400">Student / Contact *</Label>
              {students.length > 0 ? (
                <Select
                  value={formData.contact_name}
                  onValueChange={selectStudent}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333]" data-testid="contact-select">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id || s.email} value={s.name}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{s.name}</span>
                          {s.company && <span className="text-slate-500 text-xs">({s.company})</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contact_name: e.target.value }))}
                  placeholder="Enter student name"
                  className="bg-[#0a0a0a] border-[#333]"
                  data-testid="contact-input"
                />
              )}
            </div>

            {/* Session Type */}
            <div className="space-y-2">
              <Label className="text-slate-400">Session Type</Label>
              <Select
                value={formData.session_type}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, session_type: v }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]" data-testid="type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-400">Date</Label>
                <Input
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, session_date: e.target.value }))}
                  className="bg-[#0a0a0a] border-[#333]"
                  data-testid="date-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                  min="1"
                  className="bg-[#0a0a0a] border-[#333]"
                  data-testid="duration-input"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-slate-400">Notes / Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What was covered in this session?"
                className="bg-[#0a0a0a] border-[#333]"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#333]">
              Cancel
            </Button>
            <Button onClick={saveEntry} className="bg-[#ff3300] hover:bg-[#cc2900]" data-testid="save-entry-btn">
              {editingEntry ? "Update" : "Save"} Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
