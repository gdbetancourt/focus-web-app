/**
 * TimeTrackerAssetPage - Wrapper for TimeTracker in Assets
 */
import TimeTracker from "../../../pages/TimeTracker";
import AssetLayout from "../AssetLayout";
import { getAssetSectionById } from "../assetsSections";
import { Clock } from "lucide-react";

const SECTION = getAssetSectionById("time-tracker");

export default function TimeTrackerAssetPage() {
  return (
    <AssetLayout
      title={SECTION.label}
      icon={Clock}
      inConstruction={SECTION.inConstruction}
    >
      <TimeTracker />
    </AssetLayout>
  );
}
