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
    api
      .get("/focus/traffic-light-status")
      .then((res) => setTrafficStatus(res.data["personal-invitations"] || "gray"))
      .catch(() => {});
  }, []);

  return (
    <SectionLayout
      title={SECTION.label}
      sectionId={SECTION.id}
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
