import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Users, Tag } from "lucide-react";

// Import existing components
import BuyerPersonasDB from "../BuyerPersonasDB";
import JobKeywords from "../JobKeywords";

export default function Who() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "personas";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (value) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6" data-testid="who-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-black text-white tracking-tight">Who</h1>
        <p className="text-slate-500 mt-1">
          Buyer personas and job classification keywords
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#111111] p-1">
          <TabsTrigger 
            value="personas" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-personas"
          >
            <Users className="w-4 h-4" />
            Buyer Personas
          </TabsTrigger>
          <TabsTrigger 
            value="keywords" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-keywords"
          >
            <Tag className="w-4 h-4" />
            Keywords
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="personas" className="mt-6">
          <BuyerPersonasDB />
        </TabsContent>

        <TabsContent value="keywords" className="mt-6">
          <JobKeywords />
        </TabsContent>
      </Tabs>
    </div>
  );
}
