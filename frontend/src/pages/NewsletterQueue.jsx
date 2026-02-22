import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Newspaper,
  RefreshCw,
  Trash2,
  GripVertical,
  ExternalLink,
  Layers,
  ArrowUp,
  ArrowDown,
  Send,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";

export default function NewsletterQueue() {
  const [loading, setLoading] = useState(true);
  const [queueData, setQueueData] = useState(null);
  const [axes, setAxes] = useState([]);
  const [selectedAxis, setSelectedAxis] = useState("all");

  useEffect(() => {
    loadQueueData();
    loadAxes();
  }, []);

  const loadQueueData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/content/newsletter-queue");
      setQueueData(res.data);
    } catch (error) {
      console.error("Error loading queue:", error);
      toast.error("Error loading newsletter queue");
    } finally {
      setLoading(false);
    }
  };

  const loadAxes = async () => {
    try {
      const res = await api.get("/foundations/thematic-axes");
      setAxes(res.data.thematic_axes || []);
    } catch (error) {
      console.error("Error loading axes:", error);
    }
  };

  const handleRemoveFromQueue = async (queueId) => {
    try {
      await api.delete(`/content/newsletter-queue/${queueId}`);
      toast.success("Removed from queue");
      loadQueueData();
    } catch (error) {
      console.error("Error removing from queue:", error);
      toast.error("Error removing from queue");
    }
  };

  const handleUpdatePriority = async (queueId, newPriority) => {
    try {
      await api.put(`/content/newsletter-queue/${queueId}/priority`, {
        priority: newPriority
      });
      loadQueueData();
    } catch (error) {
      console.error("Error updating priority:", error);
    }
  };

  // Filter items by selected axis
  const filteredGroups = selectedAxis === "all"
    ? Object.entries(queueData?.grouped || {})
    : Object.entries(queueData?.grouped || {}).filter(([id]) => id === selectedAxis);

  // Status badge colors
  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "included":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><FileText className="w-3 h-3 mr-1" />Included</Badge>;
      case "sent":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading && !queueData) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="newsletter-queue-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="newsletter-queue-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Newspaper className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Newsletter Queue</h1>
            <p className="text-sm text-slate-500">Manage content queued for newsletters by thematic axis</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter by Axis */}
          <Select value={selectedAxis} onValueChange={setSelectedAxis}>
            <SelectTrigger className="w-[200px] bg-[#111] border-[#333]">
              <SelectValue placeholder="Filter by axis..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Axes</SelectItem>
              {axes.map(axis => (
                <SelectItem key={axis.id} value={axis.id}>
                  {axis.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={loadQueueData}
            className="border-[#333]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold text-white">{queueData?.total || 0}</p>
            <p className="text-sm text-slate-500">Total in Queue</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold text-yellow-400">
              {queueData?.queue_items?.filter(i => i.status === "pending").length || 0}
            </p>
            <p className="text-sm text-slate-500">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold text-blue-400">
              {queueData?.queue_items?.filter(i => i.status === "included").length || 0}
            </p>
            <p className="text-sm text-slate-500">Included in Draft</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="pt-4">
            <p className="text-3xl font-bold text-green-400">
              {queueData?.queue_items?.filter(i => i.status === "sent").length || 0}
            </p>
            <p className="text-sm text-slate-500">Sent</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue by Axis */}
      {filteredGroups.length === 0 ? (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="py-12 text-center">
            <Newspaper className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No items in the newsletter queue</p>
            <p className="text-sm text-slate-500 mt-1">
              Add content from the Content Matrix to build your newsletters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map(([axisId, group]) => (
            <Card key={axisId} className="bg-[#111] border-[#222]">
              <CardHeader className="border-b border-[#222]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-[#ff3300]" />
                    <CardTitle className="text-white">
                      {group.axis?.name || "Unknown Axis"}
                    </CardTitle>
                    <Badge className="bg-[#ff3300]/20 text-[#ff3300]">
                      {group.items?.length || 0} items
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#ff3300] text-[#ff3300] hover:bg-[#ff3300]/10"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Create Newsletter
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-[#222]">
                  {group.items?.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((item, index) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center gap-4 hover:bg-[#0a0a0a] transition-colors"
                    >
                      {/* Drag Handle / Order */}
                      <div className="flex flex-col items-center gap-1 text-slate-600">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-xs">{index + 1}</span>
                      </div>

                      {/* Priority Controls */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleUpdatePriority(item.id, (item.priority || 0) + 1)}
                          className="p-1 hover:bg-[#222] rounded text-slate-500 hover:text-white"
                          title="Increase priority"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <span className="text-xs text-center text-slate-500">{item.priority || 0}</span>
                        <button
                          onClick={() => handleUpdatePriority(item.id, Math.max(0, (item.priority || 0) - 1))}
                          className="p-1 hover:bg-[#222] rounded text-slate-500 hover:text-white"
                          title="Decrease priority"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Content Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">
                          {item.content_item?.title || "Unknown Content"}
                        </h4>
                        {item.content_item?.url && (
                          <a
                            href={item.content_item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {item.content_item.url.length > 50
                              ? item.content_item.url.substring(0, 50) + "..."
                              : item.content_item.url}
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(item.status)}
                          {item.notes && (
                            <span className="text-xs text-slate-500">{item.notes}</span>
                          )}
                        </div>
                      </div>

                      {/* Queued Date */}
                      <div className="text-right text-xs text-slate-500">
                        <p>Queued</p>
                        <p>{item.queued_at ? new Date(item.queued_at).toLocaleDateString() : "-"}</p>
                      </div>

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromQueue(item.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
