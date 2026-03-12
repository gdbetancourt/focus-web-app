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
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById, LINKEDIN_PROFILES } from "./focusSections";
import { ProspectionTabContent } from "../todays-focus/ProspectionTabContent";
import { IndustrySearchesContent } from "../todays-focus/IndustrySearchesContent";
import { Users, Edit, Save, Loader2 } from "lucide-react";

// Get section configuration
const SECTION = getSectionById("max-linkedin-conexions");

export default function MaxLinkedInConexionsPage() {
  const [profileChecks, setProfileChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [maxConnections, setMaxConnections] = useState({});

  // Load weekly profile checks + max connections settings
  const loadProfileChecks = useCallback(async () => {
    try {
      const [checksRes, settingsRes] = await Promise.all([
        api.get("/focus/max-linkedin/weekly-checks"),
        api.get("/focus/max-linkedin/settings")
      ]);
      setProfileChecks(checksRes.data.checks || {});
      setTrafficStatus(checksRes.data.status || "gray");
      const initial = {};
      LINKEDIN_PROFILES.forEach(p => {
        const key = p.id.toLowerCase();
        initial[p.id] = {
          value: settingsRes.data[key]?.max_connections ?? 0,
          isEditing: false,
          isSaving: false,
          editValue: settingsRes.data[key]?.max_connections ?? 0
        };
      });
      setMaxConnections(initial);
    } catch (error) {
      console.error("Error loading profile checks:", error);
      const initialChecks = {};
      const initialMax = {};
      LINKEDIN_PROFILES.forEach(p => {
        initialChecks[p.id] = false;
        initialMax[p.id] = { value: 0, isEditing: false, isSaving: false, editValue: 0 };
      });
      setProfileChecks(initialChecks);
      setMaxConnections(initialMax);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfileChecks();
  }, [loadProfileChecks]);

  const handleEditMaxConnections = (profileId) => {
    setMaxConnections(prev => ({
      ...prev,
      [profileId]: { ...prev[profileId], isEditing: true, editValue: prev[profileId].value }
    }));
  };

  const handleSaveMaxConnections = async (profileId) => {
    const current = maxConnections[profileId];
    const val = parseInt(current.editValue, 10);
    if (isNaN(val) || val < 0) {
      toast.error("El valor debe ser un número >= 0");
      return;
    }
    setMaxConnections(prev => ({
      ...prev,
      [profileId]: { ...prev[profileId], isSaving: true }
    }));
    try {
      const res = await api.patch("/focus/max-linkedin/settings", {
        profile_id: profileId.toLowerCase(),
        max_connections: val
      });
      setMaxConnections(prev => ({
        ...prev,
        [profileId]: { value: res.data.max_connections, isEditing: false, isSaving: false, editValue: res.data.max_connections }
      }));
      toast.success(`Límite de ${profileId} actualizado a ${res.data.max_connections}`);
    } catch (error) {
      console.error("Error saving max connections:", error);
      setMaxConnections(prev => ({
        ...prev,
        [profileId]: { ...prev[profileId], isSaving: false }
      }));
      toast.error("Error al guardar el límite");
    }
  };

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
          sectionId={SECTION.id}
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

      {/* Max Connections Settings */}
      <Card className="bg-[#111] border-[#222] mb-6">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Max conexiones LinkedIn por perfil
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {LINKEDIN_PROFILES.map(profile => {
              const mc = maxConnections[profile.id] || { value: 0, isEditing: false, isSaving: false, editValue: 0 };
              return (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-[#333] bg-[#0a0a0a]"
                >
                  <div>
                    <span className="text-white font-medium">{profile.label}</span>
                    <p className="text-xs text-slate-500">{profile.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mc.isEditing ? (
                      <>
                        <Input
                          type="number"
                          min="0"
                          value={mc.editValue}
                          onChange={(e) => setMaxConnections(prev => ({
                            ...prev,
                            [profile.id]: { ...prev[profile.id], editValue: e.target.value }
                          }))}
                          className="w-20 h-8 bg-[#111] border-[#444] text-white text-center"
                          disabled={mc.isSaving}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveMaxConnections(profile.id)}
                          disabled={mc.isSaving}
                          className="h-8 bg-green-600 hover:bg-green-700"
                        >
                          {mc.isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-white font-mono text-lg">{mc.value}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditMaxConnections(profile.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Industrias Activas */}
      <h2 className="text-lg font-semibold text-white mb-4">Industrias activas</h2>
      <IndustrySearchesContent />

      {/* Empresas Activas */}
      <h2 className="text-lg font-semibold text-white mb-4 mt-8">Empresas activas</h2>
      <ProspectionTabContent />
    </SectionLayout>
  );
}
