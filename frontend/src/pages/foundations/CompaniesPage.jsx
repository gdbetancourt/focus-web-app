import { useState, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Building2, Merge } from "lucide-react";

// Import existing components
import Companies from "../Companies";
import { AutoMergeDomainPanel } from "../../components/AutoMergeDomainPanel";

export default function CompaniesPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Determine initial tab from URL
  const getInitialTab = () => {
    // Legacy redirects
    if (location.pathname.includes("industries")) return "companies";
    const tabParam = searchParams.get("tab");
    if (tabParam === "industries" || tabParam === "active") return "companies";
    return tabParam || "companies";
  };
  
  const [activeTab, setActiveTab] = useState(() => getInitialTab());

  // Sync tab with URL changes
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== activeTab) {
      const timeoutId = setTimeout(() => setActiveTab(newTab), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (value) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6" data-testid="companies-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-black text-white tracking-tight">Companies</h1>
        <p className="text-slate-500 mt-1">
          Gestionar empresas e industrias
        </p>
      </div>

      {/* Tabs Navigation - Only All Companies and Auto-Merge */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#111111] p-1">
          <TabsTrigger 
            value="companies" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-companies"
          >
            <Building2 className="w-4 h-4" />
            All Companies
          </TabsTrigger>
          <TabsTrigger 
            value="auto-merge" 
            className="flex items-center gap-2 data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400"
            data-testid="tab-auto-merge"
          >
            <Merge className="w-4 h-4" />
            Auto-Merge
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="companies" className="mt-6">
          <Companies />
        </TabsContent>

        <TabsContent value="auto-merge" className="mt-6">
          <AutoMergeDomainPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
