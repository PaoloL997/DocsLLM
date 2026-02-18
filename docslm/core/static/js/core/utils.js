/**
 * Utility functions - Shared helper functions across the application
 */

/**
 * Get CSRF token from cookies
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null
 */
export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
}

/**
 * Sanitize collection name by replacing spaces with underscores
 * @param {string} name - Collection name
 * @returns {string} Sanitized name
 */
export function sanitizeCollectionName(name) {
    const sanitized = name.trim().replace(/\s+/g, '_');
    return sanitized.length ? sanitized : '';
}

/**
 * Auto-resize textarea based on content
 * @param {HTMLTextAreaElement} textarea - Textarea element to resize
 */
export function autoResizeTextarea(textarea) {
    const minHeight = 42;
    const maxHeight = 200;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = newHeight + 'px';
}
