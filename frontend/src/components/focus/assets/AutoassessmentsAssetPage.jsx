/**
 * AutoassessmentsAssetPage - Wrapper for QuizPage in Assets
 */
import QuizPage from "../../../pages/QuizPage";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { ClipboardCheck } from "lucide-react";

const SECTION = getAssetSectionById("autoassessments");

export default function AutoassessmentsAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={ClipboardCheck}
      inConstruction={SECTION.inConstruction}
    >
      <QuizPage />
    </AssetLayout>
  );
}
