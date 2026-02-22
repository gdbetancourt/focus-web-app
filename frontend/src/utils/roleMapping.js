/**
 * Canonical Role Mapping - Single Source of Truth
 * 
 * This module defines the canonical role format used across the entire frontend:
 * - ContactSheet modal (role selection)
 * - Current Cases grouping
 * - Any other role-related UI
 * 
 * IMPORTANT: All roles must be stored and compared using the canonical (lowercase, underscore) format.
 */

// Canonical role values (lowercase with underscores)
export const CANONICAL_ROLES = [
  "deal_maker",
  "influencer",
  "champion",
  "sponsor",
  "asistente_deal_maker",
  "procurement",
  "staff",
  "coachee",
  "student",
  "advisor",
  "speaker",
  "evaluador_360",
];

// UI Label -> Canonical value mapping
export const UI_TO_CANONICAL = {
  "Deal Maker": "deal_maker",
  "deal_maker": "deal_maker",
  "deal maker": "deal_maker",
  "Influencer": "influencer",
  "influencer": "influencer",
  "Champion": "champion",
  "champion": "champion",
  "Sponsor": "sponsor",
  "sponsor": "sponsor",
  "Asistente Deal Maker": "asistente_deal_maker",
  "asistente_deal_maker": "asistente_deal_maker",
  "asistente del deal maker": "asistente_deal_maker",
  "Procurement": "procurement",
  "procurement": "procurement",
  "Staff": "staff",
  "staff": "staff",
  "Coachee": "coachee",
  "coachee": "coachee",
  "Student": "student",
  "student": "student",
  "alumno": "student",
  "estudiante": "student",
  "Advisor": "advisor",
  "advisor": "advisor",
  "Speaker": "speaker",
  "speaker": "speaker",
  "speakers": "speaker",
  "Speakers": "speaker",
  "Evaluador 360": "evaluador_360",
  "evaluador_360": "evaluador_360",
  "evaluador 360": "evaluador_360",
};

// Canonical -> UI Label mapping (for display)
export const CANONICAL_TO_UI = {
  "deal_maker": "Deal Maker",
  "influencer": "Influencer",
  "champion": "Champion",
  "sponsor": "Sponsor",
  "asistente_deal_maker": "Asistente Deal Maker",
  "procurement": "Procurement",
  "staff": "Staff",
  "coachee": "Coachee",
  "student": "Student",
  "advisor": "Advisor",
  "speaker": "Speaker",
  "evaluador_360": "Evaluador 360",
};

// Role options for UI dropdowns/selectors (value = canonical, label = UI)
export const ROLE_OPTIONS = [
  { value: "deal_maker", label: "Deal Maker" },
  { value: "influencer", label: "Influencer" },
  { value: "champion", label: "Champion" },
  { value: "sponsor", label: "Sponsor" },
  { value: "asistente_deal_maker", label: "Asistente Deal Maker" },
  { value: "procurement", label: "Procurement" },
  { value: "staff", label: "Staff" },
  { value: "coachee", label: "Coachee" },
  { value: "student", label: "Student" },
  { value: "advisor", label: "Advisor" },
  { value: "speaker", label: "Speaker" },
  { value: "evaluador_360", label: "Evaluador 360" },
];

// Role groups for Current Cases grouping
export const ROLE_GROUPS = {
  deal_makers_team: {
    id: "deal_makers_team",
    title: "Deal Makers and Team",
    roles: ["deal_maker", "influencer", "champion", "sponsor", "asistente_deal_maker", "procurement", "staff"],
  },
  coachees: {
    id: "coachees",
    title: "Coachees",
    roles: ["coachee"],
  },
  students: {
    id: "students",
    title: "Students",
    roles: ["student"],
  },
  advisors_speakers: {
    id: "advisors_speakers",
    title: "Advisors & Speakers",
    roles: ["advisor", "speaker", "evaluador_360"],
  },
  others: {
    id: "others",
    title: "All Others",
    roles: [], // Catch-all for unknown roles or no roles
  },
};

/**
 * Normalize a role to its canonical format.
 * @param {string} role - Role string in any format
 * @returns {string} Canonical role string (lowercase with underscores)
 */
export function normalizeRole(role) {
  if (!role) return "";
  
  // First try direct lookup
  if (UI_TO_CANONICAL[role]) {
    return UI_TO_CANONICAL[role];
  }
  
  // Fallback: normalize manually
  const normalized = role.toLowerCase().trim().replace(/\s+/g, "_").replace(/-/g, "_");
  
  // Check if it's a known canonical role
  if (CANONICAL_ROLES.includes(normalized)) {
    return normalized;
  }
  
  // Return as-is (will be treated as unknown role -> "others" group)
  return normalized;
}

/**
 * Get the group ID for a given role.
 * @param {string} role - Role string (will be normalized)
 * @returns {string} Group ID (e.g., "deal_makers_team", "coachees", "others")
 */
export function getRoleGroup(role) {
  const canonical = normalizeRole(role);
  
  for (const [groupId, groupData] of Object.entries(ROLE_GROUPS)) {
    if (groupData.roles.includes(canonical)) {
      return groupId;
    }
  }
  
  return "others";
}

/**
 * Get the UI display label for a role.
 * @param {string} role - Role string (canonical or UI label)
 * @returns {string} UI display label
 */
export function getUILabel(role) {
  const canonical = normalizeRole(role);
  return CANONICAL_TO_UI[canonical] || role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get all group IDs for a contact based on their case-level roles.
 * A contact can appear in multiple groups if they have multiple roles.
 * @param {string[]} caseRoles - Array of case-level roles
 * @returns {string[]} Array of group IDs
 */
export function getGroupsForRoles(caseRoles) {
  if (!caseRoles || caseRoles.length === 0) {
    return ["others"];
  }
  
  const groups = new Set();
  
  for (const role of caseRoles) {
    const groupId = getRoleGroup(role);
    groups.add(groupId);
  }
  
  return groups.size > 0 ? Array.from(groups) : ["others"];
}
