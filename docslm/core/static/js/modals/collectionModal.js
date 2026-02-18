/**
 * Collection Modal - Display collection details and manage files
 */

import { getCookie } from '../core/utils.js';

/**
 * Show collection details modal
 * @param {Object} collection - Collection object
 * @param {string} commessa - Commessa code
 */
export async function showCollectionDetails(collection, commessa) {
    const modal = document.getElementById('collectionModal');
    const title = document.getElementById('modalCollectionTitle');
    const details = document.getElementById('modalCollectionDetails');
    if (!modal || !title || !details) return;
    title.textContent = `Notebook: ${collection.displayName}`;
    
    // Salva i dati nel modal per uso successivo
    modal.setAttribute('data-commessa', commessa);
    modal.setAttribute('data-collection', collection.name);
    
    // Mostra caricamento (span across both columns)
    details.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-light);">Caricamento file...</div>';
    modal.classList.add('open');
    
    try {
        const response = await fetch(`/api/list-collection-files/?commessa=${encodeURIComponent(commessa)}&collection=${encodeURIComponent(collection.name)}`);
        const data = await response.json();
        
        if (data.files && data.files.length > 0) {
            const filesList = data.files.map(file => `
                <div class="jobfile-row jobfile-file" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);transition:all 0.2s;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        <span style="font-size:14px;color:var(--text-color);word-break:break-word;flex:1;min-width:0;">${file}</span>
                    </div>
                    <button class="remove-doc-btn" data-filename="${file}" style="padding:4px 8px;background:none;border:none;color:var(--text-light);cursor:pointer;font-size:18px;line-height:1;opacity:0.6;transition:opacity 0.2s;flex-shrink:0;" title="Rimuovi documento">×</button>
                </div>
            `).join('');
            details.innerHTML = `
                <div style="grid-column: 1 / -1; display:flex;flex-direction:column;gap:4px;">${filesList}</div>
            `;
            
            // Event listeners per i pulsanti di rimozione
            details.querySelectorAll('.remove-doc-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const filename = e.target.getAttribute('data-filename');
                    await deleteCollectionFile(commessa, collection.name, filename);
                });
            });
        } else {
            details.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center;padding:40px 20px;color:var(--text-light);">Nessun file trovato per questo notebook.</div>
            `;
        }
    } catch (error) {
        console.error('Error loading collection files:', error);
        details.innerHTML = '<div class="collection-files-error" style="grid-column: 1 / -1;">Errore nel caricamento dei file.</div>';
    }
}

/**
 * Delete a file from collection
 * @param {string} commessa - Commessa code
 * @param {string} collectionName - Collection name
 * @param {string} filename - File name
 */
export async function deleteCollectionFile(commessa, collectionName, filename) {
    try {
        const response = await fetch('/api/delete-collection-file/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                commessa: commessa,
                collection: collectionName,
                filename: filename
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error deleting file:', data.error);
            alert(`Errore: ${data.error || 'Impossibile eliminare il file'}`);
            return;
        }
        
        // Mostra il banner di conferma
        showDeleteConfirmationBanner(filename);
        
        // Ricarica i file della collection
        const modal = document.getElementById('collectionModal');
        if (modal && modal.classList.contains('open')) {
            const collection = { displayName: document.getElementById('modalCollectionTitle').textContent.replace('Notebook: ', ''), name: collectionName };
            await showCollectionDetails(collection, commessa);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Errore durante l\'eliminazione del file');
    }
}

/**
 * Show delete confirmation banner
 * @param {string} filename - Deleted filename
 */
export function showDeleteConfirmationBanner(filename) {
    // Crea il banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--send-bg);
        color: var(--accent-color);
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideInUp 0.3s ease-out;
        max-width: 300px;
        word-break: break-word;
    `;
    
    // Estrai solo il nome del file
    const filenameOnly = filename.split('/').pop().split('\\').pop();
    banner.textContent = `✓ ${filenameOnly} eliminato`;
    
    document.body.appendChild(banner);
    
    // Rimuovi il banner dopo 1 secondo
    setTimeout(() => {
        banner.style.animation = 'slideOutDown 0.3s ease-in';
        setTimeout(() => {
            banner.remove();
        }, 300);
    }, 1000);
}

/**
 * Setup collection modal event listeners
 */
export function setupCollectionModalListeners() {
    const collectionModal = document.getElementById('collectionModal');
    const deleteAllDocsBtn = document.getElementById('deleteAllDocsBtn');

    if (deleteAllDocsBtn) {
        deleteAllDocsBtn.addEventListener('click', async () => {
            const modal = document.getElementById('collectionModal');
            const commessa = modal.getAttribute('data-commessa');
            const collection = modal.getAttribute('data-collection');
            
            if (!commessa || !collection) {
                console.error('Commessa or collection not found');
                return;
            }
            
            try {
                const response = await fetch('/api/delete-collection/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        commessa: commessa,
                        collection: collection
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    console.error('Error deleting collection:', data.error);
                    alert(`Errore: ${data.error || 'Impossibile eliminare il notebook'}`);
                    return;
                }
                
                const modalTitle = document.getElementById('modalCollectionTitle');
                const collectionName = modalTitle.textContent.replace('Notebook: ', '');
                showDeleteConfirmationBanner(collectionName);
                
                modal.classList.remove('open');
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                console.error('Error deleting collection:', error);
                alert('Errore durante l\'eliminazione del notebook');
            }
        });
    }
}
