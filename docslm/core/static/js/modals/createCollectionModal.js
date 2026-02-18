/**
 * Create Collection Modal Module - Handles collection creation workflow
 */

import { getCookie, sanitizeCollectionName } from '../core/utils.js';
import { getModalSelectedFiles, clearModalSelectedFiles } from './files.js';
import { loadJobFiles } from './browser.js';

// Current commessa code being processed
export let currentCommessaCode = null;

// Flag to track if documents are being processed
export let isProcessing = false;

/**
 * Open create collection modal
 * @param {string} commessaCode - Commessa code
 */
export function openCreateCollectionModal(commessaCode) {
    currentCommessaCode = commessaCode;
    clearModalSelectedFiles();
    
    const modal = document.getElementById('createCollectionModal');
    const input = document.getElementById('collectionNameInput');
    
    if (modal) {
        modal.classList.add('open');
        
        // Reset modal content to initial state
        const body = document.querySelector('.create-collection-body');
        if (body) {
            body.innerHTML = `<div style="padding:12px;color:var(--text-light)">Inizializza...</div>`;
        }
        
        // Load file browser
        loadJobFiles(commessaCode, '');
    }
    
    if (input) {
        input.value = '';
        input.disabled = false;
        input.style.opacity = '1';
        input.style.cursor = 'text';
        setTimeout(() => input.focus(), 100);
    }
    
    const confirmBtn = document.getElementById('createCollectionConfirmBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.textContent = 'Crea';
    }
    
    // Remove any existing selected files badge
    const badge = document.getElementById('selectedFilesBadge');
    if (badge) badge.remove();
}

/**
 * Close create collection modal
 */
export function closeCreateCollectionModalFunc() {
    const modal = document.getElementById('createCollectionModal');
    if (modal) {
        modal.classList.remove('open');
    }
    currentCommessaCode = null;
    clearModalSelectedFiles();
}

/**
 * Submit create collection form
 */
export function submitCreateCollection() {
    const input = document.getElementById('collectionNameInput');
    const confirmBtn = document.getElementById('createCollectionConfirmBtn');
    const body = document.querySelector('.create-collection-body');
    
    if (!currentCommessaCode) {
        return;
    }

    if (!input) {
        return;
    }

    const rawName = input.value.trim();
    if (!rawName) {
        return;
    }

    const sanitizedName = sanitizeCollectionName(rawName);
    if (!sanitizedName) {
        return;
    }

    input.value = sanitizedName;

    // Immediately show loading state and disable inputs
    if (input) {
        input.disabled = true;
        input.style.opacity = '0.6';
        input.style.cursor = 'not-allowed';
    }
    
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.style.cursor = 'not-allowed';
        confirmBtn.textContent = 'Caricamento...';
    }
    
    if (body) {
        body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:60px 40px;height:100%;">
                <div style="width:48px;height:48px;border:4px solid rgba(212, 112, 77, 0.2);border-top:4px solid var(--accent-color);border-radius:50%;animation:spin 1s linear infinite;"></div>
                <div style="text-align:center;">
                    <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">Creazione in corso...</div>
                    <div style="font-size:13px;color:var(--text-light);">Processing documenti e creazione collection</div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    // Call createCollection without finally() - let it handle button state
    createCollection(currentCommessaCode, sanitizedName)
        .catch((error) => {
            console.error('Error creating collection:', error);
            if (input) {
                input.disabled = false;
                input.style.opacity = '1';
                input.style.cursor = 'text';
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.textContent = 'Crea';
            }
        });
}

/**
 * Create collection
 * @param {string} commessaCode - Commessa code
 * @param {string} collectionName - Collection name
 */
export async function createCollection(commessaCode, collectionName) {
    const confirmBtn = document.getElementById('createCollectionConfirmBtn');
    const body = document.querySelector('.create-collection-body');
    
    const loadingLabel = 'Creazione in corso...';
    const loadingDesc = 'Processing documenti e creazione collection';
    const successLabel = 'Creazione completata!';
    const successDesc = 'Notebook creato con successo';
    
    try {
        isProcessing = true; // Prevent modal closing during processing
        
        // Disable button and show loading state
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.6';
            confirmBtn.style.cursor = 'not-allowed';
        }
        
        // Show loading message immediately
        if (body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:60px 40px;height:100%;">
                    <div style="width:48px;height:48px;border:4px solid rgba(212, 112, 77, 0.2);border-top:4px solid var(--accent-color);border-radius:50%;animation:spin 1s linear infinite;"></div>
                    <div style="text-align:center;">
                        <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">${loadingLabel}</div>
                        <div style="font-size:13px;color:var(--text-light);">${loadingDesc}</div>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;
        }
        
        const requestBody = {
            commessa: commessaCode,
            collection_name: collectionName,
            files: getModalSelectedFiles()
        };
        
        const response = await fetch('/api/create-collection/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.success) {
            // Show success message briefly
            if (body) {
                body.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:60px 40px;height:100%;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <div style="text-align:center;">
                            <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">${successLabel}</div>
                            <div style="font-size:13px;color:var(--text-light);">${successDesc}</div>
                        </div>
                    </div>
                `;
            }

            // Close modal and reload after short delay
            setTimeout(() => {
                closeCreateCollectionModalFunc();
                window.location.reload();
            }, 1000);
        } else {
            // Show error message
            const errorMsg = data.error || 'Errore sconosciuto';
            if (body) {
                body.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:60px 40px;height:100%;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <div style="text-align:center;">
                            <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">Errore nella creazione</div>
                            <div style="font-size:13px;color:var(--text-light);">${errorMsg}</div>
                        </div>
                    </div>
                `;
            }
            alert('Errore nella creazione della collection: ' + errorMsg);
            
            // Re-enable button after error
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
                confirmBtn.textContent = 'Crea';
            }
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        if (body) {
            body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:60px 40px;height:100%;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <div style="text-align:center;">
                        <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:8px;">Errore di connessione</div>
                        <div style="font-size:13px;color:var(--text-light);">${error.message}</div>
                    </div>
                </div>
            `;
        }
        alert('Errore di connessione: ' + error.message);
        
        // Re-enable button after error
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.textContent = 'Crea';
        }
    } finally {
        isProcessing = false;
    }
}

/**
 * Setup create collection modal event listeners
 */
export function setupCreateCollectionModalListeners() {
    const createCollectionModal = document.getElementById('createCollectionModal');
    const createCollectionConfirmBtn = document.getElementById('createCollectionConfirmBtn');
    const collectionInput = document.getElementById('collectionNameInput');
    
    // Modal click outside to close
    if (createCollectionModal) {
        createCollectionModal.addEventListener('click', (e) => {
            if (isProcessing) return; // Don't close during processing
            if (e.target === createCollectionModal) {
                closeCreateCollectionModalFunc();
            }
        });
    }

    // Enter key to create collection
    if (collectionInput) {
        collectionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitCreateCollection();
            }
        });
    }

    if (createCollectionConfirmBtn) {
        createCollectionConfirmBtn.addEventListener('click', submitCreateCollection);
    }
}
