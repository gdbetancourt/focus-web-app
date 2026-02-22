import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Edit, Trash2, Eye, EyeOff, Search, Filter,
  Tag, Calendar, Clock, RefreshCw, Save, X, FolderOpen, ExternalLink, Download
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
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
import { toast } from 'sonner';
import api from '../lib/api';
import html2pdf from 'html2pdf.js';

const NONE_VALUE = "_none";

const BlogPage = () => {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0 });
  
  // Dialogs
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  
  // Search/Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Post form
  const [postForm, setPostForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featured_image: '',
    category_id: '',
    category_name: '',
    eje_tematico: '',
    competencia: '',
    nivel: '',
    author_name: '',
    is_published: false,
    publish_date: ''
  });
  
  // Dropdown options for tags
  const EJES_TEMATICOS = [
    'Comunicación de la Ciencia',
    'Liderazgo',
    'Productividad',
    'Storytelling',
    'Ventas'
  ];
  
  const COMPETENCIAS = [
    'Comunicación Efectiva',
    'Pensamiento Crítico',
    'Trabajo en Equipo',
    'Resolución de Problemas',
    'Creatividad e Innovación'
  ];
  
  const NIVELES = [
    'Básico',
    'Intermedio',
    'Avanzado'
  ];
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadData();
  }, [filterCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.append('category_id', filterCategory);
      
      const [postsRes, catsRes] = await Promise.all([
        api.get(`/blog/posts?${params.toString()}`),
        api.get('/blog/categories')
      ]);
      
      setPosts(postsRes.data.posts || []);
      setStats(postsRes.data.stats || { total: 0, published: 0, drafts: 0 });
      setCategories(catsRes.data.categories || []);
    } catch (error) {
      console.error('Error loading blog data:', error);
      toast.error('Error loading blog data');
    } finally {
      setLoading(false);
    }
  };

  // Post CRUD
  const openPostDialog = (post = null) => {
    if (post) {
      setEditingPost(post);
      // Parse tags into eje_tematico, competencia, nivel
      const postTags = post.tags || [];
      const ejeMatch = EJES_TEMATICOS.find(e => postTags.includes(e)) || '';
      const compMatch = COMPETENCIAS.find(c => postTags.includes(c)) || '';
      const nivelMatch = NIVELES.find(n => postTags.includes(n)) || '';
      
      setPostForm({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        featured_image: post.featured_image || '',
        category_id: post.category_id || '',
        category_name: post.category_name || '',
        eje_tematico: ejeMatch,
        competencia: compMatch,
        nivel: nivelMatch,
        author_name: post.author_name || '',
        is_published: post.is_published || false,
        publish_date: post.publish_date ? post.publish_date.split('T')[0] : ''
      });
    } else {
      setEditingPost(null);
      setPostForm({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        featured_image: '',
        category_id: '',
        category_name: '',
        eje_tematico: '',
        competencia: '',
        nivel: '',
        author_name: '',
        is_published: false,
        publish_date: ''
      });
    }
    setPostDialogOpen(true);
  };

  const handleCategorySelect = (value) => {
    const actualValue = value === NONE_VALUE ? '' : value;
    const cat = categories.find(c => c.id === actualValue);
    setPostForm(prev => ({
      ...prev,
      category_id: actualValue,
      category_name: cat?.name || ''
    }));
  };

  const exportToPDF = async (post) => {
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1 style="font-size: 28px; color: #1a1a1a; margin-bottom: 10px;">${post.title}</h1>
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
          ${post.category_name ? `Categoría: ${post.category_name} | ` : ''}
          ${new Date(post.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        ${post.featured_image ? `<img src="${post.featured_image}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 8px; margin-bottom: 20px;" />` : ''}
        <div style="font-size: 16px; line-height: 1.8; color: #333;">
          ${post.content.replace(/\n/g, '<br/>')}
        </div>
        ${post.tags?.length > 0 ? `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <span style="color: #666;">Tags: </span>
            ${post.tags.map(t => `<span style="background: #f0f0f0; padding: 4px 12px; border-radius: 16px; margin-right: 8px; font-size: 12px;">${t}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = content;
    document.body.appendChild(element);

    const opt = {
      margin: 0.5,
      filename: `${post.slug || 'blogpost'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      toast.success('PDF descargado');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Error exportando PDF');
    } finally {
      document.body.removeChild(element);
    }
  };

  const savePost = async () => {
    if (!postForm.title.trim() || !postForm.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    
    // Build tags array from dropdowns
    const tags = [postForm.eje_tematico, postForm.competencia, postForm.nivel].filter(Boolean);
    
    const payload = {
      title: postForm.title,
      slug: postForm.slug,
      excerpt: postForm.excerpt,
      content: postForm.content,
      featured_image: postForm.featured_image,
      category_id: postForm.category_id,
      category_name: postForm.category_name,
      tags: tags,
      author_name: postForm.author_name,
      is_published: postForm.is_published,
      publish_date: postForm.publish_date
    };
    
    try {
      if (editingPost) {
        await api.put(`/blog/posts/${editingPost.id}`, payload);
        toast.success('Post updated');
      } else {
        await api.post('/blog/posts', payload);
        toast.success('Post created');
      }
      setPostDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving post');
    }
  };

  const deletePost = async (id) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/blog/posts/${id}`);
      toast.success('Post deleted');
      loadData();
    } catch (error) {
      toast.error('Error deleting post');
    }
  };

  const togglePublish = async (post) => {
    try {
      await api.put(`/blog/posts/${post.id}`, { is_published: !post.is_published });
      toast.success(post.is_published ? 'Post unpublished' : 'Post published');
      loadData();
    } catch (error) {
      toast.error('Error updating post');
    }
  };

  // Category CRUD
  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      await api.post('/blog/categories', categoryForm);
      toast.success('Category created');
      setCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating category');
    }
  };

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/blog/categories/${id}`);
      toast.success('Category deleted');
      loadData();
    } catch (error) {
      toast.error('Error deleting category');
    }
  };

  // Filter posts by search
  const filteredPosts = posts.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.excerpt?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="blog-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/20">
            <FileText className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Blog Management</h1>
            <p className="text-slate-500">Create and manage blog posts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setCategoryDialogOpen(true)}
            className="border-[#333] text-slate-300"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button 
            onClick={() => openPostDialog()} 
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="new-post-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-slate-500">Total Posts</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">{stats.published}</p>
            <p className="text-xs text-slate-500">Published</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-yellow-400">{stats.drafts}</p>
            <p className="text-xs text-slate-500">Drafts</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search posts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <Select value={filterCategory || NONE_VALUE} onValueChange={(v) => setFilterCategory(v === NONE_VALUE ? '' : v)}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-600">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>All categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posts List */}
      <div className="space-y-3">
        {filteredPosts.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-semibold text-white mb-2">No Posts Yet</h3>
              <p className="text-slate-500 mb-4">Create your first blog post</p>
              <Button onClick={() => openPostDialog()} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map(post => (
            <Card key={post.id} className="bg-[#111] border-[#222] hover:border-purple-500/30" data-testid={`post-${post.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {post.featured_image ? (
                    <img src={post.featured_image} alt="" className="w-24 h-16 rounded object-cover" />
                  ) : (
                    <div className="w-24 h-16 rounded bg-slate-800 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{post.title}</h3>
                      {post.is_published ? (
                        <Badge className="bg-green-500/20 text-green-400">Published</Badge>
                      ) : (
                        <Badge className="bg-yellow-500/20 text-yellow-400">Draft</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-400 line-clamp-1 mb-2">{post.excerpt}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {post.category_name && (
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />
                          {post.category_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.reading_time_minutes || 1} min read
                      </span>
                      {post.views > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {post.views} views
                        </span>
                      )}
                    </div>
                    
                    {post.tags?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {post.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} className="bg-slate-700 text-slate-300 text-xs">{tag}</Badge>
                        ))}
                        {post.tags.length > 3 && (
                          <Badge className="bg-slate-700 text-slate-400 text-xs">+{post.tags.length - 3}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-1">
                    {post.is_published && post.slug && (
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-purple-400 p-2"
                        title="View public post"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePublish(post)}
                      className="text-slate-400 hover:text-white"
                      title={post.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {post.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPostDialog(post)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportToPDF(post)}
                      className="text-blue-400 hover:text-blue-300"
                      data-testid="export-pdf-btn"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePost(post.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Post Dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Post' : 'New Post'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-400">Title *</Label>
              <Input
                value={postForm.title}
                onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Post title"
                data-testid="post-title-input"
              />
            </div>
            
            <div>
              <Label className="text-slate-400">Slug (URL)</Label>
              <Input
                value={postForm.slug}
                onChange={(e) => setPostForm(prev => ({ ...prev, slug: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="auto-generated-from-title"
              />
            </div>
            
            <div>
              <Label className="text-slate-400">Excerpt</Label>
              <Textarea
                value={postForm.excerpt}
                onChange={(e) => setPostForm(prev => ({ ...prev, excerpt: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Brief summary (auto-generated if empty)"
                rows={2}
              />
            </div>
            
            <div>
              <Label className="text-slate-400">Content *</Label>
              <Textarea
                value={postForm.content}
                onChange={(e) => setPostForm(prev => ({ ...prev, content: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white min-h-[200px]"
                placeholder="Write your post content here..."
                data-testid="post-content-input"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">Category</Label>
                <Select value={postForm.category_id || NONE_VALUE} onValueChange={handleCategorySelect}>
                  <SelectTrigger className="bg-slate-800 border-slate-600">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Author</Label>
                <Input
                  value={postForm.author_name}
                  onChange={(e) => setPostForm(prev => ({ ...prev, author_name: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="Author name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-400">Eje Temático</Label>
                <Select
                  value={postForm.eje_tematico || NONE_VALUE}
                  onValueChange={(value) => setPostForm(prev => ({ ...prev, eje_tematico: value === NONE_VALUE ? '' : value }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sin seleccionar</SelectItem>
                    {EJES_TEMATICOS.map(eje => (
                      <SelectItem key={eje} value={eje}>{eje}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Competencia</Label>
                <Select
                  value={postForm.competencia || NONE_VALUE}
                  onValueChange={(value) => setPostForm(prev => ({ ...prev, competencia: value === NONE_VALUE ? '' : value }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sin seleccionar</SelectItem>
                    {COMPETENCIAS.map(comp => (
                      <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-400">Nivel</Label>
                <Select
                  value={postForm.nivel || NONE_VALUE}
                  onValueChange={(value) => setPostForm(prev => ({ ...prev, nivel: value === NONE_VALUE ? '' : value }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sin seleccionar</SelectItem>
                    {NIVELES.map(nivel => (
                      <SelectItem key={nivel} value={nivel}>{nivel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label className="text-slate-400">Featured Image URL</Label>
              <Input
                value={postForm.featured_image}
                onChange={(e) => setPostForm(prev => ({ ...prev, featured_image: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="https://..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">Publish Date</Label>
                <Input
                  type="date"
                  value={postForm.publish_date}
                  onChange={(e) => setPostForm(prev => ({ ...prev, publish_date: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_published"
                    checked={postForm.is_published}
                    onCheckedChange={(checked) => setPostForm(prev => ({ ...prev, is_published: checked }))}
                  />
                  <Label htmlFor="is_published" className="text-slate-300 cursor-pointer">
                    Publish immediately
                  </Label>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialogOpen(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={savePost} className="bg-purple-600 hover:bg-purple-700" data-testid="save-post-btn">
              <Save className="w-4 h-4 mr-2" />
              {editingPost ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Existing categories */}
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-400">Existing Categories</Label>
                <div className="space-y-1">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                      <span className="text-white">{cat.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCategory(cat.id)}
                        className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* New category form */}
            <div className="pt-4 border-t border-slate-700">
              <Label className="text-slate-400">Add New Category</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="Category name"
                />
                <Button onClick={saveCategory} className="bg-purple-600 hover:bg-purple-700">
                  Add
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} className="border-slate-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogPage;
