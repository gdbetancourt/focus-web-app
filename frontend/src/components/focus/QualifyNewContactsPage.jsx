/**
 * QualifyNewContactsPage - Fifth section in the Focus system
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { ToQualifyTabContent } from "../todays-focus/ToQualifyTabContent";
import { CheckSquare } from "lucide-react";
import { useState, useEffect } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("qualify-new-contacts");

export default function QualifyNewContactsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [buyerPersonas, setBuyerPersonas] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, bpRes] = await Promise.all([
          api.get("/focus/traffic-light-status"),
          api.get("/buyer-personas-db/")
        ]);
        setTrafficStatus(statusRes.data["qualify-new-contacts"] || "gray");
        setBuyerPersonas(bpRes.data || []);
      } catch (error) {
        console.error("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={CheckSquare}
    >
      <ToQualifyTabContent buyerPersonas={buyerPersonas} />
    </SectionLayout>
  );
}
