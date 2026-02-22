/**
 * SEOAssetPage - Wrapper for Blog/SEO page in Assets
 */
import BlogPage from "../../../pages/BlogPage";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { Search } from "lucide-react";

const SECTION = getAssetSectionById("seo");

export default function SEOAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={Search}
      inConstruction={SECTION.inConstruction}
    >
      <BlogPage />
    </AssetLayout>
  );
}
