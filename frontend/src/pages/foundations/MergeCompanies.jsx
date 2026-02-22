import React, { useState, useEffect } from 'react';
import { GitMerge, Search, Building2, Check, AlertTriangle, RefreshCw, Globe, Factory } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import api from '../../lib/api';

export default function MergeCompanies() {
  const [loading, setLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [totalGroups, setTotalGroups] = useState(0);
  
  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [primaryCompanyId, setPrimaryCompanyId] = useState(null);
  const [merging, setMerging] = useState(false);
  
  // Stats
  const [mergedCount, setMergedCount] = useState(0);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/companies/admin/find-duplicates');
      setDuplicateGroups(res.data.groups || []);
      setTotalGroups(res.data.total_groups || 0);
    } catch (error) {
      console.error('Error finding duplicates:', error);
      toast.error('Error finding duplicate companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    findDuplicates();
  }, []);

  const openMergeDialog = (group) => {
    setSelectedGroup(group);
    setPrimaryCompanyId(group.companies[0]?.id || null);
    setMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!primaryCompanyId || !selectedGroup) return;
    
    const companiesToMerge = selectedGroup.companies
      .filter(c => c.id !== primaryCompanyId)
      .map(c => c.id);
    
    if (companiesToMerge.length === 0) {
      toast.error('Select at least one company to merge');
      return;
    }

    setMerging(true);
    try {
      const res = await api.post('/companies/admin/merge', {
        primary_company_id: primaryCompanyId,
        companies_to_merge: companiesToMerge
      });
      
      toast.success(res.data.message);
      setMergedCount(prev => prev + companiesToMerge.length);
      setMergeDialogOpen(false);
      
      // Remove merged group from list
      setDuplicateGroups(prev => prev.filter(g => g !== selectedGroup));
      setTotalGroups(prev => prev - 1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error merging companies');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="merge-companies-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <GitMerge className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Merge Duplicate Companies</h2>
            <p className="text-slate-500">Find and consolidate duplicate company records</p>
          </div>
        </div>
        <Button onClick={findDuplicates} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{totalGroups}</div>
            <div className="text-sm text-slate-400">Duplicate Groups</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{mergedCount}</div>
            <div className="text-sm text-slate-400">Merged This Session</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">
              {duplicateGroups.reduce((sum, g) => sum + g.companies.length, 0)}
            </div>
            <div className="text-sm text-slate-400">Total Duplicates</div>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Groups */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          Scanning for duplicate companies...
        </div>
      ) : duplicateGroups.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium text-white mb-2">No Duplicate Companies Found</h3>
            <p className="text-slate-400">Your company database looks clean!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((group, idx) => (
            <Card key={idx} className="stat-card hover:border-blue-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge className={`${
                      group.confidence >= 95 ? 'bg-red-500/20 text-red-400' :
                      group.confidence >= 80 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {group.confidence}% match
                    </Badge>
                    <span className="text-slate-400 text-sm">
                      Matching: {group.match_key}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => openMergeDialog(group)}>
                    <GitMerge className="w-4 h-4 mr-2" />
                    Merge ({group.companies.length})
                  </Button>
                </div>
                
                <div className="grid gap-2">
                  {group.companies.map((company, cidx) => (
                    <div 
                      key={company.id} 
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white">
                          {cidx + 1}
                        </div>
                        <div>
                          <div className="text-white font-medium">{company.name}</div>
                          <div className="text-sm text-slate-400">
                            {company.industry && <span className="mr-3"><Factory className="w-3 h-3 inline mr-1" />{company.industry}</span>}
                            {company.domain && <span><Globe className="w-3 h-3 inline mr-1" />{company.domain}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-400">
                        {company.contact_count || 0} contacts
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-blue-400" />
              Merge Companies
            </DialogTitle>
            <DialogDescription>
              Select the primary company to keep. Other companies will be merged into it.
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="py-4">
              <Label className="text-slate-400 mb-3 block">Select Primary Company (to keep):</Label>
              <RadioGroup value={primaryCompanyId} onValueChange={setPrimaryCompanyId}>
                <div className="space-y-3">
                  {selectedGroup.companies.map((company) => {
                    const isSelected = primaryCompanyId === company.id;
                    
                    return (
                      <div 
                        key={company.id}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                        onClick={() => setPrimaryCompanyId(company.id)}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={company.id} id={company.id} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{company.name}</span>
                              {isSelected && (
                                <Badge className="bg-blue-500/20 text-blue-400">Primary</Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                              {company.industry && <div><Factory className="w-3 h-3 inline mr-1" />{company.industry}</div>}
                              {company.domain && <div><Globe className="w-3 h-3 inline mr-1" />{company.domain}</div>}
                              <div>{company.contact_count || 0} contacts</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
              
              <div className="mt-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium">What happens when you merge:</p>
                    <ul className="text-sm text-yellow-300/80 mt-2 space-y-1">
                      <li>• The primary company keeps its ID and data</li>
                      <li>• Contacts from other companies are reassigned</li>
                      <li>• Other companies are hidden but not deleted</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMerge} disabled={merging || !primaryCompanyId}>
              {merging ? 'Merging...' : (
                <>
                  <GitMerge className="w-4 h-4 mr-2" />
                  Merge {selectedGroup?.companies.length - 1} into Primary
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
