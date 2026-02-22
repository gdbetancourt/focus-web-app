import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Search, Upload, Download, Trash2, FileText, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import api from '../lib/api';

const BOOKLET_TYPES = [
  { value: 'booklet', label: 'Booklet', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'case_study', label: 'Case Study', color: 'bg-green-500/20 text-green-400' },
  { value: 'whitepaper', label: 'Whitepaper', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'brochure', label: 'Brochure', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'catalog', label: 'Catalog', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'other', label: 'Other', color: 'bg-slate-500/20 text-slate-400' }
];

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function BookletsCases() {
  const [booklets, setBooklets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('_all');
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    booklet_type: 'booklet',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadBooklets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterType !== '_all') params.booklet_type = filterType;
      if (search) params.search = search;
      
      const res = await api.get('/booklets', { params });
      setBooklets(res.data.booklets || []);
    } catch (error) {
      console.error('Error loading booklets:', error);
      toast.error('Error loading booklets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooklets();
  }, [filterType, search]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Only PDF files are allowed');
        return;
      }
      setSelectedFile(file);
      if (!formData.name) {
        setFormData(prev => ({ ...prev, name: file.name.replace('.pdf', '').replace('.PDF', '') }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a PDF file');
      return;
    }
    if (!formData.name) {
      toast.error('Please enter a name');
      return;
    }

    setUploading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', selectedFile);
      formDataObj.append('name', formData.name);
      formDataObj.append('booklet_type', formData.booklet_type);
      formDataObj.append('description', formData.description);

      await api.post('/booklets/upload', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Booklet uploaded');
      setUploadDialog(false);
      resetForm();
      loadBooklets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error uploading booklet');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (booklet) => {
    try {
      const res = await api.get(`/booklets/${booklet.id}/download`);
      const { file_content, original_filename } = res.data;
      
      const byteCharacters = atob(file_content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Error downloading booklet');
    }
  };

  const handlePreview = async (booklet) => {
    try {
      const res = await api.get(`/booklets/${booklet.id}/download`);
      const { file_content } = res.data;
      
      const byteCharacters = atob(file_content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      toast.error('Error loading preview');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this booklet?')) return;
    try {
      await api.delete(`/booklets/${id}`);
      toast.success('Booklet deleted');
      loadBooklets();
    } catch (error) {
      toast.error('Error deleting booklet');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', booklet_type: 'booklet', description: '' });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const stats = BOOKLET_TYPES.map(t => ({
    ...t,
    count: booklets.filter(b => b.booklet_type === t.value).length
  }));

  return (
    <div className="space-y-6" data-testid="booklets-cases-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
            <BookOpen className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Booklets & Cases</h1>
            <p className="text-slate-500">Marketing materials and case studies library</p>
          </div>
        </div>
        <Button onClick={() => setUploadDialog(true)} data-testid="upload-booklet-btn">
          <Upload className="w-4 h-4 mr-2" />
          Upload PDF
        </Button>
      </div>

      {/* Type Stats */}
      <div className="flex gap-3 flex-wrap">
        <Card 
          className={`stat-card cursor-pointer transition-all ${filterType === '_all' ? 'border-green-500' : ''}`}
          onClick={() => setFilterType('_all')}
        >
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-white">{booklets.length}</div>
            <div className="text-xs text-slate-400">All</div>
          </CardContent>
        </Card>
        {stats.filter(s => s.count > 0).map(t => (
          <Card 
            key={t.value}
            className={`stat-card cursor-pointer transition-all ${filterType === t.value ? 'border-green-500' : ''}`}
            onClick={() => setFilterType(t.value)}
          >
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-white">{t.count}</div>
              <div className="text-xs text-slate-400">{t.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search booklets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Booklets Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : booklets.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-2">No Booklets Yet</h3>
            <p className="text-slate-400 mb-4">Upload your first booklet or case study</p>
            <Button onClick={() => setUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {booklets.map(booklet => {
            const typeInfo = BOOKLET_TYPES.find(t => t.value === booklet.booklet_type) || BOOKLET_TYPES[5];
            
            return (
              <Card key={booklet.id} className="stat-card hover:border-green-500/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{booklet.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                        <span className="text-xs text-slate-500">{formatFileSize(booklet.file_size)}</span>
                      </div>
                      {booklet.description && (
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{booklet.description}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePreview(booklet)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDownload(booklet)}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(booklet.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Booklet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>PDF File *</Label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf"
                className="mt-2 block w-full text-sm text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-green-500 file:text-white
                  hover:file:bg-green-600
                  file:cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-slate-500 mt-1">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Booklet name"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select 
                value={formData.booklet_type} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, booklet_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKLET_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe 
              src={previewUrl} 
              className="w-full h-full rounded-lg"
              title="PDF Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
