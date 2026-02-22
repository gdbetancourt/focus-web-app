/**
 * ContactSheet constants - Shared constants for contact management
 */

// Salutations in Spanish and English
export const SALUTATIONS_ES = ["Dr.", "Dra.", "Lic.", "Mtro.", "Mtra.", "Ing.", "Sr.", "Sra."];
export const SALUTATIONS_EN = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];
export const ALL_SALUTATIONS = [...new Set([...SALUTATIONS_ES, ...SALUTATIONS_EN])];

// All country calling codes
export const COUNTRY_CODES = [
  { code: "none", label: "Sin lada", flag: "🌐" },
  // North America
  { code: "+1", label: "US/CA", flag: "🇺🇸" },
  { code: "+52", label: "México", flag: "🇲🇽" },
  // Central America
  { code: "+502", label: "Guatemala", flag: "🇬🇹" },
  { code: "+503", label: "El Salvador", flag: "🇸🇻" },
  { code: "+504", label: "Honduras", flag: "🇭🇳" },
  { code: "+505", label: "Nicaragua", flag: "🇳🇮" },
  { code: "+506", label: "Costa Rica", flag: "🇨🇷" },
  { code: "+507", label: "Panamá", flag: "🇵🇦" },
  { code: "+509", label: "Haití", flag: "🇭🇹" },
  // Caribbean
  { code: "+53", label: "Cuba", flag: "🇨🇺" },
  { code: "+1809", label: "Rep. Dom.", flag: "🇩🇴" },
  { code: "+1787", label: "Puerto Rico", flag: "🇵🇷" },
  // South America
  { code: "+54", label: "Argentina", flag: "🇦🇷" },
  { code: "+55", label: "Brasil", flag: "🇧🇷" },
  { code: "+56", label: "Chile", flag: "🇨🇱" },
  { code: "+57", label: "Colombia", flag: "🇨🇴" },
  { code: "+58", label: "Venezuela", flag: "🇻🇪" },
  { code: "+51", label: "Perú", flag: "🇵🇪" },
  { code: "+591", label: "Bolivia", flag: "🇧🇴" },
  { code: "+593", label: "Ecuador", flag: "🇪🇨" },
  { code: "+595", label: "Paraguay", flag: "🇵🇾" },
  { code: "+598", label: "Uruguay", flag: "🇺🇾" },
  // Europe
  { code: "+34", label: "España", flag: "🇪🇸" },
  { code: "+44", label: "UK", flag: "🇬🇧" },
  { code: "+33", label: "Francia", flag: "🇫🇷" },
  { code: "+49", label: "Alemania", flag: "🇩🇪" },
  { code: "+39", label: "Italia", flag: "🇮🇹" },
  { code: "+351", label: "Portugal", flag: "🇵🇹" },
  { code: "+31", label: "Países Bajos", flag: "🇳🇱" },
  { code: "+32", label: "Bélgica", flag: "🇧🇪" },
  { code: "+41", label: "Suiza", flag: "🇨🇭" },
  { code: "+43", label: "Austria", flag: "🇦🇹" },
  { code: "+46", label: "Suecia", flag: "🇸🇪" },
  { code: "+47", label: "Noruega", flag: "🇳🇴" },
  { code: "+45", label: "Dinamarca", flag: "🇩🇰" },
  { code: "+358", label: "Finlandia", flag: "🇫🇮" },
  { code: "+48", label: "Polonia", flag: "🇵🇱" },
  { code: "+420", label: "Chequia", flag: "🇨🇿" },
  { code: "+30", label: "Grecia", flag: "🇬🇷" },
  { code: "+353", label: "Irlanda", flag: "🇮🇪" },
  { code: "+7", label: "Rusia", flag: "🇷🇺" },
  { code: "+380", label: "Ucrania", flag: "🇺🇦" },
  { code: "+40", label: "Rumania", flag: "🇷🇴" },
  { code: "+36", label: "Hungría", flag: "🇭🇺" },
  // Asia
  { code: "+81", label: "Japón", flag: "🇯🇵" },
  { code: "+82", label: "Corea Sur", flag: "🇰🇷" },
  { code: "+86", label: "China", flag: "🇨🇳" },
  { code: "+91", label: "India", flag: "🇮🇳" },
  { code: "+65", label: "Singapur", flag: "🇸🇬" },
  { code: "+66", label: "Tailandia", flag: "🇹🇭" },
  { code: "+84", label: "Vietnam", flag: "🇻🇳" },
  { code: "+63", label: "Filipinas", flag: "🇵🇭" },
  { code: "+60", label: "Malasia", flag: "🇲🇾" },
  { code: "+62", label: "Indonesia", flag: "🇮🇩" },
  { code: "+852", label: "Hong Kong", flag: "🇭🇰" },
  { code: "+886", label: "Taiwán", flag: "🇹🇼" },
  // Middle East
  { code: "+971", label: "EAU", flag: "🇦🇪" },
  { code: "+966", label: "Arabia S.", flag: "🇸🇦" },
  { code: "+972", label: "Israel", flag: "🇮🇱" },
  { code: "+90", label: "Turquía", flag: "🇹🇷" },
  // Africa
  { code: "+27", label: "Sudáfrica", flag: "🇿🇦" },
  { code: "+234", label: "Nigeria", flag: "🇳🇬" },
  { code: "+20", label: "Egipto", flag: "🇪🇬" },
  { code: "+254", label: "Kenia", flag: "🇰🇪" },
  // Oceania
  { code: "+61", label: "Australia", flag: "🇦🇺" },
  { code: "+64", label: "N. Zelanda", flag: "🇳🇿" },
];

