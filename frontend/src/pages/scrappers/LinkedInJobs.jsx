import ScrapperPage from "../../components/ScrapperPage";
import { Briefcase } from "lucide-react";

export default function LinkedInJobs() {
  return (
    <ScrapperPage
      scrapperId="linkedin_cargos"
      name="1.2 LinkedIn Jobs"
      description="Scrape job positions and career changes from LinkedIn"
      icon={Briefcase}
      color="#0099ff"
    />
  );
}
