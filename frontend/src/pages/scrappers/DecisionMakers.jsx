import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import api from "../../lib/api";
import {
  Users,
  Search,
  ExternalLink,
  Filter,
  Building2,
  Beaker,
  RefreshCw,
  CheckCircle,
  XCircle,
  MessageSquare,
  Star
} from "lucide-react";

export default function DecisionMakers() {
  const [decisionMakers, setDecisionMakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ company: "", therapeutic_area: "", status: "" });
  const [filterOptions, setFilterOptions] = useState({ companies: [], therapeutic_areas: [] });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadDecisionMakers();
  }, [filters]);

  const loadDecisionMakers = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.company) params.append("company", filters.company);
      if (filters.therapeutic_area) params.append("therapeutic_area", filters.therapeutic_area);
      if (filters.status) params.append("status", filters.status);
      params.append("limit", "200");

      const response = await api.get(`/scrappers/pharma/decision-makers?${params}`);
      setDecisionMakers(response.data.decision_makers || []);
      setStats(response.data.stats || {});
      setFilterOptions(response.data.filters || { companies: [], therapeutic_areas: [] });
    } catch (error) {
      console.error("Error loading decision makers:", error);
      toast.error("Error loading decision makers");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (dmId, newStatus) => {
    try {
      await api.put(`/scrappers/pharma/decision-makers/${dmId}/status?status=${newStatus}`);
      toast.success(`Status updated to ${newStatus}`);
      loadDecisionMakers();
    } catch (error) {
      toast.error("Error updating status");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      qualified: "bg-green-500/20 text-green-400 border-green-500/30",
      rejected: "bg-red-500/20 text-red-400 border-red-500/30"
    };
    return styles[status] || styles.new;
  };

  const clearFilters = () => {
    setFilters({ company: "", therapeutic_area: "", status: "" });
    setSearchTerm("");
  };

  const hasActiveFilters = filters.company || filters.therapeutic_area || filters.status || searchTerm;

  // Filter by search term
  const filteredDMs = decisionMakers.filter(dm => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      dm.name?.toLowerCase().includes(search) ||
      dm.headline?.toLowerCase().includes(search) ||
      dm.company_name?.toLowerCase().includes(search) ||
      dm.therapeutic_area?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="decision-makers-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="decision-makers-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#ff3300]/20">
            <Users className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Decision Makers</h1>
            <p className="text-slate-500">
              {stats.total || 0} contacts found from pipeline research
            </p>
          </div>
        </div>
        <Button 
          onClick={loadDecisionMakers}
          variant="outline"
          className="border-[#333] text-slate-300"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#ff3300]" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
                <p className="text-xs text-slate-500">Total Found</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.new || 0}</p>
                <p className="text-xs text-slate-500">New</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-yellow-400">{stats.contacted || 0}</p>
                <p className="text-xs text-slate-500">Contacted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.qualified || 0}</p>
                <p className="text-xs text-slate-500">Qualified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-white text-sm">
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#ff3300]" />
              Filters
            </span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-white">
                Clear
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            <Select value={filters.company || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, company: v === "all" ? "" : v }))}>
              <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {filterOptions.companies?.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.value} ({c.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.therapeutic_area || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, therapeutic_area: v === "all" ? "" : v }))}>
              <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                <SelectValue placeholder="Therapeutic Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {filterOptions.therapeutic_areas?.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.value} ({a.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === "all" ? "" : v }))}>
              <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Decision Makers Table */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#ff3300]" />
            Decision Makers ({filteredDMs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDMs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No decision makers found yet</p>
              <p className="text-sm mt-2">Search for decision makers from the Medications tab</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222]">
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Headline</TableHead>
                    <TableHead className="text-slate-400">Company</TableHead>
                    <TableHead className="text-slate-400">Area</TableHead>
                    <TableHead className="text-slate-400">Medication</TableHead>
                    <TableHead className="text-slate-400">Score</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDMs.map(dm => (
                    <TableRow key={dm.id} className="border-[#222] hover:bg-[#1a1a1a]">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#ff3300]/20 flex items-center justify-center">
                            <span className="text-[#ff3300] text-xs font-bold">
                              {dm.name?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-white">{dm.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-400 truncate max-w-[200px] block">
                          {dm.headline || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-300">{dm.company_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          {dm.therapeutic_area}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Beaker className="w-3 h-3 text-slate-500" />
                          <span className="text-xs text-slate-400">{dm.medication_name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-[#ff3300]/20 text-[#ff3300]">
                          {dm.relevance_score || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={dm.status}
                          onValueChange={(v) => updateStatus(dm.id, v)}
                        >
                          <SelectTrigger className={`w-[110px] h-7 text-xs border ${getStatusBadge(dm.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {dm.profile_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(dm.profile_url, "_blank")}
                            className="text-[#ff3300] hover:text-[#ff3300]/80"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
