/**
 * PharmaPipelinesAssetPage - Wrapper for PharmaPipelines in Assets
 */
import PharmaPipelines from "../../../pages/scrappers/PharmaPipelines";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { Pill } from "lucide-react";

const SECTION = getAssetSectionById("pharma-pipelines");

export default function PharmaPipelinesAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={Pill}
      inConstruction={SECTION.inConstruction}
    >
      <PharmaPipelines />
    </AssetLayout>
  );
}
