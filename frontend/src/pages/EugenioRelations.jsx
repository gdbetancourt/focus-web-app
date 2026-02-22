import React, { useState, useEffect, useCallback } from 'react';
import { 
  Newspaper, Search, Plus, Mail, Phone, Linkedin, Globe, Trash2, Edit2, 
  Users, Loader2, ArrowRight, CheckCircle2, Clock, Handshake, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../lib/api';

// Buyer Persona ID for Eugenio (editorial contacts)
const EUGENIO_PERSONA_NAME = "Eugenio";

// Opportunity states
const OPPORTUNITY_STATES = [
  { value: 'open', label: 'Oportunidad Abierta', color: 'bg-purple-500/20 text-purple-400', icon: Clock },
  { value: 'interested', label: 'Interés en Colaboración', color: 'bg-yellow-500/20 text-yellow-400', icon: Handshake },
  { value: 'closed', label: 'Colaboración Concretada', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 }
];

export default function EugenioRelations() {
  const [activeTab, setActiveTab] = useState('contacts');
  
  // Contacts state
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [searchContacts, setSearchContacts] = useState('');
  
  // Opportunities state
  const [opportunities, setOpportunities] = useState([]);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [oppStats, setOppStats] = useState({ total: 0, open: 0, interested: 0, closed: 0 });
  
  // Create opportunity dialog
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [newOppTitle, setNewOppTitle] = useState('');
  const [newOppNotes, setNewOppNotes] = useState('');
  const [creatingOpp, setCreatingOpp] = useState(false);

  // Load contacts with Eugenio persona
  const loadEugenioContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
      // Get all contacts and filter by buyer persona Eugenio
      const res = await api.get('/contacts', {
        params: { buyer_persona: EUGENIO_PERSONA_NAME, limit: 500 }
      });
      setContacts(res.data.contacts || []);
    } catch (error) {
      console.error('Error loading contactos Eugenio:', error);
      // Fallback: try to get from all contacts with filter
      try {
        const res = await api.get('/contacts?limit=1000');
        const allContacts = res.data.contacts || [];
        const mediaContacts = allContacts.filter(c => 
          c.buyer_persona === EUGENIO_PERSONA_NAME || 
          c.buyer_persona?.toLowerCase() === 'eugenio'
        );
        setContacts(mediaContacts);
      } catch (err) {
        toast.error('Error loading contactos Eugenio');
      }
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // Load opportunities
  const loadOpportunities = useCallback(async () => {
    try {
      setLoadingOpps(true);
      const res = await api.get('/media-opportunities');
      setOpportunities(res.data.opportunities || []);
      setOppStats(res.data.stats || { total: 0, open: 0, interested: 0, closed: 0 });
    } catch (error) {
      console.error('Error loading opportunities:', error);
      toast.error('Error loading opportunities');
    } finally {
      setLoadingOpps(false);
    }
  }, []);

  useEffect(() => {
    loadEugenioContacts();
    loadOpportunities();
  }, [loadEugenioContacts, loadOpportunities]);

  // Filter contacts by search
  const filteredContacts = contacts.filter(c => {
    if (!searchContacts) return true;
    const search = searchContacts.toLowerCase();
    return c.name?.toLowerCase().includes(search) ||
           c.email?.toLowerCase().includes(search) ||
           c.company?.toLowerCase().includes(search) ||
           c.position?.toLowerCase().includes(search);
  });

  // Open opportunity dialog for a contact
  const openNewOpportunityDialog = (contact) => {
    setSelectedContact(contact);
    setNewOppTitle('');
    setNewOppNotes('');
    setOppDialogOpen(true);
  };

  // Create new opportunity
  const handleCreateOpportunity = async () => {
    if (!selectedContact || !newOppTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setCreatingOpp(true);
    try {
      await api.post('/media-opportunities', {
        contact_id: selectedContact.id,
        contact_name: selectedContact.name,
        title: newOppTitle,
        notes: newOppNotes,
        state: 'open'
      });
      toast.success('Media opportunity created');
      setOppDialogOpen(false);
      setSelectedContact(null);
      loadOpportunities();
      setActiveTab('opportunities'); // Switch to opportunities tab
    } catch (error) {
      toast.error('Error creating opportunity');
    } finally {
      setCreatingOpp(false);
    }
  };

  // Update opportunity state
  const handleUpdateOppState = async (oppId, newState) => {
    try {
      await api.put(`/media-opportunities/${oppId}`, { state: newState });
      toast.success('State updated');
      loadOpportunities();
    } catch (error) {
      toast.error('Error updating state');
    }
  };

  // Delete opportunity
  const handleDeleteOpp = async (oppId) => {
    if (!confirm('Delete this opportunity?')) return;
    try {
      await api.delete(`/media-opportunities/${oppId}`);
      toast.success('Opportunity deleted');
      loadOpportunities();
    } catch (error) {
      toast.error('Error deleting opportunity');
    }
  };

  // Get state badge
  const getStateBadge = (state) => {
    const stateConfig = OPPORTUNITY_STATES.find(s => s.value === state) || OPPORTUNITY_STATES[0];
    const Icon = stateConfig.icon;
    return (
      <Badge className={`${stateConfig.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {stateConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="media-relations-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
          <Newspaper className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">2.2.8 Relaciones Eugenio</h1>
          <p className="text-slate-500">Editorial contacts (Buyer Persona: Eugenio) and collaboration opportunities</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#111111] p-1">
          <TabsTrigger 
            value="contacts" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-media-contacts"
          >
            <Users className="w-4 h-4" />
            Media Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger 
            value="opportunities" 
            className="flex items-center gap-2 data-[state=active]:bg-[#ff3300]/10 data-[state=active]:text-[#ff3300]"
            data-testid="tab-media-opportunities"
          >
            <Handshake className="w-4 h-4" />
            Media Opportunities ({oppStats.total})
          </TabsTrigger>
        </TabsList>

        {/* Media Contacts Tab */}
        <TabsContent value="contacts" className="mt-6">
          {/* Info Banner */}
          <Card className="stat-card border-purple-500/30 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-white text-sm">
                    These are contacts with Buyer Persona <strong className="text-purple-400">Eugenio</strong> (editorial professionals).
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    Add contacts via Prospecting (1.1.1.3) using Eugenio keywords, or manually assign the persona.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by name, email, company, or position..."
              value={searchContacts}
              onChange={(e) => setSearchContacts(e.target.value)}
              className="pl-10"
              data-testid="search-media-contacts"
            />
          </div>

          {/* Contacts List */}
          {loadingContacts ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-500 mt-2">Loading contactos Eugenio...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <Card className="stat-card">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-medium text-white mb-2">No Editorial Contacts Found</h3>
                <p className="text-slate-400 mb-4">
                  Add contacts with Buyer Persona "Eugenio" via Prospecting or manual assignment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredContacts.map(contact => (
                <Card key={contact.id} className="stat-card hover:border-purple-500/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{contact.name}</span>
                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                              {contact.buyer_persona || 'Eugenio'}
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-400">
                            {contact.position && <span>{contact.position}</span>}
                            {contact.position && contact.company && <span> at </span>}
                            {contact.company && <span className="text-slate-300">{contact.company}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="p-2 hover:bg-slate-800 rounded-lg" title={contact.email}>
                            <Mail className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                          </a>
                        )}
                        {contact.phones?.[0] && (
                          <a href={`tel:${contact.phones[0]}`} className="p-2 hover:bg-slate-800 rounded-lg" title={contact.phones[0]}>
                            <Phone className="w-4 h-4 text-slate-400 hover:text-green-400" />
                          </a>
                        )}
                        {contact.linkedin && (
                          <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-800 rounded-lg">
                            <Linkedin className="w-4 h-4 text-slate-400 hover:text-blue-500" />
                          </a>
                        )}
                        
                        {/* New Media Opportunity Button */}
                        <Button 
                          size="sm" 
                          onClick={() => openNewOpportunityDialog(contact)}
                          className="bg-blue-500 hover:bg-blue-600 ml-2"
                          data-testid={`new-opp-btn-${contact.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          New Media Opportunity
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Media Opportunities Tab */}
        <TabsContent value="opportunities" className="mt-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="stat-card">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-white">{oppStats.total}</div>
                <div className="text-sm text-slate-400">Total</div>
              </CardContent>
            </Card>
            <Card className="stat-card border-blue-500/30">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-400">{oppStats.open}</div>
                <div className="text-sm text-slate-400">Open</div>
              </CardContent>
            </Card>
            <Card className="stat-card border-yellow-500/30">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-400">{oppStats.interested}</div>
                <div className="text-sm text-slate-400">Interested</div>
              </CardContent>
            </Card>
            <Card className="stat-card border-green-500/30">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-400">{oppStats.closed}</div>
                <div className="text-sm text-slate-400">Closed</div>
              </CardContent>
            </Card>
          </div>

          {/* Opportunities List */}
          {loadingOpps ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-500 mt-2">Loading opportunities...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <Card className="stat-card">
              <CardContent className="p-8 text-center">
                <Handshake className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-medium text-white mb-2">No Media Opportunities Yet</h3>
                <p className="text-slate-400">
                  Create opportunities from the Media Contacts tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {opportunities.map(opp => (
                <Card key={opp.id} className="stat-card hover:border-blue-500/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white font-medium">{opp.title}</span>
                          {getStateBadge(opp.state)}
                        </div>
                        <div className="text-sm text-slate-400">
                          Contact: <span className="text-slate-300">{opp.contact_name}</span>
                        </div>
                        {opp.notes && (
                          <p className="text-sm text-slate-500 mt-2">{opp.notes}</p>
                        )}
                        <div className="text-xs text-slate-600 mt-2">
                          Created: {new Date(opp.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* State selector */}
                        <Select 
                          value={opp.state} 
                          onValueChange={(v) => handleUpdateOppState(opp.id, v)}
                        >
                          <SelectTrigger className="w-48 bg-[#111] border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPPORTUNITY_STATES.map(s => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleDeleteOpp(opp.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Opportunity Dialog */}
      <Dialog open={oppDialogOpen} onOpenChange={setOppDialogOpen}>
        <DialogContent className="max-w-md bg-[#0f0f0f] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Handshake className="w-5 h-5 text-blue-400" />
              New Media Opportunity
            </DialogTitle>
          </DialogHeader>
          
          {selectedContact && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-[#111] rounded-lg border border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Contact</p>
                <p className="text-white font-medium">{selectedContact.name}</p>
                {selectedContact.company && (
                  <p className="text-sm text-slate-400">{selectedContact.position} at {selectedContact.company}</p>
                )}
              </div>
              
              <div>
                <Label className="text-slate-400">Opportunity Title *</Label>
                <Input
                  value={newOppTitle}
                  onChange={(e) => setNewOppTitle(e.target.value)}
                  placeholder="e.g., Interview for Forbes article"
                  className="mt-1 bg-[#111] border-slate-700"
                  data-testid="opp-title-input"
                />
              </div>
              
              <div>
                <Label className="text-slate-400">Notes (optional)</Label>
                <Textarea
                  value={newOppNotes}
                  onChange={(e) => setNewOppNotes(e.target.value)}
                  placeholder="Additional details about this opportunity..."
                  className="mt-1 bg-[#111] border-slate-700"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOppDialogOpen(false)}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateOpportunity}
              disabled={creatingOpp || !newOppTitle.trim()}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="create-opp-btn"
            >
              {creatingOpp && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
