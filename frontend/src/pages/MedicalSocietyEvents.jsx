import React, { useState, useEffect } from "react";
import { 
  Calendar, Building2, MapPin, ExternalLink, Trash2, 
  Loader2, Search, Filter, Clock 
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import api from "../lib/api";

export default function MedicalSocietyEvents() {
  const [events, setEvents] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSociety, setFilterSociety] = useState("all");
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, societiesRes] = await Promise.all([
        api.get("/medical/society-events"),
        api.get("/medical/societies")
      ]);
      setEvents(eventsRes.data.events || []);
      setSocieties(societiesRes.data.societies || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/medical/society-events/${deleteId}`);
      toast.success("Event deleted");
      loadData();
    } catch (error) {
      toast.error("Failed to delete event");
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "TBD";
    try {
      return new Date(dateStr).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const getEventTypeBadge = (type) => {
    const types = {
      congress: { color: "bg-purple-500/20 text-purple-400", label: "Congress" },
      conference: { color: "bg-blue-500/20 text-blue-400", label: "Conference" },
      webinar: { color: "bg-green-500/20 text-green-400", label: "Webinar" },
      workshop: { color: "bg-amber-500/20 text-amber-400", label: "Workshop" },
      symposium: { color: "bg-pink-500/20 text-pink-400", label: "Symposium" }
    };
    const typeInfo = types[type] || { color: "bg-slate-500/20 text-slate-400", label: type || "Event" };
    return <Badge className={typeInfo.color}>{typeInfo.label}</Badge>;
  };

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         e.society_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSociety = filterSociety === "all" || e.society_id === filterSociety;
    return matchesSearch && matchesSociety;
  });

  return (
    <div className="space-y-8" data-testid="medical-society-events-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#ff3300]" />
            Medical Society Events
          </h1>
          <p className="text-slate-400 mt-1">
            Events automatically detected from medical society websites
          </p>
        </div>
        <Badge className="bg-slate-700/50 text-slate-300 text-lg px-4 py-2">
          {events.length} Events
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800"
          />
        </div>
        <Select value={filterSociety} onValueChange={setFilterSociety}>
          <SelectTrigger className="w-[250px] bg-slate-900/50 border-slate-800">
            <Filter className="w-4 h-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Filter by society" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Societies</SelectItem>
            {societies.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-slate-400 mt-2">Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Events Found</h3>
          <p className="text-slate-400 mb-4">
            {searchTerm || filterSociety !== "all" 
              ? "Try adjusting your filters"
              : "Events will appear here when scraped from medical society websites"}
          </p>
          <p className="text-sm text-slate-500">
            Go to <span className="text-[#ff3300]">Infostructure → Medical Societies</span> to add societies and scrape their websites
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map(event => (
            <div
              key={event.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{event.name}</h3>
                    {getEventTypeBadge(event.event_type)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {event.society_name}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-[#ff3300]">
                      <Clock className="w-4 h-4" />
                      {formatDate(event.date_start)}
                      {event.date_end && event.date_end !== event.date_start && (
                        <> - {formatDate(event.date_end)}</>
                      )}
                    </span>
                    <Badge variant="outline" className="border-slate-700 text-slate-500 text-xs">
                      Source: {event.source || "scrape"}
                    </Badge>
                  </div>
                  
                  {event.description && (
                    <p className="mt-3 text-sm text-slate-400 line-clamp-2">{event.description}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {event.url && (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(event.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#0f0f0f] border-[#222]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the event from the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
