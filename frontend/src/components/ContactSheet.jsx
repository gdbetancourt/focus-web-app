import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import api from "../lib/api";
// Import canonical role mapping (single source of truth)
import { ROLE_OPTIONS as CANONICAL_ROLE_OPTIONS, normalizeRole } from "../utils/roleMapping";
import {
  isStage3, isStage4, getStageLabel, getStageColor, getStagePhase
} from "../constants/stages";
import {
  User, Mail, Phone, Linkedin, Building2, Briefcase, MapPin, Tag,
  Calendar, Clock, Save, X, ExternalLink, History, FileText, RefreshCw,
  Users, ArrowUp, ArrowDown, Link2, Trash2, Plus, Loader2, GraduationCap,
  Check, Globe, Flag, ListTodo, Circle, CheckCircle, AlertCircle
} from "lucide-react";

// Import constants from centralized file
import { 
  ALL_SALUTATIONS, 
  COUNTRY_CODES, 
  detectCountryCode, 
  removeCountryCode,
  DEFAULT_BUYER_PERSONAS 
} from "./contact-sheet/constants";

// Import extracted tab components
import { CoursesTab } from "./contact-sheet/CoursesTab";
import { CasesTab } from "./contact-sheet/CasesTab";
import { WebinarsTab } from "./contact-sheet/WebinarsTab";
import { TasksTab } from "./contact-sheet/TasksTab";
import { InfoTab } from "./contact-sheet/InfoTab";
import { RelationshipsTab } from "./contact-sheet/RelationshipsTab";

const STAGE_NAMES = {
  1: "Prospect",
  2: "Nurture",
  3: "Close",
  4: "Deliver",
  5: "Repurchase"
};

// Use canonical role options from utils/roleMapping.js
// This ensures consistency with CurrentCasesDeliveryPage grouping
const ROLE_OPTIONS = CANONICAL_ROLE_OPTIONS;

