/**
 * Files Module - Manages selected files in collection creation
 */

// Selected files in the create-collection modal
export let modalSelectedFiles = [];

/**
 * Update modal selected files
 * @param {string} action - 'add', 'remove', or 'clear'
 * @param {string} filePath - File path
 */
export function updateModalSelectedFiles(action, filePath) {
    if (action === 'add') {
        if (!modalSelectedFiles.includes(filePath)) {
            modalSelectedFiles.push(filePath);
        }
    } else if (action === 'remove') {
        modalSelectedFiles = modalSelectedFiles.filter(x => x !== filePath);
    } else if (action === 'clear') {
        modalSelectedFiles = [];
    }
    renderSelectedFilesCounter();
}

/**
 * Get modal selected files
 * @returns {Array<string>} Selected file paths
 */
export function getModalSelectedFiles() {
    return modalSelectedFiles;
}

/**
 * Clear modal selected files
 */
export function clearModalSelectedFiles() {
    modalSelectedFiles = [];
    renderSelectedFilesCounter();
}

/**
 * Render selected files counter badge
 */
export function renderSelectedFilesCounter() {
    const headerTitle = document.querySelector('.create-collection-title');
    if (!headerTitle) return;
    // show count on the right
    let badge = document.getElementById('selectedFilesBadge');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'selectedFilesBadge';
        badge.style.fontSize = '12px';
        badge.style.color = 'var(--text-light)';
        badge.style.marginLeft = '8px';
        headerTitle.parentNode.appendChild(badge);
    }
    badge.textContent = modalSelectedFiles.length ? `${modalSelectedFiles.length} file selezionati` : '';
}
