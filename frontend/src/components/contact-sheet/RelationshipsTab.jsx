/**
 * RelationshipsTab - Contact relationships management tab for ContactSheet
 * Extracted from ContactSheet.jsx for maintainability
 * 
 * Features:
 * - Search and add related contacts
 * - View existing relationships (reports_to, manages, works_with)
 * - Remove relationships
 */
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Plus, X, Loader2, Users, ArrowUp, ArrowDown, Link2, Trash2
} from "lucide-react";

export function RelationshipsTab({
  // Add relationship state
  addingRelationship,
  setAddingRelationship,
  
  // Search state
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  searching,
  searchContacts,
  
  // Relationships data
  relationships,
  loadingRelationships,
  
  // Actions
  addRelationship,
  removeRelationship
}) {
  return (
    <>
      {!addingRelationship ? (
        <Button 
          variant="outline" 
          onClick={() => setAddingRelationship(true)} 
          className="w-full border-dashed border-[#333]"
          data-testid="add-relationship-btn"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Related Contact
        </Button>
      ) : (
        <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#333] space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-slate-400">Search Contacts</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { 
                setAddingRelationship(false); 
                setSearchQuery(""); 
                setSearchResults([]); 
              }} 
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => { 
              setSearchQuery(e.target.value); 
              searchContacts(e.target.value); 
            }}
            placeholder="Type name..."
            className="bg-[#0f0f0f] border-[#333]"
            data-testid="relationship-search-input"
          />
          {searching && (
            <div className="text-center py-2">
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {searchResults.map(result => (
                <div 
                  key={result.id} 
                  className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded border border-[#222]"
                  data-testid={`search-result-${result.id}`}
                >
                  <div>
                    <p className="text-white text-sm font-medium">{result.name}</p>
                    <p className="text-slate-400 text-xs">{result.job_title || result.company || ""}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => addRelationship(result.id, "reports_to")} 
                      className="text-xs h-7 px-2"
                    >
                      <ArrowUp className="w-3 h-3 mr-1" /> Reports To
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => addRelationship(result.id, "manages")} 
                      className="text-xs h-7 px-2"
                    >
                      <ArrowDown className="w-3 h-3 mr-1" /> Manages
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => addRelationship(result.id, "works_with")} 
                      className="text-xs h-7 px-2"
                    >
                      <Link2 className="w-3 h-3 mr-1" /> Peer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loadingRelationships ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
      ) : relationships.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No related contacts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel, idx) => (
            <div 
              key={idx} 
              className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#222]"
              data-testid={`relationship-item-${idx}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {rel.contact?.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{rel.contact?.name || "Unknown"}</p>
                  <p className="text-slate-400 text-sm">{rel.contact?.job_title || ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${
                  rel.relationship_type === "reports_to" 
                    ? "bg-green-500/20 text-green-400" 
                    : rel.relationship_type === "manages" 
                      ? "bg-blue-500/20 text-blue-400" 
                      : "bg-purple-500/20 text-purple-400"
                }`}>
                  {rel.relationship_type === "reports_to" 
                    ? "Reports To" 
                    : rel.relationship_type === "manages" 
                      ? "Manages" 
                      : "Works With"}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => removeRelationship(rel.contact?.id)} 
                  className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                  data-testid={`remove-relationship-${idx}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
