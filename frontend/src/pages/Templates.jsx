import { useEffect, useState } from "react";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "../lib/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2,
  Mail,
  Clock
} from "lucide-react";

const defaultTemplates = [
  {
    name: "Invitación a Evento",
    subject: "Te invitamos a nuestro próximo evento: {{evento_titulo}}",
    body_html: `<p>Hola {{nombre}},</p>
<p>Queremos invitarte a nuestro próximo evento <strong>{{evento_titulo}}</strong> que se llevará a cabo el {{evento_fecha}}.</p>
<p>{{evento_descripcion}}</p>
<p>Esperamos contar con tu presencia.</p>
<p>Saludos cordiales,<br>Equipo Leaderlix</p>`,
    variables: ["nombre", "evento_titulo", "evento_fecha", "evento_descripcion"]
  },
  {
    name: "Recordatorio de Webinar",
    subject: "Recordatorio: {{evento_titulo}} es mañana",
    body_html: `<p>Hola {{nombre}},</p>
<p>Te recordamos que mañana tenemos el webinar <strong>{{evento_titulo}}</strong>.</p>
<p><strong>Fecha:</strong> {{evento_fecha}}<br>
<strong>Hora:</strong> {{evento_hora}}<br>
<strong>Lugar:</strong> {{evento_lugar}}</p>
<p>No te lo pierdas!</p>
<p>Saludos,<br>Equipo Leaderlix</p>`,
    variables: ["nombre", "evento_titulo", "evento_fecha", "evento_hora", "evento_lugar"]
  }
];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body_html: "",
    variables: []
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await getTemplates();
      setTemplates(response.data);
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        subject: template.subject,
        body_html: template.body_html,
        variables: template.variables || []
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: "", subject: "", body_html: "", variables: [] });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, formData);
        toast.success("Plantilla actualizada");
      } else {
        await createTemplate(formData);
        toast.success("Plantilla creada");
      }
      setDialogOpen(false);
      loadTemplates();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar plantilla");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta plantilla?")) return;
    
    try {
      await deleteTemplate(id);
      toast.success("Plantilla eliminada");
      loadTemplates();
    } catch (error) {
      toast.error("Error al eliminar plantilla");
    }
  };

  const handleCreateDefault = async (template) => {
    try {
      await createTemplate(template);
      toast.success(`Plantilla "${template.name}" creada`);
      loadTemplates();
    } catch (error) {
      toast.error("Error al crear plantilla");
    }
  };

  return (
    <div className="space-y-8" data-testid="templates-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Plantillas de Email</h1>
          <p className="text-slate-500 mt-1">Crea y gestiona tus plantillas de correo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="btn-accent"
              onClick={() => handleOpenDialog()}
              data-testid="create-template-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Plantilla
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la plantilla</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Invitación a evento"
                  required
                  data-testid="template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Asunto del correo</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Ej: Te invitamos a {{evento_titulo}}"
                  required
                  data-testid="template-subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Contenido HTML</Label>
                <Textarea
                  id="body"
                  value={formData.body_html}
                  onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                  placeholder="<p>Hola {{nombre}},</p>..."
                  rows={10}
                  required
                  className="font-mono text-sm"
                  data-testid="template-body"
                />
                <p className="text-xs text-slate-500">
                  Usa variables como {"{{nombre}}"}, {"{{evento_titulo}}"}, etc.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="btn-accent" data-testid="save-template-btn">
                  {editingTemplate ? "Guardar cambios" : "Crear plantilla"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Default Templates */}
      {templates.length === 0 && !loading && (
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="p-6">
            <h3 className="font-bold text-lg text-white mb-2">Plantillas sugeridas</h3>
            <p className="text-slate-300 text-sm mb-4">
              Comienza con estas plantillas prediseñadas para tus campañas de eventos
            </p>
            <div className="flex flex-wrap gap-3">
              {defaultTemplates.map((template, i) => (
                <Button
                  key={i}
                  variant="outline"
                  onClick={() => handleCreateDefault(template)}
                  className="bg-[#111111]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <Card 
              key={template.id} 
              className="stat-card"
              data-testid={`template-card-${template.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <FileText className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(template.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenDialog(template)}
                      data-testid={`edit-template-${template.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(template.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      data-testid={`delete-template-${template.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300 truncate">{template.subject}</span>
                  </div>
                  
                  <div className="p-3 bg-[#0f0f0f] rounded-lg">
                    <p className="text-xs text-slate-500 font-mono line-clamp-3">
                      {template.body_html.replace(/<[^>]*>/g, '').substring(0, 150)}...
                    </p>
                  </div>
                  
                  {template.variables?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((v, i) => (
                        <span key={i} className="badge-neutral text-xs">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="stat-card">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-white mb-2">No hay plantillas</h3>
            <p className="text-slate-500 mb-4">Crea tu primera plantilla de email</p>
            <Button onClick={() => handleOpenDialog()} className="btn-accent">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Plantilla
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
