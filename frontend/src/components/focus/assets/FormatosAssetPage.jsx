/**
 * FormatosAssetPage - Wrapper for FormatosPage in Assets
 */
import FormatosPage from "../../../pages/FormatosPage";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { FileBox } from "lucide-react";

const SECTION = getAssetSectionById("formatos");

export default function FormatosAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={FileBox}
      inConstruction={SECTION.inConstruction}
    >
      <FormatosPage />
    </AssetLayout>
  );
}
