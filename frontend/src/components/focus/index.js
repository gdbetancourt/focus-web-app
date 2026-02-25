/**
 * Focus Components - Index file
 * Export all focus-related components
 */

export { default as FocusLayout } from './FocusLayout';
export { default as FocusNavigation, TrafficLightIndicator } from './FocusNavigation';
export { default as SectionLayout, COMPANY_VISION, TrafficLightHistory, StepsSidebar } from './SectionLayout';
export { default as AssetLayout } from './AssetLayout';
export { default as FocusRedirect } from './FocusRedirect';
export { default as FOCUS_SECTIONS, getSectionById, getSectionIndex, LINKEDIN_PROFILES } from './focusSections';
export { default as ASSETS_SECTIONS, getAssetSectionById } from './assetsSections';

// Pages
export {
  MeetingsConfirmationsPage,
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
} from './pages';

// Asset Pages
export {
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
} from './assets';
