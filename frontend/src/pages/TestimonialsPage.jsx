import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, Plus, Edit, Trash2, Star, Upload, Search, Filter, 
  Video, Calendar, ExternalLink, RefreshCw, FileSpreadsheet,
  CheckCircle, Clock, AlertCircle, X, ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { toast } from 'sonner';
import api from '../lib/api';

const NONE_VALUE = "_none";

const TestimonialsPage = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0 });
  
  // Options for dropdowns
  const [options, setOptions] = useState({
    formatos: [],
    enfoques: [],
    industries: [],
    programas: [],
    niveles: [],
    status_options: []
  });
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState("");
  
  // Filters
  const [filters, setFilters] = useState({
    formato_id: '',
    enfoque_id: '',
    industria_id: '',
    programa_id: '',
    nivel_id: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  
  // Form data
  const [formData, setFormData] = useState({
    testimonio: '',
    nombre: '',
    apellido: '',
    correo: '',
    formato_id: '',
    formato_name: '',
    enfoque_id: '',
    enfoque_name: '',
    industria_id: '',
    industria_name: '',
    programa_id: '',
    programa_name: '',
    nivel_id: '',
    nivel_name: '',
    publicar_desde: '',
    video_vimeo: '',
    video_descript: '',
    estatus: '',
    rating_presentacion: null,
    rating_articulacion: null,
    rating_calidad_video: null,
    rating_resultados: null,
    valor_agregado: false,
    display_pages: []
  });

  useEffect(() => {
    loadData();
    loadOptions();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.formato_id) params.append('formato_id', filters.formato_id);
      if (filters.enfoque_id) params.append('enfoque_id', filters.enfoque_id);
      if (filters.industria_id) params.append('industria_id', filters.industria_id);
      if (filters.programa_id) params.append('programa_id', filters.programa_id);
      if (filters.nivel_id) params.append('nivel_id', filters.nivel_id);
      
      const res = await api.get(`/testimonials?${params.toString()}`);
      let data = res.data.testimonials || [];
      
      // Client-side search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        data = data.filter(t => 
          t.nombre?.toLowerCase().includes(search) ||
          t.apellido?.toLowerCase().includes(search) ||
          t.testimonio?.toLowerCase().includes(search) ||
          t.correo?.toLowerCase().includes(search)
        );
      }
      
      setTestimonials(data);
      setStats(res.data.stats || { total: 0, published: 0, pending: 0 });
    } catch (error) {
      console.error('Error loading testimonials:', error);
      toast.error('Error loading testimonials');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const res = await api.get('/testimonials/options');
      setOptions(res.data);
    } catch (error) {
      console.error('Error loading options:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      testimonio: '',
      nombre: '',
      apellido: '',
      correo: '',
      formato_id: '',
      formato_name: '',
      enfoque_id: '',
      enfoque_name: '',
      industria_id: '',
      industria_name: '',
      programa_id: '',
      programa_name: '',
      nivel_id: '',
      nivel_name: '',
      publicar_desde: '',
      video_vimeo: '',
      video_descript: '',
      estatus: '',
      rating_presentacion: null,
      rating_articulacion: null,
      rating_calidad_video: null,
      rating_resultados: null,
      valor_agregado: false
    });
  };

  const openAddDialog = () => {
    setEditingId(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (testimonial) => {
    setEditingId(testimonial.id);
    setFormData({
      testimonio: testimonial.testimonio || '',
      nombre: testimonial.nombre || '',
      apellido: testimonial.apellido || '',
      correo: testimonial.correo || '',
      formato_id: testimonial.formato_id || '',
      formato_name: testimonial.formato_name || '',
      enfoque_id: testimonial.enfoque_id || '',
      enfoque_name: testimonial.enfoque_name || '',
      industria_id: testimonial.industria_id || '',
      industria_name: testimonial.industria_name || '',
      programa_id: testimonial.programa_id || '',
      programa_name: testimonial.programa_name || '',
      nivel_id: testimonial.nivel_id || '',
      nivel_name: testimonial.nivel_name || '',
      publicar_desde: testimonial.publicar_desde ? testimonial.publicar_desde.split('T')[0] : '',
      video_vimeo: testimonial.video_vimeo || '',
      video_descript: testimonial.video_descript || '',
      estatus: testimonial.estatus || '',
      rating_presentacion: testimonial.rating_presentacion,
      rating_articulacion: testimonial.rating_articulacion,
      rating_calidad_video: testimonial.rating_calidad_video,
      rating_resultados: testimonial.rating_resultados,
      valor_agregado: testimonial.valor_agregado || false,
      display_pages: testimonial.display_pages || []
    });
    setDialogOpen(true);
  };

  const handleSelectChange = (field, value, nameField) => {
    const actualValue = value === NONE_VALUE ? '' : value;
    
    // Find the name from options
    let name = '';
    if (actualValue) {
      const optionArrays = {
        formato_id: 'formatos',
        enfoque_id: 'enfoques',
        industria_id: 'industries',
        programa_id: 'programas',
        nivel_id: 'niveles'
      };
      const arr = options[optionArrays[field]] || [];
      const found = arr.find(o => o.id === actualValue);
      name = found?.name || '';
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: actualValue,
      [nameField]: name
    }));
  };

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.testimonio) {
      toast.error('Name and testimonial text are required');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/testimonials/${editingId}`, formData);
        toast.success('Testimonial updated');
      } else {
        await api.post('/testimonials', formData);
        toast.success('Testimonial created');
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving testimonial');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    
    try {
      await api.delete(`/testimonials/${id}`);
      toast.success('Testimonial deleted');
      loadData();
    } catch (error) {
      toast.error('Error deleting testimonial');
    }
  };

  // Bulk selection functions
  const toggleSelectAll = () => {
    if (selectedIds.length === testimonials.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(testimonials.map(t => t.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) {
      toast.error('Selecciona una accion y al menos un testimonio');
      return;
    }

    try {
      if (bulkAction === 'delete') {
        if (!confirm(`Eliminar ${selectedIds.length} testimonios?`)) return;
        await api.post('/testimonials/bulk-delete', { ids: selectedIds });
        toast.success(`${selectedIds.length} testimonios eliminados`);
      } else if (bulkAction === 'publish') {
        await api.post('/testimonials/bulk-update', { 
          ids: selectedIds, 
          update: { status: 'published' } 
        });
        toast.success(`${selectedIds.length} testimonios publicados`);
      } else if (bulkAction === 'unpublish') {
        await api.post('/testimonials/bulk-update', { 
          ids: selectedIds, 
          update: { status: 'pending' } 
        });
        toast.success(`${selectedIds.length} testimonios despublicados`);
      }
      setSelectedIds([]);
      setBulkAction("");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error en accion masiva');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file');
      return;
    }

    setImporting(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', importFile);

    try {
      const res = await api.post('/testimonials/import', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Imported ${res.data.created} testimonials`);
      if (res.data.errors?.length > 0) {
        toast.warning(`${res.data.errors.length} rows had errors`);
      }
      
      setImportDialogOpen(false);
      setImportFile(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error importing file');
    } finally {
      setImporting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      formato_id: '',
      enfoque_id: '',
      industria_id: '',
      programa_id: '',
      nivel_id: '',
      search: ''
    });
  };

  const renderRating = (value, max = 5) => {
    if (value === null || value === undefined) return <span className="text-slate-600">-</span>;
    return (
      <div className="flex gap-0.5">
        {Array(max).fill(0).map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < value ? 'text-yellow-500 fill-yellow-500' : 'text-slate-700'}`}
          />
        ))}
      </div>
    );
  };

  const RatingSelect = ({ label, value, onChange }) => (
    <div>
      <Label className="text-slate-400 text-xs">{label}</Label>
      <Select 
        value={value !== null && value !== undefined ? String(value) : NONE_VALUE} 
        onValueChange={(v) => onChange(v === NONE_VALUE ? null : parseInt(v))}
      >
        <SelectTrigger className="bg-slate-800 border-slate-600 h-9">
          <SelectValue placeholder="-" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>-</SelectItem>
          {[1, 2, 3, 4, 5].map(r => (
            <SelectItem key={r} value={String(r)}>{r} ★</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const getPublishStatus = (publicar_desde) => {
    if (!publicar_desde) return { status: 'published', label: 'Published', color: 'green' };
    const publishDate = new Date(publicar_desde);
    const now = new Date();
    if (publishDate <= now) {
      return { status: 'published', label: 'Published', color: 'green' };
    }
    return { status: 'scheduled', label: `Scheduled: ${publishDate.toLocaleDateString()}`, color: 'yellow' };
  };

  const activeFilterCount = Object.values(filters).filter(v => v).length;

  if (loading && testimonials.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="testimonials-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/20">
            <Award className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Testimonials Management</h1>
            <p className="text-slate-500">
              Manage client testimonials with filters, ratings and video links
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setImportDialogOpen(true)} 
            variant="outline" 
            className="border-[#333] text-slate-300"
            data-testid="import-excel-btn"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button 
            onClick={openAddDialog} 
            className="bg-yellow-600 hover:bg-yellow-700"
            data-testid="add-testimonial-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Testimonial
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Award className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{stats.published}</p>
              <p className="text-xs text-slate-500">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-xs text-slate-500">Scheduled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name, email, or testimonial..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 bg-slate-800 border-slate-600 text-white"
                data-testid="search-input"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-[#333] ${activeFilterCount > 0 ? 'text-yellow-400' : 'text-slate-300'}`}
              data-testid="toggle-filters-btn"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <Button
              onClick={loadData}
              variant="outline"
              className="border-[#333] text-slate-300"
              data-testid="refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[#222]">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-slate-400 text-xs">Format</Label>
                  <Select 
                    value={filters.formato_id || NONE_VALUE} 
                    onValueChange={(v) => setFilters(prev => ({ ...prev, formato_id: v === NONE_VALUE ? '' : v }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="All formats" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>All formats</SelectItem>
                      {options.formatos.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Focus (Thematic Axis)</Label>
                  <Select 
                    value={filters.enfoque_id || NONE_VALUE} 
                    onValueChange={(v) => setFilters(prev => ({ ...prev, enfoque_id: v === NONE_VALUE ? '' : v }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="All axes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>All axes</SelectItem>
                      {options.enfoques.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Industry</Label>
                  <Select 
                    value={filters.industria_id || NONE_VALUE} 
                    onValueChange={(v) => setFilters(prev => ({ ...prev, industria_id: v === NONE_VALUE ? '' : v }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="All industries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>All industries</SelectItem>
                      {options.industries.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Program</Label>
                  <Select 
                    value={filters.programa_id || NONE_VALUE} 
                    onValueChange={(v) => setFilters(prev => ({ ...prev, programa_id: v === NONE_VALUE ? '' : v }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="All programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>All programs</SelectItem>
                      {options.programas.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Level</Label>
                  <Select 
                    value={filters.nivel_id || NONE_VALUE} 
                    onValueChange={(v) => setFilters(prev => ({ ...prev, nivel_id: v === NONE_VALUE ? '' : v }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>All levels</SelectItem>
                      {options.niveles.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end mt-3 gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="text-slate-400"
                >
                  Clear All
                </Button>
                <Button 
                  size="sm" 
                  onClick={loadData}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Testimonials Table */}
      <Card className="bg-[#111] border-[#222]">
        <CardContent className="p-0">
          {testimonials.length === 0 ? (
            <div className="p-12 text-center">
              <Award className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-semibold text-white mb-2">No Testimonials Yet</h3>
              <p className="text-slate-500 mb-4">
                Add testimonials manually or import from Excel
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={() => setImportDialogOpen(true)} 
                  variant="outline"
                  className="border-[#333] text-slate-300"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Import Excel
                </Button>
                <Button onClick={openAddDialog} className="bg-yellow-600 hover:bg-yellow-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Testimonial
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Bulk Actions Bar */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-4 p-3 mb-4 bg-yellow-600/20 border border-yellow-600/50 rounded-lg">
                  <span className="text-yellow-400 font-medium">
                    {selectedIds.length} seleccionados
                  </span>
                  <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger className="w-40 bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Accion..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publish">Publicar</SelectItem>
                      <SelectItem value="unpublish">Despublicar</SelectItem>
                      <SelectItem value="delete">Eliminar</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleBulkAction}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Aplicar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    className="text-slate-400"
                  >
                    Cancelar
                  </Button>
                </div>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow className="border-[#222] hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox 
                        checked={selectedIds.length === testimonials.length && testimonials.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Testimonial</TableHead>
                    <TableHead className="text-slate-400">Format</TableHead>
                    <TableHead className="text-slate-400">Focus</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Ratings</TableHead>
                    <TableHead className="text-slate-400">Video</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testimonials.map(t => {
                    const publishStatus = getPublishStatus(t.publicar_desde);
                    return (
                      <TableRow key={t.id} className="border-[#222]" data-testid={`testimonial-row-${t.id}`}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(t.id)}
                            onCheckedChange={() => toggleSelect(t.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-white font-medium">{t.nombre} {t.apellido}</p>
                            {t.correo && <p className="text-xs text-slate-500">{t.correo}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-slate-300 text-sm line-clamp-2">{t.testimonio}</p>
                          {t.valor_agregado && (
                            <Badge className="mt-1 bg-purple-500/20 text-purple-400 text-xs">
                              Added Value
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.formato_name && (
                            <Badge className="bg-blue-500/20 text-blue-400">{t.formato_name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.enfoque_name && (
                            <Badge className="bg-green-500/20 text-green-400">{t.enfoque_name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`bg-${publishStatus.color}-500/20 text-${publishStatus.color}-400`}>
                            {publishStatus.status === 'published' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <Clock className="w-3 h-3 mr-1" />
                            )}
                            {publishStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-12">Pres:</span>
                              {renderRating(t.rating_presentacion)}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-12">Artic:</span>
                              {renderRating(t.rating_articulacion)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {t.video_vimeo && (
                              <a 
                                href={t.video_vimeo} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                title="Vimeo"
                              >
                                <Video className="w-4 h-4" />
                              </a>
                            )}
                            {t.video_descript && (
                              <a 
                                href={t.video_descript} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                title="Descript"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(t)}
                              className="text-slate-400 hover:text-white"
                              data-testid={`edit-btn-${t.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(t.id)}
                              className="text-red-400 hover:text-red-300"
                              data-testid={`delete-btn-${t.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Personal Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">First Name *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="nombre-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Last Name</Label>
                  <Input
                    value={formData.apellido}
                    onChange={(e) => setFormData(prev => ({ ...prev, apellido: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="apellido-input"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-400">Email</Label>
                <Input
                  type="email"
                  value={formData.correo}
                  onChange={(e) => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="Links to existing contact if email matches"
                  data-testid="correo-input"
                />
              </div>
            </div>

            {/* Testimonial Text */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Testimonial Content
              </h3>
              <div>
                <Label className="text-slate-400">Testimonial *</Label>
                <Textarea
                  value={formData.testimonio}
                  onChange={(e) => setFormData(prev => ({ ...prev, testimonio: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white min-h-[120px]"
                  placeholder="What did they say about your service?"
                  data-testid="testimonio-input"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="valor_agregado"
                  checked={formData.valor_agregado}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, valor_agregado: checked }))}
                />
                <Label htmlFor="valor_agregado" className="text-slate-300 cursor-pointer">
                  Added Value (Valor Agregado)
                </Label>
              </div>
            </div>

            {/* Classification */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Classification
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Format</Label>
                  <Select 
                    value={formData.formato_id || NONE_VALUE} 
                    onValueChange={(v) => handleSelectChange('formato_id', v, 'formato_name')}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {options.formatos.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Focus (Thematic Axis)</Label>
                  <Select 
                    value={formData.enfoque_id || NONE_VALUE} 
                    onValueChange={(v) => handleSelectChange('enfoque_id', v, 'enfoque_name')}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select focus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {options.enfoques.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Industry</Label>
                  <Select 
                    value={formData.industria_id || NONE_VALUE} 
                    onValueChange={(v) => handleSelectChange('industria_id', v, 'industria_name')}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {options.industries.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Program</Label>
                  <Select 
                    value={formData.programa_id || NONE_VALUE} 
                    onValueChange={(v) => handleSelectChange('programa_id', v, 'programa_name')}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {options.programas.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Certification Level</Label>
                  <Select 
                    value={formData.nivel_id || NONE_VALUE} 
                    onValueChange={(v) => handleSelectChange('nivel_id', v, 'nivel_name')}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {options.niveles.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Status (Company/Person)</Label>
                  <Select 
                    value={formData.estatus || NONE_VALUE} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, estatus: v === NONE_VALUE ? '' : v }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {options.status_options?.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Video Links */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Video Links
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Vimeo URL</Label>
                  <Input
                    value={formData.video_vimeo}
                    onChange={(e) => setFormData(prev => ({ ...prev, video_vimeo: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="https://vimeo.com/..."
                    data-testid="vimeo-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Descript URL</Label>
                  <Input
                    value={formData.video_descript}
                    onChange={(e) => setFormData(prev => ({ ...prev, video_descript: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white"
                    placeholder="https://share.descript.com/..."
                    data-testid="descript-input"
                  />
                </div>
              </div>
            </div>

            {/* Ratings */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Video Ratings
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <RatingSelect
                  label="Presentation"
                  value={formData.rating_presentacion}
                  onChange={(v) => setFormData(prev => ({ ...prev, rating_presentacion: v }))}
                />
                <RatingSelect
                  label="Articulation"
                  value={formData.rating_articulacion}
                  onChange={(v) => setFormData(prev => ({ ...prev, rating_articulacion: v }))}
                />
                <RatingSelect
                  label="Video Quality"
                  value={formData.rating_calidad_video}
                  onChange={(v) => setFormData(prev => ({ ...prev, rating_calidad_video: v }))}
                />
                <RatingSelect
                  label="Results"
                  value={formData.rating_resultados}
                  onChange={(v) => setFormData(prev => ({ ...prev, rating_resultados: v }))}
                />
              </div>
            </div>

            {/* Publish Date */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Publishing
              </h3>
              <div className="w-1/2">
                <Label className="text-slate-400">Publish From Date</Label>
                <Input
                  type="date"
                  value={formData.publicar_desde}
                  onChange={(e) => setFormData(prev => ({ ...prev, publicar_desde: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  data-testid="publicar-desde-input"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to publish immediately
                </p>
              </div>
            </div>

            {/* Display Pages */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-400 border-b border-slate-700 pb-2">
                Display on Pages
              </h3>
              <p className="text-xs text-slate-500">
                Select which pages should show this testimonial in the carousel
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(options.display_pages || [
                  {value: "home", label: "Home"},
                  {value: "lms", label: "LMS"},
                  {value: "blog", label: "Blog"},
                  {value: "events", label: "Eventos"},
                  {value: "services", label: "Servicios"},
                  {value: "about", label: "Nosotros"}
                ]).map(page => (
                  <div
                    key={page.value}
                    onClick={() => {
                      const pages = formData.display_pages || [];
                      const newPages = pages.includes(page.value)
                        ? pages.filter(p => p !== page.value)
                        : [...pages, page.value];
                      setFormData(prev => ({ ...prev, display_pages: newPages }));
                    }}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-all ${
                      (formData.display_pages || []).includes(page.value)
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <Checkbox
                      checked={(formData.display_pages || []).includes(page.value)}
                      className="border-slate-500"
                    />
                    <span className="text-sm">{page.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)} 
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              className="bg-yellow-600 hover:bg-yellow-700"
              data-testid="submit-testimonial-btn"
            >
              {editingId ? 'Update' : 'Create'} Testimonial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-400" />
              Import Testimonials from Excel
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="hidden"
              />
              {importFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-green-400" />
                  <div className="text-left">
                    <p className="text-white font-medium">{importFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImportFile(null)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-slate-600 text-slate-300"
                  >
                    Select File
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    Supports .xlsx, .xls, .csv
                  </p>
                </>
              )}
            </div>

            <Accordion type="single" collapsible className="border border-slate-700 rounded-lg">
              <AccordionItem value="columns" className="border-none">
                <AccordionTrigger className="px-4 py-2 text-sm text-slate-400 hover:no-underline">
                  Expected Column Names
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><span className="text-slate-300">testimonioesp</span> - Testimonial text</p>
                    <p><span className="text-slate-300">nombre, apellido</span> - Name</p>
                    <p><span className="text-slate-300">correo</span> - Email</p>
                    <p><span className="text-slate-300">formato, enfoque, industria, programa, nivel</span> - Classification</p>
                    <p><span className="text-slate-300">publicar_a_partir_de</span> - Publish date</p>
                    <p><span className="text-slate-300">videotestimonio_en_vimeo</span> - Vimeo URL</p>
                    <p><span className="text-slate-300">videotestimonio_en_descript</span> - Descript URL</p>
                    <p><span className="text-slate-300">presentación_, articulación_, calidad_de_video_, resultados_</span> - Ratings (1-5)</p>
                    <p><span className="text-slate-300">valor_agregado</span> - true/false/si/no</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setImportDialogOpen(false);
                setImportFile(null);
              }} 
              className="border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!importFile || importing}
              className="bg-green-600 hover:bg-green-700"
              data-testid="import-submit-btn"
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestimonialsPage;
