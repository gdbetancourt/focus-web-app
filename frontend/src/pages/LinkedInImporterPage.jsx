/**
 * LinkedInImporterPage - Page wrapper for the Enhanced LinkedIn Contact Importer
 */
import EnhancedLinkedInContactImporter from "../components/EnhancedLinkedInContactImporter";

export default function LinkedInImporterPage() {
  return (
    <div className="p-6">
      <EnhancedLinkedInContactImporter 
        onImportComplete={() => {
          // Refresh or navigate after import complete
          console.log("Import completed!");
        }}
      />
    </div>
  );
}
