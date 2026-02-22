/**
 * PersonaClassifierAssetPage - Wrapper for PersonaClassifier in Assets
 */
import PersonaClassifierPage from "../../../pages/PersonaClassifierPage";
import AssetLayout from "../AssetLayout";
import { Zap } from "lucide-react";

export default function PersonaClassifierAssetPage() {
  return (
    <AssetLayout
      title="Persona Classifier"
      icon={Zap}
      inConstruction={false}
    >
      <PersonaClassifierPage />
    </AssetLayout>
  );
}
