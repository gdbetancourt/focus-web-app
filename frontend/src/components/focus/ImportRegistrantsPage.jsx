/**
 * ImportRegistrantsPage - Fourth section in the Focus system
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { ImportRegistrantsTabContent } from "../todays-focus/ImportRegistrantsTabContent";
import { Upload } from "lucide-react";
import { useState, useEffect } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("import-registrants");

export default function ImportRegistrantsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [buyerPersonas, setBuyerPersonas] = useState([]);
  const [industries, setIndustries] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statusRes, bpRes, indRes] = await Promise.all([
          api.get("/focus/traffic-light-status"),
          api.get("/buyer-personas-db/"),
          api.get("/industries")
        ]);
        setTrafficStatus(statusRes.data["import-registrants"] || "gray");
        setBuyerPersonas(bpRes.data || []);
        setIndustries(indRes.data?.industries || []);
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
      icon={Upload}
    >
      <ImportRegistrantsTabContent 
        buyerPersonas={buyerPersonas}
        industries={industries}
      />
    </SectionLayout>
  );
}
