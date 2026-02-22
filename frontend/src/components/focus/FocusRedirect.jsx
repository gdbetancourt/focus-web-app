/**
 * FocusRedirect - Smart redirect to first non-green section
 * 
 * When user visits /focus, this component:
 * 1. Loads traffic light status
 * 2. Finds the first section with red or yellow status
 * 3. Redirects to that section (or first section if all are green)
 */
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import FOCUS_SECTIONS from "./focusSections";
import api from "../../lib/api";

export default function FocusRedirect() {
  const [targetPath, setTargetPath] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const findFirstNonGreenSection = async () => {
      try {
        const res = await api.get("/focus/traffic-light-status");
        const status = res.data || {};
        
        // Find first section that is red or yellow
        const firstNonGreen = FOCUS_SECTIONS.find(section => {
          const sectionStatus = status[section.id];
          return sectionStatus === "red" || sectionStatus === "yellow";
        });
        
        if (firstNonGreen) {
          setTargetPath(firstNonGreen.path);
        } else {
          // All green - go to first section
          setTargetPath(FOCUS_SECTIONS[0].path);
        }
      } catch (error) {
        console.error("Error finding redirect target:", error);
        // Fallback to first section
        setTargetPath(FOCUS_SECTIONS[0].path);
      } finally {
        setLoading(false);
      }
    };
    
    findFirstNonGreenSection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
          <p className="text-slate-400">Finding your next task...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={targetPath} replace />;
}
