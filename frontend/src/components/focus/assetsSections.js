/**
 * Assets Sections Configuration
 * 
 * Defines asset sections that appear in a collapsible group.
 * These sections don't have traffic lights, vision, or steps.
 */

import {
  Users,
  Building2,
  Pill,
  MessageSquareQuote,
  Search,
  ClipboardCheck,
  GraduationCap,
  DollarSign,
  FileBox,
  Clock,
  Award,
  Zap,
} from "lucide-react";

export const ASSETS_SECTIONS = [
  {
    id: "contacts",
    label: "Contacts",
    icon: Users,
    path: "/focus/assets/contacts",
    inConstruction: false,
    sourceComponent: "AllContacts",
  },
  {
    id: "companies",
    label: "Companies",
    icon: Building2,
    path: "/focus/assets/companies",
    inConstruction: false,
    sourceComponent: "CompaniesPage",
  },
  {
    id: "persona-classifier",
    label: "Persona Classifier",
    icon: Zap,
    path: "/focus/assets/persona-classifier",
    inConstruction: false,
    sourceComponent: "PersonaClassifierPage",
  },
  {
    id: "pharma-pipelines",
    label: "Pharma Pipelines",
    icon: Pill,
    path: "/focus/assets/pharma-pipelines",
    inConstruction: false,
    sourceComponent: "PharmaPipelines",
  },
  {
    id: "testimonials",
    label: "Testimonials",
    icon: MessageSquareQuote,
    path: "/focus/assets/testimonials",
    inConstruction: false,
    sourceComponent: "TestimonialsPage",
  },
  {
    id: "seo",
    label: "SEO",
    icon: Search,
    path: "/focus/assets/seo",
    inConstruction: false,
    sourceComponent: "SEOBlogPage",
  },
  {
    id: "autoassessments",
    label: "Autoassessments",
    icon: ClipboardCheck,
    path: "/focus/assets/autoassessments",
    inConstruction: false,
    sourceComponent: "QuizPage",
  },
  {
    id: "programs",
    label: "Programs",
    icon: GraduationCap,
    path: "/focus/assets/programs",
    inConstruction: false,
    sourceComponent: "ProgramsPage",
  },
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    path: "/focus/assets/pricing",
    inConstruction: false,
    sourceComponent: "Cotizador",
  },
  {
    id: "formatos",
    label: "Formatos",
    icon: FileBox,
    path: "/focus/assets/formatos",
    inConstruction: false,
    sourceComponent: "FormatosPage",
  },
  {
    id: "time-tracker",
    label: "Time Tracker",
    icon: Clock,
    path: "/focus/assets/time-tracker",
    inConstruction: true,
    sourceComponent: "TimeTracker",
  },
  {
    id: "certificates",
    label: "Certificates",
    icon: Award,
    path: "/focus/assets/certificates",
    inConstruction: false,
    sourceComponent: "Certificados",
  },
];

// Helper to get asset section by ID
export const getAssetSectionById = (id) => ASSETS_SECTIONS.find(s => s.id === id);

export default ASSETS_SECTIONS;
