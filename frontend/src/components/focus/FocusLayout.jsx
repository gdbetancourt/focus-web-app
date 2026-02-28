/**
 * FocusLayout - Main layout for the Focus system
 * 
 * Features:
 * - Left sidebar with flat navigation (FocusNavigation)
 * - Main content area for section content
 * - Top header with user info and global search
 */
import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Menu, X, LogOut, Bell, Settings, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "../ui/button";
import { LeaderlixIsotipo } from "../LeaderlixLogo";
import GlobalSearch from "../GlobalSearch";
import FocusNavigation from "./FocusNavigation";
import FOCUS_SECTIONS, { getSectionIndex } from "./focusSections";
import api from "../../lib/api";

export default function FocusLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trafficLightStatus, setTrafficLightStatus] = useState({});

  // Get current section based on path
  const currentSectionIndex = FOCUS_SECTIONS.findIndex(s => 
    location.pathname.startsWith(s.path)
  );
  const currentSection = FOCUS_SECTIONS[currentSectionIndex];

  // Load traffic light status
  const loadTrafficLight = useCallback(async () => {
    try {
      const res = await api.get("/focus/traffic-light-status");
      setTrafficLightStatus(res.data || {});
    } catch (error) {
      console.error("Error loading traffic light status:", error);
      const defaultStatus = {};
      FOCUS_SECTIONS.forEach(s => defaultStatus[s.id] = "gray");
      setTrafficLightStatus(defaultStatus);
    }
  }, []);

  useEffect(() => {
    loadTrafficLight();
    const interval = setInterval(loadTrafficLight, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadTrafficLight]);

  // Refresh navigation semaphore when child pages signal a change
  useEffect(() => {
    const handler = () => loadTrafficLight();
    window.addEventListener("focus:traffic-light-changed", handler);
    return () => window.removeEventListener("focus:traffic-light-changed", handler);
  }, [loadTrafficLight]);

  // Navigation handlers
  const goToPrevSection = () => {
    if (currentSectionIndex > 0) {
      navigate(FOCUS_SECTIONS[currentSectionIndex - 1].path);
    }
  };

  const goToNextSection = () => {
    if (currentSectionIndex < FOCUS_SECTIONS.length - 1) {
      navigate(FOCUS_SECTIONS[currentSectionIndex + 1].path);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0a' }}>
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`} 
        style={{ background: '#0f0f0f', borderRight: '1px solid #1a1a1a' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-[#ff3000] to-[#f9a11d] flex items-center justify-center p-1.5 hover:scale-105 transition-transform">
                <LeaderlixIsotipo className="w-full h-full" variant="white" animate={true} animationType="glow" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
                focus
              </span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 px-4 py-6 overflow-y-auto">
            <FocusNavigation 
              trafficLightStatus={trafficLightStatus}
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>
          
          {/* Analytics Link */}
          <div className="px-4 py-2 border-t border-slate-800">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800/50"
              onClick={() => navigate("/focus/analytics")}
            >
              <BarChart3 className="w-4 h-4 mr-3" />
              Analytics
            </Button>
          </div>
          
          {/* Settings Link */}
          <div className="px-4 py-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800/50"
              onClick={() => navigate("/settings")}
            >
              <Settings className="w-4 h-4 mr-3" />
              Settings
            </Button>
          </div>
          
          {/* User */}
          <div className="p-4 border-t border-slate-800">
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
      <main className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        {/* Top Header - Fixed */}
        <header className="fixed top-0 right-0 left-0 lg:left-72 z-30 h-16 flex items-center justify-between px-6 bg-[#0a0a0a] border-b border-slate-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Section Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevSection}
                disabled={currentSectionIndex <= 0}
                className="text-slate-400 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <span className="text-sm text-slate-400 min-w-[180px] text-center">
                {currentSection ? (
                  <>
                    <span className="text-slate-600">{currentSectionIndex + 1}/{FOCUS_SECTIONS.length}</span>
                    {" · "}
                    <span className="text-white font-medium">{currentSection.label}</span>
                  </>
                ) : (
                  "Select a section"
                )}
              </span>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextSection}
                disabled={currentSectionIndex >= FOCUS_SECTIONS.length - 1}
                className="text-slate-400 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Global Search */}
            <div className="hidden lg:block ml-4">
              <GlobalSearch />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Notifications placeholder */}
            <Button 
              variant="ghost" 
              size="icon"
              className="text-slate-400 hover:text-white"
            >
              <Bell className="w-5 h-5" />
            </Button>
            
            <span className="text-xs text-slate-500 hidden sm:block">
              Focus v3.0
            </span>
          </div>
        </header>
        
        {/* Page Content - with top padding to account for fixed header */}
        <div className="p-6 lg:p-8 mt-16">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
