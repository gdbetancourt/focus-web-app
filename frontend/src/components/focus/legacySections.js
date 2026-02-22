/**
 * Legacy Sections Configuration
 * 
 * Sections from the old navigation that haven't been migrated to the new Focus system yet.
 * These are accessible via a collapsible section at the bottom of the Focus navigation.
 */

import {
  Mail,
  BookOpen,
  Users,
  Trophy,
  Award,
} from "lucide-react";

/**
 * Legacy section groups - Minimal remaining items
 */
export const LEGACY_SECTIONS = [
  {
    group: "2. Nurturing",
    items: [
      { path: "/nurture/newsletters", label: "2.2.4 Newsletters", icon: Mail },
      { path: "/nurture/lms", label: "2.2.5 Learning (LMS)", icon: BookOpen },
    ]
  },
  {
    group: "4. Delivery",
    items: [
      { path: "/deliver/projects", label: "4.0 Proyectos (Ganados)", icon: Trophy },
    ]
  },
  {
    group: "5. Repurchase",
    items: [
      { path: "/foundations/who/contacts", label: "5.1 Students for Recommendations", icon: Users },
    ]
  },
];

export default LEGACY_SECTIONS;
