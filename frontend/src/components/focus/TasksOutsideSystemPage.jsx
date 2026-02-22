/**
 * TasksOutsideSystemPage - Twelfth section in the Focus system (Daily)
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { TodoTabContent } from "../todays-focus/TodoTabContent";
import { ListTodo } from "lucide-react";
import { useState, useEffect } from "react";
import api from "../../lib/api";

const SECTION = getSectionById("tasks-outside-system");

export default function TasksOutsideSystemPage() {
  const [trafficStatus, setTrafficStatus] = useState("gray");

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await api.get("/focus/traffic-light-status");
        setTrafficStatus(res.data["tasks-outside-system"] || "gray");
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
      isDaily={true}
      currentStatus={trafficStatus}
      icon={ListTodo}
    >
      <TodoTabContent />
    </SectionLayout>
  );
}
