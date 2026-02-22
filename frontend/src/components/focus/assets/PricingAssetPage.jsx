/**
 * PricingAssetPage - Wrapper for Cotizador in Assets
 */
import Cotizador from "../../../pages/Cotizador";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { DollarSign } from "lucide-react";

const SECTION = getAssetSectionById("pricing");

export default function PricingAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={DollarSign}
      inConstruction={SECTION.inConstruction}
    >
      <Cotizador />
    </AssetLayout>
  );
}
