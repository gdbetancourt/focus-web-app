/**
 * ContactsAssetPage - Wrapper for AllContacts in Assets
 */
import AllContacts from "../../../pages/foundations/AllContacts";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { Users } from "lucide-react";

const SECTION = getAssetSectionById("contacts");

export default function ContactsAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={Users}
      inConstruction={SECTION.inConstruction}
    >
      <AllContacts />
    </AssetLayout>
  );
}
