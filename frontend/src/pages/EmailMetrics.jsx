import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  Mail,
  Eye,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
  Users,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

// Simple bar chart component
const SimpleBarChart = ({ data, maxValue }) => {
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((item, index) => {
        const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div
            key={index}
            className="flex flex-col items-center flex-1"
            title={`${item.label}: ${item.value}`}
          >
            <div
              className="w-full bg-purple-500/60 rounded-t transition-all"
              style={{ height: `${Math.max(height, 4)}%` }}
            />
            <span className="text-[10px] text-slate-500 mt-1 truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function EmailMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [contactMetrics, setContactMetrics] = useState([]);
  const [periodDays, setPeriodDays] = useState("30");

  useEffect(() => {
    loadMetrics();
  }, [periodDays]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [dashboardRes, weeklyRes, contactsRes] = await Promise.all([
        api.get(`/email-individual/metrics/dashboard?days=${periodDays}`),
        api.get("/email-individual/metrics/weekly-report"),
        api.get("/email-individual/metrics/by-contact?limit=10"),
      ]);

      setMetrics(dashboardRes.data);
      setWeeklyReport(weeklyRes.data);
      setContactMetrics(contactsRes.data.contacts || []);
    } catch (error) {
      console.error("Error loading metrics:", error);
      toast.error("Error loading email metrics");
    } finally {
      setLoading(false);
    }
  };

  // Color for open rate
  const getOpenRateColor = (rate) => {
    if (rate >= 30) return "text-green-400";
    if (rate >= 15) return "text-yellow-400";
    return "text-red-400";
  };

  // Icon for insight type
  const InsightIcon = ({ type }) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="metrics-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-metrics-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <BarChart3 className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Metrics</h1>
            <p className="text-sm text-slate-500">
              Track engagement and optimize your email campaigns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="w-32 bg-[#111] border-[#333] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            className="border-[#333]"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Mail className="w-8 h-8 text-purple-400" />
              <span className="text-3xl font-bold text-white">
                {metrics?.total?.sent || 0}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2">Emails Sent</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Eye className="w-8 h-8 text-blue-400" />
              <span
                className={`text-3xl font-bold ${getOpenRateColor(
                  metrics?.total?.open_rate || 0
                )}`}
              >
                {metrics?.total?.open_rate || 0}%
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2">Open Rate</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <MessageSquare className="w-8 h-8 text-green-400" />
              <span className="text-3xl font-bold text-white">
                {metrics?.total?.replied || 0}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2">Replies</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-8 h-8 text-orange-400" />
              <span className="text-3xl font-bold text-white">
                {metrics?.total?.reply_rate || 0}%
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-2">Reply Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Rule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#111] border-[#222]">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Performance by Rule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["E1", "E2", "E3", "E4"].map((rule) => {
                const ruleData = metrics?.by_rule?.[rule] || {};
                const ruleLabels = {
                  E1: "Webinar Invitation",
                  E2: "Quote Follow-up",
                  E3: "Coaching Reminder",
                  E4: "Repurchase",
                };
                return (
                  <div key={rule} className="flex items-center gap-4">
                    <Badge
                      variant="outline"
                      className={`w-10 justify-center ${
                        rule === "E1"
                          ? "border-blue-500/30 text-blue-400"
                          : rule === "E2"
                          ? "border-orange-500/30 text-orange-400"
                          : rule === "E3"
                          ? "border-purple-500/30 text-purple-400"
                          : "border-green-500/30 text-green-400"
                      }`}
                    >
                      {rule}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-400">{ruleLabels[rule]}</span>
                        <span className="text-white">{ruleData.sent || 0} sent</span>
                      </div>
                      <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            rule === "E1"
                              ? "bg-blue-500"
                              : rule === "E2"
                              ? "bg-orange-500"
                              : rule === "E3"
                              ? "bg-purple-500"
                              : "bg-green-500"
                          }`}
                          style={{
                            width: `${Math.min(ruleData.open_rate || 0, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs mt-1 text-slate-500">
                        <span>{ruleData.opened || 0} opened</span>
                        <span
                          className={getOpenRateColor(ruleData.open_rate || 0)}
                        >
                          {ruleData.open_rate || 0}% open rate
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card className="bg-[#111] border-[#222]">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.insights?.length > 0 ? (
              <div className="space-y-3">
                {metrics.insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      insight.type === "success"
                        ? "bg-green-500/10 border-green-500/30"
                        : insight.type === "warning"
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : "bg-blue-500/10 border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <InsightIcon type={insight.type} />
                      <p className="text-sm text-slate-300">{insight.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Send more emails to get insights!</p>
              </div>
            )}

            {/* Best performing rule */}
            {metrics?.best_performing_rule?.rule !== "N/A" && (
              <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <p className="text-sm text-purple-300">
                  🏆 <strong>{metrics.best_performing_rule.rule}</strong> is your
                  best performing rule with{" "}
                  <strong>{metrics.best_performing_rule.open_rate}%</strong> open
                  rate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      {metrics?.daily?.length > 0 && (
        <Card className="bg-[#111] border-[#222]">
          <CardHeader>
            <CardTitle className="text-white text-lg">Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={metrics.daily.slice(-14).map((d) => ({
                label: d.date.slice(5), // MM-DD
                value: d.sent,
              }))}
              maxValue={Math.max(...metrics.daily.map((d) => d.sent), 1)}
            />
          </CardContent>
        </Card>
      )}

      {/* Top Engaged Contacts */}
      <Card className="bg-[#111] border-[#222]">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-green-400" />
            Most Engaged Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contactMetrics.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No contact engagement data yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#222]">
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400 text-center">Sent</TableHead>
                  <TableHead className="text-slate-400 text-center">Opened</TableHead>
                  <TableHead className="text-slate-400 text-center">Replied</TableHead>
                  <TableHead className="text-slate-400 text-center">
                    Engagement
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactMetrics.map((contact) => (
                  <TableRow key={contact._id} className="border-[#222]">
                    <TableCell className="text-white">
                      {contact._id || "Unknown"}
                    </TableCell>
                    <TableCell className="text-center text-slate-300">
                      {contact.total_sent}
                    </TableCell>
                    <TableCell className="text-center text-blue-400">
                      {contact.total_opened}
                    </TableCell>
                    <TableCell className="text-center text-green-400">
                      {contact.total_replied}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`${
                          contact.engagement_score >= 100
                            ? "border-green-500/30 text-green-400"
                            : contact.engagement_score >= 50
                            ? "border-yellow-500/30 text-yellow-400"
                            : "border-slate-500/30 text-slate-400"
                        }`}
                      >
                        {contact.engagement_score}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      {weeklyReport && (
        <Card className="bg-[#111] border-[#222]">
          <CardHeader>
            <CardTitle className="text-white text-lg">Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
                <p className="text-2xl font-bold text-white">
                  {weeklyReport.summary.sent}
                </p>
                <p className="text-xs text-slate-500">Sent</p>
              </div>
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
                <p className="text-2xl font-bold text-blue-400">
                  {weeklyReport.summary.opened}
                </p>
                <p className="text-xs text-slate-500">Opened</p>
              </div>
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
                <p className="text-2xl font-bold text-green-400">
                  {weeklyReport.summary.replied}
                </p>
                <p className="text-xs text-slate-500">Replied</p>
              </div>
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
                <p
                  className={`text-2xl font-bold ${getOpenRateColor(
                    weeklyReport.summary.open_rate
                  )}`}
                >
                  {weeklyReport.summary.open_rate}%
                </p>
                <p className="text-xs text-slate-500">Open Rate</p>
              </div>
              <div className="text-center p-3 bg-[#0a0a0a] rounded-lg">
                <p className="text-2xl font-bold text-purple-400">
                  {weeklyReport.summary.reply_rate}%
                </p>
                <p className="text-xs text-slate-500">Reply Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
