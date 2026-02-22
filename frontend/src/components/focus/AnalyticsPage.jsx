/**
 * AnalyticsPage - Combined view of Email Metrics and Analytics Dashboard
 * 
 * Shows email performance metrics and overall analytics.
 */
import { useState } from "react";
import EmailMetrics from "../../pages/EmailMetrics";
import AnalyticsDashboard from "../../pages/AnalyticsDashboard";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("email-metrics");

  return (
    <div className="space-y-6" data-testid="analytics-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-slate-800">
          <BarChart3 className="w-6 h-6 text-slate-300" />
        </div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800 border border-slate-700 mb-6">
          <TabsTrigger 
            value="email-metrics" 
            className="data-[state=active]:bg-[#ff3300] data-[state=active]:text-white"
          >
            Email Metrics
          </TabsTrigger>
          <TabsTrigger 
            value="dashboard" 
            className="data-[state=active]:bg-[#ff3300] data-[state=active]:text-white"
          >
            Dashboard
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="email-metrics" className="mt-0">
          <EmailMetrics />
        </TabsContent>
        
        <TabsContent value="dashboard" className="mt-0">
          <AnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
