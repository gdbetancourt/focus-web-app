import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  FileText, Clock, User, Tag, Calendar, ChevronLeft, 
  ArrowRight, Search, Eye, BookOpen, TrendingUp, Sparkles
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import api from '../lib/api';
import { usePublicLanguage } from '../components/PublicLayout';
import ReactMarkdown from 'react-markdown';

// Component to render blog content with slide images interspersed
const BlogContentWithImages = ({ content, slideImages = [] }) => {
  // Split content by H2 headings to insert images between sections
  const sections = content.split(/(?=^## )/gm);
  
  return (
    <article 
      className="prose prose-invert prose-lg max-w-none
        prose-headings:text-white prose-headings:font-bold
        prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-6 prose-h1:text-[#ff3300]
        prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-[#ff3300]
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
        prose-a:text-[#ff3300] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white
        prose-blockquote:border-l-[#ff3300] prose-blockquote:bg-[#111] prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-300
        prose-ul:text-slate-300 prose-li:text-slate-300 prose-ul:my-4
        prose-ol:text-slate-300 prose-ol:my-4
        prose-code:text-[#ff3300] prose-code:bg-[#111] prose-code:px-2 prose-code:py-1 prose-code:rounded
        prose-hr:border-[#333] prose-hr:my-8
      "
    >
      {sections.map((section, idx) => (
        <div key={idx}>
          <ReactMarkdown>{section}</ReactMarkdown>
          
          {/* Insert slide image after each section (if available) */}
          {slideImages[idx] && (
            <figure className="my-8 not-prose">
              <img 
                src={slideImages[idx]} 
                alt={`Slide ${idx + 1}`}
                className="w-full rounded-lg shadow-xl border border-[#222]"
                loading="lazy"
              />
              <figcaption className="text-center text-sm text-slate-500 mt-2">
                Slide {idx + 1}
              </figcaption>
            </figure>
          )}
        </div>
      ))}
      
      {/* Show remaining images at the end if there are more images than sections */}
      {slideImages.length > sections.length && (
        <div className="mt-12 pt-8 border-t border-[#222]">
          <h3 className="text-xl font-bold text-white mb-6">Presentación completa</h3>
          <div className="grid grid-cols-2 gap-4">
            {slideImages.slice(sections.length).map((img, idx) => (
              <figure key={idx} className="not-prose">
                <img 
                  src={img} 
                  alt={`Slide ${sections.length + idx + 1}`}
                  className="w-full rounded-lg shadow-lg border border-[#222]"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

// Blog List Component - Redesigned
export const BlogList = () => {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [filters, setFilters] = useState({ programs: [], competencies: [], levels: [] });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [activeProgram, setActiveProgram] = useState('');
  const [activeCompetency, setActiveCompetency] = useState('');
  const [activeLevel, setActiveLevel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get language from context
  const { lang } = usePublicLanguage();

  // Parse URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setActiveProgram(params.get('program') || '');
    setActiveCompetency(params.get('competency') || '');
    setActiveLevel(params.get('level') || '');
    setActiveTag(params.get('tag') || '');
    setActiveCategory(params.get('category') || '');
  }, [location.search]);

  useEffect(() => {
    loadPosts();
  }, [activeCategory, activeTag, activeProgram, activeCompetency, activeLevel, lang]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.append('category', activeCategory);
      if (activeTag) params.append('tag', activeTag);
      if (activeProgram) params.append('program', activeProgram);
      if (activeCompetency) params.append('competency', activeCompetency);
      if (activeLevel) params.append('level', activeLevel);
      params.append('lang', lang || 'es');  // Pass language to API
      
      const res = await api.get(`/blog/public/posts?${params.toString()}`);
      setPosts(res.data.posts || []);
      setCategories(res.data.categories || []);
      setTags(res.data.tags || []);
      setFilters(res.data.filters || { programs: [], competencies: [], levels: [] });
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setActiveCategory('');
    setActiveTag('');
    setActiveProgram('');
    setActiveCompetency('');
    setActiveLevel('');
    navigate('/blog');
  };

  const hasActiveFilters = activeCategory || activeTag || activeProgram || activeCompetency || activeLevel;

  const filteredPosts = posts.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.excerpt?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const featuredPost = filteredPosts[0];
  const otherPosts = filteredPosts.slice(1);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-[#ff3300] border-t-transparent rounded-full" />
          <p className="text-slate-500">Cargando artículos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]" data-testid="blog-list">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#ff3300]/10 via-transparent to-purple-500/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#ff3300]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#ff3300]" />
            <span className="text-[#ff3300] text-sm font-medium tracking-wider uppercase">Leaderlix Blog</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#ff3300]" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-center mb-6">
            <span className="text-white">Ideas que </span>
            <span className="bg-gradient-to-r from-[#ff3300] to-orange-400 bg-clip-text text-transparent">Transforman</span>
          </h1>
          
          <p className="text-slate-400 text-lg md:text-xl text-center max-w-2xl mx-auto mb-10">
            Insights sobre comunicación, liderazgo y storytelling para impulsar tu carrera profesional
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              placeholder="Buscar artículos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 py-6 bg-[#111] border-[#333] text-white rounded-full text-base focus:border-[#ff3300] transition-colors"
              data-testid="blog-search"
            />
          </div>

          {/* Classification Filters */}
          {(filters.programs.length > 0 || filters.competencies.length > 0 || filters.levels.length > 0) && (
            <div className="mt-8 space-y-4">
              {/* Active Filters Banner */}
              {hasActiveFilters && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-500">Filtros activos:</span>
                  {activeProgram && (
                    <span className="text-sm text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30 flex items-center gap-1">
                      {activeProgram}
                      <button onClick={() => { setActiveProgram(''); navigate('/blog'); }} className="ml-1 hover:text-white">×</button>
                    </span>
                  )}
                  {activeCompetency && (
                    <span className="text-sm text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                      {activeCompetency}
                      <button onClick={() => { setActiveCompetency(''); navigate('/blog'); }} className="ml-1 hover:text-white">×</button>
                    </span>
                  )}
                  {activeLevel && (
                    <span className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      {activeLevel}
                      <button onClick={() => { setActiveLevel(''); navigate('/blog'); }} className="ml-1 hover:text-white">×</button>
                    </span>
                  )}
                  {activeTag && (
                    <span className="text-sm text-slate-400 bg-slate-500/10 px-3 py-1 rounded-full border border-slate-500/30 flex items-center gap-1">
                      #{activeTag}
                      <button onClick={() => { setActiveTag(''); navigate('/blog'); }} className="ml-1 hover:text-white">×</button>
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Limpiar todos
                  </Button>
                </div>
              )}

              {/* Filter Dropdowns */}
              <div className="flex flex-wrap justify-center gap-3">
                {filters.programs.length > 0 && (
                  <select
                    value={activeProgram}
                    onChange={(e) => setActiveProgram(e.target.value)}
                    className="bg-[#111] border border-[#333] text-slate-300 rounded-full px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Todos los programas</option>
                    {filters.programs.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
                {filters.competencies.length > 0 && (
                  <select
                    value={activeCompetency}
                    onChange={(e) => setActiveCompetency(e.target.value)}
                    className="bg-[#111] border border-[#333] text-slate-300 rounded-full px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Todas las competencias</option>
                    {filters.competencies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
                {filters.levels.length > 0 && (
                  <select
                    value={activeLevel}
                    onChange={(e) => setActiveLevel(e.target.value)}
                    className="bg-[#111] border border-[#333] text-slate-300 rounded-full px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Todos los niveles</option>
                    {filters.levels.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Categories Pills */}
          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              <Button
                variant={activeCategory === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory('')}
                className={`rounded-full ${activeCategory === '' ? 'bg-[#ff3300] hover:bg-[#ff3300]/90' : 'border-[#333] text-slate-400 hover:border-[#ff3300] hover:text-[#ff3300]'}`}
              >
                Todos
              </Button>
              {categories.map(cat => (
                <Button
                  key={typeof cat === 'object' ? cat.id || cat.name : cat}
                  variant={activeCategory === (typeof cat === 'object' ? cat.slug || cat.name : cat) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(typeof cat === 'object' ? cat.slug || cat.name : cat)}
                  className={`rounded-full ${activeCategory === (typeof cat === 'object' ? cat.slug || cat.name : cat) ? 'bg-[#ff3300] hover:bg-[#ff3300]/90' : 'border-[#333] text-slate-400 hover:border-[#ff3300] hover:text-[#ff3300]'}`}
                >
                  {typeof cat === 'object' ? cat.name : cat}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        {filteredPosts.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#ff3300]/10 flex items-center justify-center">
                <FileText className="w-10 h-10 text-[#ff3300]/50" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">No se encontraron artículos</h3>
              <p className="text-slate-500 mb-6">
                {hasActiveFilters || searchTerm ? 'Intenta con otros filtros' : '¡Pronto publicaremos nuevo contenido!'}
              </p>
              {(hasActiveFilters || searchTerm) && (
                <Button 
                  variant="outline" 
                  onClick={() => { clearFilters(); setSearchTerm(''); }}
                  className="border-[#ff3300] text-[#ff3300] hover:bg-[#ff3300]/10"
                >
                  Limpiar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Featured Post */}
            {featuredPost && (
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-[#ff3300]" />
                  <span className="text-[#ff3300] font-medium">Artículo Destacado</span>
                </div>
                
                <Card 
                  className="bg-[#111] border-[#222] overflow-hidden group cursor-pointer hover:border-[#ff3300]/50 transition-all duration-300"
                  onClick={() => navigate(`/blog/${featuredPost.slug}`)}
                  data-testid="featured-post"
                >
                  <div className="grid md:grid-cols-2 gap-0">
                    {/* Image */}
                    <div className="relative h-64 md:h-auto overflow-hidden">
                      {featuredPost.featured_image ? (
                        <img 
                          src={featuredPost.featured_image} 
                          alt={featuredPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#ff3300]/20 to-purple-500/20 flex items-center justify-center">
                          <BookOpen className="w-16 h-16 text-[#ff3300]/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent md:bg-gradient-to-r" />
                    </div>

                    {/* Content */}
                    <div className="p-8 md:p-10 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-4">
                        {featuredPost.category && (
                          <Badge className="bg-[#ff3300]/20 text-[#ff3300] hover:bg-[#ff3300]/30">
                            {featuredPost.category}
                          </Badge>
                        )}
                        <span className="text-slate-500 text-sm flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {featuredPost.reading_time || 5} min lectura
                        </span>
                      </div>
                      
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 group-hover:text-[#ff3300] transition-colors">
                        {featuredPost.title}
                      </h2>
                      
                      <p className="text-slate-400 mb-6 line-clamp-3">
                        {featuredPost.excerpt}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff3300] to-orange-400 flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{featuredPost.author || 'Leaderlix'}</p>
                            <p className="text-slate-500 text-xs">{formatDate(featuredPost.published_at || featuredPost.created_at)}</p>
                          </div>
                        </div>
                        
                        <Button variant="ghost" className="text-[#ff3300] hover:bg-[#ff3300]/10 group/btn">
                          Leer más
                          <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Other Posts Grid */}
            {otherPosts.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-400 font-medium">Más Artículos</span>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherPosts.map((post) => (
                    <Card 
                      key={post.id} 
                      className="bg-[#111] border-[#222] overflow-hidden group cursor-pointer hover:border-[#ff3300]/50 transition-all duration-300"
                      onClick={() => navigate(`/blog/${post.slug}`)}
                      data-testid={`post-${post.slug}`}
                    >
                      {/* Image */}
                      <div className="relative h-48 overflow-hidden">
                        {post.featured_image ? (
                          <img 
                            src={post.featured_image} 
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#ff3300]/10 to-purple-500/10 flex items-center justify-center">
                            <BookOpen className="w-12 h-12 text-[#ff3300]/20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
                        
                        {/* Category Badge on Image */}
                        {post.category && (
                          <Badge className="absolute top-4 left-4 bg-[#111]/80 backdrop-blur-sm text-white border-0">
                            {post.category}
                          </Badge>
                        )}
                      </div>

                      {/* Content */}
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.published_at || post.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.reading_time || 5} min
                          </span>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-[#ff3300] transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        
                        <p className="text-slate-500 text-sm line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.tags.slice(0, 2).map((tag, idx) => (
                              <span key={idx} className="text-xs text-slate-600 bg-[#1a1a1a] px-2 py-1 rounded">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Popular Tags Section */}
        {tags.length > 0 && (
          <div className="mt-16 pt-12 border-t border-[#222]">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#ff3300]" />
              Temas Populares
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                  className={`px-4 py-2 rounded-full text-sm transition-all ${
                    activeTag === tag 
                      ? 'bg-[#ff3300] text-white' 
                      : 'bg-[#111] border border-[#333] text-slate-400 hover:border-[#ff3300] hover:text-[#ff3300]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Newsletter CTA */}
      <div className="bg-gradient-to-r from-[#ff3300]/10 via-[#111] to-purple-500/10 border-t border-[#222]">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            ¿Te gustaría recibir más contenido como este?
          </h3>
          <p className="text-slate-400 mb-8">
            Suscríbete a nuestro newsletter y recibe insights semanales sobre liderazgo y comunicación
          </p>
          <Link to="/nurture/newsletters">
            <Button className="bg-[#ff3300] hover:bg-[#ff3300]/90 text-white px-8 py-6 text-lg rounded-full">
              Suscríbete al Newsletter
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

// Blog Post Detail Component - Redesigned
export const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Get language from context
  const { lang } = usePublicLanguage();

  useEffect(() => {
    loadPost();
  }, [slug]);
  
  // When language changes, try to load the equivalent post in the other language
  useEffect(() => {
    if (!post || !post.content_item_id) return;
    
    // Check if current post language matches selected language
    const postLang = post.language || (slug.includes('-es-') ? 'es' : slug.includes('-en-') ? 'en' : 'es');
    
    if (postLang !== lang) {
      // Try to find equivalent post in other language
      loadEquivalentPost(post.content_item_id, lang);
    }
  }, [lang, post?.content_item_id]);
  
  const loadEquivalentPost = async (contentItemId, targetLang) => {
    try {
      // Fetch all posts for this content item and find the one in target language
      const res = await api.get(`/blog/public/posts?lang=${targetLang}&limit=50`);
      const posts = res.data.posts || [];
      const equivalentPost = posts.find(p => p.content_item_id === contentItemId);
      
      if (equivalentPost && equivalentPost.slug !== slug) {
        navigate(`/blog/${equivalentPost.slug}`, { replace: true });
      }
    } catch (error) {
      console.error('Error loading equivalent post:', error);
    }
  };

  const loadPost = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/blog/public/posts/${slug}`);
      setPost(res.data.post);
      setRelatedPosts(res.data.related || []);
    } catch (error) {
      console.error('Error loading post:', error);
      navigate('/blog');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#ff3300] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Artículo no encontrado</h2>
          <Button onClick={() => navigate('/blog')} className="bg-[#ff3300]">
            Volver al Blog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]" data-testid="blog-post">
      {/* Hero Image */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        {post.featured_image ? (
          <img 
            src={post.featured_image} 
            alt={post.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#ff3300]/20 to-purple-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
        
        {/* Back Button */}
        <div className="absolute top-6 left-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/blog')}
            className="bg-[#111]/80 backdrop-blur-sm text-white hover:bg-[#111] border border-[#333]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Volver al Blog
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 -mt-32 relative z-10">
        {/* Meta Info */}
        <div className="flex items-center gap-4 mb-6">
          {post.category && (
            <Badge className="bg-[#ff3300] text-white">
              {post.category}
            </Badge>
          )}
          <span className="text-slate-400 text-sm flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {post.reading_time || 5} min lectura
          </span>
          <span className="text-slate-400 text-sm flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {post.views || 0} vistas
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
          {post.title}
        </h1>

        {/* Author & Date */}
        <div className="flex items-center gap-4 mb-10 pb-10 border-b border-[#222]">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#ff3300] to-orange-400 flex items-center justify-center">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-white font-medium">{post.author || 'Leaderlix'}</p>
            <p className="text-slate-500 text-sm">{formatDate(post.published_at || post.created_at)}</p>
          </div>
        </div>

        {/* Article Content - Rendered with ReactMarkdown and slide images */}
        <BlogContentWithImages content={post.content} slideImages={post.slide_images || []} />

        {/* Classification Tags (Program, Competency, Level) */}
        {(post.program_tag || post.competency_tag || post.level_tag) && (
          <div className="mt-12 pt-8 border-t border-[#222]">
            <div className="flex flex-wrap gap-4">
              {post.program_tag && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 uppercase">Programa:</span>
                  <Link 
                    to={`/blog?program=${encodeURIComponent(post.program_tag)}`}
                    className="text-sm text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded-full transition-colors border border-blue-500/30"
                  >
                    {post.program_tag}
                  </Link>
                </div>
              )}
              {post.competency_tag && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 uppercase">Competencia:</span>
                  <Link 
                    to={`/blog?competency=${encodeURIComponent(post.competency_tag)}`}
                    className="text-sm text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1 rounded-full transition-colors border border-amber-500/30"
                  >
                    {post.competency_tag}
                  </Link>
                </div>
              )}
              {post.level_tag && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 uppercase">Nivel:</span>
                  <Link 
                    to={`/blog?level=${encodeURIComponent(post.level_tag)}`}
                    className="text-sm text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-full transition-colors border border-emerald-500/30"
                  >
                    {post.level_tag}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-8 pt-8 border-t border-[#222]">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-slate-500" />
              {post.tags.map((tag, idx) => (
                <Link 
                  key={idx} 
                  to={`/blog?tag=${tag}`}
                  className="text-sm text-slate-400 bg-[#111] hover:bg-[#222] px-3 py-1 rounded-full transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 pt-12 border-t border-[#222]">
            <h3 className="text-xl font-bold text-white mb-8">Artículos Relacionados</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {relatedPosts.slice(0, 2).map((related) => (
                <Card 
                  key={related.id}
                  className="bg-[#111] border-[#222] overflow-hidden cursor-pointer hover:border-[#ff3300]/50 transition-colors"
                  onClick={() => navigate(`/blog/${related.slug}`)}
                >
                  <CardContent className="p-6">
                    <Badge className="bg-[#ff3300]/20 text-[#ff3300] mb-3">
                      {related.category}
                    </Badge>
                    <h4 className="text-lg font-semibold text-white mb-2 hover:text-[#ff3300] transition-colors">
                      {related.title}
                    </h4>
                    <p className="text-slate-500 text-sm line-clamp-2">
                      {related.excerpt}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Back to Blog CTA */}
        <div className="mt-16 pb-16 text-center">
          <Button 
            onClick={() => navigate('/blog')}
            className="bg-[#ff3300] hover:bg-[#ff3300]/90"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Ver todos los artículos
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BlogList;
