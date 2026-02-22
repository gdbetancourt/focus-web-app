/**
 * BulkEventInvitationsPage - Third section in the Focus system
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { InviteToEventsTabContent } from "../todays-focus/InviteToEventsTabContent";
import { Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("bulk-event-invitations");

export default function BulkEventInvitationsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await api.get("/focus/traffic-light-status");
        setTrafficStatus(res.data["bulk-event-invitations"] || "gray");
      } catch (error) {
        console.error("Error loading status:", error);
      }
    };
    loadStatus();
  }, []);

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={Calendar}
    >
      <InviteToEventsTabContent />
    </SectionLayout>
  );
}
