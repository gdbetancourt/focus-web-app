/**
 * Focus Sections Configuration
 * 
 * Defines all 13 sections with their:
 * - Navigation info (id, label, icon)
 * - Traffic light rules (weekly/daily)
 * - Subheadline (contribution to company vision)
 * - Steps with "See more" details
 */

import {
  Users,
  Download,
  Calendar,
  CalendarDays,
  Upload,
  CheckSquare,
  MessageSquare,
  Mail,
  FileText,
  UserPlus,
  Tag,
  Snowflake,
  ListTodo,
  Youtube,
  Briefcase,
  GitMerge,
} from "lucide-react";

// LinkedIn profiles for prospecting (fixed)
export const LINKEDIN_PROFILES = [
  { id: "GB", label: "GB", name: "Gerardo Betancourt" },
  { id: "MG", label: "MG", name: "María del Mar Gargari" },
];

/**
 * Section Configurations
 * Order: As specified by user
 */
export const FOCUS_SECTIONS = [
  {
    id: "max-linkedin-conexions",
    label: "Max LinkedIn Conexions",
    icon: Users,
    path: "/focus/max-linkedin-conexions",
    trafficType: "weekly", // weekly semaphore
    subheadline: "The biggest source of income for this company comes from corporate clients, and this is a 100% relational process that starts by adding contacts on LinkedIn.",
    steps: [
      {
        title: "Identify the profile from which you will prospect.",
        details: "Within the available profiles, always start with the one that has the highest number of contacts, then the next one, and so on with the rest."
      },
      {
        title: "In the prospecting queue, identify the first search, and if there isn't one, create a new one.",
        details: "We will always prioritize searches that have already been created, but if the next search in the queue has been prospected less than a month ago, this may indicate that more searches need to be created. To create a new search, we will always prioritize companies that are at the top of the list because they have the highest chance of hiring."
      },
      {
        title: "Add all contacts to the profile you selected.",
        details: "Do it without reviewing in much detail. It's better to add everyone than to review profile by profile because that would take too much time."
      },
      {
        title: "Whenever possible, try to add contacts that correspond to one of our Buyer Personas.",
        details: "However, adding people who work on their team also contributes to the integration of the buying committee."
      },
    ],
    trafficRules: {
      red: "No checkbox has been marked for any profile this week (Monday to Sunday)",
      yellow: "Some profiles have been marked but there are still some missing",
      green: "All checkboxes for all LinkedIn profiles being prospected have been marked",
    },
    // Source: Prospección in Today's Focus
    sourceComponent: "ProspectionTabContent",
    hasProfileCheckboxes: true,
  },
  {
    id: "import-new-connections",
    label: "Import New Connections",
    icon: Download,
    path: "/focus/import-new-connections",
    trafficType: "weekly",
    subheadline: "Es fácil pasar por alto nuevas conexiones que nos aceptan en LinkedIn, por lo que es importante importar conexiones cada semana. Así aseguramos poder iniciar conversaciones con todos.",
    steps: [
      {
        title: "Ir a la página de exportación de datos de LinkedIn.",
        details: "Visitar https://www.linkedin.com/mypreferences/d/download-my-data",
        link: "https://www.linkedin.com/mypreferences/d/download-my-data"
      },
      {
        title: "Solicitar exportación de 'Connections'.",
        details: "Marcar la casilla cuando hayas hecho esto para cada perfil (GB y MG)."
      },
      {
        title: "Aproximadamente 2-3 días después recibirás la exportación completa en tu email.",
        details: "En ese momento, importa los contactos usando el formulario de subida."
      },
    ],
    trafficRules: {
      red: "Ningún perfil ha solicitado export esta semana",
      yellow: "Al menos uno solicitado pero no ambos importados",
      green: "Ambos perfiles tienen al menos una importación completada esta semana",
    },
    sourceComponent: "ImportNewConnectionsPage",
  },
  {
    id: "marketing-event-planning",
    label: "Marketing Event Planning",
    icon: CalendarDays,
    path: "/focus/marketing-event-planning",
    trafficType: "weekly",
    subheadline: "It is important to always have the invitation open for our 4 types of marketing events, so that we can both capture new prospects and nurture existing ones.",
    steps: [
      {
        title: "Check if you need to schedule one of the 4 events.",
        details: "Review each placeholder to ensure there is at least one upcoming event scheduled."
      },
      {
        title: "Schedule it.",
        details: "Click the 'New Event' button within the placeholder to create a new event with the correct category pre-selected."
      },
    ],
    trafficRules: {
      red: "No upcoming events scheduled in any placeholder",
      yellow: "Events scheduled in some placeholders but not all 4",
      green: "All 4 placeholders have at least one upcoming event",
    },
    // 4 Event Placeholders for Marketing Planning
    eventCategories: [
      { id: "dominant_industry", label: "Dominant Industry Specific", description: "Events targeting our dominant industry vertical" },
      { id: "leadership", label: "Leadership Specific", description: "Events focused on leadership development topics" },
      { id: "sales", label: "Sales Specific", description: "Events focused on sales excellence topics" },
      { id: "thought_leadership", label: "Thought Leadership Specific", description: "Events establishing thought leadership positioning" },
    ],
    sourceComponent: "MarketingEventPlanningPage",
  },
  {
    id: "bulk-event-invitations",
    label: "Bulk Event Invitations",
    icon: Calendar,
    path: "/focus/bulk-event-invitations",
    trafficType: "weekly",
    subheadline: "One of the most important prospecting vehicles is through LinkedIn events, and the most practical way is through the bulk invitations tool.",
    steps: [
      {
        title: "Open the page of each event.",
        details: null
      },
      {
        title: "Invite by company.",
        details: null
      },
      {
        title: "Make sure to send invitations for all 4 events.",
        details: null
      },
    ],
    trafficRules: {
      red: "No activities have been initiated this week",
      yellow: "Invitations have been made but not yet to all 4 events",
      green: "Invitations were sent to all 4 events this week",
    },
    // 4 Event Placeholders
    eventPlaceholders: [
      { id: "industry", label: "Industry Specific", description: "An event for the dominant industry in our client list" },
      { id: "leadership", label: "General Leadership", description: "A non-industry specific event on leadership topics" },
      { id: "sales", label: "General Sales", description: "A non-industry specific event on sales topics" },
      { id: "thought-leadership", label: "General Thought Leadership", description: "A non-industry specific event on thought leadership topics" },
    ],
    sourceComponent: "InviteToEventsTabContent",
  },
  {
    id: "import-registrants",
    label: "Import Registrants",
    icon: Upload,
    path: "/focus/import-registrants",
    trafficType: "weekly",
    subheadline: "It's important to import all registrants from all weekly events, as this is one of our main sources of Stage 2 contacts.",
    steps: [
      {
        title: "Open the next event.",
        details: null
      },
      {
        title: "Export the contacts that have registered.",
        details: null
      },
      {
        title: "Import them.",
        details: null
      },
    ],
    trafficRules: {
      red: "No contacts have been imported this week",
      yellow: "Contacts have been imported from some events but not all",
      green: "Contacts from all events have been imported this week",
    },
    // All contacts will be marked as Stage 2
    sourceComponent: "ImportRegistrantsTabContent",
    autoClassifyStage: 2,
  },
  {
    id: "qualify-new-contacts",
    label: "Qualify New Contacts",
    icon: CheckSquare,
    path: "/focus/qualify-new-contacts",
    trafficType: "weekly",
    subheadline: "It's very important to qualify contacts as buyer persona before dedicating time to them. That's why this manual review is important.",
    steps: [
      {
        title: "Review the profile shown to you.",
        details: null
      },
      {
        title: "If necessary, go to their LinkedIn profile to understand them better.",
        details: null
      },
      {
        title: "Qualify them as buyer persona or discard them.",
        details: "If you're not sure, you can postpone it to review later. Discarded contacts are classified as Mateo (Usuario Final)."
      },
    ],
    trafficRules: {
      red: "No contacts have been qualified this week",
      yellow: "Contacts have been qualified but weekly goal of 250 not yet reached",
      green: "Weekly goal reached: 250+ contacts qualified (excluding Mateo)",
    },
    // This section should group all contacts in Stage 1 and Stage 2
    sourceComponent: "ToQualifyTabContent",
    contactStages: [1, 2],
  },
  {
    id: "personal-invitations",
    label: "Personal Invitations",
    icon: Snowflake,
    path: "/focus/personal-invitations",
    trafficType: "weekly",
    subheadline: "All corporate contacts should be treated individually, which is why we send them personal invitations via LinkedIn.",
    steps: [
      {
        title: "Identify the invitations that were made two weeks ago.",
        details: null
      },
      {
        title: "Open the profile from which those searches were made.",
        details: null
      },
      {
        title: "Send an Ice Breaker message to all those contacts.",
        details: null
      },
      {
        title: "Then do the same with individual contacts.",
        details: null
      },
      {
        title: "IMPORTANT: This is not a sales message.",
        details: "It's a message solely to invite them to the next relevant event for them."
      },
    ],
    trafficRules: {
      red: "No activities have been performed this week",
      yellow: "Activities have been performed but not yet completed",
      green: "All searches and all individual contacts have been marked as processed",
    },
    // Shows qualified contacts not classified as Mateo (catchall)
    // Has two parts: Search and Individual Contacts
    sourceComponent: "IceBreakerTabContent",
    excludeCatchall: true,
  },
  {
    id: "assign-dm",
    label: "Assign DM",
    icon: UserPlus,
    path: "/focus/assign-dm",
    trafficType: "weekly",
    subheadline: "It's important to ensure that all cases in Stage 3 and Stage 4 have a deal maker assigned, otherwise we risk that contact not receiving the necessary follow-up.",
    steps: [
      {
        title: "Identify cases that require Deal Maker assignment.",
        details: null
      },
      {
        title: "Assign them.",
        details: null
      },
    ],
    trafficRules: {
      red: "There are cases without deal makers that have not been processed",
      yellow: "Some cases without deal makers have been processed this week but there are still more",
      green: "There are no cases without deal maker",
    },
    sourceComponent: "AssignDMTabContent",
    caseStages: [3, 4],
  },
  {
    id: "role-assignment",
    label: "Role Assignment",
    icon: Tag,
    path: "/focus/role-assignment",
    trafficType: "weekly",
    subheadline: "It's important that all contacts in Stage 3, 4, and 5 have all their contacts assigned, otherwise we risk them not receiving the appropriate follow-up.",
    steps: [
      {
        title: "Identify contacts that need role assignment.",
        details: null
      },
      {
        title: "Assign the roles.",
        details: null
      },
    ],
    trafficRules: {
      red: "There are contacts without assigned role and they have not been processed this week",
      yellow: "They have been processed but there are still more",
      green: "There are no contacts in stage 3, 4, or 5 without assigned role",
    },
    sourceComponent: "AssignRolesTabContent",
    contactStages: [3, 4, 5],
  },
  {
    id: "merge-companies",
    label: "Merge Companies",
    icon: GitMerge,
    path: "/focus/merge-companies",
    trafficType: "weekly",
    subheadline: "Database maintenance to merge duplicate companies based on domain matches. Keeping company data clean and consolidated improves data quality across the CRM.",
    steps: [
      {
        title: "Review potential duplicate companies.",
        details: "System identifies companies that share the same domain and may be duplicates."
      },
      {
        title: "Merge or dismiss candidates.",
        details: "Confirm merges to consolidate duplicate companies, or dismiss false positives."
      },
    ],
    trafficRules: {
      red: "There are companies to review and none have been reviewed this week",
      yellow: "Some companies have been reviewed but there are still more pending",
      green: "No pending company duplicates to review",
    },
    sourceComponent: "MergeCompaniesPage",
  },
  {
    id: "whatsapp-follow-up",
    label: "WhatsApp Follow Up",
    icon: MessageSquare,
    path: "/focus/whatsapp-follow-up",
    trafficType: "daily", // Daily semaphore - 90 days
    subheadline: "One of the keys to maintaining good relationships with our contacts is to follow up frequently via WhatsApp.",
    steps: [
      {
        title: "Identify the messages that need to be sent.",
        details: null
      },
      {
        title: "Copy the URLs in small groups to avoid errors.",
        details: null
      },
      {
        title: "Send the messages.",
        details: null
      },
    ],
    trafficRules: {
      red: "None of the messages that need to be sent today have been sent",
      yellow: "Messages have been sent but there are still more",
      green: "All of today's messages have been sent",
    },
    sourceComponent: "MensajesHoy", // WhatsApp tab
    sourceProps: { embedded: true, forceTab: "whatsapp" },
  },
  {
    id: "email-follow-up",
    label: "Email Follow Up",
    icon: Mail,
    path: "/focus/email-follow-up",
    trafficType: "daily", // Daily semaphore - 90 days
    subheadline: "One of the keys to maintaining good relationships with our contacts is to follow up frequently via email.",
    steps: [
      {
        title: "Identify the messages that need to be sent.",
        details: null
      },
      {
        title: "Send the messages.",
        details: null
      },
    ],
    trafficRules: {
      red: "None of the messages that need to be sent today have been sent",
      yellow: "Messages have been sent but there are still more",
      green: "All of today's messages have been sent",
    },
    sourceComponent: "MensajesHoy", // Email tab
    sourceProps: { embedded: true, forceTab: "email" },
  },
  {
    id: "pre-projects",
    label: "Pre-projects",
    icon: FileText,
    path: "/focus/pre-projects",
    trafficType: "daily", // Daily semaphore - 90 days
    subheadline: "It's key to send all requested quotes as quickly as possible.",
    steps: [
      {
        title: "Identify the contacts who requested pre-projects.",
        details: null
      },
      {
        title: "Quote.",
        details: null
      },
      {
        title: "Schedule a meeting to present the pre-project.",
        details: null
      },
      {
        title: "IMPORTANT: We never send pre-projects with quotes to new clients.",
        details: "In cases of exceptional trust, we can send pre-projects by email to certain contacts. But whenever possible, we should seek to present the pre-project in a call."
      },
    ],
    trafficRules: {
      red: "No pre-projects have been processed today",
      yellow: "Some pre-projects have been processed but there are still more",
      green: "All pending pre-projects have been processed today",
    },
    sourceComponent: "QuotesTabContent",
  },
  {
    id: "youtube-ideas",
    label: "YouTube Ideas",
    icon: Youtube,
    path: "/focus/youtube-ideas",
    trafficType: "weekly",
    inConstruction: true,
    subheadline: "Content planning for YouTube channel to establish thought leadership and attract new prospects.",
    steps: [
      {
        title: "Review content ideas and prioritize.",
        details: "Evaluate which ideas align best with current marketing goals."
      },
      {
        title: "Schedule content production.",
        details: "Assign dates and resources for content creation."
      },
    ],
    trafficRules: {
      red: "No content scheduled for this month",
      yellow: "Some content scheduled but below target",
      green: "Content calendar is fully planned",
    },
    sourceComponent: "YouTubeIdeasPage",
  },
  {
    id: "current-cases",
    label: "Current Cases",
    icon: Briefcase,
    path: "/focus/current-cases",
    trafficType: "weekly",
    subheadline: "It is important to follow up with each of our coachees individually to ensure the success of the project.",
    steps: [
      {
        title: "Review the tasks that must be completed today.",
        details: null
      },
      {
        title: "Complete them.",
        details: null
      },
    ],
    trafficRules: {
      red: "No checkbox was marked during the week",
      yellow: "At least one checkbox was marked during the current ISO week",
      green: "All tasks completed or unchecked tasks have future due dates",
    },
    sourceComponent: "CurrentCasesDeliveryPage",
  },
  {
    id: "merge-duplicates",
    label: "Merge Duplicates",
    icon: GitMerge,
    path: "/focus/merge-duplicates",
    trafficType: "weekly",
    inConstruction: true,
    subheadline: "Database maintenance to merge duplicate contacts and keep the CRM clean and accurate.",
    steps: [
      {
        title: "Review potential duplicates.",
        details: "System identifies contacts that may be duplicates."
      },
      {
        title: "Merge or dismiss duplicates.",
        details: "Confirm merges or mark as not duplicates."
      },
    ],
    trafficRules: {
      red: "Many unreviewed potential duplicates",
      yellow: "Some potential duplicates pending review",
      green: "No pending duplicates to review",
    },
    sourceComponent: "MergeDuplicatesPage",
  },
  {
    id: "tasks-outside-system",
    label: "Tasks Outside System",
    icon: ListTodo,
    path: "/focus/tasks-outside-system",
    trafficType: "daily", // Daily semaphore - 90 days
    subheadline: "In cases where certain projects require tasks not considered in the system, these tasks will be listed here.",
    steps: [
      {
        title: "Read each task carefully and make sure you understand it.",
        details: null
      },
      {
        title: "Assign the date on which each task needs to be completed.",
        details: null
      },
      {
        title: "Complete tasks according to the date they need to be completed.",
        details: null
      },
    ],
    trafficRules: {
      red: "There are pending tasks that have not been addressed today",
      yellow: "Some tasks have been addressed but there are still more",
      green: "All tasks scheduled for today have been completed",
    },
    sourceComponent: "TodoTabContent",
  },
];

// Helper to get section by ID
export const getSectionById = (id) => FOCUS_SECTIONS.find(s => s.id === id);

// Helper to get section index (for navigation)
export const getSectionIndex = (id) => FOCUS_SECTIONS.findIndex(s => s.id === id);

// Default export
export default FOCUS_SECTIONS;
