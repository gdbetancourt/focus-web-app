import React, { useState, useEffect } from 'react';
import { GitMerge, Search, Users, Check, AlertTriangle, ArrowRight, RefreshCw, Building2, Mail, Phone, Linkedin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import api from '../lib/api';

const MATCH_METHODS = [
  { value: 'name_company', label: 'Name + Company', description: 'Find contacts with similar names in the same company' },
  { value: 'email', label: 'Email', description: 'Find contacts sharing the same email address' },
  { value: 'phone', label: 'Phone', description: 'Find contacts sharing the same phone number' }
];

export default function MergeDuplicates() {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('name_company');
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalDuplicates, setTotalDuplicates] = useState(0);
  
  // Merge dialog state
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [primaryContactId, setPrimaryContactId] = useState(null);
  const [merging, setMerging] = useState(false);
  
  // Stats
  const [mergedCount, setMergedCount] = useState(0);

  const findDuplicates = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/contacts/admin/find-duplicates?method=${method}`);
      setDuplicateGroups(res.data.groups || []);
      setTotalGroups(res.data.total_groups || 0);
      setTotalDuplicates(res.data.total_duplicates || 0);
    } catch (error) {
      toast.error('Error finding duplicates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    findDuplicates();
  }, [method]);

  const openMergeDialog = (group) => {
    setSelectedGroup(group);
    setPrimaryContactId(group.contacts[0]?.id || null);
    setMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!primaryContactId || !selectedGroup) return;
    
    const contactsToMerge = selectedGroup.contacts
      .filter(c => c.id !== primaryContactId)
      .map(c => c.id);
    
    if (contactsToMerge.length === 0) {
      toast.error('Select at least one contact to merge');
      return;
    }

    setMerging(true);
    try {
      const res = await api.post('/contacts/admin/merge', {
        primary_contact_id: primaryContactId,
        contacts_to_merge: contactsToMerge
      });
      
      toast.success(res.data.message);
      setMergedCount(prev => prev + contactsToMerge.length);
      setMergeDialogOpen(false);
      
      // Remove merged group from list
      setDuplicateGroups(prev => prev.filter(g => g !== selectedGroup));
      setTotalGroups(prev => prev - 1);
      setTotalDuplicates(prev => prev - selectedGroup.contacts.length);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error merging contacts');
    } finally {
      setMerging(false);
    }
  };

  const getContactDisplayInfo = (contact) => {
    const email = contact.email || contact.emails?.[0]?.email || '';
    const phone = contact.phone || contact.phones?.[0]?.raw_input || '';
    return { email, phone };
  };

  return (
    <div className="space-y-6" data-testid="merge-duplicates-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <GitMerge className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Merge Duplicates</h1>
            <p className="text-slate-500">Find and consolidate duplicate contacts</p>
          </div>
        </div>
        <Button onClick={findDuplicates} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{totalGroups}</div>
            <div className="text-sm text-slate-400">Duplicate Groups</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-400">{totalDuplicates}</div>
            <div className="text-sm text-slate-400">Total Duplicates</div>
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
              {totalDuplicates > 0 ? Math.round((totalDuplicates - totalGroups) / totalDuplicates * 100) : 0}%
            </div>
            <div className="text-sm text-slate-400">Potential Reduction</div>
          </CardContent>
        </Card>
      </div>

      {/* Method Selector */}
      <Card className="stat-card">
        <CardContent className="p-4">
          <Label className="text-slate-400 mb-2 block">Detection Method</Label>
          <div className="flex gap-4">
            {MATCH_METHODS.map(m => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={`flex-1 p-4 rounded-lg border transition-all ${
                  method === m.value 
                    ? 'border-purple-500 bg-purple-500/10' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-white">{m.label}</div>
                <div className="text-xs text-slate-400 mt-1">{m.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Groups */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          Scanning for duplicates...
        </div>
      ) : duplicateGroups.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium text-white mb-2">No Duplicates Found</h3>
            <p className="text-slate-400">Your contact database looks clean!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((group, idx) => (
            <Card key={idx} className="stat-card hover:border-purple-500/30 transition-colors">
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
                      {group.match_type === 'name_company' && <Building2 className="w-4 h-4 inline mr-1" />}
                      {group.match_type === 'email' && <Mail className="w-4 h-4 inline mr-1" />}
                      {group.match_type === 'phone' && <Phone className="w-4 h-4 inline mr-1" />}
                      {group.match_key}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => openMergeDialog(group)}>
                    <GitMerge className="w-4 h-4 mr-2" />
                    Merge ({group.contacts.length})
                  </Button>
                </div>
                
                <div className="grid gap-2">
                  {group.contacts.map((contact, cidx) => {
                    const { email, phone } = getContactDisplayInfo(contact);
                    return (
                      <div 
                        key={contact.id} 
                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm text-white">
                            {cidx + 1}
                          </div>
                          <div>
                            <div className="text-white font-medium">{contact.name}</div>
                            <div className="text-sm text-slate-400">
                              {contact.job_title && <span>{contact.job_title.slice(0, 50)}{contact.job_title.length > 50 ? '...' : ''}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          {email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {email}</span>}
                          {contact.linkedin_url && (
                            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
                              <Linkedin className="w-4 h-4 hover:text-blue-400" />
                            </a>
                          )}
                          <Badge className="bg-slate-700">Stage {contact.stage || 1}</Badge>
                        </div>
                      </div>
                    );
                  })}
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
              <GitMerge className="w-5 h-5 text-purple-400" />
              Merge Contacts
            </DialogTitle>
            <DialogDescription>
              Select the primary contact to keep. Other contacts will be merged into it.
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="py-4">
              <Label className="text-slate-400 mb-3 block">Select Primary Contact (to keep):</Label>
              <RadioGroup value={primaryContactId} onValueChange={setPrimaryContactId}>
                <div className="space-y-3">
                  {selectedGroup.contacts.map((contact) => {
                    const { email, phone } = getContactDisplayInfo(contact);
                    const isSelected = primaryContactId === contact.id;
                    
                    return (
                      <div 
                        key={contact.id}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                        onClick={() => setPrimaryContactId(contact.id)}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={contact.id} id={contact.id} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{contact.name}</span>
                              {isSelected && (
                                <Badge className="bg-purple-500/20 text-purple-400">Primary</Badge>
                              )}
                            </div>
                            <div className="text-sm text-slate-400 mt-1">
                              {contact.job_title && <div>{contact.job_title.slice(0, 80)}</div>}
                              <div className="flex gap-4 mt-1">
                                {email && <span><Mail className="w-3 h-3 inline mr-1" />{email}</span>}
                                {phone && <span><Phone className="w-3 h-3 inline mr-1" />{phone}</span>}
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-slate-700">Stage {contact.stage || 1}</Badge>
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
                      <li>• The primary contact keeps its ID</li>
                      <li>• All emails and phones are combined (deduplicated)</li>
                      <li>• Notes are appended together</li>
                      <li>• Other contacts are hidden but not deleted</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMerge} disabled={merging || !primaryContactId}>
              {merging ? 'Merging...' : (
                <>
                  <GitMerge className="w-4 h-4 mr-2" />
                  Merge {selectedGroup?.contacts.length - 1} into Primary
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
