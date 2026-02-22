import React, { useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { GitMerge, Users, Building2 } from "lucide-react";

// Import merge components
import MergeDuplicatesContacts from "../MergeDuplicates";
import MergeCompanies from "./MergeCompanies";

export default function MergeDuplicatesPage() {
  const [activeTab, setActiveTab] = useState("contacts");

  return (
    <div className="space-y-6" data-testid="merge-duplicates-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <GitMerge className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Merge Duplicates</h1>
            <p className="text-slate-500 mt-1">
              Find and consolidate duplicate contacts and companies
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#111111] p-1">
          <TabsTrigger 
            value="contacts" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-merge-contacts"
          >
            <Users className="w-4 h-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger 
            value="companies" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-merge-companies"
          >
            <Building2 className="w-4 h-4" />
            Companies
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="contacts" className="mt-6">
          <MergeDuplicatesContacts />
        </TabsContent>

        <TabsContent value="companies" className="mt-6">
          <MergeCompanies />
        </TabsContent>
      </Tabs>
    </div>
  );
}
