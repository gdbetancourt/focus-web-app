/**
 * MergeDuplicatesFocusPage - Wrapper for MergeDuplicatesPage in Focus module
 * 
 * Integrates the merge duplicates functionality
 * into the Focus section with SectionLayout.
 */
import MergeDuplicatesPage from "../../pages/foundations/MergeDuplicatesPage";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import { GitMerge } from "lucide-react";

const SECTION = getSectionById("merge-duplicates");

export default function MergeDuplicatesFocusPage() {
  return (
    <SectionLayout
      title={SECTION.label}
          sectionId={SECTION.id}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus="gray"
      icon={GitMerge}
      inConstruction={true}
    >
      <MergeDuplicatesPage />
    </SectionLayout>
  );
}
