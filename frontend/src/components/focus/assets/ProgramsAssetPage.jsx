/**
 * ProgramsAssetPage - LMS Courses Management
 */
import LMSPage from "../../../pages/LMSPage";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { GraduationCap } from "lucide-react";

const SECTION = getAssetSectionById("programs");

export default function ProgramsAssetPage() {
  return (
    <AssetLayout
      title="Programas LMS"
      icon={GraduationCap}
      inConstruction={false}
    >
      <LMSPage />
    </AssetLayout>
  );
}
