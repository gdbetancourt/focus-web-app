import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { 
  Globe, ExternalLink, Layout, FileText, Image, Settings, Eye, 
  Monitor, Tablet, Smartphone, RefreshCw, Edit, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PREVIEW_PAGES = [
  { id: "home", name: "Inicio", path: "/public", editPath: null },
  { id: "blog", name: "Blog", path: "/blog", editPath: "/nurture/blog" },
  { id: "eventos", name: "Eventos", path: "/eventos", editPath: "/nurture/events" },
  { id: "cursos", name: "Cursos", path: "/learn", editPath: "/nurture/lms" },
  { id: "testimonios", name: "Testimonios", path: "/muro", editPath: "/nurture/testimonials" },
  { id: "legal", name: "Legal", path: "/legal", editPath: null },
];

export default function Website() {
  const navigate = useNavigate();
  const [selectedPage, setSelectedPage] = useState(PREVIEW_PAGES[0]);
  const [viewportSize, setViewportSize] = useState("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  
  const baseUrl = window.location.origin;
  const previewUrl = `${baseUrl}${selectedPage.path}`;
  
  const viewportWidths = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px"
  };

  return (
    <div className="space-y-6" data-testid="website-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/20">
            <Globe className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Website Preview
            </h1>
            <p className="text-slate-500">Previsualiza y gestiona las páginas públicas</p>
          </div>
        </div>
        
        <Button 
          onClick={() => window.open(previewUrl, '_blank')}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Eye className="w-4 h-4 mr-2" />
          Abrir en Nueva Pestaña
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Page Selector + Viewport Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Page Tabs */}
        <div className="flex gap-2 flex-wrap">
          {PREVIEW_PAGES.map((page) => (
            <Button
              key={page.id}
              variant={selectedPage.id === page.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPage(page)}
              className={selectedPage.id === page.id 
                ? "bg-indigo-600 hover:bg-indigo-700" 
                : "border-[#333] text-slate-400 hover:text-white hover:border-indigo-500"
              }
              data-testid={`page-tab-${page.id}`}
            >
              {page.name}
            </Button>
          ))}
        </div>

        {/* Viewport + Actions */}
        <div className="flex items-center gap-2">
          {/* Viewport Selector */}
          <div className="flex bg-[#111] border border-[#222] rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewportSize("desktop")}
              className={viewportSize === "desktop" ? "bg-indigo-600/20 text-indigo-400" : "text-slate-400"}
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewportSize("tablet")}
              className={viewportSize === "tablet" ? "bg-indigo-600/20 text-indigo-400" : "text-slate-400"}
            >
              <Tablet className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewportSize("mobile")}
              className={viewportSize === "mobile" ? "bg-indigo-600/20 text-indigo-400" : "text-slate-400"}
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
            className="border-[#333] text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Edit Button */}
          {selectedPage.editPath && (
            <Button
              size="sm"
              onClick={() => navigate(selectedPage.editPath)}
              className="bg-green-600 hover:bg-green-700"
              data-testid="edit-page-btn"
            >
              <Edit className="w-4 h-4 mr-1" />
              Editar {selectedPage.name}
            </Button>
          )}
        </div>
      </div>

      {/* Preview Frame */}
      <Card className="bg-[#111] border-[#222] overflow-hidden">
        <CardHeader className="py-3 border-b border-[#222]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-slate-500 ml-2">{previewUrl}</span>
            </div>
            <Badge className="bg-indigo-500/20 text-indigo-400 text-xs">
              {viewportSize === "desktop" ? "1920px" : viewportSize === "tablet" ? "768px" : "375px"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-900/50">
          <div 
            className="mx-auto transition-all duration-300 bg-white rounded-lg overflow-hidden shadow-2xl"
            style={{ 
              width: viewportWidths[viewportSize],
              maxWidth: "100%"
            }}
          >
            <iframe
              key={refreshKey}
              src={previewUrl}
              title={`Preview: ${selectedPage.name}`}
              className="w-full border-0"
              style={{ height: '600px' }}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Edit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="bg-[#111] border-[#222] hover:border-blue-500/50 transition-colors cursor-pointer"
          onClick={() => navigate("/nurture/blog")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">Blog</p>
                <p className="text-xs text-slate-500">Crear y editar posts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </CardContent>
        </Card>

        <Card 
          className="bg-[#111] border-[#222] hover:border-purple-500/50 transition-colors cursor-pointer"
          onClick={() => navigate("/nurture/events")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layout className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">Eventos</p>
                <p className="text-xs text-slate-500">Gestionar eventos</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </CardContent>
        </Card>

        <Card 
          className="bg-[#111] border-[#222] hover:border-green-500/50 transition-colors cursor-pointer"
          onClick={() => navigate("/nurture/lms")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-white font-medium">Cursos</p>
                <p className="text-xs text-slate-500">Learning center</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </CardContent>
        </Card>

        <Card 
          className="bg-[#111] border-[#222] hover:border-orange-500/50 transition-colors cursor-pointer"
          onClick={() => navigate("/nurture/testimonials")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-white font-medium">Testimonios</p>
                <p className="text-xs text-slate-500">Muro de testimonios</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
