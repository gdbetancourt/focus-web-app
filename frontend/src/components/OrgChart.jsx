import React, { useState, useMemo } from "react";
import { Linkedin, User, ChevronDown, ChevronRight, GripVertical, X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

// Simple contact card for org chart
const ContactCard = ({ 
  contact, 
  onOpenContact, 
  onDragStart,
  onDrop, 
  draggingId,
  hasChildren,
  isExpanded,
  onToggleExpand
}) => {
  const [isDropTarget, setIsDropTarget] = useState(false);
  
  return (
    <div 
      className={`relative bg-slate-900 border rounded-lg p-3 min-w-[200px] max-w-[250px] cursor-move transition-all ${
        isDropTarget 
          ? "border-[#ff3300] ring-2 ring-[#ff3300]/50" 
          : "border-slate-700 hover:border-slate-600"
      } ${draggingId === contact.id ? "opacity-50" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("contactId", contact.id);
        onDragStart(contact.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (draggingId && draggingId !== contact.id) {
          setIsDropTarget(true);
        }
      }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDropTarget(false);
        const sourceId = e.dataTransfer.getData("contactId");
        if (sourceId && sourceId !== contact.id) {
          onDrop(sourceId, contact.id);
        }
      }}
      data-testid={`org-node-${contact.id}`}
    >
      {/* Drag Handle */}
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 text-slate-600">
        <GripVertical className="w-4 h-4" />
      </div>
      
      {/* Content */}
      <div className="pl-3">
        <h4 className="font-semibold text-white text-sm truncate" title={contact.name}>
          {contact.name}
        </h4>
        <p className="text-xs text-slate-400 truncate" title={contact.job_title}>
          {contact.job_title || "No title"}
        </p>
        
        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          {contact.linkedin_url && (
            <a 
              href={contact.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
              title="Open LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenContact(contact.id);
            }}
            className="text-slate-400 hover:text-white"
            title="Open Contact Sheet"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
        
        {/* Classification badges */}
        {contact.contact_types && contact.contact_types.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {contact.contact_types.map(type => (
              <Badge 
                key={type} 
                className={`text-[9px] px-1.5 py-0 ${
                  type === "deal_maker" ? "bg-emerald-500/20 text-emerald-400" :
                  type === "influencer" ? "bg-purple-500/20 text-purple-400" :
                  type === "student" ? "bg-blue-500/20 text-blue-400" :
                  "bg-amber-500/20 text-amber-400"
                }`}
              >
                {type.replace("_", " ")}
              </Badge>
            ))}
          </div>
        )}
      </div>
      
      {/* Expand/Collapse button for nodes with children */}
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(contact.id);
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-slate-700 z-10"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-slate-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400" />
          )}
        </button>
      )}
    </div>
  );
};

// Main OrgChart Component - Flat rendering approach
export default function OrgChart({ 
  contacts = [], 
  relationships = [], 
  rootContacts = [],
  onAddRelationship,
  onRemoveRelationship,
  onOpenContact,
  companyName
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(rootContacts || []));
  const [showUnassigned, setShowUnassigned] = useState(true);
  
  // Build hierarchy data
  const { hierarchy, unassigned } = useMemo(() => {
    if (!contacts || contacts.length === 0) {
      return { hierarchy: [], unassigned: [] };
    }
    
    // Create maps
    const contactMap = new Map();
    const childrenMap = new Map(); // parentId -> [childIds]
    const hasParent = new Set();
    
    contacts.forEach(c => {
      contactMap.set(c.id, c);
      childrenMap.set(c.id, []);
    });
    
    // Build parent-child relationships
    relationships.forEach(rel => {
      if (rel.type === "reports_to" && contactMap.has(rel.source_id) && contactMap.has(rel.target_id)) {
        childrenMap.get(rel.target_id).push(rel.source_id);
        hasParent.add(rel.source_id);
      }
    });
    
    // Find roots (contacts without parents)
    const roots = contacts.filter(c => !hasParent.has(c.id));
    
    // Build flat hierarchy with levels
    const result = [];
    const visited = new Set();
    
    const addToHierarchy = (contactId, level) => {
      if (visited.has(contactId)) return;
      visited.add(contactId);
      
      const contact = contactMap.get(contactId);
      if (!contact) return;
      
      const children = childrenMap.get(contactId) || [];
      result.push({
        ...contact,
        level,
        childCount: children.length,
        childIds: children
      });
      
      // Add children recursively (limited depth)
      if (level < 5) {
        children.forEach(childId => addToHierarchy(childId, level + 1));
      }
    };
    
    roots.forEach(root => addToHierarchy(root.id, 0));
    
    // Unassigned = contacts not in hierarchy
    const unassignedContacts = contacts.filter(c => !visited.has(c.id));
    
    return { hierarchy: result, unassigned: unassignedContacts };
  }, [contacts, relationships]);
  
  const handleDragStart = (contactId) => {
    setDraggingId(contactId);
  };
  
  const handleDrop = (sourceId, targetId) => {
    setDraggingId(null);
    if (sourceId !== targetId && onAddRelationship) {
      onAddRelationship(sourceId, targetId, "reports_to");
    }
  };
  
  const toggleExpand = (contactId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };
  
  // Filter hierarchy based on expanded nodes
  const visibleHierarchy = useMemo(() => {
    const visible = [];
    const expandedSet = expandedNodes;
    
    for (const contact of hierarchy) {
      if (contact.level === 0) {
        visible.push(contact);
      } else {
        // Check if all ancestors are expanded
        // For simplicity, show level 1 if parent is expanded
        const isVisible = hierarchy.some(parent => 
          parent.childIds.includes(contact.id) && expandedSet.has(parent.id)
        );
        if (isVisible) {
          visible.push(contact);
        }
      }
    }
    return visible;
  }, [hierarchy, expandedNodes]);
  
  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        No contacts found for this company
      </div>
    );
  }
  
  return (
    <div 
      className="relative min-h-[400px] overflow-auto p-8"
      onDragEnd={() => setDraggingId(null)}
      data-testid="org-chart-container"
    >
      {/* Instructions */}
      <div className="absolute top-2 right-2 text-xs text-slate-500 bg-slate-900/80 px-3 py-2 rounded-lg z-10">
        <p><strong>Drag & Drop</strong> to connect contacts</p>
        <p>Drop onto another contact to set reporting</p>
      </div>
      
      {/* Main content */}
      <div className="flex flex-col items-center gap-8">
        {/* Company Header */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-white">{companyName}</h2>
          <p className="text-sm text-slate-400">{contacts.length} contacts</p>
        </div>
        
        {/* Hierarchy visualization */}
        <div className="space-y-6 w-full">
          {/* Level 0 (roots) */}
          <div className="flex flex-wrap gap-4 justify-center">
            {visibleHierarchy
              .filter(c => c.level === 0)
              .map(contact => (
                <div key={contact.id} className="flex flex-col items-center">
                  <ContactCard
                    contact={contact}
                    onOpenContact={onOpenContact}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    draggingId={draggingId}
                    hasChildren={contact.childCount > 0}
                    isExpanded={expandedNodes.has(contact.id)}
                    onToggleExpand={toggleExpand}
                  />
                  
                  {/* Children */}
                  {expandedNodes.has(contact.id) && contact.childCount > 0 && (
                    <>
                      <div className="w-px h-6 bg-slate-700" />
                      <div className="flex flex-wrap gap-4 justify-center pt-2">
                        {visibleHierarchy
                          .filter(c => contact.childIds.includes(c.id))
                          .map(child => (
                            <div key={child.id} className="flex flex-col items-center">
                              <div className="w-px h-4 bg-slate-700" />
                              <ContactCard
                                contact={child}
                                onOpenContact={onOpenContact}
                                onDragStart={handleDragStart}
                                onDrop={handleDrop}
                                draggingId={draggingId}
                                hasChildren={child.childCount > 0}
                                isExpanded={expandedNodes.has(child.id)}
                                onToggleExpand={toggleExpand}
                              />
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        </div>
        
        {/* Unassigned contacts */}
        {unassigned.length > 0 && (
          <div className="mt-8 w-full">
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4"
            >
              {showUnassigned ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="text-sm font-medium">
                Unassigned Contacts ({unassigned.length})
              </span>
            </button>
            
            {showUnassigned && (
              <div className="flex flex-wrap gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                {unassigned.map(contact => (
                  <div
                    key={contact.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-3 min-w-[180px] cursor-move hover:border-slate-600"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("contactId", contact.id);
                      handleDragStart(contact.id);
                    }}
                  >
                    <h4 className="font-medium text-white text-sm truncate">{contact.name}</h4>
                    <p className="text-xs text-slate-400 truncate">{contact.job_title || "No title"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {contact.linkedin_url && (
                        <a 
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Linkedin className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        onClick={() => onOpenContact(contact.id)}
                        className="text-slate-400 hover:text-white"
                      >
                        <User className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
