import React, { useState, useEffect } from "react";
import { Building2, Users, GitBranch, Network, Plus, Search, ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { toast } from "sonner";
import api from "../../lib/api";
import OrgChart from "../../components/OrgChart";
import ContactSheet from "../../components/ContactSheet";

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  
  // Selected company for org chart
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [orgChartData, setOrgChartData] = useState(null);
  const [loadingOrgChart, setLoadingOrgChart] = useState(false);
  
  // Contact sheet
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [loadingContact, setLoadingContact] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const res = await api.get("/contacts?limit=5000");
      const contacts = res.data.contacts || [];
      
      // Group by company
      const companyMap = {};
      contacts.forEach(contact => {
        const company = contact.company || "Unknown";
        if (!companyMap[company]) {
          companyMap[company] = {
            name: company,
            contacts: [],
            count: 0
          };
        }
        companyMap[company].contacts.push(contact);
        companyMap[company].count++;
      });
      
      // Convert to array and sort by contact count
      const companyList = Object.values(companyMap)
        .filter(c => c.name !== "Unknown" && c.name.trim() !== "")
        .sort((a, b) => b.count - a.count);
      
      setCompanies(companyList);
    } catch (error) {
      console.error("Error loading companies:", error);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const loadOrgChart = async (companyName) => {
    setLoadingOrgChart(true);
    try {
      const res = await api.get(`/contacts/company/${encodeURIComponent(companyName)}/orgchart`);
      setOrgChartData(res.data);
      setSelectedCompany(companyName);
    } catch (error) {
      console.error("Error loading org chart:", error);
      toast.error("Failed to load organization chart");
    } finally {
      setLoadingOrgChart(false);
    }
  };

  const handleAddRelationship = async (sourceId, targetId, relationshipType) => {
    try {
      await api.post(`/contacts/${sourceId}/relationships`, {
        target_contact_id: targetId,
        relationship_type: relationshipType
      });
      toast.success("Relationship created");
      // Reload org chart
      if (selectedCompany) {
        loadOrgChart(selectedCompany);
      }
    } catch (error) {
      console.error("Error adding relationship:", error);
      toast.error("Failed to create relationship");
    }
  };

  const handleRemoveRelationship = async (sourceId, targetId) => {
    try {
      await api.delete(`/contacts/${sourceId}/relationships/${targetId}`);
      toast.success("Relationship removed");
      // Reload org chart
      if (selectedCompany) {
        loadOrgChart(selectedCompany);
      }
    } catch (error) {
      console.error("Error removing relationship:", error);
      toast.error("Failed to remove relationship");
    }
  };

  const handleOpenContact = async (contactId) => {
    setLoadingContact(true);
    try {
      const res = await api.get(`/contacts/${contactId}`);
      setSelectedContact(res.data);
      setContactSheetOpen(true);
    } catch (error) {
      console.error("Error loading contact:", error);
      toast.error("Failed to load contact");
    } finally {
      setLoadingContact(false);
    }
  };

  const handleSelectCompanyForOrgChart = (company) => {
    loadOrgChart(company.name);
    setActiveTab("orgchart");
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8" data-testid="companies-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-[#ff3300]" />
            Companies
          </h1>
          <p className="text-slate-400 mt-1">
            Manage companies and their organizational structure
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-900/50 border-slate-800"
          data-testid="company-search-input"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="list" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
            <Building2 className="w-4 h-4 mr-2" />
            List View
          </TabsTrigger>
          <TabsTrigger value="orgchart" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
            <GitBranch className="w-4 h-4 mr-2" />
            Org Chart
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading companies...
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCompanies.slice(0, 50).map((company, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors cursor-pointer group"
                  onClick={() => handleSelectCompanyForOrgChart(company)}
                  data-testid={`company-row-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#ff3300]/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-[#ff3300]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{company.name}</h3>
                        <p className="text-sm text-slate-400">{company.count} contacts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="border-slate-700 text-slate-400">
                        <Users className="w-3 h-3 mr-1" />
                        {company.count}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                      >
                        <GitBranch className="w-4 h-4 mr-1" />
                        View Org Chart
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredCompanies.length > 50 && (
                <p className="text-center text-slate-500 text-sm">
                  Showing 50 of {filteredCompanies.length} companies
                </p>
              )}
              {filteredCompanies.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500">
                  No companies found matching your search
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orgchart" className="mt-6">
          {!selectedCompany ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 rounded-full bg-[#ff3300]/10 flex items-center justify-center mx-auto">
                  <Network className="w-10 h-10 text-[#ff3300]" />
                </div>
                <h2 className="text-xl font-bold text-white">
                  Select a Company
                </h2>
                <p className="text-slate-400">
                  Choose a company from the list to view its organizational chart.
                  Click on any company row or use the "View Org Chart" button.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("list")}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go to List View
                </Button>
              </div>
            </div>
          ) : loadingOrgChart ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#ff3300]" />
              <p className="text-slate-400">Loading organization chart...</p>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCompany(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <span className="text-slate-600">|</span>
                  <h2 className="text-lg font-semibold text-white">{selectedCompany}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-700/50 text-slate-300">
                    {orgChartData?.contacts?.length || 0} contacts
                  </Badge>
                </div>
              </div>
              
              {/* Org Chart */}
              {orgChartData && (
                <OrgChart
                  contacts={orgChartData.contacts}
                  relationships={orgChartData.relationships}
                  rootContacts={orgChartData.root_contacts}
                  onAddRelationship={handleAddRelationship}
                  onRemoveRelationship={handleRemoveRelationship}
                  onOpenContact={handleOpenContact}
                  companyName={selectedCompany}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Contact Sheet */}
      {contactSheetOpen && selectedContact && (
        <ContactSheet
          contact={selectedContact}
          open={contactSheetOpen}
          onOpenChange={(open) => {
            setContactSheetOpen(open);
            if (!open) setSelectedContact(null);
          }}
          onUpdate={() => {
            // Reload org chart after contact update
            if (selectedCompany) {
              loadOrgChart(selectedCompany);
            }
          }}
        />
      )}
    </div>
  );
}
