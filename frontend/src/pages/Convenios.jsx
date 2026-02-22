import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Calendar, FileText, Check, Upload, 
  ChevronDown, ChevronUp, Search, RefreshCw, Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import { toast } from 'sonner';
import api from '../lib/api';

export default function Convenios() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/convenios/companies');
      setCompanies(res.data.companies || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast.error('Error cargando empresas');
    } finally {
      setLoading(false);
    }
  };

  const updateConvenio = async (companyId, field, value) => {
    try {
      await api.put(`/convenios/companies/${companyId}`, { [field]: value });
      // Update local state
      setCompanies(prev => prev.map(c => 
        c.id === companyId ? { ...c, [field]: value } : c
      ));
      toast.success('Convenio actualizado');
    } catch (error) {
      toast.error('Error actualizando convenio');
    }
  };

  const handleFileUpload = async (companyId, file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post(`/convenios/companies/${companyId}/acuerdo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setCompanies(prev => prev.map(c => 
        c.id === companyId ? { ...c, acuerdo_url: res.data.url, acuerdo_filename: res.data.filename } : c
      ));
      toast.success('Acuerdo subido');
    } catch (error) {
      toast.error('Error subiendo archivo');
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: companies.length,
    conInteres: companies.filter(c => c.interes_convenio).length,
    conveniosActivos: companies.filter(c => c.fecha_cierre).length
  };

  return (
    <div className="space-y-6" data-testid="convenios-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Convenios</h1>
          <p className="text-slate-500">Empresas con contactos de perfil Ricardo</p>
        </div>
        <Button onClick={loadCompanies} variant="outline" className="border-slate-600">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Total Empresas</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Con Interés</p>
                <p className="text-2xl font-bold text-green-400">{stats.conInteres}</p>
              </div>
              <Check className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm">Convenios Activos</p>
                <p className="text-2xl font-bold text-orange-400">{stats.conveniosActivos}</p>
              </div>
              <FileText className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Buscar empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-[#111] border-[#222] text-white"
        />
      </div>

      {/* Companies List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
          Cargando empresas...
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No se encontraron empresas con contactos de perfil Ricardo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCompanies.map((company) => (
            <Collapsible
              key={company.id}
              open={expandedCompany === company.id}
              onOpenChange={(open) => setExpandedCompany(open ? company.id : null)}
            >
              <Card className="bg-[#111] border-[#222]">
                <CollapsibleTrigger className="w-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-white">{company.name}</h3>
                          <p className="text-sm text-slate-500">
                            <Users className="w-3 h-3 inline mr-1" />
                            {company.ricardo_count} contactos Ricardo
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {company.interes_convenio && (
                          <Badge className="bg-green-500/20 text-green-400 border-0">
                            Interesado
                          </Badge>
                        )}
                        {company.fecha_cierre && (
                          <Badge className="bg-orange-500/20 text-orange-400 border-0">
                            Convenio Activo
                          </Badge>
                        )}
                        {expandedCompany === company.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t border-[#222] p-4 space-y-4">
                    {/* Contactos Ricardo */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Contactos Perfil Ricardo</h4>
                      <div className="flex flex-wrap gap-2">
                        {company.contacts?.map((contact, idx) => (
                          <Badge key={idx} variant="outline" className="border-blue-500/30 text-blue-400">
                            {contact.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Convenio Fields */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Interés en Convenio */}
                      <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg">
                        <Checkbox
                          id={`interes-${company.id}`}
                          checked={company.interes_convenio || false}
                          onCheckedChange={(checked) => updateConvenio(company.id, 'interes_convenio', checked)}
                        />
                        <label htmlFor={`interes-${company.id}`} className="text-white cursor-pointer">
                          Interés en Convenio
                        </label>
                      </div>

                      {/* Fecha de Cierre */}
                      <div className="p-3 bg-[#0a0a0a] rounded-lg">
                        <label className="text-sm text-slate-400 block mb-1">Fecha de Cierre</label>
                        <Input
                          type="date"
                          value={company.fecha_cierre?.split('T')[0] || ''}
                          onChange={(e) => updateConvenio(company.id, 'fecha_cierre', e.target.value)}
                          className="bg-[#111] border-[#333] text-white"
                        />
                      </div>

                      {/* Fecha de Renovación (auto-calculada) */}
                      <div className="p-3 bg-[#0a0a0a] rounded-lg">
                        <label className="text-sm text-slate-400 block mb-1">Fecha de Renovación</label>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-white">
                            {company.fecha_cierre 
                              ? new Date(new Date(company.fecha_cierre).setFullYear(new Date(company.fecha_cierre).getFullYear() + 1)).toLocaleDateString('es-MX')
                              : '-'
                            }
                          </span>
                          <span className="text-xs text-slate-500">(+1 año)</span>
                        </div>
                      </div>

                      {/* Acuerdo (archivo) */}
                      <div className="p-3 bg-[#0a0a0a] rounded-lg">
                        <label className="text-sm text-slate-400 block mb-1">Acuerdo</label>
                        {company.acuerdo_url ? (
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-400" />
                            <a 
                              href={company.acuerdo_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-400 hover:underline text-sm truncate"
                            >
                              {company.acuerdo_filename || 'Ver acuerdo'}
                            </a>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf,.doc,.docx';
                                input.onchange = (e) => handleFileUpload(company.id, e.target.files[0]);
                                input.click();
                              }}
                            >
                              Cambiar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#333] text-slate-300"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.pdf,.doc,.docx';
                              input.onchange = (e) => handleFileUpload(company.id, e.target.files[0]);
                              input.click();
                            }}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Subir Acuerdo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
