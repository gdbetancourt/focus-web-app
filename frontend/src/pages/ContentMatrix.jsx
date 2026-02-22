import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import api from "../lib/api";
import {
  Grid3X3,
  FileText,
  Plus,
  RefreshCw,
  Edit,
  ExternalLink,
  Save,
  X,
  BookOpen,
  Layers,
  FolderOpen,
  AlertCircle,
  Newspaper,
  Youtube,
  Link,
  Image as ImageIcon,
  Presentation,
  Globe,
  Lock,
} from "lucide-react";

// Level colors
const LEVEL_COLORS = {
  1: "bg-green-500/20 text-green-400 border-green-500/30",
  2: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  3: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  4: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

export default function ContentMatrix() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [courseMatrix, setCourseMatrix] = useState(null);
  const [unclassifiedItems, setUnclassifiedItems] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Course/Competency Creation Modals
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [showNewCompetencyModal, setShowNewCompetencyModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCompetencyName, setNewCompetencyName] = useState("");
  const [newCompetencyDesc, setNewCompetencyDesc] = useState("");
  
  // Dictate Modal State
  const [showDictateModal, setShowDictateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [dictationText, setDictationText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  // Editable fields in dictate modal
  const [editTitle, setEditTitle] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editCompetencyId, setEditCompetencyId] = useState("");
  const [editLevel, setEditLevel] = useState("");
  
  // Cell Items Modal State
  const [showCellModal, setShowCellModal] = useState(false);
  const [cellItems, setCellItems] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ competency: null, level: null });
  
  // Edit Item Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // YouTube Link Modal State
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeItem, setYoutubeItem] = useState(null);
  
  // AI Generation State
  const [generatingAI, setGeneratingAI] = useState(null); // 'thumbnail', 'description', 'slides' or null
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [slidesUrl, setSlidesUrl] = useState(null);
  
  // Slides Generation Options
  const [showSlidesOptions, setShowSlidesOptions] = useState(false);
  const [slidesCount, setSlidesCount] = useState("8");
  const [slidesPreview, setSlidesPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Webinar Creation State
  const [showWebinarModal, setShowWebinarModal] = useState(false);
  const [webinarItem, setWebinarItem] = useState(null);
  const [webinarDate, setWebinarDate] = useState("");
  const [webinarTime, setWebinarTime] = useState("10:00");
  const [createYouTubeLive, setCreateYouTubeLive] = useState(true);
  const [autoEnrollLMS, setAutoEnrollLMS] = useState(true);
  const [creatingWebinar, setCreatingWebinar] = useState(false);

  // Generate All state
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  // YouTube Privacy state
  const [changingPrivacy, setChangingPrivacy] = useState(null); // item id while changing

  // New content in cell state
  const [newContentTitle, setNewContentTitle] = useState("");
  const [creatingContent, setCreatingContent] = useState(false);

  // Load courses
  const loadCourses = useCallback(async () => {
    try {
      const res = await api.get("/content/courses");
      setCourses(res.data.courses || []);
      
      // Set first course as active if none selected
      if (res.data.courses?.length > 0) {
        setActiveCourse(prev => prev || res.data.courses[0].id);
      }
    } catch (error) {
      console.error("Error loading courses:", error);
      toast.error("Error loading courses");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load course matrix when active course changes
  const loadCourseMatrix = useCallback(async () => {
    if (!activeCourse) {
      setCourseMatrix(null);
      return;
    }
    
    try {
      const res = await api.get(`/content/courses/${activeCourse}/matrix`);
      setCourseMatrix(res.data);
      setUnclassifiedItems(res.data.unclassified || []);
    } catch (error) {
      console.error("Error loading course matrix:", error);
      toast.error("Error loading content matrix");
    }
  }, [activeCourse]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/content/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadCourses();
    loadStats();
  }, [loadCourses, loadStats]);

  // Load course matrix when active course changes
  useEffect(() => {
    if (activeCourse) {
      loadCourseMatrix();
    }
  }, [activeCourse, loadCourseMatrix]);

  // Create new course
  const handleCreateCourse = async () => {
    if (!newCourseName.trim()) {
      toast.error("Course name is required");
      return;
    }
    
    try {
      const res = await api.post("/content/courses", {
        name: newCourseName.trim(),
        description: newCourseDesc.trim()
      });
      
      if (res.data.success) {
        toast.success("Course created successfully");
        setShowNewCourseModal(false);
        setNewCourseName("");
        setNewCourseDesc("");
        await loadCourses();
        // Set the new course as active
        setActiveCourse(res.data.course.id);
      }
    } catch (error) {
      console.error("Error creating course:", error);
      toast.error(error.response?.data?.detail || "Error creating course");
    }
  };

  // Create new competency
  const handleCreateCompetency = async () => {
    if (!newCompetencyName.trim()) {
      toast.error("Competency name is required");
      return;
    }
    
    if (!activeCourse) {
      toast.error("Select a course first");
      return;
    }
    
    try {
      const res = await api.post("/content/competencies", {
        name: newCompetencyName.trim(),
        description: newCompetencyDesc.trim(),
        course_id: activeCourse
      });
      
      if (res.data.success) {
        toast.success("Competency created successfully");
        setShowNewCompetencyModal(false);
        setNewCompetencyName("");
        setNewCompetencyDesc("");
        await loadCourseMatrix();
      }
    } catch (error) {
      console.error("Error creating competency:", error);
      toast.error(error.response?.data?.detail || "Error creating competency");
    }
  };

  const loadCellItems = async (competencyId, level) => {
    try {
      const res = await api.get(`/content/matrix/${competencyId}/level/${level}`);
      setCellItems(res.data.items || []);
    } catch (error) {
      console.error("Error loading cell items:", error);
      toast.error("Error loading content items");
    }
  };

  // Assign an item to the current cell
  const handleAssignItem = async (itemId) => {
    if (!selectedCell.competency || !selectedCell.level) {
      toast.error("No cell selected");
      return;
    }
    
    try {
      const res = await api.post(`/content/items/${itemId}/assign`, null, {
        params: {
          competency_id: selectedCell.competency.id,
          level: selectedCell.level.number,
          course_id: activeCourse
        }
      });
      
      if (res.data.success) {
        toast.success(`Item assigned to Level ${selectedCell.level.number}`);
        // Refresh cell items and matrix
        await loadCellItems(selectedCell.competency.id, selectedCell.level.number);
        await loadCourseMatrix();
      }
    } catch (error) {
      console.error("Error assigning item:", error);
      toast.error(error.response?.data?.detail || "Error assigning item");
    }
  };

  // Unassign an item from its cell
  const handleUnassignItem = async (itemId) => {
    try {
      const res = await api.post(`/content/items/${itemId}/unassign`);
      
      if (res.data.success) {
        toast.success("Item unassigned from cell");
        // Refresh cell items and matrix
        if (selectedCell.competency && selectedCell.level) {
          await loadCellItems(selectedCell.competency.id, selectedCell.level.number);
        }
        await loadCourseMatrix();
      }
    } catch (error) {
      console.error("Error unassigning item:", error);
      toast.error(error.response?.data?.detail || "Error unassigning item");
    }
  };

  // Open cell modal with items
  const handleCellClick = async (competency, level) => {
    setSelectedCell({ competency, level });
    await loadCellItems(competency.id, level.number);
    setShowCellModal(true);
  };

  // Open dictate modal
  const handleOpenDictate = async (item) => {
    // Ensure courses are loaded
    if (courses.length === 0) {
      try {
        const res = await api.get("/content/courses");
        setCourses(res.data.courses || []);
      } catch (err) {
        console.error("Error loading courses for modal:", err);
      }
    }
    
    setSelectedItem(item);
    setDictationText(item.dictation_draft_text || "");
    setLastSaved(item.dictation_last_saved);
    setEditTitle(item.title || "");
    setEditCourseId(item.course_id || "");
    setEditCompetencyId(item.competency_id || "");
    setEditLevel(item.level?.toString() || "");
    setShowDictateModal(true);
  };

  // Save item metadata (title, course, competency, level)
  const saveItemMetadata = async () => {
    if (!selectedItem) return;
    
    try {
      await api.patch(`/content/items/${selectedItem.id}`, {
        title: editTitle,
        course_id: editCourseId || null,
        competency_id: editCompetencyId || null,
        level: editLevel ? parseInt(editLevel) : null
      });
      
      // Update local state
      setSelectedItem(prev => ({
        ...prev,
        title: editTitle,
        course_id: editCourseId,
        competency_id: editCompetencyId,
        level: editLevel ? parseInt(editLevel) : null
      }));
      
      // Reload matrix data
      loadCourseMatrix();
      
      // Show subtle confirmation
      toast.success("Guardado", { duration: 1000 });
    } catch (error) {
      console.error("Error saving item metadata:", error);
      toast.error("Error guardando metadatos");
    }
  };

  // Autosave dictation with debounce
  const saveDictation = useCallback(async () => {
    if (!selectedItem) return;
    
    setIsSaving(true);
    try {
      const res = await api.patch(`/content/items/${selectedItem.id}/dictation`, {
        dictation_draft_text: dictationText
      });
      setLastSaved(res.data.saved_at);
    } catch (error) {
      console.error("Error saving dictation:", error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedItem, dictationText]);

  // Debounced autosave effect
  useEffect(() => {
    if (!selectedItem || !showDictateModal) return;
    
    const timeoutId = setTimeout(() => {
      saveDictation();
    }, 2000); // Autosave after 2 seconds of inactivity
    
    return () => clearTimeout(timeoutId);
  }, [dictationText, selectedItem, showDictateModal, saveDictation]);

  // Open edit modal
  const handleEditItem = (item) => {
    setEditingItem({ ...item });
    setShowEditModal(true);
  };

  // Save edited item
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    try {
      await api.put(`/content/items/${editingItem.id}`, {
        title: editingItem.title,
        course_id: editingItem.course_id || null,
        competency_id: editingItem.competency_id || null,
        level: editingItem.level || null,
        notes: editingItem.notes,
        tags: editingItem.tags
      });
      
      toast.success("Content item updated");
      setShowEditModal(false);
      setEditingItem(null);
      
      // Refresh data
      loadCourses();
      loadCourseMatrix();
      
      // Refresh cell if open
      if (showCellModal && selectedCell.competency && selectedCell.level) {
        loadCellItems(selectedCell.competency.id, selectedCell.level.number);
      }
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Error updating item");
    }
  };

  // Queue for Newsletter
  const handleQueueForNewsletter = async (item) => {
    if (!item.course_id) {
      toast.error("Assign a course first");
      return;
    }
    
    try {
      const res = await api.post(`/content/items/${item.id}/queue-for-newsletter`);
      if (res.data.already_queued) {
        toast.info("Already in newsletter queue");
      } else {
        toast.success("Added to newsletter queue");
      }
    } catch (error) {
      console.error("Error queuing for newsletter:", error);
      toast.error(error.response?.data?.detail || "Error queuing for newsletter");
    }
  };

  // Open YouTube modal
  const handleOpenYouTube = async (item) => {
    setYoutubeItem(item);
    setYoutubeUrl(item.youtube_url || "");
    setGeneratedDescription("");
    setGeneratingAI(null);
    
    // Try to get existing video info
    try {
      const res = await api.get(`/content/items/${item.id}/video`);
      if (res.data.video?.youtube_url) {
        setYoutubeUrl(res.data.video.youtube_url);
      }
    } catch (error) {
      console.error("Error loading video info:", error);
    }
    
    setShowYouTubeModal(true);
  };

  // Save YouTube Link
  const handleSaveYouTubeLink = async () => {
    if (!youtubeItem || !youtubeUrl.trim()) return;
    
    try {
      await api.put(`/content/items/${youtubeItem.id}/youtube-link?youtube_url=${encodeURIComponent(youtubeUrl)}`);
      toast.success("YouTube link saved");
      setShowYouTubeModal(false);
      setYoutubeItem(null);
      setYoutubeUrl("");
      
      // Refresh cell if open
      if (showCellModal && selectedCell.competency && selectedCell.level) {
        loadCellItems(selectedCell.competency.id, selectedCell.level.number);
      }
    } catch (error) {
      console.error("Error saving YouTube link:", error);
      toast.error("Error saving YouTube link");
    }
  };

  // Generate Thumbnail with AI
  const handleGenerateThumbnail = async (item) => {
    if (!item) return;
    
    setGeneratingAI('thumbnail');
    try {
      await api.post(`/content/items/${item.id}/generate-thumbnail`, {
        style: "professional"
      });
      toast.success("Thumbnail generated successfully!");
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      toast.error(error.response?.data?.detail || "Error generating thumbnail");
    } finally {
      setGeneratingAI(null);
    }
  };

  // Generate Description with AI
  const handleGenerateDescription = async (item) => {
    if (!item) return;
    
    setGeneratingAI('description');
    setGeneratedDescription("");
    try {
      const res = await api.post(`/content/items/${item.id}/generate-description`, {
        language: "es"
      });
      if (res.data.description) {
        setGeneratedDescription(res.data.description);
        toast.success("Description generated successfully!");
      }
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error(error.response?.data?.detail || "Error generating description");
    } finally {
      setGeneratingAI(null);
    }
  };

  // Preview Slides Structure
  const handlePreviewSlides = async (item) => {
    if (!item || !dictationText) {
      toast.error("Agrega contenido primero antes de previsualizar");
      return;
    }
    
    setLoadingPreview(true);
    try {
      const res = await api.post(`/content/items/${item.id}/preview-slides`, {
        text: dictationText,
        slide_count: parseInt(slidesCount)
      });
      if (res.data.success) {
        setSlidesPreview(res.data.structured_content);
        setShowSlidesOptions(true);
      }
    } catch (error) {
      console.error("Error previewing slides:", error);
      toast.error("Error generando vista previa");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Generate Slides with AI
  const handleGenerateSlides = async (item, slideCount = 8) => {
    if (!item) return;
    
    setGeneratingAI('slides');
    setSlidesUrl(null);
    setShowSlidesOptions(false);
    try {
      const res = await api.post(`/content/items/${item.id}/generate-slides`, {
        slide_count: slideCount
      });
      if (res.data.success) {
        setSlidesUrl(res.data.presentation_url);
        toast.success(`¡Slides creadas! ${res.data.slides_count} diapositivas generadas`);
        // Open in new tab
        window.open(res.data.presentation_url, '_blank');
      }
    } catch (error) {
      console.error("Error generating slides:", error);
      const errorMsg = error.response?.data?.detail || "";
      
      // Check for scope insufficient error
      if (errorMsg.includes("SCOPE_INSUFFICIENT") || errorMsg.includes("scope")) {
        toast.error(
          "Permisos insuficientes. Ve a Settings → Configuración, desconecta y reconecta Google para habilitar Slides.",
          { duration: 8000 }
        );
      } else if (errorMsg.includes("not connected") || errorMsg.includes("No Google credentials")) {
        toast.error("Conecta tu cuenta de Google en Settings → Configuración primero.");
      } else {
        toast.error(errorMsg || "Error generando slides");
      }
    } finally {
      setGeneratingAI(null);
    }
  };

  // Create Webinar from Content Item
  const handleOpenWebinarModal = (item) => {
    setWebinarItem(item);
    // Set default date to 1 month from now
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() + 1);
    setWebinarDate(defaultDate.toISOString().split('T')[0]);
    setWebinarTime("10:00");
    setCreateYouTubeLive(true);
    setAutoEnrollLMS(true);
    setShowWebinarModal(true);
  };

  const handleCreateWebinar = async () => {
    if (!webinarItem || !webinarDate) {
      toast.error("Fecha del webinar requerida");
      return;
    }

    setCreatingWebinar(true);
    try {
      const res = await api.post("/events-v2/from-content-item", {
        content_item_id: webinarItem.id,
        webinar_date: webinarDate,
        webinar_time: webinarTime,
        auto_enroll_lms: autoEnrollLMS,
        create_youtube_live: createYouTubeLive
      });

      if (res.data.success) {
        toast.success("¡Webinar creado exitosamente!");
        if (res.data.youtube_created) {
          toast.success("YouTube Live broadcast creado automáticamente", { duration: 5000 });
        }
        setShowWebinarModal(false);
        setWebinarItem(null);
        
        // Refresh matrix to show webinar badge
        if (activeCourse) {
          loadCourseMatrix();
        }
      }
    } catch (error) {
      console.error("Error creating webinar:", error);
      const errorMsg = error.response?.data?.detail || "";
      if (errorMsg.includes("already has a webinar")) {
        toast.error("Este contenido ya tiene un webinar asociado");
      } else {
        toast.error(errorMsg || "Error creando webinar");
      }
    } finally {
      setCreatingWebinar(false);
    }
  };

  // Change YouTube privacy (unlisted -> public)
  const handleChangeYouTubePrivacy = async (item, newPrivacy = "public") => {
    if (!item.webinar?.id) {
      toast.error("No hay webinar asociado");
      return;
    }

    setChangingPrivacy(item.id);
    try {
      const res = await api.post(`/events-v2/${item.webinar.id}/youtube-privacy?privacy=${newPrivacy}`);
      if (res.data.success) {
        toast.success(`YouTube Live ahora es ${newPrivacy === 'public' ? 'Público' : 'Oculto'}`);
        // Refresh the item to update privacy status
        await loadCellItems(item.competency_id, item.level);
      }
    } catch (error) {
      console.error("Error changing YouTube privacy:", error);
      toast.error(error.response?.data?.detail || "Error cambiando privacidad");
    } finally {
      setChangingPrivacy(null);
    }
  };

  // Create new content directly in a cell
  const handleCreateContentInCell = async () => {
    // Create with placeholder title, user will edit in dictation modal
    setCreatingContent(true);
    try {
      const res = await api.post("/content/items", {
        title: "Nuevo contenido",
        course_id: selectedCell.competency?.course_id || activeCourse,
        competency_id: selectedCell.competency?.id,
        level: selectedCell.level?.number
      });

      if (res.data.success) {
        toast.success("Contenido creado - edita el título y dictado");
        // Refresh cell items
        await loadCellItems(selectedCell.competency?.id, selectedCell.level?.number);
        
        // Open dictation modal for the new item with pre-filled course/competency/level
        const newItem = res.data.item;
        setSelectedItem(newItem);
        setDictationText("");
        setEditTitle(newItem.title || "");
        setEditCourseId(newItem.course_id || activeCourse || "");
        setEditCompetencyId(newItem.competency_id || selectedCell.competency?.id || "");
        setEditLevel(newItem.level?.toString() || selectedCell.level?.number?.toString() || "");
        setShowDictateModal(true);
      }
    } catch (error) {
      console.error("Error creating content:", error);
      toast.error(error.response?.data?.detail || "Error creando contenido");
    } finally {
      setCreatingContent(false);
    }
  };

  // Generate All (clean + slides + blogs) then open webinar modal
  // Uses async background job with polling to avoid timeout
  const handleGenerateAll = async (item) => {
    if (!item) {
      toast.error("No hay item seleccionado");
      return;
    }
    
    // Use current dictationText from state
    const currentDictation = dictationText || "";
    if (currentDictation.length < 100) {
      toast.error("Se necesitan al menos 100 caracteres para generar contenido");
      return;
    }

    // Use current title from state
    const currentTitle = editTitle || item.title || "Sin título";

    setGeneratingAll(true);
    setGenerationProgress("Guardando título y metadatos...");

    try {
      // First save the metadata (title, course, competency, level)
      const metadataPayload = {
        title: currentTitle,
        course_id: editCourseId || item.course_id || null,
        competency_id: editCompetencyId || item.competency_id || null,
        level: editLevel ? parseInt(editLevel) : item.level || null
      };
      console.log("Saving metadata:", metadataPayload);
      
      await api.patch(`/content/items/${item.id}`, metadataPayload);

      setGenerationProgress("Guardando dictado...");
      
      // Then save the dictation - use the state variable directly
      console.log("Saving dictation, length:", currentDictation.length);
      await api.patch(`/content/items/${item.id}/dictation`, {
        dictation_draft_text: currentDictation
      });

      setGenerationProgress("Iniciando generación en segundo plano...");
      
      // Start async generation
      const startRes = await api.post(`/content/items/${item.id}/generate-all-async`, {
        slide_count: parseInt(slidesCount)
      });

      if (!startRes.data.success || !startRes.data.job_id) {
        throw new Error("No se pudo iniciar la generación");
      }

      const jobId = startRes.data.job_id;
      console.log("Generation job started:", jobId);

      // Poll for status every 3 seconds
      let attempts = 0;
      const maxAttempts = 120; // 6 minutes max (120 * 3s = 360s)
      
      const pollStatus = async () => {
        while (attempts < maxAttempts) {
          attempts++;
          
          try {
            const statusRes = await api.get(`/content/items/${item.id}/generation-status/${jobId}`);
            const { status, progress, results, error } = statusRes.data;
            
            setGenerationProgress(progress || `Procesando... (${attempts * 3}s)`);
            
            if (status === "completed") {
              // Success!
              if (results?.cleaned_text) {
                setDictationText(results.cleaned_text);
              }

              let msg = "✅ Contenido generado:";
              if (results?.slides_url) {
                msg += " Slides";
                setSlidesUrl(results.slides_url);
                window.open(results.slides_url, '_blank');
              }
              if (results?.blog_es_id) msg += ", Blog ES";
              if (results?.blog_en_id) msg += ", Blog EN";
              
              toast.success(msg, { duration: 5000 });

              if (results?.errors?.length > 0) {
                toast.error(`Errores: ${results.errors.join(", ")}`, { duration: 8000 });
              }

              // Refresh data
              try {
                const updatedItemRes = await api.get(`/content/items/${item.id}`);
                if (updatedItemRes.data.item) {
                  setSelectedItem(updatedItemRes.data.item);
                  if (selectedCell.competency && selectedCell.level) {
                    await loadCellItems(selectedCell.competency.id, selectedCell.level.number);
                  }
                }
              } catch (err) {
                console.error("Error refreshing item:", err);
              }
              
              await loadCourseMatrix();
              setShowDictateModal(false);
              handleOpenWebinarModal(item);
              return;
            }
            
            if (status === "failed") {
              throw new Error(error || "La generación falló");
            }
            
            // Still running, wait and poll again
            await new Promise(resolve => setTimeout(resolve, 3000));
            
          } catch (pollError) {
            console.error("Polling error:", pollError);
            // If it's a network error, retry
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              continue;
            }
            throw pollError;
          }
        }
        
        throw new Error("Timeout - la generación tardó demasiado. El proceso puede continuar en segundo plano.");
      };

      await pollStatus();

    } catch (error) {
      console.error("Error in generate all:", error);
      toast.error(error.message || error.response?.data?.detail || "Error generando contenido", { duration: 8000 });
    } finally {
      setGeneratingAll(false);
      setGenerationProgress("");
    }
  };

  // Get active course data
  const activeCourseData = courseMatrix;

  if (loading && !courseMatrix) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="content-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-matrix-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#ff3300]/20">
            <Grid3X3 className="w-6 h-6 text-[#ff3300]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Content Matrix</h1>
            <p className="text-sm text-slate-500">Organize content by competencies and levels</p>
          </div>
        </div>
        
        {/* Stats */}
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
              <p className="text-xs text-slate-500">Total Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.unclassified || 0}</p>
              <p className="text-xs text-slate-500">Unclassified</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{stats.by_status?.published || 0}</p>
              <p className="text-xs text-slate-500">Published</p>
            </div>
          </div>
        )}
      </div>

      {/* Unclassified Alert */}
      {unclassifiedItems.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div className="flex-1">
                <p className="text-yellow-400 font-medium">
                  {unclassifiedItems.length} unclassified content items
                </p>
                <p className="text-sm text-yellow-400/70">
                  Assign them to a competency and level to see them in the matrix
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditItem(unclassifiedItems[0])}
                className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                Classify First Item
              </Button>
            </div>
            
            {/* List unclassified items */}
            <div className="mt-3 flex flex-wrap gap-2">
              {unclassifiedItems.slice(0, 5).map(item => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className="border-yellow-500/30 text-yellow-400 cursor-pointer hover:bg-yellow-500/10"
                  onClick={() => handleEditItem(item)}
                >
                  {item.title.length > 30 ? item.title.substring(0, 30) + "..." : item.title}
                </Badge>
              ))}
              {unclassifiedItems.length > 5 && (
                <Badge variant="outline" className="border-slate-500/30 text-slate-400">
                  +{unclassifiedItems.length - 5} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Selection and Matrix */}
      <div className="space-y-6">
        {/* Course Selection Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select value={activeCourse || ""} onValueChange={setActiveCourse}>
              <SelectTrigger className="w-64 bg-[#111] border-[#222] text-white">
                <SelectValue placeholder="Select a course..." />
              </SelectTrigger>
              <SelectContent>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {course.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewCourseModal(true)}
              className="border-[#333]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Course
            </Button>
          </div>
          
          <div className="flex gap-2">
            {activeCourse && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewCompetencyModal(true)}
                className="border-[#333]"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Competency
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadCourseMatrix}
              className="border-[#333]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Course Matrix */}
        {activeCourse && courseMatrix ? (
          <div className="space-y-6">
            {/* Course Header */}
            <div>
              <h2 className="text-xl font-semibold text-white">
                {courses.find(c => c.id === activeCourse)?.name}
              </h2>
              {courses.find(c => c.id === activeCourse)?.description && (
                <p className="text-sm text-slate-400 mt-1">
                  {courses.find(c => c.id === activeCourse)?.description}
                </p>
              )}
            </div>

            {/* Matrix Grid */}
            {courseMatrix.competencies?.length > 0 ? (
              <Card className="bg-[#111] border-[#222] overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#222]">
                          <th className="text-left p-4 text-slate-400 font-medium w-64">
                            Competency
                          </th>
                          {courseMatrix.levels?.map(level => (
                            <th
                              key={level.id}
                              className="text-center p-4 text-slate-400 font-medium min-w-[120px]"
                            >
                              <Badge
                                variant="outline"
                                className={LEVEL_COLORS[level.number]}
                              >
                                L{level.number}: {level.name}
                              </Badge>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {courseMatrix.competencies.map(competency => (
                          <tr key={competency.id} className="border-b border-[#222] hover:bg-[#0a0a0a]">
                            <td className="p-4">
                              <div>
                                <p className="font-medium text-white">{competency.name}</p>
                                {competency.description && (
                                  <p className="text-xs text-slate-500 mt-1">{competency.description}</p>
                                )}
                              </div>
                            </td>
                            {courseMatrix.levels?.map(level => {
                              const count = competency.level_counts?.[level.number] || 0;
                              return (
                                <td key={level.id} className="p-2 text-center">
                                  <button
                                    onClick={() => handleCellClick(competency, level)}
                                    className={`
                                      w-full h-16 rounded-lg border transition-all
                                      ${count > 0
                                        ? "bg-[#ff3300]/10 border-[#ff3300]/30 hover:bg-[#ff3300]/20"
                                        : "bg-[#0a0a0a] border-[#222] hover:border-[#333]"
                                      }
                                    `}
                                  >
                                    <div className="flex flex-col items-center justify-center">
                                      <span className={`text-lg font-bold ${count > 0 ? "text-[#ff3300]" : "text-slate-600"}`}>
                                        {count}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {count === 1 ? "item" : "items"}
                                      </span>
                                    </div>
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#111] border-[#222]">
                <CardContent className="py-12 text-center">
                  <FolderOpen className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">No competencies defined for this course</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewCompetencyModal(true)}
                    className="mt-3 border-[#333]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Competency
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        ) : activeCourse ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-8 h-8 animate-spin text-[#ff3300]" />
          </div>
        ) : (
          <Card className="bg-[#111] border-[#222]">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">Select a course to view its content matrix</p>
              <p className="text-sm text-slate-500 mt-1">
                Create a course to start organizing your content
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cell Items Modal */}
      <Dialog open={showCellModal} onOpenChange={setShowCellModal}>
        <DialogContent className="bg-[#111] border-[#222] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#ff3300]" />
              {selectedCell.competency?.name}
              {selectedCell.level && (
                <Badge
                  variant="outline"
                  className={LEVEL_COLORS[selectedCell.level.number]}
                >
                  Level {selectedCell.level.number}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Content items in this cell
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {/* Button to create new content in this cell */}
            <Button
              onClick={() => handleCreateContentInCell()}
              className="w-full bg-green-600 hover:bg-green-700 mb-4"
              data-testid="create-content-in-cell-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Contenido en esta Celda
            </Button>

            {cellItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No content items in this cell</p>
                <p className="text-xs mt-1">Usa el botón de arriba para crear contenido</p>
              </div>
            ) : (
              cellItems.map(item => {
                // Check completion status
                const hasSlides = item.slides?.presentation_url;
                const hasBlogES = item.processing_state?.blog_es_generated;
                const hasBlogEN = item.processing_state?.blog_en_generated;
                const hasNewsletter = item.processing_state?.newsletter_queued;
                const allComplete = hasSlides && hasBlogES && hasBlogEN && hasNewsletter;
                
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-[#0a0a0a] border border-[#222] rounded-lg space-y-3"
                  >
                    {/* Title - clickable to edit dictation */}
                    <div 
                      className="cursor-pointer hover:bg-[#111] p-2 -m-2 rounded transition-colors"
                      onClick={() => handleOpenDictate(item)}
                    >
                      <h4 className="font-medium text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Click para editar dictado
                      </p>
                    </div>

                    {/* Sequential Flow Status */}
                    <div className="border-t border-[#222] pt-3 space-y-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Estado</p>
                      
                      {/* Slides */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                          <Presentation className="w-4 h-4" />
                          Slides
                        </span>
                        {hasSlides ? (
                          <a 
                            href={item.slides.presentation_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Ver en Drive <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-500">
                            Pendiente
                          </Badge>
                        )}
                      </div>

                      {/* Blog ES */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                          🇪🇸 Blog Español
                        </span>
                        {hasBlogES ? (
                          <a 
                            href={item.blog_es_slug ? `/blog/${item.blog_es_slug}` : `/blog`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Ver blog <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-500">
                            Pendiente
                          </Badge>
                        )}
                      </div>

                      {/* Blog EN */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                          🇬🇧 Blog English
                        </span>
                        {hasBlogEN ? (
                          <a 
                            href={item.blog_en_slug ? `/blog/${item.blog_en_slug}` : `/blog`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Ver blog <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-500">
                            Pendiente
                          </Badge>
                        )}
                      </div>

                      {/* Newsletter - simplified, manual for now */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                          <Newspaper className="w-4 h-4" />
                          Newsletter
                        </span>
                        <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-500">
                          Manual
                        </Badge>
                      </div>

                      {/* Webinar Creation / Status */}
                      <div className="flex items-center justify-between py-1 border-t border-[#222] pt-2 mt-2">
                        <span className="text-sm text-slate-300 flex items-center gap-2">
                          <Presentation className="w-4 h-4" />
                          Webinar
                        </span>
                        {item.webinar ? (
                          <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
                            Creado
                          </Badge>
                        ) : allComplete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenWebinarModal(item)}
                            className="h-6 px-2 text-xs text-green-400 hover:text-green-300"
                          >
                            Crear Webinar
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs border-slate-500/30 text-slate-500">
                            Completa los pasos anteriores
                          </Badge>
                        )}
                      </div>

                      {/* YouTube Live Link - separate row */}
                      {item.webinar && item.youtube_url && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-slate-300 flex items-center gap-2">
                            <Youtube className="w-4 h-4 text-red-500" />
                            YouTube Live
                          </span>
                          <div className="flex items-center gap-2">
                            <a 
                              href={item.youtube_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-red-400 hover:underline flex items-center gap-1"
                              data-testid={`youtube-link-${item.id}`}
                            >
                              Ver video <ExternalLink className="w-3 h-3" />
                            </a>
                            {item.webinar.youtube_privacy !== 'public' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleChangeYouTubePrivacy(item, 'public')}
                                disabled={changingPrivacy === item.id}
                                className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                title="Hacer público"
                                data-testid={`make-public-btn-${item.id}`}
                              >
                                {changingPrivacy === item.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Globe className="w-3 h-3" />
                                )}
                              </Button>
                            ) : (
                              <Badge className="text-xs bg-green-600/20 text-green-400 border-green-600/30">
                                Público
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* LMS Course Link */}
                      {item.course_id && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-slate-300 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-400" />
                            Curso LMS
                          </span>
                          <a 
                            href={`/lms/course/${item.course_id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                          >
                            Ver curso <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Event Registration Link */}
                      {item.webinar && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-slate-300 flex items-center gap-2">
                            <Link className="w-4 h-4 text-green-400" />
                            Registro Evento
                          </span>
                          <a 
                            href={`/evento/${item.webinar.slug || item.webinar.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-green-400 hover:underline flex items-center gap-1"
                          >
                            Ver landing <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Remove from cell button */}
                    <div className="border-t border-[#222] pt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnassignItem(item.id)}
                        className="text-xs text-red-400 hover:text-red-300 h-6"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Quitar de celda
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Assign Unclassified Items Section */}
          {unclassifiedItems.length > 0 && (
            <div className="border-t border-[#222] pt-4 mt-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Assign Unclassified Items to This Cell
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {unclassifiedItems.slice(0, 10).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#222] rounded hover:border-[#333] group"
                  >
                    <span className="text-sm text-slate-300 truncate flex-1">{item.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAssignItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-green-400 hover:text-green-300 transition-opacity"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                  </div>
                ))}
                {unclassifiedItems.length > 10 && (
                  <p className="text-xs text-slate-500 text-center">
                    +{unclassifiedItems.length - 10} more unclassified items
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCellModal(false)}
              className="border-[#333]"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dictate Modal */}
      <Dialog open={showDictateModal} onOpenChange={setShowDictateModal}>
        <DialogContent className="bg-[#111] border-[#222] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Dictate Content
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Editable Title */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Título</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={saveItemMetadata}
                placeholder="Título del contenido"
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            
            {/* Course, Competency, Level row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Curso</label>
                <Select value={editCourseId} onValueChange={(v) => { setEditCourseId(v); setTimeout(saveItemMetadata, 100); }}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue placeholder="Seleccionar curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Competencia</label>
                <Select value={editCompetencyId} onValueChange={(v) => { setEditCompetencyId(v); setTimeout(saveItemMetadata, 100); }}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue placeholder="Seleccionar competencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {(courseMatrix?.competencies || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nivel</label>
                <Select value={editLevel} onValueChange={(v) => { setEditLevel(v); setTimeout(saveItemMetadata, 100); }}>
                  <SelectTrigger className="bg-[#0a0a0a] border-[#333] text-white">
                    <SelectValue placeholder="Nivel" />
                  </SelectTrigger>
                  <SelectContent>
                    {(courseMatrix?.levels || []).map(l => (
                      <SelectItem key={l.number} value={l.number.toString()}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* URL if exists */}
            {selectedItem?.url && (
              <div className="text-sm">
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir URL fuente
                </a>
              </div>
            )}
            
            {/* Dictation textarea */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Dictado / Contenido</label>
              <Textarea
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="Start typing or paste your dictation text here..."
                className="min-h-[250px] bg-[#0a0a0a] border-[#333] text-white resize-none"
              />
            </div>
            
            {/* Autosave indicator */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Saving...
                  </>
                ) : lastSaved ? (
                  <>
                    <Save className="w-3 h-3 text-green-400" />
                    Last saved: {new Date(lastSaved).toLocaleTimeString()}
                  </>
                ) : (
                  "Autosave enabled"
                )}
              </div>
              <span>{dictationText.length} characters</span>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-3">
            {/* Show generation section OR links to generated content */}
            {selectedItem && (
              <>
                {/* If not all generated, show Generate button */}
                {!(selectedItem.slides?.presentation_url && 
                   selectedItem.processing_state?.blog_es_generated && 
                   selectedItem.processing_state?.blog_en_generated) ? (
                  <>
                    {dictationText.length >= 100 ? (
                      <div className="flex items-center gap-2 flex-wrap w-full justify-center">
                        <Select value={slidesCount} onValueChange={setSlidesCount}>
                          <SelectTrigger className="w-20 bg-[#0a0a0a] border-[#333]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="6">6</SelectItem>
                            <SelectItem value="8">8</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => handleGenerateAll(selectedItem)}
                          disabled={generatingAll || generatingAI}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid="generate-all-btn"
                        >
                          {generatingAll ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              {generationProgress || "Generando..."}
                            </>
                          ) : (
                            <>
                              <Presentation className="w-4 h-4 mr-2" />
                              Generar Slides y Blogs
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center">
                        Escribe al menos 100 caracteres para generar contenido
                      </p>
                    )}
                  </>
                ) : (
                  /* If all generated, show links */
                  <div className="w-full p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400 mb-2 text-center">✅ Contenido generado</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {selectedItem.slides?.presentation_url && (
                        <a
                          href={selectedItem.slides.presentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Presentation className="w-3 h-3" />
                          Ver Slides
                        </a>
                      )}
                      {selectedItem.processing_state?.blog_es_generated && (
                        <a
                          href="/blog"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          🇪🇸 Blog ES
                        </a>
                      )}
                      {selectedItem.processing_state?.blog_en_generated && (
                        <a
                          href="/blog"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          🇬🇧 Blog EN
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  // Save metadata first
                  if (selectedItem) {
                    await api.patch(`/content/items/${selectedItem.id}`, {
                      title: editTitle,
                      course_id: editCourseId || null,
                      competency_id: editCompetencyId || null,
                      level: editLevel ? parseInt(editLevel) : null
                    });
                    
                    // Then save dictation
                    await api.patch(`/content/items/${selectedItem.id}/dictation`, {
                      dictation_draft_text: dictationText
                    });
                    
                    toast.success("Guardado correctamente");
                  }
                } catch (error) {
                  console.error("Error saving:", error);
                  toast.error("Error al guardar");
                }
                
                // Refresh data and close
                loadCourseMatrix();
                if (selectedCell.competency && selectedCell.level) {
                  loadCellItems(selectedCell.competency.id, selectedCell.level.number);
                }
                setShowDictateModal(false);
                setSlidesUrl(null);
              }}
              className="border-[#333]"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar y Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Course Modal */}
      <Dialog open={showNewCourseModal} onOpenChange={setShowNewCourseModal}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#ff3300]" />
              Create New Course
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a new course to organize your content
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Course Name</label>
              <Input
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Enter course name..."
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Description (Optional)</label>
              <Textarea
                value={newCourseDesc}
                onChange={(e) => setNewCourseDesc(e.target.value)}
                placeholder="Enter course description..."
                className="bg-[#0a0a0a] border-[#333] text-white h-20"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCourseModal(false)}
              className="border-[#333]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCourse}
              disabled={!newCourseName.trim()}
              className="bg-[#ff3300] hover:bg-[#e62e00]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Competency Modal */}
      <Dialog open={showNewCompetencyModal} onOpenChange={setShowNewCompetencyModal}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#ff3300]" />
              Create New Competency
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new competency to {courses.find(c => c.id === activeCourse)?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Competency Name</label>
              <Input
                value={newCompetencyName}
                onChange={(e) => setNewCompetencyName(e.target.value)}
                placeholder="Enter competency name..."
                className="bg-[#0a0a0a] border-[#333] text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Description (Optional)</label>
              <Textarea
                value={newCompetencyDesc}
                onChange={(e) => setNewCompetencyDesc(e.target.value)}
                placeholder="Enter competency description..."
                className="bg-[#0a0a0a] border-[#333] text-white h-20"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCompetencyModal(false)}
              className="border-[#333]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompetency}
              disabled={!newCompetencyName.trim()}
              className="bg-[#ff3300] hover:bg-[#e62e00]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Competency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webinar Creation Modal */}
      <Dialog open={showWebinarModal} onOpenChange={setShowWebinarModal}>
        <DialogContent className="bg-[#111] border-[#222] max-w-lg" data-testid="webinar-modal">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Presentation className="w-5 h-5 text-green-400" />
              Crear Webinar
            </DialogTitle>
            {webinarItem && (
              <DialogDescription className="text-slate-400">
                Basado en: {webinarItem.title}
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Fecha del Webinar *</label>
              <Input
                type="date"
                value={webinarDate}
                onChange={(e) => setWebinarDate(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
                data-testid="webinar-date-input"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Hora (México)</label>
              <Input
                type="time"
                value={webinarTime}
                onChange={(e) => setWebinarTime(e.target.value)}
                className="bg-[#0a0a0a] border-[#333] text-white"
                data-testid="webinar-time-input"
              />
            </div>

            <div className="border-t border-[#222] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Crear YouTube Live automáticamente</p>
                  <p className="text-xs text-slate-500">Se creará un broadcast programado en tu canal</p>
                </div>
                <input
                  type="checkbox"
                  checked={createYouTubeLive}
                  onChange={(e) => setCreateYouTubeLive(e.target.checked)}
                  className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a]"
                  data-testid="create-youtube-checkbox"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Auto-enrolar participantes en LMS</p>
                  <p className="text-xs text-slate-500">Los registrados se inscribirán al curso automáticamente</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoEnrollLMS}
                  onChange={(e) => setAutoEnrollLMS(e.target.checked)}
                  className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a]"
                  data-testid="auto-enroll-checkbox"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWebinarModal(false)}
              className="border-[#333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateWebinar}
              disabled={!webinarDate || creatingWebinar}
              className="bg-green-600 hover:bg-green-700"
              data-testid="create-webinar-submit"
            >
              {creatingWebinar ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Presentation className="w-4 h-4 mr-2" />
                  Crear Webinar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
