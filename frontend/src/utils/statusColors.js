/**
 * Canonical status → CSS class map.
 * Single source of truth for all traffic-light / badge colors.
 * Every component that renders a status indicator imports from here.
 *
 * Light-mode classes paired with dark: variants for WCAG AA contrast.
 */

// ── Traffic-light statuses (semaphores) ──────────────────────────
export const trafficColors = {
  green:  "bg-green-500",
  yellow: "bg-yellow-500",
  red:    "bg-red-500",
  gray:   "bg-slate-500",
};

// ── Badge statuses (pills with text) ─────────────────────────────
export const statusColors = {
  // Pipeline / CRM
  nuevo:              "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  en_proceso:         "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  propuesta_enviada:  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  ganado:             "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  perdido:            "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",

  // Campaign
  draft:    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  sent:     "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  sending:  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  failed:   "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",

  // Email log
  opened:   "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  clicked:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",

  // Quotes
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  expired:  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",

  // DM / Contacts
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  qualified: "bg-green-500/20 text-green-400 border-green-500/30",

  // Generic
  active:   "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  inactive: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  error:    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

// ── Admin module colors ──────────────────────────────────────────
export const moduleColors = {
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pink:   "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  green:  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  amber:  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

/**
 * Resolve a status string to its CSS classes.
 * Falls back to neutral gray if unknown.
 */
export function getStatusClasses(status) {
  return statusColors[status] || statusColors.inactive;
}
