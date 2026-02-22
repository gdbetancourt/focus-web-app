import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
// Login page removed - auth happens via home page modal
import AuthCallback from "./pages/AuthCallback";
import AuthProcess from "./pages/AuthProcess";
import Layout from "./components/Layout";
import PublicWebsite from "./pages/PublicWebsite";
import "./App.css";

// New Focus System
import { 
  FocusLayout, 
  FocusRedirect,
  MaxLinkedInConexionsPage,
  ImportNewConnectionsPage,
  MarketingEventPlanningPage,
  BulkEventInvitationsPage,
  ImportRegistrantsPage,
  QualifyNewContactsPage,
  PersonalInvitationsPage,
  AssignDMPage,
  RoleAssignmentPage,
  MergeCompaniesPage,
  WhatsAppFollowUpPage,
  EmailFollowUpPage,
  PreProjectsPage,
  TasksOutsideSystemPage,
  YouTubeIdeasPage,
  CurrentCasesPage,
  MergeDuplicatesFocusPage,
  AnalyticsPage,
  // Asset Pages
  ContactsAssetPage,
  CompaniesAssetPage,
  PharmaPipelinesAssetPage,
  TestimonialsAssetPage,
  SEOAssetPage,
  AutoassessmentsAssetPage,
  ProgramsAssetPage,
  PricingAssetPage,
  FormatosAssetPage,
  TimeTrackerAssetPage,
  CertificatesAssetPage,
  PersonaClassifierAssetPage,
} from "./components/focus";

// Step 1: Prospect - Individual Scrapper Pages
import MoleculesDealMakers from "./pages/scrappers/MoleculesDealMakers";
import PostsDealMakers from "./pages/scrappers/PostsDealMakers";
import PositionDealMakers from "./pages/scrappers/PositionDealMakers";

// Legacy (keep for now)
import PharmaPipelines from "./pages/scrappers/PharmaPipelines";

// Stage Contacts - removed, now redirected to unified All Contacts in Assets
// import NurtureContacts from "./pages/stages/NurtureContacts";
// import CloseContacts from "./pages/stages/CloseContacts";
// import DeliverContacts from "./pages/stages/DeliverContacts";

// Step 2: Nurture
import Contacts from "./pages/Contacts";
import Events from "./pages/Events";
import EventsV2 from "./pages/EventsV2";
import EventLandingPage from "./pages/EventLandingPage";
import Campaigns from "./pages/Campaigns";
import CSVImporter from "./pages/CSVImporter";
import LinkedInImporterPage from "./pages/LinkedInImporterPage";
import ContentFlow from "./pages/ContentFlow";

// Step 3: Close
import Cierre from "./pages/Cierre";
import Cotizador from "./pages/Cotizador";
import CasesPage from "./pages/CasesPage";

// Step 4: Deliver
import Certificados from "./pages/Certificados";
import TimeTracker from "./pages/TimeTracker";
import WhatsAppConfirmations from "./pages/WhatsAppConfirmations";
import DeliveryPage from "./pages/DeliveryPage";

// Daily Messages
import MensajesHoy from "./pages/MensajesHoy";
import EmailMetrics from "./pages/EmailMetrics";

// Step 2 Additional
import VenueFinder from "./pages/VenueFinder";
import TestimonialsPage from "./pages/TestimonialsPage";
import Website from "./pages/Website";
import LegalPage from "./pages/LegalPage";
import MuroTestimonios from "./pages/MuroTestimonios";
import NewslettersPage from "./pages/NewslettersPage";
import EmailMetricsDashboard from "./pages/EmailMetricsDashboard";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import PublicLayout from "./components/PublicLayout";