// Validation helpers
const isValidEmail = (email) => {
  if (!email) return true; // Empty is OK
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const isValidPhone = (phone) => {
  if (!phone) return true; // Empty is OK
  // Allow digits, spaces, dashes, parentheses, plus sign
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(cleaned);
};

const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export default function ContactSheet({ 
  contact: contactProp, 
  contactId: contactIdProp,
  open, 
  onOpenChange, 
  onUpdate,
  onSaved,
  onCreate,
  createMode = false,
  defaultValues = {},
  buyerPersonas: externalBuyerPersonas = []
}) {
  // === CORE STATES (declare first) ===
  const [loadState, setLoadState] = useState("idle"); // idle | loading | loaded | error
  const [loadError, setLoadError] = useState(null);
  const [contact, setContact] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [isCreateMode, setIsCreateMode] = useState(createMode);
  
  // === FORM FIELD STATES (declare before callbacks) ===
  const [emails, setEmails] = useState([{ email: "", is_primary: true }]);
  const [phones, setPhones] = useState([{ phone: "", country_code: "+52", is_primary: true }]);
  const [contactCompanies, setContactCompanies] = useState([{ company_id: null, company_name: "", is_primary: true }]);
  
  // === REFS ===
  const loadRequestRef = useRef(0);
  const loadTimeoutRef = useRef(null);
  const LOAD_TIMEOUT_MS = 15000; // 15 seconds max for loading
  
  // === ADDITIONAL STATES ===
  const [emailDuplicates, setEmailDuplicates] = useState({});
  const [phoneDuplicates, setPhoneDuplicates] = useState({});
  
  // Companies - Multiple companies support (contactCompanies declared above)
  const [companySearchResults, setCompanySearchResults] = useState([]);
  const [activeCompanyIndex, setActiveCompanyIndex] = useState(null);
  const [companySearchInput, setCompanySearchInput] = useState("");
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [showCreateCompanyForm, setShowCreateCompanyForm] = useState(false);
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("");
  const [industries, setIndustries] = useState([]);
  
  // Buyer personas
  const [buyerPersonas, setBuyerPersonas] = useState(externalBuyerPersonas);
  
  // Related contacts state
  const [relationships, setRelationships] = useState([]);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [addingRelationship, setAddingRelationship] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // LMS Courses state
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState("¡Bienvenido a tu nuevo curso!");
  const [welcomeEmailMessage, setWelcomeEmailMessage] = useState("");
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false);
  const [courseToUnenroll, setCourseToUnenroll] = useState(null);
  
  // Webinar history state
  const [webinarHistory, setWebinarHistory] = useState([]);
  const [loadingWebinars, setLoadingWebinars] = useState(false);

  // Tasks state
  const [contactTasks, setContactTasks] = useState({ pending: [], completed: [] });
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Role assignment per case state
  const [caseRoles, setCaseRoles] = useState({}); // {case_id: [roles]}
  const [roleAssignDialogOpen, setRoleAssignDialogOpen] = useState(false);
  const [pendingRoleCase, setPendingRoleCase] = useState(null); // {case_id, case_name, role}
  const [savingCaseRoles, setSavingCaseRoles] = useState(false);

  // Add/Create case state
  const [addingCase, setAddingCase] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [caseSearchResults, setCaseSearchResults] = useState([]);
  const [searchingCases, setSearchingCases] = useState(false);
  const [allCases, setAllCases] = useState([]);
  const [creatingNewCase, setCreatingNewCase] = useState(false);
  const [newCaseData, setNewCaseData] = useState({
    name: "",
    stage: "caso_solicitado",
    company_names: [],
    notes: ""
  });
  const [savingNewCase, setSavingNewCase] = useState(false);
  const [newCaseCompanyInput, setNewCaseCompanyInput] = useState("");

  // === INITIALIZE FORM FROM CONTACT DATA ===
  const initializeFormFromContact = useCallback((contactData) => {
    if (!contactData) return;
    
    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    
    // Parse name into first_name and last_name if not provided separately
    let firstName = contactData.first_name || "";
    let lastName = contactData.last_name || "";
    
    // If first_name or last_name are empty but we have a full name, parse it
    if ((!firstName || !lastName) && contactData.name) {
      const nameParts = contactData.name.trim().split(/\s+/);
      if (nameParts.length >= 1 && !firstName) {
        firstName = nameParts[0];
      }
      if (nameParts.length >= 2 && !lastName) {
        // Join all remaining parts as last name (handles middle names, compound surnames)
        lastName = nameParts.slice(1).join(" ");
      }
    }
    
    // Set form data
    setFormData({
      title: contactData.title || contactData.salutation || "",
      first_name: firstName,
      last_name: lastName,
      name: contactData.name || "",
      linkedin_url: contactData.linkedin_url || "",
      job_title: contactData.job_title || contactData.headline || "",
      location: contactData.location || "",
      country: contactData.country || "",
      buyer_persona: contactData.buyer_persona || "mateo",
      specialty: contactData.specialty || "",
      status: contactData.status || "new",
      notes: contactData.notes || "",
      stage: contactData.stage || 1,
      roles: contactData.roles || contactData.contact_types || [],
      stage_1_status: contactData.stage_1_status || "pending_accept",
      linkedin_accepted_by: contactData.linkedin_accepted_by || null,
      classification: contactData.classification || "inbound"
    });
    
    // Initialize emails
    if (contactData.emails && Array.isArray(contactData.emails) && contactData.emails.length > 0) {
      setEmails(contactData.emails.map(e => ({
        email: typeof e === 'string' ? e : e.email || "",
        is_primary: typeof e === 'object' ? e.is_primary : false
      })));
    } else if (contactData.email) {
      setEmails([{ email: contactData.email, is_primary: true }]);
    } else {
      setEmails([{ email: "", is_primary: true }]);
    }
    
    // Initialize phones
    if (contactData.phones && Array.isArray(contactData.phones) && contactData.phones.length > 0) {
      setPhones(contactData.phones.map(p => ({
        phone: typeof p === 'string' ? p : p.e164 || p.raw_input || p.phone || "",
        country_code: typeof p === 'object' ? (p.country_code || "none") : "+52",
        is_primary: typeof p === 'object' ? p.is_primary : false
      })));
    } else if (contactData.phone) {
      setPhones([{ phone: contactData.phone, country_code: "+52", is_primary: true }]);
    } else {
      setPhones([{ phone: "", country_code: "+52", is_primary: true }]);
    }
    
    // Initialize companies
    if (contactData.companies && Array.isArray(contactData.companies) && contactData.companies.length > 0) {
      setContactCompanies(contactData.companies.map(c => ({
        company_id: c.company_id || null,
        company_name: c.company_name || "",
        is_primary: c.is_primary || false
      })));
    } else if (contactData.company) {
      setContactCompanies([{ company_id: null, company_name: contactData.company, is_primary: true }]);
    } else {
      setContactCompanies([{ company_id: null, company_name: "", is_primary: true }]);
    }
    
    // Reset UI state
    setActiveCompanyIndex(null);
    setCompanySearchInput("");
    setCompanySearchResults([]);
    setActiveTab("info");
  }, []);

  // === LOAD CONTACT BY ID ===
  const loadContact = useCallback(async (contactId) => {
    const requestId = ++loadRequestRef.current;
    
    // Clear any existing timeout
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    setLoadState("loading");
    setLoadError(null);
    
    // Set timeout for loading
    loadTimeoutRef.current = setTimeout(() => {
      if (loadRequestRef.current === requestId) {
        setLoadState("error");
        setLoadError("La carga tardó demasiado. Por favor, intente de nuevo.");
      }
    }, LOAD_TIMEOUT_MS);
    
    try {
      const res = await api.get(`/contacts/${contactId}`);
      
      // Check if this is still the current request
      if (requestId !== loadRequestRef.current) {
        return;
      }
      
      // Clear timeout on success
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      setContact(res.data);
      initializeFormFromContact(res.data);
      setLoadState("loaded");
      
      // Load additional data in background
      loadBuyerPersonas();
      loadCaseHistory(res.data.id);
      loadContactTasks(res.data.id);
    } catch (err) {
      if (requestId !== loadRequestRef.current) {
        return;
      }
      
      // Clear timeout on error
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      console.error("Error loading contact:", err);
      setLoadError(err.response?.data?.detail || "Error al cargar el contacto");
      setLoadState("error");
    }
  }, [initializeFormFromContact]);

  // === RETRY LOADING ===
  const handleRetry = useCallback(() => {
    const idToLoad = contactIdProp || contact?.id;
    if (idToLoad) {
      loadContact(idToLoad);
    }
  }, [contactIdProp, contact?.id, loadContact]);

  // === MAIN EFFECT: Handle dialog open/close ===
  useEffect(() => {
    if (!open) {
      // Clear timeout when closing
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      
      // Reset everything when dialog closes
      setLoadState("idle");
      setLoadError(null);
      setContact(null);
      setFormData({});
      setCaseHistory([]);
      setWebinarHistory([]);
      setCourses([]);
      setRelationships([]);
      setCaseRoles({});
      return;
    }
    
    // Dialog is opening
    if (createMode) {
      setLoadState("loaded");
      setIsCreateMode(true);
      setFormData({
        title: defaultValues?.title || "",
        first_name: defaultValues?.first_name || "",
        last_name: defaultValues?.last_name || "",
        name: defaultValues?.name || "",
        linkedin_url: defaultValues?.linkedin_url || "",
        job_title: defaultValues?.job_title || "",
        location: defaultValues?.location || "",
        country: defaultValues?.country || "",
        buyer_persona: defaultValues?.buyer_persona || "mateo",
        specialty: defaultValues?.specialty || "",
        status: "new",
        notes: defaultValues?.notes || "",
        stage: defaultValues?.stage || 3,
        roles: defaultValues?.roles || ["deal_maker"]
      });
      
      if (defaultValues?.email) {
        setEmails([{ email: defaultValues.email, is_primary: true }]);
      } else {
        setEmails([{ email: "", is_primary: true }]);
      }
      
      if (defaultValues?.phone) {
        setPhones([{ phone: defaultValues.phone, country_code: "+52", is_primary: true }]);
      } else {
        setPhones([{ phone: "", country_code: "+52", is_primary: true }]);
      }
      
      if (defaultValues?.company) {
        setContactCompanies([{ company_id: null, company_name: defaultValues.company, is_primary: true }]);
      } else {
        setContactCompanies([{ company_id: null, company_name: "", is_primary: true }]);
      }
      
      setActiveTab("info");
      loadBuyerPersonas();
      return;
    }
    
    // Edit mode
    setIsCreateMode(false);
    
    if (contactProp) {
      // Contact provided directly - use it immediately
      setContact(contactProp);
      initializeFormFromContact(contactProp);
      setLoadState("loaded");
      // Load additional data in background
      loadBuyerPersonas();
      loadCaseHistory(contactProp.id);
      loadContactTasks(contactProp.id);
    } else if (contactIdProp) {
      // Only have ID - need to load from API
      loadContact(contactIdProp);
    } else {
      setLoadState("error");
      setLoadError("No se especificó un contacto para editar");
    }
  }, [open, createMode, contactProp, contactIdProp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Update createMode when prop changes
  useEffect(() => {
    setIsCreateMode(createMode);
  }, [createMode]);

  // Load tasks for this contact
  const loadContactTasks = async (contactId) => {
    const idToUse = contactId || contact?.id;
    if (!idToUse) return;
    setLoadingTasks(true);
    try {
      const res = await api.get(`/tasks/by-contact/${idToUse}`);
      setContactTasks({
        pending: res.data.pending || [],
        completed: res.data.completed || []
      });
    } catch (error) {
      console.error("Error loading tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Toggle task completion from ContactSheet
  const handleToggleTaskComplete = async (taskId) => {
    try {
      const res = await api.post(`/tasks/${taskId}/toggle-complete`);
      // Update local state
      if (res.data.is_completed) {
        // Move from pending to completed
        setContactTasks(prev => {
          const task = prev.pending.find(t => t.id === taskId);
          if (task) {
            return {
              pending: prev.pending.filter(t => t.id !== taskId),
              completed: [{ ...task, is_completed: true }, ...prev.completed]
            };
          }
          return prev;
        });
      } else {
        // Move from completed to pending
        setContactTasks(prev => {
          const task = prev.completed.find(t => t.id === taskId);
          if (task) {
            return {
              pending: [{ ...task, is_completed: false }, ...prev.pending],
              completed: prev.completed.filter(t => t.id !== taskId)
            };
          }
          return prev;
        });
      }
      toast.success(res.data.is_completed ? "Tarea completada" : "Tarea reabierta");
    } catch (error) {
      toast.error("Error al actualizar tarea");
    }
  };

  const loadBuyerPersonas = async () => {
    try {
      const res = await api.get("/buyer-personas-db/");
      setBuyerPersonas(res.data || []);
    } catch (error) {
      console.error("Error loading personas:", error);
    }
  };

  const loadIndustries = async () => {
    try {
      const res = await api.get("/hubspot/companies/industries");
      setIndustries(res.data.industries || []);
    } catch (error) {
      console.error("Error loading industries:", error);
    }
  };

  const loadCourses = async () => {
    if (!contact?.id) return;
    setLoadingCourses(true);
    try {
      const res = await api.get(`/lms/contact/${contact.id}/enrollments`);
      setCourses(res.data.enrollments || []);
    } catch (error) {
      console.error("Error loading enrollments:", error);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadAllCourses = async () => {
    try {
      const res = await api.get("/lms/courses");
      setAllCourses(res.data.courses || []);
    } catch (error) {
      console.error("Error loading all courses:", error);
    }
  };

  const enrollInCourse = async (courseId) => {
    if (!contact?.id || !courseId) return;
    setEnrolling(true);
    try {
      const res = await api.post("/lms/enroll", {
        contact_id: contact.id,
        course_id: courseId,
        send_welcome_email: sendWelcomeEmail,
        welcome_email_subject: welcomeEmailSubject,
        welcome_email_message: welcomeEmailMessage || undefined
      });
      if (res.data.success) {
        toast.success("Contacto enrolado exitosamente");
        if (res.data.email_sent) {
          toast.success("Email de bienvenida enviado");
        }
        loadCourses();
        setCourseSearchQuery("");
        setSendWelcomeEmail(false);
        setWelcomeEmailMessage("");
      } else {
        toast.error(res.data.message || "Error al enrolar");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enrolar en el curso");
    } finally {
      setEnrolling(false);
    }
  };

  const confirmUnenroll = (course) => {
    setCourseToUnenroll(course);
    setUnenrollDialogOpen(true);
  };

  const unenrollFromCourse = async () => {
    if (!contact?.id || !courseToUnenroll) return;
    try {
      const res = await api.post("/lms/unenroll", {
        contact_id: contact.id,
        course_id: courseToUnenroll.course_id
      });
      if (res.data.success) {
        toast.success("Contacto desenrolado exitosamente");
        loadCourses();
      }
    } catch (error) {
      toast.error("Error al desenrolar del curso");
    } finally {
      setUnenrollDialogOpen(false);
      setCourseToUnenroll(null);
    }
  };

  const createQuickCourse = async () => {
    if (!newCourseName.trim()) return;
    setCreatingCourse(true);
    try {
      const res = await api.post("/lms/courses/quick-create", {
        title: newCourseName.trim()
      });
      if (res.data.success) {
        toast.success("Curso creado exitosamente");
        // Enroll contact in the new course
        await enrollInCourse(res.data.course.id);
        setShowCreateCourse(false);
        setNewCourseName("");
        loadAllCourses();
      }
    } catch (error) {
      toast.error("Error al crear el curso");
    } finally {
      setCreatingCourse(false);
    }
  };

  const loadRelationships = async () => {
    if (!contact?.id) return;
    setLoadingRelationships(true);
    try {
      const res = await api.get(`/contacts/${contact.id}/relationships`);
      setRelationships(res.data.relationships || []);
    } catch (error) {
      console.error("Error loading relationships:", error);
    } finally {
      setLoadingRelationships(false);
    }
  };

  // Company search - for multiple companies
  const searchCompanies = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setCompanySearchResults([]);
      return;
    }
    setLoadingCompanies(true);
    try {
      const res = await api.get(`/unified-companies/search?q=${encodeURIComponent(query)}&limit=10`);
      setCompanySearchResults(res.data.companies || []);
    } catch (error) {
      console.error("Error searching companies:", error);
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  // Create new company with optional industry
  const createCompany = async (companyName, industry = "", targetIndex) => {
    setCreatingCompany(true);
    try {
      const res = await api.post("/unified-companies", { 
        name: companyName, 
        industry: industry || null,
        classification: "inbound"
      });
      if (res.data.id) {
        // Update the company at targetIndex with the unified company id
        setContactCompanies(prev => prev.map((c, i) => 
          i === targetIndex ? { ...c, company_name: companyName, company_id: res.data.id } : c
        ));
        setActiveCompanyIndex(null);
        setCompanySearchInput("");
        setShowCreateCompanyForm(false);
        setNewCompanyIndustry("");
        toast.success(`Empresa "${companyName}" creada`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear empresa");
    } finally {
      setCreatingCompany(false);
    }
  };

  // Open create company form with industry selection
  const openCreateCompanyForm = () => {
    setShowCreateCompanyForm(true);
    if (industries.length === 0) loadIndustries();
  };

  // Check for duplicate emails
  const checkEmailDuplicate = useCallback(async (email, index) => {
    if (!email || !isValidEmail(email)) {
      setEmailDuplicates(prev => ({ ...prev, [index]: null }));
      return;
    }
    try {
      const res = await api.get(`/contacts?search=${encodeURIComponent(email)}&limit=5`);
      const duplicates = (res.data.contacts || []).filter(c => 
        c.id !== contact?.id && 
        (c.email === email || c.emails?.some(e => e.email === email))
      );
      setEmailDuplicates(prev => ({ ...prev, [index]: duplicates.length > 0 ? duplicates : null }));
    } catch (error) {
      console.error("Error checking email duplicate:", error);
    }
  }, [contact?.id]);

  // Check for duplicate phones
  const checkPhoneDuplicate = useCallback(async (phone, index) => {
    if (!phone || !isValidPhone(phone)) {
      setPhoneDuplicates(prev => ({ ...prev, [index]: null }));
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 7) return;
    
    try {
      const res = await api.get(`/contacts?search=${encodeURIComponent(cleanPhone)}&limit=5`);
      const duplicates = (res.data.contacts || []).filter(c => {
        if (c.id === contact?.id) return false;
        const cPhone = (c.phone || "").replace(/\D/g, '');
        const cPhones = c.phones?.map(p => (p.e164 || p.raw_input || "").replace(/\D/g, '')) || [];
        return cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone) || 
               cPhones.some(p => p.includes(cleanPhone) || cleanPhone.includes(p));
      });
      setPhoneDuplicates(prev => ({ ...prev, [index]: duplicates.length > 0 ? duplicates : null }));
    } catch (error) {
      console.error("Error checking phone duplicate:", error);
    }
  }, [contact?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (companySearchInput && companySearchInput.length >= 2) {
        searchCompanies(companySearchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearchInput, searchCompanies]);

  // Debounced duplicate check for emails
  useEffect(() => {
    const timers = emails.map((e, idx) => {
      if (e.email && isValidEmail(e.email)) {
        return setTimeout(() => checkEmailDuplicate(e.email, idx), 500);
      }
      return null;
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [emails, checkEmailDuplicate]);

  // Debounced duplicate check for phones
  useEffect(() => {
    const timers = phones.map((p, idx) => {
      if (p.phone && isValidPhone(p.phone)) {
        return setTimeout(() => checkPhoneDuplicate(p.phone, idx), 500);
      }
      return null;
    });
    return () => timers.forEach(t => t && clearTimeout(t));
  }, [phones, checkPhoneDuplicate]);

  // Contact search for relationships
  const searchContacts = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/contacts?search=${encodeURIComponent(query)}&limit=10`);
      const relatedIds = new Set(relationships.map(r => r.contact?.id));
      const filtered = (res.data.contacts || []).filter(c => 
        c.id !== contact.id && !relatedIds.has(c.id)
      );
      setSearchResults(filtered);
    } catch (error) {
      console.error("Error searching contacts:", error);
    } finally {
      setSearching(false);
    }
  };

  // Email management
  const addEmail = () => setEmails(prev => [...prev, { email: "", is_primary: false }]);
  const removeEmail = (index) => setEmails(prev => prev.filter((_, i) => i !== index));
  const updateEmail = (index, value) => setEmails(prev => prev.map((e, i) => i === index ? { ...e, email: value } : e));
  const setPrimaryEmail = (index) => setEmails(prev => prev.map((e, i) => ({ ...e, is_primary: i === index })));

  // Phone management
  const addPhone = () => setPhones(prev => [...prev, { phone: "", country_code: "+52", is_primary: false }]);
  const removePhone = (index) => setPhones(prev => prev.filter((_, i) => i !== index));
  const updatePhone = (index, value) => setPhones(prev => prev.map((p, i) => i === index ? { ...p, phone: value } : p));
  const updatePhoneCountry = (index, code) => setPhones(prev => prev.map((p, i) => i === index ? { ...p, country_code: code } : p));
  const setPrimaryPhone = (index) => setPhones(prev => prev.map((p, i) => ({ ...p, is_primary: i === index })));

  // Company management - Multiple companies
  const addCompany = () => setContactCompanies(prev => [...prev, { company_id: null, company_name: "", is_primary: false }]);
  const removeCompany = (index) => {
    setContactCompanies(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // If we removed the primary company, make the first one primary
      if (prev[index]?.is_primary && updated.length > 0) {
        updated[0].is_primary = true;
      }
      return updated.length > 0 ? updated : [{ company_id: null, company_name: "", is_primary: true }];
    });
  };
  const setPrimaryCompany = (index) => setContactCompanies(prev => prev.map((c, i) => ({ ...c, is_primary: i === index })));
  const selectCompany = (index, company) => {
    setContactCompanies(prev => prev.map((c, i) => 
      i === index ? { ...c, company_id: company.id || null, company_name: company.name } : c
    ));
    setActiveCompanyIndex(null);
    setCompanySearchInput("");
    setCompanySearchResults([]);
  };

  // Role management
  const toggleRole = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles?.includes(role) 
        ? prev.roles.filter(r => r !== role)
        : [...(prev.roles || []), role]
    }));
  };

  // Case-specific role management
  const toggleCaseRole = (caseId, role) => {
    setCaseRoles(prev => {
      const currentRoles = prev[caseId] || [];
      if (currentRoles.includes(role)) {
        return { ...prev, [caseId]: currentRoles.filter(r => r !== role) };
      } else {
        return { ...prev, [caseId]: [...currentRoles, role] };
      }
    });
  };

  // Track original case roles for dirty checking
  const [originalCaseRoles, setOriginalCaseRoles] = useState({});

  const saveCaseRoles = async (caseId, caseName) => {
    if (!contact?.id) return;
    
    const roles = caseRoles[caseId] || [];
    // Allow saving empty roles array (to clear all roles)
    
    setSavingCaseRoles(true);
    try {
      // Use the new PUT endpoint that replaces all roles for this case
      const response = await api.put("/todays-focus/case-roles", {
        contact_id: contact.id,
        case_id: caseId,
        roles: roles  // Can be empty to clear all roles
      });
      
      if (roles.length > 0) {
        toast.success(`Roles asignados a ${caseName}`);
      } else {
        toast.success(`Roles eliminados de ${caseName}`);
      }
      
      // Reload case history to get fresh data from server
      // This ensures originalCaseRoles is synced with server state
      await loadCaseHistory();
      
      // CRITICAL: Call onSaved to notify parent (CurrentCasesDeliveryPage) to reload
      // This ensures the role grouping updates without requiring a page refresh
      if (onSaved) {
        onSaved();
      }
      
      // Update global roles if any were added
      if (roles.length > 0) {
        setFormData(prev => ({
          ...prev,
          roles: [...new Set([...(prev.roles || []), ...roles])]
        }));
      }
    } catch (error) {
      console.error("Error saving case roles:", error);
      toast.error("Error al guardar roles");
    } finally {
      setSavingCaseRoles(false);
    }
  };

  // Check if case roles are different from original (dirty)
  const isCaseRolesDirty = (caseId) => {
    const current = (caseRoles[caseId] || []).slice().sort();
    const original = (originalCaseRoles[caseId] || []).slice().sort();
    return JSON.stringify(current) !== JSON.stringify(original);
  };

  const handleSave = async () => {
    // Validate emails
    const invalidEmails = emails.filter(e => e.email && !isValidEmail(e.email));
    if (invalidEmails.length > 0) {
      toast.error("Please fix invalid email addresses");
      return;
    }
    
    // Validate phones
    const invalidPhones = phones.filter(p => p.phone && !isValidPhone(p.phone));
    if (invalidPhones.length > 0) {
      toast.error("Please fix invalid phone numbers");
      return;
    }
    
    setSaving(true);
    try {
      const primaryEmail = emails.find(e => e.is_primary)?.email || emails[0]?.email || "";
      const primaryPhone = phones.find(p => p.is_primary)?.phone || phones[0]?.phone || "";
      
      // Process companies - filter out empty ones and ensure proper structure
      const validCompanies = contactCompanies
        .filter(c => c.company_name && c.company_name.trim())
        .map(c => ({
          company_id: c.company_id || null,
          company_name: c.company_name.trim(),
          is_primary: c.is_primary
        }));
      
      // Ensure at least one primary if companies exist
      if (validCompanies.length > 0 && !validCompanies.some(c => c.is_primary)) {
        validCompanies[0].is_primary = true;
      }
      
      // Get primary company name for legacy field
      const primaryCompanyName = validCompanies.find(c => c.is_primary)?.company_name || 
                                 validCompanies[0]?.company_name || "";
      
      const dataToSave = {
        ...formData,
        salutation: formData.title,
        name: `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || formData.name,
        // Only include email if it has a value (avoid duplicate key error with empty strings)
        ...(primaryEmail ? { email: primaryEmail } : {}),
        emails: emails.filter(e => e.email).map(e => ({ email: e.email, is_primary: e.is_primary })),
        // Only include phone if it has a value
        ...(primaryPhone ? { phone: primaryPhone } : {}),
        phones: phones.filter(p => p.phone).map(p => ({ 
          raw_input: p.phone, 
          e164: p.phone, 
          country_code: p.country_code === "none" ? "" : p.country_code, 
          is_primary: p.is_primary 
        })),
        company: primaryCompanyName,  // Legacy field
        companies: validCompanies,     // New multi-company field
        contact_types: formData.roles
      };
      
      // Handle create mode
      if (isCreateMode || createMode) {
        // Validate name is required for creation
        if (!dataToSave.name?.trim() && !formData.first_name?.trim()) {
          toast.error("El nombre es requerido");
          setSaving(false);
          return;
        }
        
        // Call onCreate callback which handles the API call
        if (onCreate) {
          await onCreate(dataToSave);
        }
        onOpenChange(false);
        return;
      }
      
      // Edit mode - need contact ID
      if (!contact?.id) {
        toast.error("No se puede guardar sin ID de contacto");
        setSaving(false);
        return;
      }
      
      await api.put(`/contacts/${contact.id}`, dataToSave);
      toast.success("Contacto actualizado");
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (newStage) => {
    if (!contact?.id) return;
    setSaving(true);
    try {
      await api.put(`/contacts/${contact.id}/stage?stage=${newStage}`);
      setFormData(prev => ({ ...prev, stage: parseInt(newStage) }));
      toast.success(`Moved to ${STAGE_NAMES[newStage]}`);
      onUpdate?.();
    } catch (error) {
      toast.error("Failed to change stage");
    } finally {
      setSaving(false);
    }
  };

  // Relationship management
  const addRelationship = async (targetContactId, relationshipType) => {
    try {
      await api.post(`/contacts/${contact.id}/relationships`, {
        target_contact_id: targetContactId,
        relationship_type: relationshipType
      });
      toast.success("Relationship added");
      loadRelationships();
      setSearchQuery("");
      setSearchResults([]);
      setAddingRelationship(false);
      onUpdate?.();
    } catch (error) {
      toast.error("Failed to add relationship");
    }
  };

  const removeRelationship = async (targetContactId) => {
    try {
      await api.delete(`/contacts/${contact.id}/relationships/${targetContactId}`);
      toast.success("Relationship removed");
      loadRelationships();
      onUpdate?.();
    } catch (error) {
      toast.error("Failed to remove relationship");
    }
  };

  // Load webinar history
  const loadWebinarHistory = useCallback(async () => {
    if (!contact?.id) return;
    setLoadingWebinars(true);
    try {
      const res = await api.get(`/events-v2/contact/${contact.id}/history`);
      setWebinarHistory(res.data?.webinar_history || []);
    } catch (error) {
      console.error("Error loading webinar history:", error);
      setWebinarHistory([]);
    } finally {
      setLoadingWebinars(false);
    }
  }, [contact?.id]);

  // Load cases history
  const [caseHistory, setCaseHistory] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  
  const loadCaseHistory = useCallback(async (contactId) => {
    const idToUse = contactId || contact?.id;
    if (!idToUse) return;
    setLoadingCases(true);
    try {
      const res = await api.get(`/contacts/${idToUse}/cases`);
      const rawCases = res.data?.cases || res.data || [];
      // Flatten case_roles from the matching contact entry to case level
      const cases = rawCases.map(c => {
        const contactEntry = (c.contacts || []).find(ct => ct.id === idToUse);
        return { ...c, case_roles: contactEntry?.case_roles || [] };
      });
      setCaseHistory(cases);

      // Hydrate caseRoles from the backend response
      // This ensures the modal shows the correct pre-selected roles
      const rolesMap = {};
      const originalMap = {};
      for (const caseItem of cases) {
        // Use case_roles from backend response (authoritative source)
        const roles = caseItem.case_roles || [];
        rolesMap[caseItem.id] = [...roles];
        originalMap[caseItem.id] = [...roles];  // Track original for dirty checking
      }
      setCaseRoles(rolesMap);
      setOriginalCaseRoles(originalMap);
    } catch (error) {
      console.error("Error loading case history:", error);
      setCaseHistory([]);
      setCaseRoles({});
      setOriginalCaseRoles({});
    } finally {
      setLoadingCases(false);
    }
  }, [contact?.id]);

  // Load webinars when tab changes to webinars
  useEffect(() => {
    if (activeTab === "webinars" && contact?.id && webinarHistory.length === 0) {
      loadWebinarHistory();
    }
  }, [activeTab, contact?.id, loadWebinarHistory, webinarHistory.length]);

  // Load cases when tab changes to cases OR when modal opens with cases tab active
  // Also reload if contact changes
  useEffect(() => {
    if (open && activeTab === "cases" && contact?.id) {
      // Always reload when switching to cases tab or when modal opens
      // This ensures fresh data and prevents stale/cached roles
      loadCaseHistory();
    }
  }, [open, activeTab, contact?.id, loadCaseHistory]);

  // Format watch time
  const formatWatchTime = (seconds) => {
    if (!seconds) return "0m";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getSourceLabel = (source) => {
    const labels = {
      'molecules_deal_makers': 'Molecules Search',
      'deal_makers_by_post': 'LinkedIn Posts',
      'linkedin_position': 'Position Search',
      'manual': 'Manual Entry',
      'hubspot': 'HubSpot Import',
      'import': 'CSV Import'
    };
    return labels[source] || source || 'Unknown';
  };

  // Search cases function
  const searchCases = async (query) => {
    if (!query || query.length < 2) {
      // Load all cases if no query
      setSearchingCases(true);
      try {
        const res = await api.get("/cases/");
        const cases = res.data.cases || res.data || [];
        setAllCases(cases);
        setCaseSearchResults(cases);
      } catch (error) {
        console.error("Error loading cases:", error);
      } finally {
        setSearchingCases(false);
      }
      return;
    }
    
    setSearchingCases(true);
    try {
      const res = await api.get(`/cases/?search=${encodeURIComponent(query)}`);
      const cases = res.data.cases || res.data || [];
      setCaseSearchResults(cases);
    } catch (error) {
      console.error("Error searching cases:", error);
    } finally {
      setSearchingCases(false);
    }
  };

  // Load all cases when adding case mode is activated
  useEffect(() => {
    if (addingCase && allCases.length === 0) {
      searchCases("");
    }
  }, [addingCase]);

  // Add contact to existing case
  const addContactToCase = async (caseItem, role = "Deal Maker") => {
    try {
      const contactId = contact?.id || formData.id;
      if (!contactId) {
        toast.error("Primero guarda el contacto");
        return;
      }
      
      // Add contact to case
      await api.post(`/cases/${caseItem.id}/add-contact`, {
        contact_id: contactId,
        role: role
      });
      
      toast.success(`Contacto agregado al caso: ${caseItem.name}`);
      setAddingCase(false);
      setCaseSearchQuery("");
      
      // Reload case history
      if (contact?.id) {
        const casesRes = await api.get(`/contacts/${contact.id}/cases`);
        setCaseHistory(casesRes.data.cases || []);
      }
    } catch (error) {
      console.error("Error adding contact to case:", error);
      toast.error("Error al agregar contacto al caso");
    }
  };

  // Remove contact from case
  const removeContactFromCase = async (caseId) => {
    if (!window.confirm("¿Eliminar este contacto del caso?")) return;
    
    const contactId = contact?.id;
    if (!contactId) return;
    
    try {
      await api.delete(`/cases/${caseId}/remove-contact/${contactId}`);
      toast.success("Contacto eliminado del caso");
      
      // Reload case history
      const casesRes = await api.get(`/contacts/${contactId}/cases`);
      setCaseHistory(casesRes.data.cases || []);
    } catch (error) {
      console.error("Error removing contact from case:", error);
      toast.error("Error al eliminar contacto del caso");
    }
  };

  // Create new case with this contact
  const createNewCase = async () => {
    if (!newCaseData.name.trim()) {
      toast.error("El nombre del caso es requerido");
      return;
    }
    
    const contactId = contact?.id || formData.id;
    if (!contactId && !isCreateMode) {
      toast.error("Primero guarda el contacto");
      return;
    }
    
    setSavingNewCase(true);
    try {
      const casePayload = {
        name: newCaseData.name.trim(),
        stage: newCaseData.stage,
        status: "active",
        company_names: newCaseData.company_names.filter(c => c.trim()),
        notes: newCaseData.notes,
        contact_ids: contactId ? [contactId] : [],
        quotes: []
      };
      
      const res = await api.post("/cases/", casePayload);
      
      toast.success(`Caso creado: ${newCaseData.name}`);
      setCreatingNewCase(false);
      setAddingCase(false);
      setNewCaseData({ name: "", stage: "caso_solicitado", company_names: [], notes: "" });
      
      // Reload case history
      if (contactId) {
        const casesRes = await api.get(`/contacts/${contactId}/cases`);
        setCaseHistory(casesRes.data.cases || []);
      }
    } catch (error) {
      console.error("Error creating case:", error);
      toast.error("Error al crear caso");
    } finally {
      setSavingNewCase(false);
    }
  };

  // Group cases by stage
  const groupCasesByStage = (cases) => {
    const stages = {
      caso_solicitado: { label: "Solicitado", color: "blue", cases: [] },
      caso_presentado: { label: "Presentado", color: "purple", cases: [] },
      interes_en_caso: { label: "Interés", color: "green", cases: [] },
      cierre_administrativo: { label: "Cierre Admin.", color: "amber", cases: [] }
    };
    
    cases.forEach(c => {
      if (stages[c.stage]) {
        stages[c.stage].cases.push(c);
      }
    });
    
    return stages;
  };

  // Don't render if no contact AND not in create mode
  if (!contact && !isCreateMode && !createMode) return null;

  // Filter courses for dropdown - exclude already enrolled and filter by search
  const enrolledCourseIds = new Set(courses.map(c => c.course_id));
  const availableCourses = allCourses
    .filter(c => !enrolledCourseIds.has(c.id) && (c.title || c.name))
    .filter(c => {
      if (!courseSearchQuery) return true;
      const searchLower = courseSearchQuery.toLowerCase();
      return (c.title || c.name || "").toLowerCase().includes(searchLower);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f0f] border-[#222] text-white max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Loading state */}
        {loadState === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#ff3300] animate-spin mb-4" />
            <p className="text-slate-400">Cargando contacto...</p>
          </div>
        )}
        
        {/* Error state */}
        {loadState === "error" && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-slate-200 text-lg mb-2">Error al cargar contacto</p>
            <p className="text-slate-400 text-sm mb-4">{loadError || "No se pudo obtener la información"}</p>
            <Button 
              onClick={handleRetry}
              className="bg-[#ff3300] hover:bg-[#cc2900]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        )}
        
        {/* Loaded state - show content */}
        {loadState === "loaded" && (
          <>
        <DialogHeader className="border-b border-[#222] pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${isCreateMode ? 'bg-blue-500/20' : 'bg-[#ff3300]/20'} flex items-center justify-center`}>
                {isCreateMode ? (
                  <Plus className="w-6 h-6 text-blue-400" />
                ) : (
                  <span className="text-[#ff3300] font-bold text-lg">
                    {(formData.first_name || contact?.name || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {isCreateMode 
                    ? "Crear Nuevo Contacto" 
                    : `${formData.title} ${formData.first_name} ${formData.last_name}`.trim() || contact?.name || "Contacto"
                  }
                </h2>
                <p className="text-sm text-slate-400">
                  {isCreateMode 
                    ? "Completa la información del nuevo contacto" 
                    : formData.job_title || "No title"
                  }
                </p>
              </div>
            </div>
            <Badge className={`${isCreateMode ? 'bg-blue-500/20 text-blue-400' : 'bg-[#ff3300]/20 text-[#ff3300]'}`}>
              Stage {formData.stage}: {STAGE_NAMES[formData.stage]}
            </Badge>
            {/* Classification Selector */}
            <Select
              value={formData.classification || "inbound"}
              onValueChange={async (value) => {
                const prevValue = formData.classification;
                setFormData(prev => ({ ...prev, classification: value }));
                
                // Auto-save classification change (only if contact exists)
                if (!contact?.id) return;
                
                try {
                  const response = await fetch(
                    `${process.env.REACT_APP_BACKEND_URL}/api/contacts/${contact.id}`,
                    {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ classification: value })
                    }
                  );
                  
                  if (response.ok) {
                    toast.success(`Clasificación: ${value === 'outbound' ? 'Outbound' : 'Inbound'}`);
                  } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || `Error ${response.status}`);
                  }
                } catch (error) {
                  console.error("Error saving classification:", error);
                  toast.error(error.message || "Error al guardar clasificación");
                  setFormData(prev => ({ ...prev, classification: prevValue }));
                }
              }}
            >
              <SelectTrigger 
                className={`w-[120px] h-7 ml-2 text-xs border-0 ${
                  formData.classification === 'outbound' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-slate-500/20 text-slate-400'
                }`}
                data-testid="classification-selector"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#333]">
                <SelectItem value="inbound" className="text-slate-300">Inbound</SelectItem>
                <SelectItem value="outbound" className="text-green-400">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="bg-[#1a1a1a] border-b border-[#222] rounded-none px-4 flex-wrap">
            <TabsTrigger value="info" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
              <User className="w-4 h-4 mr-2" /> Info
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
              <History className="w-4 h-4 mr-2" /> Activity
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
              <FileText className="w-4 h-4 mr-2" /> Notes
            </TabsTrigger>
            <TabsTrigger value="relationships" className="data-[state=active]:bg-[#ff3300]/20 data-[state=active]:text-[#ff3300]">
              <Users className="w-4 h-4 mr-2" /> Related
              {relationships.length > 0 && <Badge className="ml-2 bg-[#ff3300]/20 text-[#ff3300] text-xs px-1.5">{relationships.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="courses" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              <GraduationCap className="w-4 h-4 mr-2" /> LMS
              {courses.length > 0 && <Badge className="ml-2 bg-purple-500/20 text-purple-400 text-xs px-1.5">{courses.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="webinars" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
              <Calendar className="w-4 h-4 mr-2" /> Webinars
              {webinarHistory.length > 0 && <Badge className="ml-2 bg-green-500/20 text-green-400 text-xs px-1.5">{webinarHistory.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="cases" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              <Briefcase className="w-4 h-4 mr-2" /> Casos
              {caseHistory.length > 0 && <Badge className="ml-2 bg-orange-500/20 text-orange-400 text-xs px-1.5">{caseHistory.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              <ListTodo className="w-4 h-4 mr-2" /> Tasks
              {(contactTasks.pending.length + contactTasks.completed.length) > 0 && (
                <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 text-xs px-1.5">
                  {contactTasks.pending.length + contactTasks.completed.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto p-4">
            {/* ===== INFO TAB ===== */}
            <TabsContent value="info" className="mt-0 space-y-4">
              <InfoTab
                // Form data
                formData={formData}
                setFormData={setFormData}
                
                // Emails
                emails={emails}
                emailDuplicates={emailDuplicates}
                addEmail={addEmail}
                updateEmail={updateEmail}
                removeEmail={removeEmail}
                setPrimaryEmail={setPrimaryEmail}
                
                // Phones
                phones={phones}
                phoneDuplicates={phoneDuplicates}
                addPhone={addPhone}
                updatePhone={updatePhone}
                updatePhoneCountry={updatePhoneCountry}
                removePhone={removePhone}
                setPrimaryPhone={setPrimaryPhone}
                
                // Companies
                contactCompanies={contactCompanies}
                activeCompanyIndex={activeCompanyIndex}
                setActiveCompanyIndex={setActiveCompanyIndex}
                companySearchInput={companySearchInput}
                setCompanySearchInput={setCompanySearchInput}
                companySearchResults={companySearchResults}
                setCompanySearchResults={setCompanySearchResults}
                loadingCompanies={loadingCompanies}
                addCompany={addCompany}
                selectCompany={selectCompany}
                removeCompany={removeCompany}
                setPrimaryCompany={setPrimaryCompany}
                
                // Company creation
                showCreateCompanyForm={showCreateCompanyForm}
                setShowCreateCompanyForm={setShowCreateCompanyForm}
                newCompanyIndustry={newCompanyIndustry}
                setNewCompanyIndustry={setNewCompanyIndustry}
                industries={industries}
                loadIndustries={loadIndustries}
                createCompany={createCompany}
                creatingCompany={creatingCompany}
                openCreateCompanyForm={openCreateCompanyForm}
                
                // Buyer personas
                buyerPersonas={buyerPersonas}
                
                // Stage
                handleStageChange={handleStageChange}
                
                // Roles
                ROLE_OPTIONS={ROLE_OPTIONS}
                toggleRole={toggleRole}
                
                // Case roles
                isCreateMode={isCreateMode}
                createMode={createMode}
                loadingCases={loadingCases}
                caseHistory={caseHistory}
                caseRoles={caseRoles}
                toggleCaseRole={toggleCaseRole}
                saveCaseRoles={saveCaseRoles}
                savingCaseRoles={savingCaseRoles}
                isCaseRolesDirty={isCaseRolesDirty}
                loadCaseHistory={loadCaseHistory}
              />
            </TabsContent>
            {/* ===== ACTIVITY TAB ===== */}
            <TabsContent value="activity" className="mt-0 space-y-3">
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
                <Label className="text-slate-400 text-xs">Source</Label>
                <p className="text-white font-medium">{getSourceLabel(contact?.source)}</p>
              </div>
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
                <Label className="text-slate-400 text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Created
                </Label>
                <p className="text-white">{formatDate(contact?.created_at)}</p>
              </div>
              <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
                <Label className="text-slate-400 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last Updated
                </Label>
                <p className="text-white">{formatDate(contact?.updated_at)}</p>
              </div>
              {contact?.tags?.length > 0 && (
                <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#222]">
                  <Label className="text-slate-400 text-xs mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {contact?.tags?.map((tag, idx) => (
                      <Badge key={idx} className="bg-[#ff3300]/20 text-[#ff3300] text-xs">{tag.name || tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ===== NOTES TAB ===== */}
            <TabsContent value="notes" className="mt-0">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="bg-[#1a1a1a] border-[#333] min-h-[300px]"
                placeholder="Add notes about this contact..."
              />
            </TabsContent>

            {/* ===== RELATIONSHIPS TAB ===== */}
            <TabsContent value="relationships" className="mt-0 space-y-4">
              <RelationshipsTab
                addingRelationship={addingRelationship}
                setAddingRelationship={setAddingRelationship}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                setSearchResults={setSearchResults}
                searching={searching}
                searchContacts={searchContacts}
                relationships={relationships}
                loadingRelationships={loadingRelationships}
                addRelationship={addRelationship}
                removeRelationship={removeRelationship}
              />
            </TabsContent>

            {/* ===== LMS COURSES TAB ===== */}
            <TabsContent value="courses" className="mt-0">
              <CoursesTab
                contactId={contact?.id || contactIdProp}
                courses={courses}
                loadingCourses={loadingCourses}
                onCoursesUpdate={loadCourses}
              />
            </TabsContent>

            {/* ===== WEBINARS TAB ===== */}
            <TabsContent value="webinars" className="mt-0">
              <WebinarsTab
                webinarHistory={webinarHistory}
                loadingWebinars={loadingWebinars}
              />
            </TabsContent>

            {/* ===== CASES TAB ===== */}
            <TabsContent value="cases" className="mt-0">
              <CasesTab
                contactId={contact?.id || contactIdProp}
                contactName={contact?.name || `${contact?.firstname || ''} ${contact?.lastname || ''}`}
                caseHistory={caseHistory}
                loadingCases={loadingCases}
                onCasesUpdate={loadCaseHistory}
              />
            </TabsContent>

            {/* ===== TASKS TAB ===== */}
            <TabsContent value="tasks" className="mt-0">
              <TasksTab
                contactTasks={contactTasks}
                loadingTasks={loadingTasks}
                onToggleTaskComplete={handleToggleTaskComplete}
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t border-[#222] pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#333]">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className={isCreateMode ? "bg-blue-600 hover:bg-blue-700" : "bg-[#ff3300] hover:bg-[#cc2900]"}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : isCreateMode ? <Plus className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {isCreateMode ? "Crear Contacto" : "Guardar Cambios"}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
