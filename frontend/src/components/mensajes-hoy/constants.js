/**
 * Constants for MensajesHoy components
 */

// Rule color mapping - Keys in English
export const RULE_COLORS = {
  "Appointment today": "border-green-500/30 text-green-400 bg-green-500/10",
  "Student without appointment (8 days)": "border-purple-500/30 text-purple-400 bg-purple-500/10",
  "Pending quote (9 days)": "border-orange-500/30 text-orange-400 bg-orange-500/10",
  "New business (first contact)": "border-teal-500/30 text-teal-400 bg-teal-500/10",
  "New business (second contact)": "border-blue-500/30 text-blue-400 bg-blue-500/10",
  "Alumni check-in (90 days)": "border-pink-500/30 text-pink-400 bg-pink-500/10",
  "Deal Maker - Propuesta (Stage 3)": "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  "Deal Maker - Cierre Admin (Stage 3)": "border-amber-500/30 text-amber-400 bg-amber-500/10",
};

// Email rule colors
export const EMAIL_RULE_COLORS = {
  "E1": "border-blue-500/30 text-blue-400 bg-blue-500/10",
  "E2": "border-orange-500/30 text-orange-400 bg-orange-500/10",
  "E3": "border-purple-500/30 text-purple-400 bg-purple-500/10",
  "E4": "border-green-500/30 text-green-400 bg-green-500/10",
  "E5": "border-teal-500/30 text-teal-400 bg-teal-500/10",
};

// Email rule descriptions (readable names)
export const EMAIL_RULE_NAMES = {
  "E1": "E1 - Invitación a Webinar (Stage 2)",
  "E2": "E2 - Seguimiento Cotización (Stage 3)",
  "E3": "E3 - Recordatorio Coaching (Stage 4)",
  "E4": "E4 - Recompra (Stage 5, no estudiantes)",
  "E5": "E5 - Alumni Check-in (Stage 5, estudiantes)",
};

// Template mapping for WhatsApp rules
export const WHATSAPP_TEMPLATE_MAP = {
  "Alumni check-in (90 days)": "alumni_checkin_whatsapp",
  "Student without appointment (8 days)": "student_coaching",
  "Pending quote (9 days)": "quote_followup",
  "Appointment today": "meeting_today",
  "Appointment tomorrow": "meeting_tomorrow",
  "Appointment in 21 days (never contacted)": "meeting_21_days_new",
  "Appointment in 21 days (followup)": "meeting_21_days_followup",
  "New business (first contact)": "quote_followup",
  "New business (second contact)": "quote_followup",
};

// Rules summary labels
export const RULES_LABELS = {
  meeting_today: "Appointment today",
  student_coaching: "Students",
  quote_followup: "Quotes",
  new_business_first: "New business (1st contact)",
  new_business_followup: "New business (2nd contact)",
  dealmaker_propuesta: "DM Propuesta",
  dealmaker_cierre: "DM Cierre Admin",
};

// Pagination options
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100, 250];
export const DEFAULT_PAGE_SIZE = 10;
