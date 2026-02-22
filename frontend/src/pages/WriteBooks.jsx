import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import api from "../lib/api";
import {
  BookOpen,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  FileText,
  Layers,
  ArrowLeft,
  Save,
  X,
  GripVertical,
  ChevronRight,
} from "lucide-react";

const CHAPTER_STATUSES = [
  { id: "outline", name: "Outline", color: "bg-slate-500/20 text-slate-400" },
  { id: "draft", name: "Draft", color: "bg-blue-500/20 text-blue-400" },
  { id: "review", name: "Review", color: "bg-amber-500/20 text-amber-400" },
  { id: "final", name: "Final", color: "bg-green-500/20 text-green-400" },
];

export default function WriteBooks() {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Editor state
  const [editingChapter, setEditingChapter] = useState(null);
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  
  // Dialogs
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showChapterDialog, setShowChapterDialog] = useState(false);
  
  // Forms
  const [newBook, setNewBook] = useState({
    title: "", subtitle: "", description: "", genre: "", target_word_count: 50000
  });
  const [newChapter, setNewChapter] = useState({
    title: "", description: "", status: "outline"
  });

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const [booksRes, statsRes] = await Promise.all([
        api.get("/books/"),
        api.get("/books/stats/overview")
      ]);
      setBooks(booksRes.data.books || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error loading books:", error);
      toast.error("Error loading books");
    } finally {
      setLoading(false);
    }
  };

  const loadBookDetails = async (bookId) => {
    try {
      const res = await api.get(`/books/${bookId}`);
      setSelectedBook(res.data);
      setChapters(res.data.chapters || []);
    } catch (error) {
      toast.error("Error loading book details");
    }
  };

  const handleCreateBook = async () => {
    if (!newBook.title.trim()) {
      toast.error("Enter a title");
      return;
    }
    try {
      const res = await api.post("/books/", newBook);
      toast.success("Book created");
      setShowBookDialog(false);
      setNewBook({ title: "", subtitle: "", description: "", genre: "", target_word_count: 50000 });
      loadBooks();
      // Open the new book
      loadBookDetails(res.data.book.id);
    } catch (error) {
      toast.error("Error creating book");
    }
  };

  const handleCreateChapter = async () => {
    if (!newChapter.title.trim() || !selectedBook) {
      toast.error("Enter a title");
      return;
    }
    try {
      await api.post(`/books/${selectedBook.id}/chapters`, {
        book_id: selectedBook.id,
        ...newChapter
      });
      toast.success("Chapter created");
      setShowChapterDialog(false);
      setNewChapter({ title: "", description: "", status: "outline" });
      loadBookDetails(selectedBook.id);
    } catch (error) {
      toast.error("Error creating chapter");
    }
  };

  const handleUpdateChapterStatus = async (chapterId, newStatus) => {
    try {
      await api.put(`/books/chapters/${chapterId}/status`, { status: newStatus });
      // Update local state
      setChapters(chapters.map(c => 
        c.id === chapterId ? {...c, status: newStatus} : c
      ));
    } catch (error) {
      toast.error("Error updating chapter status");
    }
  };

  const handleOpenEditor = async (chapter) => {
    try {
      const res = await api.get(`/books/chapters/${chapter.id}`);
      setEditingChapter(res.data);
      setEditorContent(res.data.content || "");
    } catch (error) {
      toast.error("Error loading chapter");
    }
  };

  const handleSaveContent = async () => {
    if (!editingChapter) return;
    setSaving(true);
    try {
      await api.put(`/books/chapters/${editingChapter.id}`, {
        content: editorContent
      });
      toast.success("Saved");
      // Update local chapter
      setEditingChapter({...editingChapter, content: editorContent, word_count: editorContent.split(/\s+/).filter(w => w).length});
    } catch (error) {
      toast.error("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!confirm("Delete this book and all its chapters?")) return;
    try {
      await api.delete(`/books/${bookId}`);
      toast.success("Book deleted");
      if (selectedBook?.id === bookId) {
        setSelectedBook(null);
        setChapters([]);
      }
      loadBooks();
    } catch (error) {
      toast.error("Error deleting book");
    }
  };

  const handleDeleteChapter = async (chapterId) => {
    if (!confirm("Delete this chapter?")) return;
    try {
      await api.delete(`/books/chapters/${chapterId}`);
      toast.success("Chapter deleted");
      loadBookDetails(selectedBook.id);
    } catch (error) {
      toast.error("Error deleting chapter");
    }
  };

  const getChaptersByStatus = (status) => {
    return chapters.filter(c => c.status === status);
  };

  const wordCount = editorContent.split(/\s+/).filter(w => w).length;

  // Focus Mode Editor (Full Screen)
  if (focusMode && editingChapter) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col" data-testid="focus-editor">
        {/* Minimal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222]">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setFocusMode(false)}>
              <X className="w-5 h-5" />
            </Button>
            <span className="text-slate-400">{editingChapter.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{wordCount} words</span>
            <Button onClick={handleSaveContent} disabled={saving} size="sm">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        
        {/* Editor */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto">
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full h-full min-h-[70vh] bg-transparent text-white text-lg leading-relaxed resize-none focus:outline-none"
              placeholder="Start writing..."
              autoFocus
            />
          </div>
        </div>
      </div>
    );
  }

  // Regular Editor Panel
  if (editingChapter) {
    return (
      <div className="space-y-4" data-testid="chapter-editor">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setEditingChapter(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-white">{editingChapter.title}</h2>
              <p className="text-sm text-slate-500">{selectedBook?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{wordCount} words</span>
            <Button variant="outline" onClick={() => setFocusMode(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Focus Mode
            </Button>
            <Button onClick={handleSaveContent} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        
        {/* Editor */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-6">
            <textarea
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              className="w-full min-h-[500px] bg-[#0a0a0a] text-white p-4 rounded-lg border border-[#222] focus:border-amber-500/50 focus:outline-none text-base leading-relaxed resize-none"
              placeholder="Start writing your chapter..."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Book Detail View with Kanban
  if (selectedBook) {
    const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
    const progress = selectedBook.target_word_count > 0 
      ? Math.min(100, Math.round(totalWords / selectedBook.target_word_count * 100))
      : 0;

    return (
      <div className="space-y-6" data-testid="book-detail">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { setSelectedBook(null); setChapters([]); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">{selectedBook.title}</h1>
              {selectedBook.subtitle && (
                <p className="text-slate-400">{selectedBook.subtitle}</p>
              )}
            </div>
          </div>
          <Button 
            onClick={() => {
              if (!selectedBook) {
                toast.error("Primero selecciona o crea un libro");
                return;
              }
              setShowChapterDialog(true);
            }} 
            className={`${selectedBook ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-600 cursor-not-allowed'}`}
            disabled={!selectedBook}
            data-testid="new-chapter-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chapter
          </Button>
          {!selectedBook && (
            <span className="text-xs text-slate-500 ml-2">Selecciona un libro primero</span>
          )}
        </div>

        {/* Progress */}
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Word Progress</span>
              <span className="text-sm text-white">
                {totalWords.toLocaleString()} / {selectedBook.target_word_count.toLocaleString()} words ({progress}%)
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <div className="grid grid-cols-4 gap-4">
          {CHAPTER_STATUSES.map((status) => (
            <div key={status.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={status.color}>{status.name}</Badge>
                <span className="text-xs text-slate-500">{getChaptersByStatus(status.id).length}</span>
              </div>
              <div className="space-y-2 min-h-[200px] bg-[#0a0a0a] rounded-lg p-2 border border-[#222]">
                {getChaptersByStatus(status.id).map((chapter) => (
                  <Card 
                    key={chapter.id} 
                    className="bg-[#111] border-[#222] hover:border-amber-500/30 cursor-pointer transition-colors"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleOpenEditor(chapter)}
                        >
                          <h4 className="font-medium text-white text-sm">{chapter.title}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            {chapter.word_count || 0} words
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Select 
                            value={chapter.status} 
                            onValueChange={(v) => handleUpdateChapterStatus(chapter.id, v)}
                          >
                            <SelectTrigger className="w-6 h-6 p-0 border-none bg-transparent">
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            </SelectTrigger>
                            <SelectContent>
                              {CHAPTER_STATUSES.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-400"
                            onClick={() => handleDeleteChapter(chapter.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Books List View
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="write-books-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <BookOpen className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Write Books</h1>
            <p className="text-sm text-slate-500">Organize chapters with Kanban and write in focus mode</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadBooks} variant="outline" className="border-[#333]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowBookDialog(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-2" />
            New Book
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.total_books}</p>
              <p className="text-xs text-slate-500">Books</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{stats.total_chapters}</p>
              <p className="text-xs text-slate-500">Chapters</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.total_words?.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total Words</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.chapters_by_status?.final || 0}</p>
              <p className="text-xs text-slate-500">Final Chapters</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Books Grid */}
      {books.length === 0 ? (
        <Card className="bg-[#111] border-[#222]">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-amber-400 opacity-30" />
            <h3 className="text-xl font-bold text-white mb-2">No books yet</h3>
            <p className="text-slate-400 mb-4">Start writing your first book</p>
            <Button onClick={() => setShowBookDialog(true)} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Book
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <Card 
              key={book.id} 
              className="bg-[#111] border-[#222] hover:border-amber-500/30 cursor-pointer transition-colors"
              onClick={() => loadBookDetails(book.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white text-lg">{book.title}</h3>
                    {book.subtitle && (
                      <p className="text-sm text-slate-400">{book.subtitle}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400"
                    onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {book.description && (
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">{book.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {book.chapter_count || 0} chapters
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {(book.word_count || 0).toLocaleString()} words
                  </span>
                </div>
                
                <Progress 
                  value={book.target_word_count > 0 ? Math.min(100, (book.word_count || 0) / book.target_word_count * 100) : 0} 
                  className="h-1" 
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Book Dialog */}
      <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">New Book</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input 
                value={newBook.title}
                onChange={(e) => setNewBook({...newBook, title: e.target.value})}
                placeholder="Book title"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input 
                value={newBook.subtitle}
                onChange={(e) => setNewBook({...newBook, subtitle: e.target.value})}
                placeholder="Optional subtitle"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={newBook.description}
                onChange={(e) => setNewBook({...newBook, description: e.target.value})}
                placeholder="What's this book about?"
                className="bg-[#0a0a0a] border-[#333]"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Input 
                  value={newBook.genre}
                  onChange={(e) => setNewBook({...newBook, genre: e.target.value})}
                  placeholder="e.g., Business, Fiction"
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Word Count</Label>
                <Input 
                  type="number"
                  value={newBook.target_word_count}
                  onChange={(e) => setNewBook({...newBook, target_word_count: parseInt(e.target.value) || 50000})}
                  className="bg-[#0a0a0a] border-[#333]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateBook} className="bg-amber-600 hover:bg-amber-700">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Chapter Dialog */}
      <Dialog open={showChapterDialog} onOpenChange={setShowChapterDialog}>
        <DialogContent className="bg-[#111] border-[#222]">
          <DialogHeader>
            <DialogTitle className="text-white">New Chapter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input 
                value={newChapter.title}
                onChange={(e) => setNewChapter({...newChapter, title: e.target.value})}
                placeholder="Chapter title"
                className="bg-[#0a0a0a] border-[#333]"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={newChapter.description}
                onChange={(e) => setNewChapter({...newChapter, description: e.target.value})}
                placeholder="Brief chapter summary"
                className="bg-[#0a0a0a] border-[#333]"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Status</Label>
              <Select value={newChapter.status} onValueChange={(v) => setNewChapter({...newChapter, status: v})}>
                <SelectTrigger className="bg-[#0a0a0a] border-[#333]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAPTER_STATUSES.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChapterDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateChapter} className="bg-amber-600 hover:bg-amber-700">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
