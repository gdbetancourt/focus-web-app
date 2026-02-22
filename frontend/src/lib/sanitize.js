import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes <script>, onclick, onerror, etc.
 */
export function sanitizeHTML(dirty) {
  if (!dirty) return '';
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
      'img', 'hr', 'sub', 'sup'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel',
      'width', 'height', 'align', 'valign', 'colspan', 'rowspan'
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // Allow target="_blank" for links
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
  });
}

/**
 * Create props for dangerouslySetInnerHTML with sanitization
 */
export function createSafeHTML(html) {
  return { __html: sanitizeHTML(html) };
}
