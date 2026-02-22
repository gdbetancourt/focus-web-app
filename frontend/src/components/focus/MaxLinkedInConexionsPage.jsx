/**
 * MaxLinkedInConexionsPage - First section in the new Focus system
 * 
 * Wraps the existing ProspectionTabContent with the new SectionLayout
 * and adds profile checkboxes at the top (GB, MG)
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById, LINKEDIN_PROFILES } from "./focusSections";
import { ProspectionTabContent } from "../todays-focus/ProspectionTabContent";
import { Users } from "lucide-react";

// Get section configuration
const SECTION = getSectionById("max-linkedin-conexions");

export default function MaxLinkedInConexionsPage() {
  const [profileChecks, setProfileChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [trafficStatus, setTrafficStatus] = useState("gray");

  // Load weekly profile checks
  const loadProfileChecks = useCallback(async () => {
    try {
      const res = await api.get("/focus/max-linkedin/weekly-checks");
      setProfileChecks(res.data.checks || {});
      setTrafficStatus(res.data.status || "gray");
    } catch (error) {
      console.error("Error loading profile checks:", error);
      // Initialize empty checks
      const initialChecks = {};
      LINKEDIN_PROFILES.forEach(p => initialChecks[p.id] = false);
      setProfileChecks(initialChecks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileChecks();
  }, [loadProfileChecks]);

  // Toggle profile checkbox
  const handleToggleProfile = async (profileId) => {
    const newValue = !profileChecks[profileId];
    
    // Optimistic update
    setProfileChecks(prev => ({ ...prev, [profileId]: newValue }));
    
    try {
      const res = await api.post("/focus/max-linkedin/toggle-check", {
        profile_id: profileId,
        checked: newValue
      });
      
      // Update traffic status from response
      setTrafficStatus(res.data.status || "gray");
      
      toast.success(
        newValue 
          ? `Profile ${profileId.toUpperCase()} marked as complete` 
          : `Profile ${profileId.toUpperCase()} unmarked`
      );
    } catch (error) {
      console.error("Error toggling profile:", error);
      // Revert on error
      setProfileChecks(prev => ({ ...prev, [profileId]: !newValue }));
      toast.error("Error saving check status");
    }
  };

  // Calculate traffic light based on checks
  const calculateTrafficLight = () => {
    const checkedCount = Object.values(profileChecks).filter(Boolean).length;
    const totalProfiles = LINKEDIN_PROFILES.length;
    
    if (checkedCount === 0) return "red";
    if (checkedCount < totalProfiles) return "yellow";
    return "green";
  };

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={Users}
    >
      {/* Profile Checkboxes Section - At the top */}
      <Card className="bg-[#111] border-[#222] mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Weekly Profile Completion
            </h3>
            <Badge 
              className={`
                ${trafficStatus === 'green' ? 'bg-green-500/20 text-green-400' : ''}
                ${trafficStatus === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                ${trafficStatus === 'red' ? 'bg-red-500/20 text-red-400' : ''}
                ${trafficStatus === 'gray' ? 'bg-slate-500/20 text-slate-400' : ''}
              `}
            >
              {trafficStatus === 'green' && 'All profiles complete'}
              {trafficStatus === 'yellow' && 'Some profiles pending'}
              {trafficStatus === 'red' && 'No profiles marked'}
              {trafficStatus === 'gray' && 'Loading...'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {LINKEDIN_PROFILES.map(profile => (
              <div
                key={profile.id}
                className={`
                  flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer
                  ${profileChecks[profile.id] 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-[#0a0a0a] border-[#333] hover:border-[#444]'
                  }
                `}
                onClick={() => handleToggleProfile(profile.id)}
              >
                <Checkbox 
                  checked={profileChecks[profile.id] || false}
                  onCheckedChange={() => handleToggleProfile(profile.id)}
                  className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                />
                <div>
                  <span className="text-white font-medium">{profile.label}</span>
                  <p className="text-xs text-slate-500">{profile.name}</p>
                </div>
                {profileChecks[profile.id] && (
                  <Badge className="ml-auto bg-green-500/20 text-green-400 text-xs">
                    Done
                  </Badge>
                )}
              </div>
            ))}
          </div>
          
          <p className="text-xs text-slate-500 mt-4">
            Mark each profile when you've completed LinkedIn prospecting for this week (Monday to Sunday).
          </p>
        </CardContent>
      </Card>

      {/* Original Prospection Content */}
      <ProspectionTabContent />
    </SectionLayout>
  );
}
