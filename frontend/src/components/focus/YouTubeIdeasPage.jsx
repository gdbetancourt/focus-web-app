/**
 * YouTubeIdeasPage - Wrapper for ContentMatrix in Focus module
 * 
 * Integrates the content matrix/YouTube ideas functionality
 * into the Focus section with SectionLayout.
 */
import ContentMatrix from "../../pages/ContentMatrix";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { Youtube } from "lucide-react";

const SECTION = getSectionById("youtube-ideas");

export default function YouTubeIdeasPage() {
  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus="gray"
      icon={Youtube}
      inConstruction={true}
    >
      <ContentMatrix />
    </SectionLayout>
  );
}