// Future Features (Coming Soon)
import Attract from "./pages/Attract";
import MediaRelations from "./pages/MediaRelations";
import EugenioRelations from "./pages/EugenioRelations";
import WriteBooks from "./pages/WriteBooks";
import LongFormVideos from "./pages/LongFormVideos";
import Documents from "./pages/Documents";
import BookletsCases from "./pages/BookletsCases";
import Media from "./pages/Media";
// StudentsRecommendations removed - now in unified All Contacts
import LongFormVideoSearch from "./pages/LongFormVideoSearch";
import GEO from "./pages/GEO";
import SEO from "./pages/SEO";
import SocialFollowers from "./pages/SocialFollowers";
import EditorialRelations from "./pages/EditorialRelations";
import LinkedInInvitations from "./pages/LinkedInInvitations";

// LMS
import LMSPage from "./pages/LMSPage";
import WatchingRoom from "./pages/WatchingRoom";
import { CourseCatalog, CourseDetail } from "./pages/LearnPages";
import ExternalLMSPage from "./pages/ExternalLMSPage";
import PublicCoursePage from "./pages/PublicCoursePage";

// Blog
import BlogPage from "./pages/BlogPage";
import { BlogList, BlogPost } from "./pages/PublicBlog";
import ContentPipeline from "./pages/ContentPipeline";
import VideoProcessing from "./pages/VideoProcessing";
import QuizPage from "./pages/QuizPage";
import CountdownPage from "./pages/CountdownPage";
import QuickCapture from "./pages/QuickCapture";

// Foundations
import Who from "./pages/foundations/Who";
import Companies from "./pages/Companies";
import CompaniesPage from "./pages/foundations/CompaniesPage";
import MediaCompaniesPage from "./pages/foundations/MediaCompaniesPage";
import AllContacts from "./pages/foundations/AllContacts";
import ThematicAxes from "./pages/ThematicAxes";
import Industries from "./pages/Industries";
import FormatosPage from "./pages/FormatosPage";
import ProgramasPage from "./pages/ProgramasPage";
import NivelesPage from "./pages/NivelesPage";

// Infostructure
import MedicalSpecialties from "./pages/MedicalSpecialties";
import MedicalSocietiesPage from "./pages/MedicalSocietiesPage";
import BusinessSearchConfig from "./pages/BusinessSearchConfig";

// Nurture - Medical Society Events
import MedicalSocietyEvents from "./pages/MedicalSocietyEvents";

// Settings & Others
import Settings from "./pages/Settings";
import GmailCallback from "./pages/GmailCallback";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import History from "./pages/History";
import Templates from "./pages/Templates";
import EventStats from "./pages/EventStats";
import PublicQuiz from "./pages/PublicQuiz";
import DevKanban from "./pages/DevKanban";

// Sponsorship
import SponsorshipPage from "./pages/SponsorshipPage";

// Admin Tools
import MergeDuplicates from "./pages/MergeDuplicates";
import MergeDuplicatesPage from "./pages/foundations/MergeDuplicatesPage";

// Scraping Automation
import ScrapingAutomation from "./pages/ScrapingAutomation";

// Convenios (Close Step)
import Convenios from "./pages/Convenios";

// Foundations
import Competencias from "./pages/Competencias";

// Content System
import ContentMatrix from "./pages/ContentMatrix";
import NewsletterQueue from "./pages/NewsletterQueue";

const ProtectedRoute = ({ children }) => {
  const { user, loading, login } = useAuth();
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [showLegacyLogin, setShowLegacyLogin] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  
  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  
  const handleLegacyLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoginLoading(true);
    try {
      await login(email, password);
      // Page will re-render automatically after login sets user
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      setLoginLoading(false);
    }
  };
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#ff3300] flex items-center justify-center animate-pulse">
            <span className="text-white font-black text-xl">F</span>
          </div>
          <div className="text-slate-400">Loading Focus...</div>
        </div>
      </div>
    );
  }
  
  // If user is authenticated, render children
  if (user) {
    return children;
  }
  
  // Not authenticated - redirect to public homepage
  return <Navigate to="/public" replace />
};

