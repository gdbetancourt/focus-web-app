/**
 * Assign Roles Tab Content Component
 * Simplified version - role assignment is done via ContactSheet
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import {
  RefreshCw,
  Check,
  Tag,
  Search,
  Filter,
  ChevronRight,
  ChevronLeft,
  Edit2,
  Building2,
  Briefcase,
} from "lucide-react";
import ContactSheet from "../ContactSheet";

export function AssignRolesTabContent({
  contactsWithoutRoles,
  setContactsWithoutRoles,
  loadingRoles,
  onRefresh,
}) {
  // Filter and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Contact edit state
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  // Filter handlers that reset pagination
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStageFilterChange = (value) => {
    setStageFilter(value);
    setCurrentPage(1);
  };

  // Filter contacts
  const filteredContacts = contactsWithoutRoles.filter(contact => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = contact.name?.toLowerCase().includes(query);
      const matchesEmail = contact.email?.toLowerCase().includes(query);
      const matchesCompany = contact.company_names_from_cases?.some(c => c.toLowerCase().includes(query));
      if (!matchesName && !matchesEmail && !matchesCompany) {
        return false;
      }
    }
    
    // Stage filter
    if (stageFilter !== "all" && contact.stage !== parseInt(stageFilter)) {
      return false;
    }
    
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredContacts.length / pageSize);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleContactUpdated = (updatedContact) => {
    // If contact now has roles, remove from list
    if (updatedContact.roles?.length > 0) {
      setContactsWithoutRoles(prev => prev.filter(c => c.id !== updatedContact.id));
      toast.success("Contacto actualizado y removido de la lista");
    } else {
      // Update contact in list
      setContactsWithoutRoles(prev => 
        prev.map(c => c.id === updatedContact.id ? { ...c, ...updatedContact } : c)
      );
    }
  };

  return (
    <>
      <Card className="bg-[#111] border-[#222]">
        <CardHeader className="border-b border-[#222]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-teal-400" />
              Contactos sin Rol Asignado
              <Badge className="bg-teal-500/20 text-teal-400">{contactsWithoutRoles.length}</Badge>
            </CardTitle>
            <Button 
              onClick={onRefresh} 
              variant="outline" 
              size="sm"
              className="border-[#333]"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRoles ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* Filters */}
          {contactsWithoutRoles.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#222]">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Buscar por nombre, email, empresa..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 bg-[#0a0a0a] border-[#333] text-white"
                />
              </div>
              
              {/* Stage filter */}
              <Select value={stageFilter} onValueChange={handleStageFilterChange}>
                <SelectTrigger className="w-[130px] bg-[#0a0a0a] border-[#333] text-white">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#222]">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="3">Stage 3</SelectItem>
                  <SelectItem value="4">Stage 4</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Results count */}
              <div className="flex items-center text-sm text-slate-400">
                <Filter className="w-4 h-4 mr-1" />
                {filteredContacts.length} de {contactsWithoutRoles.length}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingRoles ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Cargando...
            </div>
          ) : contactsWithoutRoles.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>¡Todos los contactos tienen roles asignados!</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No se encontraron contactos con los filtros seleccionados</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#222] hover:bg-transparent">
                      <TableHead className="text-slate-400">Contacto</TableHead>
                      <TableHead className="text-slate-400">Stage</TableHead>
                      <TableHead className="text-slate-400">Negocios</TableHead>
                      <TableHead className="text-slate-400">Empresas</TableHead>
                      <TableHead className="text-slate-400 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedContacts.map((contact) => (
                      <TableRow key={contact.id} className="border-b border-[#222] hover:bg-[#151515]">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{contact.name || "Sin nombre"}</p>
                            {contact.email && (
                              <p className="text-xs text-slate-400 truncate max-w-[200px]">{contact.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={contact.stage === 3 ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}>
                            Stage {contact.stage}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contact.case_names?.length > 0 ? (
                            <div className="flex items-center gap-1 text-slate-300">
                              <Briefcase className="w-3 h-3" />
                              <span className="text-sm">{contact.case_names.length}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.company_names_from_cases?.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-300 text-sm truncate max-w-[120px]">
                                {contact.company_names_from_cases[0]}
                                {contact.company_names_from_cases.length > 1 && (
                                  <span className="text-slate-500"> +{contact.company_names_from_cases.length - 1}</span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingContact(contact);
                              setEditContactOpen(true);
                            }}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Asignar Roles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-[#222]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Mostrar</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                      <SelectTrigger className="w-[70px] h-8 bg-[#0a0a0a] border-[#333] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111] border-[#222]">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-slate-400">por página</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 border-[#333]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <span className="text-sm text-slate-300 min-w-[100px] text-center">
                      Página {currentPage} de {totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 border-[#333]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="text-sm text-slate-400">
                    {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredContacts.length)} de {filteredContacts.length}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Edit Sheet */}
      <ContactSheet
        contact={editingContact}
        open={editContactOpen}
        onOpenChange={(open) => {
          setEditContactOpen(open);
          if (!open) {
            setEditingContact(null);
            // Refresh list when dialog closes
            onRefresh();
          }
        }}
        onUpdate={handleContactUpdated}
      />
    </>
  );
}

export default AssignRolesTabContent;
