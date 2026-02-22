/**
 * TestimonialsAssetPage - Wrapper for TestimonialsPage in Assets
 */
import TestimonialsPage from "../../../pages/TestimonialsPage";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { MessageSquareQuote } from "lucide-react";

const SECTION = getAssetSectionById("testimonials");

export default function TestimonialsAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={MessageSquareQuote}
      inConstruction={SECTION.inConstruction}
    >
      <TestimonialsPage />
    </AssetLayout>
  );
}
