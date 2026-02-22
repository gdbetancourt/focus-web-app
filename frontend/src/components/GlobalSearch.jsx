import { useState, useEffect, useRef } from "react";
import { Search, X, User, Building2, Store, FileText, Tag, Loader2, Phone } from "lucide-react";
import { Input } from "./ui/input";
import api from "../lib/api";
import ContactSheet from "./ContactSheet";
import { CompanyEditorDialog } from "./CompanyEditorDialog";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  
  // Modal states
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search/global?q=${encodeURIComponent(query)}&limit=10`);
        setResults(res.data);
        setIsOpen(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (type, item) => {
    setIsOpen(false);
    setQuery("");
    
    switch (type) {
      case "contact":
        // Open contact modal instead of navigating
        setSelectedContact(item);
        break;
      case "company":
        // Open company modal instead of navigating
        setSelectedCompany(item);
        break;
      case "small_business":
        // For small businesses, we don't have a modal yet - could add later
        window.open(`/prospect/1-2-2-small-business?highlight=${item.id}`, '_self');
        break;
      case "opportunity":
        window.open(`/prospect/1-2-1-deal-makers?highlight=${item.id}`, '_self');
        break;
      case "keyword":
        window.open(`/prospect/1-1-2-posts?highlight=${item.id}`, '_self');
        break;
      default:
        break;
    }
  };

  const ResultSection = ({ title, icon: Icon, items, type, emptyText }) => {
    if (!items || items.length === 0) return null;
    
    return (
      <div className="py-2">
        <div className="px-3 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Icon className="w-3 h-3" />
          {title}
        </div>
        {items.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(type, item)}
            className="w-full px-3 py-2 text-left hover:bg-[#1a1a1a] flex items-center gap-3 transition-colors"
          >
            <Icon className="w-4 h-4 text-slate-500" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">
                {item.name || item.keyword || item.author_name || "Unknown"}
              </div>
              <div className="text-xs text-slate-500 truncate flex items-center gap-2">
                <span>{item.company || item.domain || item.city || item.category || item.keyword_matched || item.email || ""}</span>
                {item.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {item.phone}
                  </span>
                )}
              </div>
            </div>
            {item.stage && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[#ff3300]/20 text-[#ff3300]">
                Stage {item.stage}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Buscar contactos, empresas, teléfono..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && setIsOpen(true)}
            className="w-64 pl-9 pr-8 h-9 bg-[#111] border-[#222] text-white placeholder:text-slate-600 text-sm focus:border-[#ff3300]/50 focus:ring-[#ff3300]/20"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
          )}
          {query && !loading && (
            <button
              onClick={() => { setQuery(""); setResults(null); setIsOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results Dropdown */}
        {isOpen && results && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#111] border border-[#222] rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            {results.total === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                No se encontraron resultados para "{query}"
              </div>
            ) : (
              <div className="divide-y divide-[#1a1a1a]">
                <ResultSection 
                  title="Contactos" 
                  icon={User} 
                  items={results.contacts} 
                  type="contact" 
                />
                <ResultSection 
                  title="Empresas" 
                  icon={Building2} 
                  items={results.companies} 
                  type="company" 
                />
                <ResultSection 
                  title="Small Businesses" 
                  icon={Store} 
                  items={results.small_businesses} 
                  type="small_business" 
                />
                <ResultSection 
                  title="Opportunities" 
                  icon={FileText} 
                  items={results.opportunities} 
                  type="opportunity" 
                />
                <ResultSection 
                  title="Keywords" 
                  icon={Tag} 
                  items={results.keywords} 
                  type="keyword" 
                />
              </div>
            )}
            
            {results.total > 0 && (
              <div className="px-3 py-2 border-t border-[#1a1a1a] text-xs text-slate-500 text-center">
                {results.total} resultados encontrados
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {selectedContact && (
        <ContactSheet
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
          contactId={selectedContact.id}
          onSaved={() => {}}
        />
      )}

      {/* Company Modal */}
      {selectedCompany && (
        <CompanyEditorDialog
          open={!!selectedCompany}
          onOpenChange={(open) => !open && setSelectedCompany(null)}
          companyId={selectedCompany.id || selectedCompany.hubspot_id}
          companyName={selectedCompany.name}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
