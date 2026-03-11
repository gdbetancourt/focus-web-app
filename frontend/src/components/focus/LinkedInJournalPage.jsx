/**
 * LinkedInJournalPage — LIJ-01 LinkedIn Event Journal
 * Manual checklist UI: scheduled posts list, create/edit/delete, mark-published.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { toast } from "sonner";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import {
  CalendarClock,
  Pencil,
  Trash2,
  CheckCircle,
  Plus,
  Loader2,
} from "lucide-react";

const SECTION = getSectionById("linkedin-journal");
const MAX_CONTENT = 3000;

const STATUS_BADGE = {
  pending:   "bg-blue-500/20 text-blue-400",
  published: "bg-green-500/20 text-green-400",
  failed:    "bg-red-500/20 text-red-400",
  skipped:   "bg-yellow-500/20 text-yellow-400",
};

// ── Helpers ──────────────────────────────────────────────────────

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function postTypeLabel(rec) {
  if (rec == null) return "Inmediata";
  return `Aniversario año ${rec}`;
}

// ── Component ────────────────────────────────────────────────────

export default function LinkedInJournalPage() {
  // Posts
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createCaseId, setCreateCaseId] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  // ── Fetch posts ──
  const loadPosts = useCallback(async () => {
    try {
      const res = await api.get("/linkedin/journal");
      setPosts(res.data || []);
    } catch (err) {
      console.error("Error loading journal posts:", err);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // ── Actions ──
  const handleDelete = async (postId) => {
    if (!window.confirm("¿Eliminar esta publicación programada?")) return;
    try {
      await api.delete(`/linkedin/journal/${postId}`);
      toast.success("Publicación eliminada");
      loadPosts();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al eliminar";
      toast.error(msg);
    }
  };

  const handleMarkPublished = async (postId) => {
    if (!window.confirm("¿Confirmar que este post fue publicado en LinkedIn?")) return;
    try {
      await api.patch(`/linkedin/journal/${postId}/mark-published`);
      toast.success("Post marcado como publicado. Aniversario generado.");
      loadPosts();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al marcar como publicado";
      toast.error(msg);
    }
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      await api.patch(`/linkedin/journal/${editPost.id}`, { content: editContent });
      toast.success("Contenido actualizado");
      setEditOpen(false);
      loadPosts();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al guardar";
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createCaseId.trim() || !createContent.trim()) return;
    setCreateSaving(true);
    try {
      await api.post("/linkedin/journal", {
        case_id: createCaseId.trim(),
        content: createContent.trim(),
      });
      toast.success("Publicación programada creada");
      setCreateOpen(false);
      setCreateCaseId("");
      setCreateContent("");
      loadPosts();
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al crear";
      toast.error(msg);
    } finally {
      setCreateSaving(false);
    }
  };

  const openEdit = (post) => {
    setEditPost(post);
    setEditContent(post.content);
    setEditOpen(true);
  };

  // ── Render ──
  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus="gray"
      statusHistory={[]}
      icon={CalendarClock}
    >
      {/* ── Posts List ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Publicaciones programadas</h2>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Nueva publicación
          </Button>
        </div>

        {postsLoading ? (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : posts.length === 0 ? (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-8 text-center text-slate-500">
              <CalendarClock className="w-8 h-8 mx-auto mb-2" />
              No hay publicaciones programadas.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                onEdit={() => openEdit(p)}
                onDelete={() => handleDelete(p.id)}
                onMarkPublished={() => handleMarkPublished(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#111] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Editar publicación</DialogTitle>
          </DialogHeader>
          {editPost && (
            <div className="space-y-4 mt-2">
              <div className="flex gap-4 text-sm text-zinc-400">
                <span>Fecha: {editPost.scheduled_date}</span>
                <span>Tipo: {postTypeLabel(editPost.recurrence_year)}</span>
              </div>
              <textarea
                className="w-full h-40 rounded-md border border-[#333] bg-[#0a0a0a] text-white p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value.slice(0, MAX_CONTENT))}
                placeholder="Contenido del post..."
              />
              <div className="text-xs text-zinc-500 text-right">
                {editContent.length}/{MAX_CONTENT}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-zinc-400">
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving || !editContent.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Modal ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#111] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Nueva publicación programada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Case ID</label>
              <input
                className="w-full rounded-md border border-[#333] bg-[#0a0a0a] text-white p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={createCaseId}
                onChange={(e) => setCreateCaseId(e.target.value)}
                placeholder="UUID del caso (Stage 4 con event_date)"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Contenido del post</label>
              <textarea
                className="w-full h-40 rounded-md border border-[#333] bg-[#0a0a0a] text-white p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={createContent}
                onChange={(e) => setCreateContent(e.target.value.slice(0, MAX_CONTENT))}
                placeholder="Texto que se publicará en LinkedIn..."
              />
              <div className="text-xs text-zinc-500 text-right mt-1">
                {createContent.length}/{MAX_CONTENT}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-zinc-400">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createSaving || !createCaseId.trim() || !createContent.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Programar publicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionLayout>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function PostRow({ post, onEdit, onDelete, onMarkPublished }) {
  const isPending = post.status === "pending";
  const isFailed = post.status === "failed";

  return (
    <Card className="bg-[#111] border-[#222] hover:bg-[#151515] transition-colors">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={STATUS_BADGE[post.status] || "bg-zinc-700 text-zinc-300"}>
                {post.status}
              </Badge>
              <span className="text-xs text-zinc-500">
                {postTypeLabel(post.recurrence_year)}
              </span>
              <span className="text-xs text-zinc-600">
                {post.scheduled_date}
              </span>
            </div>
            <p className="text-sm text-zinc-300 truncate" title={post.content}>
              {truncate(post.content, 80)}
            </p>
            <p className="text-xs text-zinc-600 mt-1" title={post.case_id}>
              Caso: {post.case_id?.slice(0, 8)}...
            </p>
            {isFailed && post.error_message && (
              <p className="text-xs text-red-400 mt-1" title={post.error_message}>
                Error: {truncate(post.error_message, 100)}
              </p>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPending && (
              <>
                <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
                  <Pencil className="w-4 h-4 text-zinc-400" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onMarkPublished} title="Marcar como publicado">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onDelete} title="Eliminar">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
