/**
 * PersonalInvitationsPage - Sixth section in the Focus system (Ice Breaker)
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { IceBreakerTabContent } from "../todays-focus/IceBreakerTabContent";
import { Snowflake } from "lucide-react";
import { useState, useEffect } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("personal-invitations");

export default function PersonalInvitationsPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await api.get("/focus/traffic-light-status");
        setTrafficStatus(res.data["personal-invitations"] || "gray");
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
      icon={Snowflake}
    >
      <IceBreakerTabContent />
    </SectionLayout>
  );
}
