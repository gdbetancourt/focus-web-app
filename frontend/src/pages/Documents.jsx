import React, { useState, useEffect, useRef } from 'react';
import { FileText, Search, Upload, Download, Trash2, FolderOpen, File, FileSpreadsheet, FileImage, Presentation } from 'lucide-react';
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

const CATEGORIES = [
  { value: 'contracts', label: 'Contracts', icon: FileText, color: 'text-blue-400 bg-blue-500/20' },
  { value: 'proposals', label: 'Proposals', icon: File, color: 'text-green-400 bg-green-500/20' },
  { value: 'invoices', label: 'Invoices', icon: FileSpreadsheet, color: 'text-yellow-400 bg-yellow-500/20' },
  { value: 'presentations', label: 'Presentations', icon: Presentation, color: 'text-purple-400 bg-purple-500/20' },
  { value: 'reports', label: 'Reports', icon: FileText, color: 'text-orange-400 bg-orange-500/20' },
  { value: 'other', label: 'Other', icon: FolderOpen, color: 'text-slate-400 bg-slate-500/20' }
];

const getFileIcon = (ext) => {
  if (['.pdf'].includes(ext)) return FileText;
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return FileSpreadsheet;
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return FileImage;
  if (['.ppt', '.pptx'].includes(ext)) return Presentation;
  return File;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('_all');
  const [categoryCounts, setCategoryCounts] = useState({});
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCategory !== '_all') params.category = filterCategory;
      if (search) params.search = search;
      
      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
      setCategoryCounts(res.data.category_counts || {});
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [filterCategory, search]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.name) {
        setFormData(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
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
      formDataObj.append('category', formData.category);
      formDataObj.append('description', formData.description);

      await api.post('/documents/upload', formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Document uploaded');
      setUploadDialog(false);
      resetForm();
      loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error uploading document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`);
      const { file_content, original_filename, file_type } = res.data;
      
      // Decode base64 and create blob
      const byteCharacters = atob(file_content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: file_type });
      
      // Download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Error downloading document');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success('Document deleted');
      loadDocuments();
    } catch (error) {
      toast.error('Error deleting document');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: 'other', description: '' });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalDocs = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6" data-testid="documents-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <FolderOpen className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Documents Library</h1>
            <p className="text-slate-500">Store and organize your business documents</p>
          </div>
        </div>
        <Button onClick={() => setUploadDialog(true)} data-testid="upload-doc-btn">
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-7 gap-3">
        <Card 
          className={`stat-card cursor-pointer transition-all ${filterCategory === '_all' ? 'border-blue-500' : ''}`}
          onClick={() => setFilterCategory('_all')}
        >
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-white">{totalDocs}</div>
            <div className="text-xs text-slate-400">All</div>
          </CardContent>
        </Card>
        {CATEGORIES.map(cat => (
          <Card 
            key={cat.value}
            className={`stat-card cursor-pointer transition-all ${filterCategory === cat.value ? 'border-blue-500' : ''}`}
            onClick={() => setFilterCategory(cat.value)}
          >
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-white">{categoryCounts[cat.value] || 0}</div>
              <div className="text-xs text-slate-400">{cat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : documents.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-medium text-white mb-2">No Documents</h3>
            <p className="text-slate-400 mb-4">Upload your first document to get started</p>
            <Button onClick={() => setUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {documents.map(doc => {
            const FileIcon = getFileIcon(doc.file_extension);
            const category = CATEGORIES.find(c => c.value === doc.category) || CATEGORIES[5];
            
            return (
              <Card key={doc.id} className="stat-card hover:border-blue-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${category.color}`}>
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{doc.name}</div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <span>{doc.original_filename}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.file_size)}</span>
                          <Badge className={category.color}>{category.label}</Badge>
                        </div>
                        {doc.description && (
                          <p className="text-sm text-slate-500 mt-1">{doc.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>File *</Label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="mt-2 block w-full text-sm text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-500 file:text-white
                  hover:file:bg-blue-600
                  file:cursor-pointer"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"
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
                placeholder="Document name"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description..."
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
    </div>
  );
}
