/**
 * EmailFollowUpPage - Email follow-up section in the Focus system (Daily)
 * Shows pending emails for today with traffic light status
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import EmailRulesFollowUp from "./EmailRulesFollowUp";
import { Mail } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("email-follow-up");

export default function EmailFollowUpPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");

  const loadStatus = useCallback(async () => {
    try {
      // Use the focus endpoint which calculates all section statuses
      const res = await api.get("/focus/traffic-light-status");
      setTrafficStatus(res.data["email-follow-up"] || "gray");
    } catch (error) {
      console.error("Error loading status:", error);
      setTrafficStatus("gray");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Custom traffic rules
  const customTrafficRules = {
    red: "Ningún mensaje de hoy ha sido enviado",
    yellow: "Se han enviado algunos mensajes pero faltan más",
    green: "Todos los mensajes de hoy han sido enviados"
  };

  return (
    <SectionLayout
      title={SECTION.label}
          sectionId={SECTION.id}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={customTrafficRules}
      isDaily={true}
      currentStatus={trafficStatus}
      icon={Mail}
    >
      <EmailRulesFollowUp onStatusChange={loadStatus} />
    </SectionLayout>
  );
}