// Helper to detect country code from phone
export const detectCountryCode = (phone) => {
  if (!phone) return "+52";
  const cleanPhone = phone.replace(/\s/g, "");
  
  // Try longer codes first (more specific)
  const sortedCodes = [...COUNTRY_CODES]
    .filter(c => c.code !== "none")
    .sort((a, b) => b.code.length - a.code.length);
  
  for (const country of sortedCodes) {
    if (cleanPhone.startsWith(country.code)) {
      return country.code;
    }
  }
  
  return "+52"; // Default to Mexico
};

// Helper to remove country code from phone
export const removeCountryCode = (phone, countryCode) => {
  if (!phone) return "";
  const cleanPhone = phone.replace(/\s/g, "");
  if (countryCode && countryCode !== "none" && cleanPhone.startsWith(countryCode)) {
    return cleanPhone.slice(countryCode.length);
  }
  return cleanPhone;
};

// Seniority levels for buyer personas
export const SENIORITY_LEVELS = [
  { value: "c-level", label: "C-Level (CEO, CFO, COO, etc.)" },
  { value: "vp", label: "VP / Vice President" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior Individual Contributor" },
  { value: "mid", label: "Mid-Level Individual Contributor" },
  { value: "junior", label: "Junior / Entry Level" },
  { value: "intern", label: "Intern / Trainee" },
];

// Default buyer persona options
export const DEFAULT_BUYER_PERSONAS = [
  { value: "economic_buyer", label: "Economic Buyer (Tomador de decisión económica)" },
  { value: "user_buyer", label: "User Buyer (Usuario del producto)" },
  { value: "technical_buyer", label: "Technical Buyer (Evaluador técnico)" },
  { value: "coach", label: "Coach (Aliado interno)" },
  { value: "champion", label: "Champion (Promotor activo)" },
  { value: "influencer", label: "Influencer (Influenciador)" },
  { value: "gatekeeper", label: "Gatekeeper (Acceso a decisores)" },
  { value: "blocker", label: "Blocker (Opositor)" },
  { value: "end_user", label: "End User (Usuario final)" },
  { value: "evaluator", label: "Evaluator (Evaluador)" },
];
