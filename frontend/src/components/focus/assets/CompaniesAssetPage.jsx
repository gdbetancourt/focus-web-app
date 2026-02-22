/**
 * CompaniesAssetPage - Wrapper for CompaniesPage in Assets
 * 
 * CompaniesPage has its own internal tabs for:
 * - Active Companies
 * - All Companies  
 * - Industries
 */
import CompaniesPage from "../../../pages/foundations/CompaniesPage";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { Building2 } from "lucide-react";

const SECTION = getAssetSectionById("companies");

export default function CompaniesAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={Building2}
      inConstruction={SECTION.inConstruction}
    >
      <CompaniesPage />
    </AssetLayout>
  );
}
