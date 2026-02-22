/**
 * Utility functions for MensajesHoy components
 */

/**
 * Copy text to clipboard with fallback for older browsers
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Whether copy was successful
 */
export const copyToClipboard = async (text) => {
  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed, trying fallback:", err);
    }
  }
  
  // Fallback: create a temporary textarea and use execCommand
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Make it visible but off-screen for iOS compatibility
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Try to select the text
    try {
      textArea.setSelectionRange(0, text.length);
    } catch (e) {
      // setSelectionRange not supported
    }
    
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    }
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
  }
  
  return false;
};

/**
 * Generate WhatsApp URL with message
 * @param {string} phone - Phone number
 * @param {string} message - Message to send
 * @returns {string|null} - WhatsApp URL or null if no phone
 */
export const generateWhatsAppUrl = (phone, message) => {
  if (!phone) return null;
  // Clean phone number - remove spaces, dashes, parentheses
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  // Ensure it starts with country code (assume Mexico +52 if no code)
  const phoneWithCode = cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : 
                        cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneWithCode}?text=${encodedMessage}`;
};

/**
 * Group contacts by rule and buyer persona
 * @param {Array} contacts - Array of contacts
 * @returns {Object} - Grouped contacts by rule > persona
 */
export const groupContactsByRuleAndPersona = (contacts) => {
  const groups = {};
  contacts.forEach(contact => {
    // Use rule_matched for WhatsApp, rule_type for Email
    const rule = contact.rule_matched || contact.rule_type || "Other";
    const persona = contact.buyer_persona || contact.persona || "Sin Persona";
    
    if (!groups[rule]) groups[rule] = {};
    if (!groups[rule][persona]) groups[rule][persona] = [];
    groups[rule][persona].push(contact);
  });
  return groups;
};

/**
 * Get paginated items from array
 * @param {Array} items - Array of items
 * @param {number} page - Current page (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Array} - Paginated items
 */
export const getPaginatedItems = (items, page, pageSize) => {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
};

/**
 * Get total pages for pagination
 * @param {number} totalItems - Total number of items
 * @param {number} pageSize - Items per page
 * @returns {number} - Total pages
 */
export const getTotalPages = (totalItems, pageSize) => {
  return Math.ceil(totalItems / pageSize);
};
