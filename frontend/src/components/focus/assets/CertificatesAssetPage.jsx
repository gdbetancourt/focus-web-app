/**
 * CertificatesAssetPage - Wrapper for Certificados in Assets
 */
import Certificados from "../../../pages/Certificados";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { Award } from "lucide-react";

const SECTION = getAssetSectionById("certificates");

export default function CertificatesAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={Award}
      inConstruction={SECTION.inConstruction}
    >
      <Certificados />
    </AssetLayout>
  );
}
