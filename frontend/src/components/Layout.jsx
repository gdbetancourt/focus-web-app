import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Target,
  Heart,
  Handshake,
  Package,
  RotateCcw,
  Users,
  Award,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Search,
  GitMerge,
  Briefcase,
  Building2,
  DollarSign,
  Database,
  Tag,
  Factory,
  BookOpen,
  TrendingUp,
  Sparkles,
  Layers,
  UserPlus,
  Pill,
  Clock,
  MapPin,
  MessageCircle,
  CheckCircle2,
  Hand,
  Video,
  Newspaper,
  Youtube,
  FolderOpen,
  Bell,
  AlertTriangle,
  CheckCheck,
  Trash2,
  Medal,
  Mail,
  BarChart3,
  Wand2,
  ClipboardList,
  Timer,
  Trophy
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useState, useEffect, useCallback } from "react";
import Step0, { useStep0 } from "../pages/Step0";
import { Beaker, MapPin as Map, Globe, Stethoscope, Bot, Grid3x3 } from "lucide-react";
import GlobalSearch from "./GlobalSearch";
import api from "../lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { LeaderlixIsotipo } from "./LeaderlixLogo";

// Focus Navigation Structure - All in English with Hierarchical Traffic Lights
const navSections = [
  // Today's Focus - First item and Homepage (combines all daily actions)
  {
    id: "todays-focus",
    trafficId: "todays-focus",
    label: "Today's Focus",
    icon: Target,
    path: "/todays-focus",
    isHomepage: true,
  },
  // Email Metrics - Track E1-E4 performance
  {
    id: "email-metrics",
    label: "Email Metrics",
    icon: BarChart3,
    path: "/deliver/email-metrics",
  },
  // Content Matrix - Focus Content System
  {
    id: "content-matrix",
    trafficId: "content",
    label: "Content Matrix",
    icon: Grid3x3,
    path: "/content",
  },
  // Newsletter Queue
  {
    id: "newsletter-queue",
    trafficId: "newsletter-queue",
    label: "Newsletter Queue",
    icon: Newspaper,
    path: "/content/newsletter-queue",
  },
  // Pipeline Steps (1-5)
  { 
    id: "step1",
    trafficId: "step1",
    label: "1. Prospecting", 
    icon: Target, 
    isSection: true,
    items: [
      { 
        id: "step1-find",
        trafficId: "1.1",
        label: "1.1 Find", 
        icon: Search,
        isSubSection: true,
        subItems: [
          { path: "/prospect/1-1-1-molecules", label: "1.1.1 By Molecules", icon: Beaker, trafficId: "1.1.1" },
          { path: "/prospect/1-1-2-posts", label: "1.1.2 By Post", icon: FileText, trafficId: "1.1.2" },
          { path: "/prospect/1-1-3-position", label: "1.1.3 By Position", icon: Briefcase, trafficId: "1.1.3" },
        ]
      },
      // 1.2 Attract - Hidden per user request (Coming Soon section)
      // { 
      //   id: "step1-attract",
      //   trafficId: "1.2",
      //   label: "1.2 Attract", 
      //   icon: TrendingUp,
      //   isSubSection: true,
      //   subItems: [
      //     { path: "/prospect/1-2-1-viral-videos", label: "1.2.1 Viral Videos", icon: Video, badge: "Soon", trafficId: "1.2.1" },
      //     { path: "/prospect/1-2-2-long-form-search", label: "1.2.2 Long Form Video Search", icon: Youtube, badge: "Soon", trafficId: "1.2.2" },
      //     { path: "/prospect/1-2-3-geo", label: "1.2.3 GEO", icon: MapPin, badge: "Soon", trafficId: "1.2.3" },
      //     { path: "/prospect/1-2-4-seo", label: "1.2.4 SEO", icon: Search, badge: "Soon", trafficId: "1.2.4" },
      //   ]
      // },
      { 
        id: "step1-connect",
        trafficId: "1.3",
        label: "1.3 Connect", 
        icon: UserPlus,
        isSubSection: true,
        subItems: [
          { path: "/foundations/who/contacts", label: "1.3.1 Deal Makers", icon: Users, trafficId: "1.3.1" },
          { path: "/prospect/1-3-2-linkedin-invitations", label: "1.3.2 Max LinkedIn Invitations", icon: UserPlus, trafficId: "1.3.2" },
          { path: "/prospect/1-3-3-social-followers", label: "1.3.3 Social Media Followers", icon: Heart, trafficId: "1.3.3" },
        ]
      },
    ]
  },
  { 
    id: "step2",
    trafficId: "step2",
    label: "2. Nurturing", 
    icon: Heart, 
    isSection: true,
    items: [
      { 
        id: "step2-individual",
        trafficId: "2.1",
        label: "2.1 Individual", 
        icon: Users,
        isSubSection: true,
        subItems: [
          { path: "/nurture/import", label: "2.1.1 Import LinkedIn Event Contacts", icon: Database, trafficId: "2.1.1" },
          // 2.1.2 Booklets & Cases - REMOVED per user request
          { path: "/nurture/contacts", label: "2.1.3 Nurture Deal Makers", icon: Users, trafficId: "2.1.3" },
        ]
      },
      { 
        id: "step2-bulk",
        trafficId: "2.2",
        label: "2.2 Bulk", 
        icon: Layers,
        isSubSection: true,
        subItems: [
          { path: "/nurture/website", label: "2.2.1 Website", icon: Globe, trafficId: "2.2.1" },
          // 2.2.2 Campaigns - REMOVED (moved to Mensajes de Hoy)
          { path: "/nurture/testimonials", label: "2.2.3 Testimonials", icon: Award, trafficId: "2.2.3" },
          { path: "/nurture/newsletters", label: "2.2.4 Newsletters", icon: Mail, trafficId: "2.2.4" },
          { path: "/nurture/email-metrics", label: "2.2.4.1 Email Metrics", icon: BarChart3, trafficId: "2.2.4.1" },
          { path: "/nurture/lms", label: "2.2.5 Learning (LMS)", icon: BookOpen, trafficId: "2.2.5" },
          { path: "/nurture/blog", label: "2.2.6 Blog", icon: FileText, trafficId: "2.2.6" },
          { path: "/nurture/content-pipeline", label: "2.2.6.1 Content AI", icon: Wand2, trafficId: "2.2.6.1" },
          { path: "/nurture/video-processing", label: "2.2.6.2 Video Processing", icon: Video, trafficId: "2.2.6.2" },
          // 2.2.14 Hero Countdown - REMOVED per Cambios.docx (countdown now auto-targets last Monday of month)
          { path: "/nurture/media", label: "2.2.7 Media Relations (Jerónimo)", icon: Newspaper, trafficId: "2.2.7" },
          { path: "/nurture/eugenio", label: "2.2.8 Eugenio Relations", icon: Users, trafficId: "2.2.8" },
          { path: "/nurture/editorial", label: "2.2.8.1 Editorial Relations", icon: BookOpen, trafficId: "2.2.8.1" },
          // 2.2.9 Long Form Videos - REMOVED per user request
          { path: "/nurture/events", label: "2.2.10 Own Events", icon: LayoutDashboard, trafficId: "2.2.10" },
          // 2.2.11 Medical Society Events - MOVED TO NOBYLIX
          { path: "/nurture/write-books", label: "2.2.12 Write Books", icon: BookOpen, trafficId: "2.2.12" },
        ]
      },
    ]
  },
  { 
    id: "step3",
    trafficId: "step3",
    label: "3. Close", 
    icon: Handshake, 
    isSection: true,
    items: [
      // 3.1 Venue Finder - MOVED TO NOBYLIX
      { path: "/close/cases", label: "3.1 Casos (Cotizaciones)", icon: Briefcase, trafficId: "3.1" },
      { path: "/close/quoter", label: "3.2 Quote Deal Makers", icon: FileText, trafficId: "3.2" },
      { path: "/close/contacts", label: "3.3 Close Deal Makers", icon: Users, trafficId: "3.3" },
      { path: "/close/convenios", label: "3.4 Convenios", icon: Building2, trafficId: "3.4" },
    ]
  },
  { 
    id: "step4",
    trafficId: "step4",
    label: "4. Delivery", 
    icon: Package, 
    isSection: true,
    items: [
      { path: "/deliver/projects", label: "4.0 Proyectos (Ganados)", icon: Trophy, trafficId: "4.0" },
      { path: "/deliver/contacts", label: "4.1 Deliver Deal Makers", icon: Users, trafficId: "4.1" },
      { path: "/deliver/time-tracker", label: "4.2 Coach Students", icon: Clock, trafficId: "4.2" },
      { path: "/deliver/certificates", label: "4.3 Certificate Students", icon: Award, trafficId: "4.3" },
    ]
  },
  { 
    id: "step5",
    trafficId: "step5",
    label: "5. Repurchase", 
    icon: RotateCcw, 
    isSection: true,
    items: [
      { path: "/foundations/who/contacts", label: "5.1 Deal Makers for Recommendations", icon: Users, trafficId: "5.1" },
      { path: "/foundations/who/contacts", label: "5.2 Students for Recommendations", icon: Award, trafficId: "5.2" },
    ]
  },
  
  // Foundations
  { 
    id: "foundations",
    trafficId: "foundations",
    label: "Foundations", 
    icon: Layers, 
    isSection: true,
    items: [
      { 
        id: "foundations-who",
        trafficId: "foundations-who",
        label: "Who", 
        icon: Users,
        isSubSection: true,
        subItems: [
          { path: "/foundations/who/contacts", label: "All Contacts", icon: Database, trafficId: "foundations-who-contacts" },
          { path: "/foundations/who/buyer-personas", label: "Buyer Personas", icon: Users, trafficId: "foundations-who-bp" },
          { path: "/foundations/who/keywords", label: "Keywords", icon: Tag, trafficId: "foundations-who-keywords" },
          { path: "/foundations/who/companies", label: "Companies", icon: Building2, trafficId: "foundations-who-companies" },
          { path: "/foundations/who/media", label: "Media", icon: Newspaper, trafficId: "foundations-who-media" },
          { path: "/foundations/who/merge", label: "Merge Duplicates", icon: GitMerge, trafficId: "foundations-who-merge" },
        ]
      },
      { path: "/foundations/what", label: "What", icon: Award, description: "Formatos", trafficId: "foundations-what" },
      { 
        id: "foundations-how",
        trafficId: "foundations-how",
        label: "How", 
        icon: Briefcase,
        isSubSection: true,
        subItems: [
          { path: "/foundations/how", label: "Ejes Temáticos", icon: Sparkles, trafficId: "foundations-how-axes" },
          { path: "/foundations/how/programas", label: "Programas", icon: BookOpen, trafficId: "foundations-how-programas" },
          { path: "/foundations/how/quiz", label: "Quiz System", icon: ClipboardList, trafficId: "foundations-how-quiz" },
        ]
      },
      { path: "/foundations/competencias", label: "Competencias", icon: Target, description: "Skills & Competencies", trafficId: "foundations-competencias" },
      { path: "/foundations/niveles", label: "Niveles", icon: Medal, description: "Certification Levels", trafficId: "foundations-niveles" },
      { path: "/foundations/how-much", label: "How Much", icon: DollarSign, description: "Pricing", trafficId: "foundations-howmuch" },
    ]
  },
  
  // Infostructure
  { 
    id: "infostructure",
    trafficId: "infostructure",
    label: "Infostructure", 
    icon: Database, 
    isSection: true,
    items: [
      { path: "/infostructure/pharma-pipelines", label: "Pharma Pipelines", icon: Pill, trafficId: "pharma" },
      // Medical Societies - MOVED TO NOBYLIX
      { path: "/infostructure/medical-specialties", label: "Medical Specialties", icon: Stethoscope, trafficId: "med-specialties" },
      // Búsqueda de Negocios - MOVED TO NOBYLIX
      { path: "/infostructure/keywords", label: "Keywords", icon: Tag, trafficId: "keywords" },
      { path: "/infostructure/sources", label: "Data Sources", icon: Database, trafficId: "sources" },
    ]
  },
  
  // Settings (no traffic light)
  { 
    id: "settings",
    label: "Settings", 
    icon: Settings, 
    isSection: true,
    items: [
      { path: "/settings", label: "Configuración", icon: Settings },
      { path: "/settings/kanban", label: "Kanban Dev", icon: LayoutDashboard },
      { path: "/analytics", label: "Analytics Dashboard", icon: BarChart3 },
    ]
  },
  
  // Admin Tools
  {
    id: "admin-tools",
    label: "Admin Tools",
    icon: GitMerge,
    children: [
      { path: "/admin/merge-duplicates", label: "Merge Duplicates", icon: GitMerge },
      { path: "/scraping-automation", label: "Scraping Automation", icon: Bot },
    ]
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState([]);
  const { showStep0, unlock, updateActivity } = useStep0();
  const [trafficLight, setTrafficLight] = useState(null);
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get("/scheduler/notifications?limit=20");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  }, []);
  
  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/scheduler/notifications/${notificationId}/read`);
      loadNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };
  
  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.put("/scheduler/notifications/read-all");
      loadNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };
  
  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/scheduler/notifications/${notificationId}`);
      loadNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };
  
  // Load notifications on mount and periodically
  useEffect(() => {
    // Initial load
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/scheduler/notifications?limit=20");
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      } catch (error) {
        console.error("Error loading notifications:", error);
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60 * 1000); // Every minute
    return () => clearInterval(interval);
  }, []);

  // Load traffic light status for navigation indicators
  useEffect(() => {
    const loadTrafficLight = async () => {
      try {
        const res = await api.get("/scheduler/traffic-light");
        setTrafficLight(res.data.status);
      } catch (error) {
        console.error("Error loading traffic light:", error);
      }
    };
    loadTrafficLight();
    // Refresh every 2 minutes
    const interval = setInterval(loadTrafficLight, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Get traffic light indicator for navigation item with full explanation
  // ALWAYS render with reserved space for alignment
  const getTrafficLight = (itemId, isSoon = false) => {
    // Base classes for consistent size and alignment
    const baseClass = "w-2.5 h-2.5 rounded-full flex-shrink-0";
    
    if (isSoon) {
      return (
        <span 
          className={`${baseClass} bg-slate-500`}
          title="⚫ GRIS: Próximamente (Coming Soon)
🟢 VERDE: Todo en orden, metas alcanzadas
🟡 AMARILLO: Requiere atención, tareas pendientes
🔴 ROJO: Error o vencido, acción urgente requerida" 
        />
      );
    }
    
    // Always render a placeholder if no traffic light data
    if (!trafficLight) {
      return <span className={`${baseClass} bg-slate-700/50`} />;
    }
    
    const status = trafficLight[itemId];
    // Render gray placeholder if no status for this item
    if (!status) {
      return <span className={`${baseClass} bg-slate-700/50`} />;
    }
    
    const colors = {
      green: "bg-green-500",
      yellow: "bg-yellow-500", 
      red: "bg-red-500",
      gray: "bg-slate-500"
    };
    
    const statusExplanations = {
      green: "🟢 VERDE: Todo en orden, metas alcanzadas",
      yellow: "🟡 AMARILLO: Requiere atención, tareas pendientes", 
      red: "🔴 ROJO: Error o vencido, acción urgente requerida",
      gray: "⚫ GRIS: Próximamente (Coming Soon)"
    };
    
    const fullExplanation = `Estado actual: ${statusExplanations[status.status] || "Desconocido"}

Escenarios posibles:
🟢 VERDE: Todo en orden, metas alcanzadas
🟡 AMARILLO: Requiere atención, tareas pendientes
🔴 ROJO: Error o vencido, acción urgente requerida
⚫ GRIS: Próximamente (Coming Soon)`;
    
    return (
      <span 
        className={`${baseClass} ${colors[status.status] || colors.gray}`}
        title={fullExplanation}
      />
    );
  };

  // Check if item is marked as "Soon"
  const isSoonItem = (item) => {
    return item.label?.includes("Soon") || item.soon === true;
  };

  // State for expanded subsections
  const [expandedSubSections, setExpandedSubSections] = useState([]);

  // Check if a subsection has an active route inside it
  const hasActiveRouteInside = (subSectionId) => {
    const currentPath = location.pathname;
    
    // Find the subsection in navSections
    for (const section of navSections) {
      if (section.items) {
        for (const item of section.items) {
          if (item.subItems) {
            for (const subItem of item.subItems) {
              if (subItem.id === subSectionId && subItem.nestedItems) {
                return subItem.nestedItems.some(nested => currentPath.startsWith(nested.path));
              }
            }
          }
        }
      }
    }
    return false;
  };

  // Toggle subsection - only opens clicked section (gradual/independent)
  const toggleSubSection = (subSectionId) => {
    setExpandedSubSections(prev => {
      if (prev.includes(subSectionId)) {
        // Don't close if there's an active route inside
        if (hasActiveRouteInside(subSectionId)) {
          return prev; // Keep it open
        }
        // Close this section and its children
        return prev.filter(id => id !== subSectionId && !id.startsWith(subSectionId + "-"));
      } else {
        // Only add this section, don't open siblings or parent's siblings
        return [...prev, subSectionId];
      }
    });
  };

  // Track previous path to avoid unnecessary updates
  const prevPathRef = React.useRef("");

  // Auto-expand section and subsection based on current route
  React.useLayoutEffect(() => {
    const currentPath = location.pathname;
    
    // Skip if same path (but always run on first mount)
    if (currentPath === prevPathRef.current && prevPathRef.current !== "") return;
    prevPathRef.current = currentPath;
    
    let activeSection = null;
    let activeSubSection = null;
    let activeNestedSubSection = null;
    
    for (const section of navSections) {
      if (section.items) {
        for (const item of section.items) {
          if (item.path && currentPath.startsWith(item.path)) {
            activeSection = section.id;
            break;
          }
          if (item.subItems) {
            for (const subItem of item.subItems) {
              if (subItem.path && currentPath.startsWith(subItem.path)) {
                activeSection = section.id;
                activeSubSection = item.id;
                break;
              }
              // Check for nested items (e.g., 1.1.1 Via LinkedIn)
              if (subItem.nestedItems) {
                const matchingNested = subItem.nestedItems.find(nested => currentPath.startsWith(nested.path));
                if (matchingNested) {
                  activeSection = section.id;
                  activeSubSection = item.id;
                  activeNestedSubSection = subItem.id;
                  break;
                }
              }
            }
            if (activeSubSection) break;
          }
        }
        if (activeSection) break;
      } else if (section.path && currentPath === section.path) {
        activeSection = section.id;
        break;
      }
    }
    
    if (activeSection) {
      setExpandedSections([activeSection]);
    }
    const subSectionsToExpand = [];
    if (activeSubSection) subSectionsToExpand.push(activeSubSection);
    if (activeNestedSubSection) subSectionsToExpand.push(activeNestedSubSection);
    if (subSectionsToExpand.length > 0) {
      setExpandedSubSections(subSectionsToExpand);
    }
  }, [location.pathname]);

  // Update activity on any interaction
  useEffect(() => {
    const handleActivity = () => updateActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, [updateActivity]);

  const toggleSection = (sectionId) => {
    // Only one section can be open at a time (accordion behavior)
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? [] // Close if already open
        : [sectionId] // Open only this section
    );
  };

  const isActiveSection = (section) => {
    if (section.path) return location.pathname === section.path;
    if (section.items) {
      return section.items.some(item => {
        if (item.path) return location.pathname.startsWith(item.path);
        if (item.subItems) {
          return item.subItems.some(sub => {
            if (sub.path) return location.pathname.startsWith(sub.path);
            // Check nested items
            if (sub.nestedItems) {
              return sub.nestedItems.some(nested => location.pathname.startsWith(nested.path));
            }
            return false;
          });
        }
        return false;
      });
    }
    return false;
  };

  // Show Step 0 if needed
  if (showStep0) {
    return <Step0 onUnlock={unlock} />;
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0a' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: '#0f0f0f', borderRight: '1px solid #1a1a1a' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-[#ff3000] to-[#f9a11d] flex items-center justify-center neon-glow p-1.5 hover:scale-105 transition-transform">
                <LeaderlixIsotipo className="w-full h-full" variant="white" animate={true} animationType="glow" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "'Comfortaa', sans-serif" }}>leaderlix</span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.id}>
                {section.isSection ? (
                  <>
                    {/* Section header - NO descriptive icon, only semaphore + chevron */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 ${
                        isActiveSection(section)
                          ? 'bg-[#ff3300]/10 text-[#ff3300]'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getTrafficLight(section.trafficId)}
                        <span className="font-medium text-sm text-left">{section.label}</span>
                      </div>
                      {section.items?.length > 0 && (
                        expandedSections.includes(section.id) 
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {expandedSections.includes(section.id) && section.items?.length > 0 && (
                      <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-4">
                        {section.items.map((item) => (
                          item.isSubSection ? (
                            // Render collapsible sub-section - NO icon, only semaphore + chevron
                            <div key={item.id} className="space-y-0.5">
                              <button
                                onClick={() => toggleSubSection(item.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 rounded-lg transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  {getTrafficLight(item.trafficId)}
                                  <span className="font-medium text-left">{item.label}</span>
                                </div>
                                {expandedSubSections.includes(item.id) 
                                  ? <ChevronDown className="w-3 h-3" />
                                  : <ChevronRight className="w-3 h-3" />
                                }
                              </button>
                              
                              {expandedSubSections.includes(item.id) && (
                                <div className="ml-4 space-y-0.5 border-l border-slate-800 pl-3">
                                  {item.subItems?.map((subItem) => (
                                    subItem.isNestedSubSection ? (
                                      // Render nested sub-section - NO icon, only semaphore + chevron
                                      <div key={subItem.id} className="space-y-0.5">
                                        <button
                                          onClick={() => toggleSubSection(subItem.id)}
                                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800/30 rounded-lg transition-all"
                                        >
                                          <div className="flex items-center gap-2">
                                            {getTrafficLight(subItem.trafficId)}
                                            <span className="font-medium text-left">{subItem.label}</span>
                                          </div>
                                          {expandedSubSections.includes(subItem.id) 
                                            ? <ChevronDown className="w-3 h-3" />
                                            : <ChevronRight className="w-3 h-3" />
                                          }
                                        </button>
                                        
                                        {expandedSubSections.includes(subItem.id) && (
                                          <div className="ml-4 space-y-0.5 border-l border-slate-800/50 pl-3">
                                            {subItem.nestedItems?.map((nestedItem) => (
                                              <NavLink
                                                key={nestedItem.path}
                                                to={nestedItem.path}
                                                onClick={() => setSidebarOpen(false)}
                                                className={({ isActive }) =>
                                                  `flex items-center gap-2 px-2 py-1 rounded-lg text-[11px] transition-all duration-200 ${
                                                    isActive
                                                      ? 'bg-[#ff3300]/10 text-[#ff3300] border-l-2 border-[#ff3300] -ml-[13px] pl-[10px]'
                                                      : 'text-slate-500 hover:text-white hover:bg-slate-800/30'
                                                  }`
                                                }
                                              >
                                                {getTrafficLight(nestedItem.trafficId, !!nestedItem.badge)}
                                                <span className="flex-1 text-left">{nestedItem.label}</span>
                                                {nestedItem.badge && (
                                                  <Badge className="bg-slate-700/50 text-slate-400 text-[9px] px-1.5 py-0">
                                                    {nestedItem.badge}
                                                  </Badge>
                                                )}
                                              </NavLink>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      // Regular subItem - NO icon, only semaphore + text + badge
                                      <NavLink
                                        key={subItem.path}
                                        to={subItem.path}
                                        onClick={() => setSidebarOpen(false)}
                                        className={({ isActive }) =>
                                          `flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                                            isActive
                                              ? 'bg-[#ff3300]/10 text-[#ff3300] border-l-2 border-[#ff3300] -ml-[13px] pl-[10px]'
                                              : 'text-slate-500 hover:text-white hover:bg-slate-800/30'
                                          }`
                                        }
                                      >
                                        {getTrafficLight(subItem.trafficId, !!subItem.badge)}
                                        <span className="flex-1 text-left">{subItem.label}</span>
                                        {subItem.badge && (
                                          <Badge className="bg-slate-700/50 text-slate-400 text-[9px] px-1.5 py-0">
                                            {subItem.badge}
                                          </Badge>
                                        )}
                                      </NavLink>
                                    )
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            // Regular item with traffic light - NO icon (only semaphore + text + badge)
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={() => setSidebarOpen(false)}
                              className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                  isActive
                                    ? 'bg-[#ff3300]/10 text-[#ff3300] border-l-2 border-[#ff3300] -ml-[17px] pl-[14px]'
                                    : 'text-slate-500 hover:text-white hover:bg-slate-800/30'
                                }`
                              }
                            >
                              {getTrafficLight(item.trafficId, !!item.badge)}
                              <span className="flex-1 text-left">{item.label}</span>
                              {item.badge && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px] px-1.5 py-0">
                                  {item.badge}
                                </Badge>
                              )}
                            </NavLink>
                          )
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // Homepage/Standalone item (Mensajes de Hoy) - NO icon, has semaphore
                  <NavLink
                    to={section.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-[#ff3300]/10 text-[#ff3300]'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    {getTrafficLight(section.trafficId)}
                    <span className="font-medium text-sm">{section.label}</span>
                  </NavLink>
                )}
              </div>
            ))}
          </nav>
          
          {/* User */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded-full bg-[#ff3300]/20 flex items-center justify-center">
                <span className="text-sm font-bold text-[#ff3300]">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={logout}
                className="text-slate-500 hover:text-red-400 hover:bg-red-400/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <main className="flex-1 lg:ml-72">
        {/* Top Header */}
        <header className="glass-header sticky top-0 z-30 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Pipeline Progress */}
            <div className="hidden md:flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`step-indicator ${
                    location.pathname.includes(`/step${step}`) || 
                    (step === 1 && location.pathname.includes('/prospect')) ||
                    (step === 2 && location.pathname.includes('/nurture')) ||
                    (step === 3 && location.pathname.includes('/close')) ||
                    (step === 4 && location.pathname.includes('/deliver')) ||
                    (step === 5 && location.pathname.includes('/repurchase'))
                      ? 'active' 
                      : ''
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>
            
            {/* Global Search */}
            <div className="hidden md:block ml-4">
              <GlobalSearch />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="relative text-slate-400 hover:text-white"
                  data-testid="notifications-btn"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-80 bg-[#0f0f0f] border-[#222] max-h-96 overflow-y-auto"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#222]">
                  <span className="font-medium text-white text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs text-blue-400 hover:text-blue-300 h-auto p-1"
                    >
                      <CheckCheck className="w-3 h-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                </div>
                
                {notifications.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <Bell className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm text-slate-500">No notifications</p>
                  </div>
                ) : (
                  <>
                    {notifications.map((notif) => (
                      <DropdownMenuItem
                        key={notif.id}
                        className={`flex flex-col items-start gap-1 px-3 py-3 cursor-pointer ${
                          !notif.read ? 'bg-red-500/5' : ''
                        }`}
                        onClick={() => !notif.read && markAsRead(notif.id)}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            notif.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              !notif.read ? 'text-white' : 'text-slate-300'
                            }`}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                            {notif.error && (
                              <p className="text-xs text-red-400/70 mt-1 truncate">
                                Error: {notif.error}
                              </p>
                            )}
                            <p className="text-xs text-slate-600 mt-1">
                              {new Date(notif.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-red-500 absolute right-3 top-3" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-[#222]" />
                    <DropdownMenuItem
                      className="text-center justify-center text-xs text-slate-500 hover:text-white"
                      onClick={() => window.location.href = '/settings'}
                    >
                      View all in Settings
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <span className="text-xs text-slate-500 hidden sm:block">
              Focus v2.0
            </span>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
