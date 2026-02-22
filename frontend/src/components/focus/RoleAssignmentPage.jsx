/**
 * RoleAssignmentPage - Eighth section in the Focus system
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { AssignRolesTabContent } from "../todays-focus/AssignRolesTabContent";
import { Tag } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("role-assignment");

export default function RoleAssignmentPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");
  const [contactsWithoutRoles, setContactsWithoutRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const refreshContactsWithoutRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await api.get("/todays-focus/contacts-without-roles");
      setContactsWithoutRoles(res.data.contacts || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const statusRes = await api.get("/focus/traffic-light-status");
        setTrafficStatus(statusRes.data["role-assignment"] || "gray");
      } catch (error) {
        console.error("Error loading status:", error);
      }
    };
    loadData();
    refreshContactsWithoutRoles();
  }, [refreshContactsWithoutRoles]);

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={Tag}
    >
      <AssignRolesTabContent
        contactsWithoutRoles={contactsWithoutRoles}
        setContactsWithoutRoles={setContactsWithoutRoles}
        loadingRoles={loadingRoles}
        onRefresh={refreshContactsWithoutRoles}
      />
    </SectionLayout>
  );
}
