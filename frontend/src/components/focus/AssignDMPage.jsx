/**
 * AssignDMPage - Seventh section in the Focus system
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { AssignDMTabContent } from "../todays-focus/AssignDMTabContent";
import { UserPlus } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("assign-dm");

export default function AssignDMPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [casesWithoutDM, setCasesWithoutDM] = useState([]);
  const [loadingDM, setLoadingDM] = useState(true);

  const formatCurrency = (amount, currency = "MXN") => {
    if (!amount) return "-";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
  };

  const refreshCasesWithoutDM = useCallback(async () => {
    setLoadingDM(true);
    try {
      const res = await api.get("/todays-focus/cases-without-dm");
      setCasesWithoutDM(res.data.cases || []);
    } catch (error) {
      console.error("Error loading cases:", error);
    } finally {
      setLoadingDM(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const statusRes = await api.get("/focus/traffic-light-status");
        setTrafficStatus(statusRes.data["assign-dm"] || "gray");
      } catch (error) {
        console.error("Error loading status:", error);
      }
    };
    loadData();
    refreshCasesWithoutDM();
  }, [refreshCasesWithoutDM]);

  return (
    <SectionLayout
      title={SECTION.label}
          sectionId={SECTION.id}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={UserPlus}
    >
      <AssignDMTabContent
        casesWithoutDM={casesWithoutDM}
        setCasesWithoutDM={setCasesWithoutDM}
        loadingDM={loadingDM}
        onRefresh={refreshCasesWithoutDM}
        formatCurrency={formatCurrency}
      />
    </SectionLayout>
  );
}
