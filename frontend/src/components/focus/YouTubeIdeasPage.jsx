/**
 * YouTubeIdeasPage - YouTube video production pipeline
 * Kanban board + Calendar view for planning and tracking video production.
 */
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { Youtube } from "lucide-react";
import YouTubeContent from "./youtube/YouTubeContent";

const SECTION = getSectionById("youtube-ideas");

export default function YouTubeIdeasPage() {
  return (
    <SectionLayout
      title={SECTION.label}
      sectionId={SECTION.id}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus="gray"
      icon={Youtube}
    >
      <YouTubeContent />
    </SectionLayout>
  );
}