// Smart Home Route - shows public site or redirects to dashboard based on auth
const SmartHomeRoute = () => {
  const { user, userType, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#ff3300] flex items-center justify-center animate-pulse">
            <span className="text-white font-black text-xl">F</span>
          </div>
          <div className="text-slate-400">Loading Focus...</div>
        </div>
      </div>
    );
  }
  
  // If authenticated as external user, go to LMS
  if (user && userType === 'external') {
    return <Navigate to="/nurture/lms" replace />;
  }
  
  // If authenticated as staff, go to Focus dashboard
  if (user) {
    return <Navigate to="/focus" replace />;
  }
  
  // Not authenticated - show public website
  return <PublicWebsite />;
};

// Component to check for session_id in URL hash and route to AuthCallback
function AppRouter() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Check URL fragment for session_id (synchronously during render, NOT in useEffect)
  // This prevents race conditions by processing new session_id FIRST
  // BUT: Skip if user is already authenticated (callback was already processed)
  if (location.hash?.includes('session_id=') && !user) {
    return <AuthCallback />;
  }
  
  return <AppRoutes />;
}

function AppRoutes() {
  return (
    <Routes>
          {/* Home - Smart route that shows public site or redirects to dashboard */}
          <Route path="/" element={<SmartHomeRoute />} />
          
          {/* Public website - no auth required */}
          <Route path="/public" element={<PublicWebsite />} />
          
          {/* Public Learning Center - no auth required */}
          <Route path="/learn" element={<PublicLayout><CourseCatalog /></PublicLayout>} />
          <Route path="/learn/course/:courseId" element={<PublicLayout><CourseDetail /></PublicLayout>} />
          
          {/* Public Blog - no auth required */}
          <Route path="/blog" element={<PublicLayout><BlogList /></PublicLayout>} />
          <Route path="/blog/:slug" element={<PublicLayout><BlogPost /></PublicLayout>} />
          
          {/* Quick Capture - public, no auth required */}
          <Route path="/capture" element={<QuickCapture />} />
          
          {/* Public routes with Header/Footer */}
          <Route path="/evento/:slug" element={<PublicLayout><EventLandingPage /></PublicLayout>} />
          <Route path="/evento/:eventId/sponsors" element={<PublicLayout><SponsorshipPage /></PublicLayout>} />
          <Route path="/programa/:slug" element={<PublicLayout><PublicCoursePage /></PublicLayout>} />
          <Route path="/quiz/:slug" element={<PublicLayout><PublicQuiz /></PublicLayout>} />
          <Route path="/legal" element={<PublicLayout><LegalPage /></PublicLayout>} />
          <Route path="/muro" element={<PublicLayout><MuroTestimonios /></PublicLayout>} />
          {/* Login page removed - auth via home modal */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          
          {/* Auth processing page - handles OAuth token after redirect */}
          <Route path="/auth/process" element={<AuthProcess />} />
          
          {/* External LMS - Standalone page for external users, no admin layout */}
          <Route path="/nurture/lms" element={<ExternalLMSPage />} />
          <Route path="/nurture/lms/webinar/:eventId" element={<WatchingRoom />} />
          
          {/* New Focus System - Protected routes with FocusLayout */}
          <Route element={
            <ProtectedRoute>
              <FocusLayout />
            </ProtectedRoute>
          }>
            <Route path="focus" element={<FocusRedirect />} />
            <Route path="focus/max-linkedin-conexions" element={<MaxLinkedInConexionsPage />} />
            <Route path="focus/import-new-connections" element={<ImportNewConnectionsPage />} />
            <Route path="focus/marketing-event-planning" element={<MarketingEventPlanningPage />} />
            <Route path="focus/bulk-event-invitations" element={<BulkEventInvitationsPage />} />
            <Route path="focus/import-registrants" element={<ImportRegistrantsPage />} />
            <Route path="focus/qualify-new-contacts" element={<QualifyNewContactsPage />} />
            <Route path="focus/personal-invitations" element={<PersonalInvitationsPage />} />
            <Route path="focus/assign-dm" element={<AssignDMPage />} />
            <Route path="focus/role-assignment" element={<RoleAssignmentPage />} />
            <Route path="focus/merge-companies" element={<MergeCompaniesPage />} />
            <Route path="focus/whatsapp-follow-up" element={<WhatsAppFollowUpPage />} />
            <Route path="focus/email-follow-up" element={<EmailFollowUpPage />} />
            <Route path="focus/pre-projects" element={<PreProjectsPage />} />
            <Route path="focus/youtube-ideas" element={<YouTubeIdeasPage />} />
            <Route path="focus/current-cases" element={<CurrentCasesPage />} />
            <Route path="focus/merge-duplicates" element={<MergeDuplicatesFocusPage />} />
            <Route path="focus/analytics" element={<AnalyticsPage />} />
            <Route path="focus/tasks-outside-system" element={<TasksOutsideSystemPage />} />
            
            {/* Asset Pages */}
            <Route path="focus/assets/contacts" element={<ContactsAssetPage />} />
            <Route path="focus/assets/companies" element={<CompaniesAssetPage />} />
            <Route path="focus/assets/pharma-pipelines" element={<PharmaPipelinesAssetPage />} />
            <Route path="focus/assets/testimonials" element={<TestimonialsAssetPage />} />
            <Route path="focus/assets/seo" element={<SEOAssetPage />} />
            <Route path="focus/assets/autoassessments" element={<AutoassessmentsAssetPage />} />
            <Route path="focus/assets/programs" element={<ProgramsAssetPage />} />
            <Route path="focus/assets/pricing" element={<PricingAssetPage />} />
            <Route path="focus/assets/formatos" element={<FormatosAssetPage />} />
            <Route path="focus/assets/time-tracker" element={<TimeTrackerAssetPage />} />
            <Route path="focus/assets/certificates" element={<CertificatesAssetPage />} />
            <Route path="focus/assets/persona-classifier" element={<PersonaClassifierAssetPage />} />
          </Route>
          
          {/* Protected routes */}
          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            {/* Mensajes de Hoy - Redirects to Focus */}
            <Route path="mensajes-hoy" element={<Navigate to="/focus" replace />} />
            
            {/* Step 1: Prospecting - Most routes removed, redirect to Focus */}
            <Route path="prospect" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-1-molecules" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-2-posts" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-3-position" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-3-2-linkedin-invitations" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-3-3-social-followers" element={<Navigate to="/focus" replace />} />
            
            {/* Legacy routes - redirect old paths */}
            <Route path="prospect/1-1-1-1-molecules" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-1-2-posts" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-1-3-position" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-2-google-maps" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-4-small-business" element={<Navigate to="/focus" replace />} />
            
            {/* 1.2 Attract (Coming Soon) */}
            <Route path="prospect/1-2-1-viral-videos" element={<Attract />} />
            <Route path="prospect/1-2-2-long-form-search" element={<LongFormVideoSearch />} />
            <Route path="prospect/1-2-3-geo" element={<GEO />} />
            <Route path="prospect/1-2-4-seo" element={<SEO />} />
            
            {/* 1.3 Connect */}
            <Route path="prospect/1-3-1-deal-makers" element={<Navigate to="/focus/assets/contacts" replace />} />
            
            {/* Legacy routes redirects */}
            <Route path="prospect/1-3-3-small-business" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-3-4-social-followers" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-3-2-small-business" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-1-deal-makers" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="prospect/1-2-1-deal-makers" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="prospect/1-2-2-small-business" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-2-whatsapp-messenger" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-3-molecules-deal-makers" element={<Navigate to="/focus" replace />} />
            <Route path="prospect/1-4-posts-deal-makers" element={<Navigate to="/prospect/1-1-2-posts" replace />} />
            <Route path="prospect/1-5-position-deal-makers" element={<Navigate to="/prospect/1-1-3-position" replace />} />
            <Route path="prospect/1-6-small-business" element={<Navigate to="/prospect/1-1-1-molecules" replace />} />
            <Route path="prospect/1-3-1-viral-videos" element={<Navigate to="/prospect/1-2-1-viral-videos" replace />} />
            <Route path="prospect/1-3-2-long-form" element={<Navigate to="/nurture/long-form-videos" replace />} />
            
            {/* Step 2: Nurture */}
            <Route path="nurture" element={<Navigate to="/focus/assets/contacts" replace />} />
            {/* 2.1 Individual */}
            <Route path="nurture/import" element={<Navigate to="/focus/marketing-event-planning" replace />} />
            <Route path="nurture/import-linkedin" element={<LinkedInImporterPage />} />
            <Route path="nurture/booklets-cases" element={<BookletsCases />} />
            <Route path="nurture/contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            {/* 2.2 Bulk */}
            <Route path="nurture/website" element={<Navigate to="/focus" replace />} />
            <Route path="nurture/campaigns" element={<Campaigns />} />
            <Route path="nurture/newsletters" element={<NewslettersPage />} />
            <Route path="nurture/email-metrics" element={<Navigate to="/focus/analytics" replace />} />
            <Route path="deliver/email-metrics" element={<Navigate to="/focus/analytics" replace />} />
            <Route path="analytics" element={<Navigate to="/focus/analytics" replace />} />
            <Route path="nurture/testimonials" element={<Navigate to="/focus/assets/testimonials" replace />} />
            <Route path="nurture/media" element={<Navigate to="/focus" replace />} />
            <Route path="nurture/eugenio" element={<Navigate to="/focus" replace />} />
            <Route path="nurture/editorial" element={<Navigate to="/focus" replace />} />
            <Route path="nurture/long-form-videos" element={<LongFormVideos />} />
            {/* nurture/lms moved outside Layout for external users */}
            <Route path="nurture/blog" element={<Navigate to="/focus/assets/seo" replace />} />
            <Route path="nurture/content-pipeline" element={<Navigate to="/focus" replace />} />
            <Route path="nurture/video-processing" element={<Navigate to="/focus" replace />} />
            <Route path="nurture/quiz" element={<Navigate to="/focus/assets/autoassessments" replace />} />
            <Route path="nurture/countdown" element={<CountdownPage />} />
            <Route path="nurture/events" element={<Navigate to="/focus/marketing-event-planning" replace />} />
            {/* Medical Society Events moved to Nobylix */}
            <Route path="nurture/medical-society-events" element={<Navigate to="/focus/marketing-event-planning" replace />} />
            <Route path="nurture/events-old" element={<Navigate to="/focus/marketing-event-planning" replace />} />
            <Route path="nurture/write-books" element={<Navigate to="/focus" replace />} />
            {/* Legacy nurture routes */}
            <Route path="nurture/content-flow" element={<ContentFlow />} />
            <Route path="nurture/venue-finder" element={<Navigate to="/focus/assets/pricing" replace />} />
            <Route path="nurture/stats" element={<EventStats />} />
            <Route path="nurture/history" element={<History />} />
            <Route path="nurture/templates" element={<Templates />} />
            
            {/* Step 3: Close */}
            <Route path="close" element={<Navigate to="/focus/pre-projects" replace />} />
            {/* Venue Finder moved to Nobylix */}
            <Route path="close/venue-finder" element={<Navigate to="/focus/assets/pricing" replace />} />
            <Route path="close/quoter" element={<Navigate to="/focus/assets/pricing" replace />} />
            <Route path="close/cases" element={<Navigate to="/focus/pre-projects" replace />} />
            <Route path="close/contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="close/convenios" element={<Navigate to="/focus" replace />} />
            <Route path="close/media-relations" element={<Navigate to="/focus" replace />} />
            
            {/* Step 4: Deliver */}
            <Route path="deliver" element={<Navigate to="/focus/current-cases" replace />} />
            <Route path="deliver/whatsapp-confirmations" element={<WhatsAppConfirmations />} />
            <Route path="deliver/contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="deliver/time-tracker" element={<Navigate to="/focus/assets/time-tracker" replace />} />
            <Route path="deliver/certificates" element={<Navigate to="/focus/assets/certificates" replace />} />
            <Route path="deliver/documents" element={<Documents />} />
            
            {/* Today's Focus - Redirects to Focus */}
            <Route path="todays-focus" element={<Navigate to="/focus" replace />} />
            <Route path="mensajes-hoy" element={<Navigate to="/focus" replace />} />
            
            {/* Step 5: Repurchase */}
            <Route path="repurchase" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="repurchase/contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="repurchase/students" element={<Navigate to="/focus/assets/contacts" replace />} />
            
            {/* Foundations */}
            <Route path="foundations/who" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="foundations/who/contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="foundations/who/buyer-personas" element={<Navigate to="/settings" replace />} />
            <Route path="foundations/who/keywords" element={<Navigate to="/settings" replace />} />
            <Route path="foundations/who/companies" element={<Navigate to="/focus/assets/companies" replace />} />
            <Route path="foundations/who/media" element={<Navigate to="/focus" replace />} />
            <Route path="foundations/who/industries" element={<Navigate to="/focus/assets/companies" replace />} />
            <Route path="foundations/who/all-contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="foundations/what" element={<Navigate to="/focus/assets/formatos" replace />} />
            <Route path="foundations/what/formatos" element={<Navigate to="/focus/assets/formatos" replace />} />
            <Route path="foundations/how" element={<Navigate to="/focus" replace />} />
            <Route path="foundations/how/programas" element={<Navigate to="/focus/assets/programs" replace />} />
            <Route path="foundations/how/quiz" element={<Navigate to="/focus/assets/autoassessments" replace />} />
            <Route path="foundations/competencias" element={<Navigate to="/focus" replace />} />
            <Route path="foundations/niveles" element={<Navigate to="/focus" replace />} />
            <Route path="foundations/how-much" element={<Navigate to="/focus/assets/pricing" replace />} />
            
            {/* Content System - Redirect to Focus */}
            <Route path="content-matrix" element={<ContentMatrix />} />
            <Route path="content/newsletter-queue" element={<Navigate to="/focus" replace />} />
            
            {/* Infostructure */}
            <Route path="infostructure/pharma-pipelines" element={<Navigate to="/focus/assets/pharma-pipelines" replace />} />
            {/* Medical Societies moved to Nobylix */}
            <Route path="infostructure/medical-societies" element={<Navigate to="/focus/assets/pharma-pipelines" replace />} />
            <Route path="infostructure/medical-specialties" element={<Navigate to="/focus" replace />} />
            {/* Business Search moved to Nobylix */}
            <Route path="infostructure/business-search" element={<Navigate to="/focus/assets/pharma-pipelines" replace />} />
            <Route path="infostructure/keywords" element={<Navigate to="/focus" replace />} />
            <Route path="infostructure/sources" element={<Navigate to="/settings" replace />} />
            
            {/* Settings */}
            <Route path="settings" element={<Settings />} />
            <Route path="settings/gmail-callback" element={<GmailCallback />} />
            <Route path="settings/calendar-callback" element={<Settings />} />
            <Route path="settings/kanban" element={<Navigate to="/focus" replace />} />
            
            {/* Admin Tools */}
            <Route path="admin/merge-duplicates" element={<MergeDuplicates />} />
            <Route path="scraping-automation" element={<ScrapingAutomation />} />
            
            {/* Legacy routes (redirect to new structure) */}
            <Route path="admin" element={<Navigate to="/settings" replace />} />
            <Route path="contacts" element={<Navigate to="/focus/assets/contacts" replace />} />
            <Route path="events" element={<Navigate to="/focus/marketing-event-planning" replace />} />
            <Route path="companies" element={<Navigate to="/focus/assets/companies" replace />} />
            <Route path="sectors" element={<Navigate to="/focus/assets/companies" replace />} />
            <Route path="cotizador" element={<Navigate to="/focus/assets/pricing" replace />} />
            <Route path="certificados" element={<Navigate to="/focus/assets/certificates" replace />} />
            <Route path="prospeccion" element={<Navigate to="/focus" replace />} />
            <Route path="cierre" element={<Navigate to="/focus/pre-projects" replace />} />
          </Route>
          
          {/* Auth callback route */}
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background: 'hsl(220, 20%, 12%)',
              border: '1px solid hsl(220, 15%, 20%)',
              color: 'white',
            },
          }}
        />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
