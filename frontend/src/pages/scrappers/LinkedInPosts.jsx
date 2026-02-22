import ScrapperPage from "../../components/ScrapperPage";
import { FileText } from "lucide-react";

export default function LinkedInPosts() {
  return (
    <ScrapperPage
      scrapperId="linkedin_posts_profile"
      name="1.4 LinkedIn Posts"
      description="Extract posts from specific LinkedIn profiles"
      icon={FileText}
      color="#ffcc00"
    />
  );
}
