/**
 * WhatsAppFollowUpPage - WhatsApp follow-up section in the Focus system (Daily)
 * Shows pending WhatsApp messages with traffic light status
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import WhatsAppRulesFollowUp from "./WhatsAppRulesFollowUp";
import { MessageSquare } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("whatsapp-follow-up");

export default function WhatsAppFollowUpPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/focus/traffic-light-status");
      setTrafficStatus(res.data["whatsapp-follow-up"] || "gray");
    } catch (error) {
      console.error("Error loading status:", error);
      setTrafficStatus("gray");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const customTrafficRules = {
    red: "Ningun mensaje de hoy ha sido enviado",
    yellow: "Se han enviado algunos mensajes pero faltan mas",
    green: "Todos los mensajes de hoy han sido enviados"
  };

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={customTrafficRules}
      isDaily={true}
      currentStatus={trafficStatus}
      icon={MessageSquare}
    >
      <WhatsAppRulesFollowUp onStatusChange={loadStatus} />
    </SectionLayout>
  );
}
