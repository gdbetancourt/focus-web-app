/**
 * InfoTab - Contact information editing tab for ContactSheet
 * Extracted from ContactSheet.jsx for maintainability
 * 
 * This is the main contact editing form with:
 * - Name (title, first, last)
 * - Multiple emails with primary selection
 * - Multiple phones with country codes
 * - Multiple companies with search/create
 * - LinkedIn URL
 * - Job title, location, country
 * - Buyer persona, stage
 * - Global roles
 * - Per-case roles assignment
 */
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  User, Mail, Phone, Linkedin, Building2, Briefcase, MapPin, Tag,
  Save, X, ExternalLink, Plus, Loader2, Check, Flag, Clock, Users, RefreshCw
} from "lucide-react";

import { ALL_SALUTATIONS, COUNTRY_CODES } from "./constants";

// Validation helpers
const isValidEmail = (email) => {
  if (!email) return true;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const isValidPhone = (phone) => {
  if (!phone) return true;
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(cleaned);
};

const STAGE_NAMES = {
  1: "Prospect",
  2: "Nurture",
  3: "Close",
  4: "Deliver",
  5: "Repurchase"
};

export function InfoTab({
  // Form data
  formData,
  setFormData,
  
  // Emails
  emails,
  emailDuplicates,
  addEmail,
  updateEmail,
  removeEmail,
  setPrimaryEmail,
  
  // Phones
  phones,
  phoneDuplicates,
  addPhone,
  updatePhone,
  updatePhoneCountry,
  removePhone,
  setPrimaryPhone,
  
  // Companies
  contactCompanies,
  activeCompanyIndex,
  setActiveCompanyIndex,
  companySearchInput,
  setCompanySearchInput,
  companySearchResults,
  setCompanySearchResults,
  loadingCompanies,
  addCompany,
  selectCompany,
  removeCompany,
  setPrimaryCompany,
  
  // Company creation
  showCreateCompanyForm,
  setShowCreateCompanyForm,
  newCompanyIndustry,
  setNewCompanyIndustry,
  industries,
  loadIndustries,
  createCompany,
  creatingCompany,
  openCreateCompanyForm,
  
  // Buyer personas
  buyerPersonas,
  
  // Stage
  handleStageChange,
  
  // Roles
  ROLE_OPTIONS,
  toggleRole,
  
  // Case roles
  isCreateMode,
  createMode,
  loadingCases,
  caseHistory,
  caseRoles,
  toggleCaseRole,
  saveCaseRoles,
  savingCaseRoles,
  isCaseRolesDirty,
  loadCaseHistory
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Tratamiento + Nombre + Apellido */}
      <div className="col-span-2">
        <Label className="text-slate-400 flex items-center gap-2 mb-1">
          <User className="w-4 h-4" /> Name
        </Label>
        <div className="grid grid-cols-4 gap-2">
          <Select value={formData.title || "_none"} onValueChange={(v) => setFormData(prev => ({ ...prev, title: v === "_none" ? "" : v }))}>
            <SelectTrigger className="bg-[#1a1a1a] border-[#333]">
              <SelectValue placeholder="Title" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">(None)</SelectItem>
              {ALL_SALUTATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={formData.first_name}
            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
            className="bg-[#1a1a1a] border-[#333]"
            placeholder="First Name"
          />
          <Input
            value={formData.last_name}
            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
            className="bg-[#1a1a1a] border-[#333] col-span-2"
            placeholder="Last Name"
          />
        </div>
      </div>

      {/* Emails - Multiple */}
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <Label className="text-slate-400 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Emails
          </Label>
          <Button variant="ghost" size="sm" onClick={addEmail} className="h-6 text-xs text-slate-400 hover:text-white">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {emails.map((emailEntry, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Input
                    type="email"
                    value={emailEntry.email}
                    onChange={(e) => updateEmail(idx, e.target.value)}
                    className={`bg-[#1a1a1a] border-[#333] ${emailEntry.email && !isValidEmail(emailEntry.email) ? 'border-red-500 focus:border-red-500' : ''} ${emailDuplicates[idx] ? 'border-amber-500 focus:border-amber-500' : ''}`}
                    placeholder="email@example.com"
                    data-testid={`email-input-${idx}`}
                  />
                  {emailEntry.email && !isValidEmail(emailEntry.email) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-xs">Invalid</span>
                  )}
                </div>
                <Button
                  variant={emailEntry.is_primary ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrimaryEmail(idx)}
                  className={emailEntry.is_primary ? "bg-green-600 hover:bg-green-700" : "border-[#333]"}
                >
                  {emailEntry.is_primary ? <Check className="w-4 h-4" /> : "Primary"}
                </Button>
                {emails.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeEmail(idx)} className="text-red-400 hover:text-red-300 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {/* Duplicate warning */}
              {emailDuplicates[idx] && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400" data-testid={`email-duplicate-warning-${idx}`}>
                  <span className="font-medium">⚠️ Duplicate found:</span>
                  {emailDuplicates[idx].slice(0, 2).map((dup, i) => (
                    <span key={i} className="text-white">{dup.name || dup.first_name || "Unknown"}</span>
                  ))}
                  {emailDuplicates[idx].length > 2 && <span>+{emailDuplicates[idx].length - 2} more</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phones - Multiple */}
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <Label className="text-slate-400 flex items-center gap-2">
            <Phone className="w-4 h-4" /> Phones
          </Label>
          <Button variant="ghost" size="sm" onClick={addPhone} className="h-6 text-xs text-slate-400 hover:text-white">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {phones.map((phoneEntry, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex gap-2 items-center">
                <Select value={phoneEntry.country_code || "none"} onValueChange={(v) => updatePhoneCountry(idx, v)}>
                  <SelectTrigger className="bg-[#1a1a1a] border-[#333] w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {COUNTRY_CODES.map(({ code, label, flag }) => (
                      <SelectItem key={code} value={code}>
                        {flag} {code === "none" ? "—" : code} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1 relative">
                  <Input
                    type="tel"
                    value={phoneEntry.phone}
                    onChange={(e) => updatePhone(idx, e.target.value)}
                    className={`bg-[#1a1a1a] border-[#333] ${phoneEntry.phone && !isValidPhone(phoneEntry.phone) ? 'border-red-500 focus:border-red-500' : ''} ${phoneDuplicates[idx] ? 'border-amber-500 focus:border-amber-500' : ''}`}
                    placeholder="Phone number"
                    data-testid={`phone-input-${idx}`}
                  />
                  {phoneEntry.phone && !isValidPhone(phoneEntry.phone) && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-xs">Invalid</span>
                  )}
                </div>
                <Button
                  variant={phoneEntry.is_primary ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrimaryPhone(idx)}
                  className={phoneEntry.is_primary ? "bg-green-600 hover:bg-green-700" : "border-[#333]"}
                >
                  {phoneEntry.is_primary ? <Check className="w-4 h-4" /> : "Primary"}
                </Button>
                {phones.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removePhone(idx)} className="text-red-400 hover:text-red-300 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {/* Duplicate warning */}
              {phoneDuplicates[idx] && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400" data-testid={`phone-duplicate-warning-${idx}`}>
                  <span className="font-medium">⚠️ Duplicate found:</span>
                  {phoneDuplicates[idx].slice(0, 2).map((dup, i) => (
                    <span key={i} className="text-white">{dup.name || dup.first_name || "Unknown"}</span>
                  ))}
                  {phoneDuplicates[idx].length > 2 && <span>+{phoneDuplicates[idx].length - 2} more</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* LinkedIn */}
      <div className="col-span-2">
        <Label className="text-slate-400 flex items-center gap-2 mb-1">
          <Linkedin className="w-4 h-4" /> LinkedIn
        </Label>
        <div className="flex gap-2">
          <Input
            value={formData.linkedin_url}
            onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
            className="bg-[#1a1a1a] border-[#333] flex-1"
            placeholder="https://linkedin.com/in/..."
          />
          {formData.linkedin_url && (
            <Button variant="outline" size="icon" onClick={() => window.open(formData.linkedin_url, '_blank')} className="border-[#333] text-blue-400">
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Companies - Multiple companies support */}
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <Label className="text-slate-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Empresas
          </Label>
          <Button variant="ghost" size="sm" onClick={addCompany} className="h-6 text-xs text-slate-400 hover:text-white">
            <Plus className="w-3 h-3 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {contactCompanies.map((companyEntry, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  {/* Show company name as clickable field to edit */}
                  {activeCompanyIndex !== idx ? (
                    <div
                      onClick={() => {
                        setActiveCompanyIndex(idx);
                        setCompanySearchInput(companyEntry.company_name || "");
                        if (industries.length === 0) loadIndustries();
                      }}
                      className={`bg-[#1a1a1a] border border-[#333] rounded-md px-3 py-2 cursor-pointer hover:border-[#555] text-sm min-h-[38px] flex items-center ${!companyEntry.company_name ? 'text-slate-500' : 'text-white'}`}
                      data-testid={`company-field-${idx}`}
                    >
                      {companyEntry.company_name || "Clic para buscar empresa..."}
                    </div>
                  ) : (
                    /* Show search input when editing */
                    <div className="relative">
                      <Input
                        autoFocus
                        value={companySearchInput}
                        onChange={(e) => setCompanySearchInput(e.target.value)}
                        onBlur={() => setTimeout(() => {
                          if (!showCreateCompanyForm) {
                            setActiveCompanyIndex(null);
                            setCompanySearchInput("");
                            setCompanySearchResults([]);
                          }
                        }, 200)}
                        className="bg-[#1a1a1a] border-[#333]"
                        placeholder="Buscar empresa..."
                        data-testid={`company-search-${idx}`}
                      />
                      {/* Dropdown with search results */}
                      {(companySearchResults.length > 0 || companySearchInput.length >= 2) && (
                        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {loadingCompanies && <div className="p-2 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}
                          {companySearchResults.map(c => (
                            <div
                              key={c.id || c.hs_object_id}
                              className="px-3 py-2 hover:bg-[#333] cursor-pointer text-sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectCompany(idx, c);
                              }}
                            >
                              {c.name}
                              {c.industry && <span className="text-slate-500 ml-2 text-xs">({c.industry})</span>}
                            </div>
                          ))}
                          {companySearchInput.length >= 2 && !companySearchResults.find(c => c.name?.toLowerCase() === companySearchInput.toLowerCase()) && (
                            <div
                              className="px-3 py-2 hover:bg-[#333] cursor-pointer text-sm text-green-400 border-t border-[#333] flex items-center gap-2"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                openCreateCompanyForm();
                              }}
                              data-testid={`create-company-btn-${idx}`}
                            >
                              <Plus className="w-3 h-3" /> Crear &ldquo;{companySearchInput}&rdquo;...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant={companyEntry.is_primary ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrimaryCompany(idx)}
                  className={companyEntry.is_primary ? "bg-green-600 hover:bg-green-700" : "border-[#333]"}
                  title={companyEntry.is_primary ? "Empresa principal" : "Marcar como principal"}
                >
                  {companyEntry.is_primary ? <Check className="w-4 h-4" /> : "Principal"}
                </Button>
                {contactCompanies.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeCompany(idx)} className="text-red-400 hover:text-red-300 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Create Company Form with Industry */}
        {showCreateCompanyForm && activeCompanyIndex !== null && (
          <div className="mt-2 bg-[#1a1a1a] border border-green-500/50 rounded-md shadow-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-400">Crear Nueva Empresa</span>
              <Button variant="ghost" size="sm" onClick={() => { setShowCreateCompanyForm(false); setActiveCompanyIndex(null); }} className="h-6 w-6 p-0 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-sm text-white bg-[#0f0f0f] px-2 py-1.5 rounded border border-[#333]">
              {companySearchInput}
            </div>
            <div>
              <Label className="text-slate-400 text-xs mb-1">Industria (opcional)</Label>
              <Select value={newCompanyIndustry} onValueChange={setNewCompanyIndustry}>
                <SelectTrigger className="bg-[#0f0f0f] border-[#333] text-sm h-9">
                  <SelectValue placeholder="Seleccionar industria..." />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="_none">(Sin industria)</SelectItem>
                  {industries.map(ind => (
                    <SelectItem key={ind.industry} value={ind.industry}>
                      {ind.industry.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())} ({ind.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => createCompany(companySearchInput, newCompanyIndustry === "_none" ? "" : newCompanyIndustry, activeCompanyIndex)} 
              disabled={creatingCompany}
              className="w-full bg-green-600 hover:bg-green-700 h-8 text-sm"
            >
              {creatingCompany ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear Empresa
            </Button>
          </div>
        )}
      </div>

      {/* Job Title */}
      <div>
        <Label className="text-slate-400 flex items-center gap-2 mb-1">
          <Briefcase className="w-4 h-4" /> Cargo
        </Label>
        <Input
          value={formData.job_title}
          onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
          className="bg-[#1a1a1a] border-[#333]"
        />
      </div>

      {/* Location */}
      <div>
        <Label className="text-slate-400 flex items-center gap-2 mb-1">
          <MapPin className="w-4 h-4" /> Location
        </Label>
        <Input
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          className="bg-[#1a1a1a] border-[#333]"
          placeholder="City, State"
        />
      </div>

      {/* Country */}
      <div>
        <Label className="text-slate-400 flex items-center gap-2 mb-1">
          <Flag className="w-4 h-4" /> Country
        </Label>
        <Input
          value={formData.country}
          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
          className="bg-[#1a1a1a] border-[#333]"
          placeholder="Mexico"
        />
      </div>

      {/* Buyer Persona */}
      <div>
        <Label className="text-slate-400 flex items-center gap-2 mb-1">
          <Tag className="w-4 h-4" /> Buyer Persona
        </Label>
        <Select value={formData.buyer_persona || "mateo"} onValueChange={(v) => setFormData(prev => ({ ...prev, buyer_persona: v }))}>
          <SelectTrigger className="bg-[#1a1a1a] border-[#333]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {buyerPersonas.map(p => (
              <SelectItem key={p.id || p.key} value={p.key || p.code || p.name}>
                {p.name || p.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stage */}
      <div>
        <Label className="text-slate-400 mb-1">Stage</Label>
        <Select value={String(formData.stage)} onValueChange={handleStageChange}>
          <SelectTrigger className="bg-[#1a1a1a] border-[#333]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STAGE_NAMES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{k}. {v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stage 1 Status - Only show for Stage 1 contacts */}
      {formData.stage === 1 && (
        <div className="col-span-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
          <Label className="text-blue-400 mb-2 block flex items-center gap-2">
            <Linkedin className="w-4 h-4" />
            Estado LinkedIn (Stage 1)
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1">Estado</Label>
              <Select 
                value={formData.stage_1_status || "pending_accept"} 
                onValueChange={(value) => {
                  if (value === "pending_accept") {
                    setFormData(prev => ({ 
                      ...prev, 
                      stage_1_status: value,
                      linkedin_accepted_by: null
                    }));
                  } else if (!formData.linkedin_accepted_by) {
                    return;
                  } else {
                    setFormData(prev => ({ ...prev, stage_1_status: value }));
                  }
                }}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_accept">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-yellow-400" />
                      Por aceptar
                    </div>
                  </SelectItem>
                  <SelectItem value="accepted">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-400" />
                      Aceptado
                    </div>
                  </SelectItem>
                  <SelectItem value="conversation_open">
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-blue-400" />
                      Conversación abierta
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1">Perfil LinkedIn</Label>
              <Select 
                value={formData.linkedin_accepted_by || "none"} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  linkedin_accepted_by: value === "none" ? null : value 
                }))}
              >
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin seleccionar</SelectItem>
                  <SelectItem value="GB">GB - Gerardo Betancourt</SelectItem>
                  <SelectItem value="MG">MG - María del Mar Gargari</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Roles - Multiple Selection */}
      <div className="col-span-2">
        <Label className="text-slate-400 mb-2 block">Roles (Globales)</Label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map(role => (
            <Button
              key={role.value}
              variant={formData.roles?.includes(role.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleRole(role.value)}
              className={formData.roles?.includes(role.value) ? "bg-[#ff3300] hover:bg-[#cc2900]" : "border-[#333]"}
            >
              {role.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Los roles globales aplican a este contacto en general.
        </p>
      </div>

      {/* Roles por Caso - Editable */}
      {!isCreateMode && !createMode && (
        <div className="col-span-2 mt-4">
          <Label className="text-slate-400 mb-2 block flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Asignar Roles por Negocio
          </Label>
          {loadingCases ? (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-500" />
            </div>
          ) : caseHistory.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {caseHistory.map((caseItem) => {
                const selectedRoles = caseRoles[caseItem.id] || [];
                const serverRoles = caseItem.case_roles || [];
                const isDirty = isCaseRolesDirty(caseItem.id);
                
                return (
                  <div key={caseItem.id} className="p-3 bg-[#0a0a0a] rounded-lg border border-[#222]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white text-sm font-medium truncate flex-1" title={caseItem.name}>
                        {caseItem.name || "Caso sin nombre"}
                      </p>
                      <Badge className={`text-[10px] ml-2 ${
                        caseItem.delivery_stage 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {caseItem.delivery_stage ? `S4: ${caseItem.delivery_stage}` : `S3: ${caseItem.stage}`}
                      </Badge>
                    </div>
                    
                    {/* Current server roles */}
                    {serverRoles.length > 0 && !isDirty && (
                      <div className="mb-2">
                        <p className="text-[10px] text-slate-500 mb-1">Roles guardados:</p>
                        <div className="flex flex-wrap gap-1">
                          {serverRoles.map((role, ridx) => (
                            <Badge key={ridx} className="text-[10px] bg-teal-500/20 text-teal-400 border border-teal-500/30">
                              {role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Pending changes indicator */}
                    {isDirty && (
                      <div className="mb-2 text-[10px] text-amber-400 flex items-center gap-1">
                        <span>⚠️ Cambios sin guardar</span>
                      </div>
                    )}
                    
                    {/* Role selection */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ROLE_OPTIONS.map(role => (
                        <Badge
                          key={role.value}
                          className={`text-[10px] cursor-pointer transition-colors ${
                            selectedRoles.includes(role.value)
                              ? 'bg-[#ff3300] text-white hover:bg-[#cc2900]'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                          onClick={() => toggleCaseRole(caseItem.id, role.value)}
                        >
                          {role.label}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Save button for this case */}
                    {isDirty && (
                      <Button
                        size="sm"
                        onClick={() => saveCaseRoles(caseItem.id, caseItem.name)}
                        disabled={savingCaseRoles}
                        className="mt-2 h-7 text-xs bg-teal-600 hover:bg-teal-700"
                      >
                        {savingCaseRoles ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Save className="w-3 h-3 mr-1" />
                        )}
                        {selectedRoles.length > 0 ? 'Guardar roles' : 'Eliminar roles'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin negocios asociados</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadCaseHistory}
                className="mt-2 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Cargar negocios
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Selecciona roles específicos para cada negocio asociado a este contacto.
          </p>
        </div>
      )}
    </div>
  );
}
