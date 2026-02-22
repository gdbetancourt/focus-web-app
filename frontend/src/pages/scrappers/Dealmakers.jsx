import ScrapperPage from "../../components/ScrapperPage";
import { UserPlus } from "lucide-react";

export default function Dealmakers() {
  return (
    <ScrapperPage
      scrapperId="dealmakers"
      name="1.3 Dealmakers"
      description="Extract LinkedIn profiles from existing opportunities"
      icon={UserPlus}
      color="#aa00ff"
    />
  );
}
