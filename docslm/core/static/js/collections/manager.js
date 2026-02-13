/**
 * Collections Manager - Handles loading and rendering collections
 */

import { getCookie } from '../core/utils.js';
import { initializeAgent, showAgentInactive, disableSendButton, activeCollection } from '../core/agent.js';
import { showCollectionDetails } from '../modals/collectionModal.js';
import { openCreateCollectionModal } from '../modals/createCollectionModal.js';

/**
 * Load collections for a commessa
 * @param {string} commessaCode - Commessa code
 * @param {HTMLElement} container - Container element
 */
export async function loadCollections(commessaCode, container) {
    try {
        if (container) {
            container.querySelectorAll('.collections-section, .collections-container').forEach((el) => el.remove());
            
            // Show loading spinner while fetching collections
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'collections-loading';
            loadingDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:12px;';
            loadingDiv.innerHTML = `
                <div style="width:32px;height:32px;border:3px solid rgba(212, 112, 77, 0.2);border-top:3px solid var(--accent-color);border-radius:50%;animation:spin 1s linear infinite;"></div>
                <div style="font-size:13px;color:var(--text-light);text-align:center;">Caricamento notebook...</div>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;
            container.appendChild(loadingDiv);
        }
        
        const response = await fetch(`/api/list-collections/?commessa=${encodeURIComponent(commessaCode)}`);
        const data = await response.json();
        
        // Remove loading spinner
        if (container) {
            const loader = container.querySelector('.collections-loading');
            if (loader) loader.remove();
        }
        
        if (data.collections) {
            renderCollections(data.collections, container, commessaCode);
        } else if (data.error) {
            console.error('Collections error:', data.error);
            // Show error message to user
            const errorDiv = document.createElement('div');
            errorDiv.style.padding = '12px';
            errorDiv.style.color = 'red';
            errorDiv.textContent = `Errore nel caricamento delle collezioni: ${data.error}`;
            container.appendChild(errorDiv);
        }
    } catch (error) {
        console.error('Error loading collections:', error);
        
        // Remove loading spinner on error
        if (container) {
            const loader = container.querySelector('.collections-loading');
            if (loader) loader.remove();
        }
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.padding = '12px';
        errorDiv.style.color = 'red';
        errorDiv.textContent = `Errore di connessione: ${error.message}`;
        container.appendChild(errorDiv);
    }
}

/**
 * Render collections in container
 * @param {Array} collections - Array of collection objects
 * @param {HTMLElement} container - Container element
 * @param {string} commessaCode - Commessa code
 */
export function renderCollections(collections, container, commessaCode) {
    const section = document.createElement('div');
    section.className = 'collections-section';

    const createWrapper = document.createElement('div');
    createWrapper.className = 'create-notebook-wrapper';

    const createBtn = document.createElement('div');
    createBtn.className = 'create-notebook-btn';
    createBtn.innerHTML = `
        <span class="create-notebook-text">Crea nuovo Notebook</span>
        <div class="plus-icon">+</div>
    `;

    createBtn.addEventListener('click', () => {
        openCreateCollectionModal(commessaCode);
    });

    createWrapper.appendChild(createBtn);

    const list = document.createElement('div');
    list.className = 'collections-list';

    collections.forEach((collection) => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.innerHTML = `
            <span class="collection-name">${collection.displayName}</span>
            <div class="collection-actions">
                <svg class="collection-icon clickable" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Informazioni" aria-label="Informazioni collection">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
            </div>
        `;

        card.addEventListener('click', async () => {
            // Check if this card is already selected BEFORE removing
            const wasSelected = card.classList.contains('selected');
            
            // Remove selection from all cards
            document.querySelectorAll('.collection-card').forEach((c) => c.classList.remove('selected'));
            
            // If it wasn't selected, select it now and initialize agent
            if (!wasSelected) {
                card.classList.add('selected');
                
                // Initialize agent
                await initializeAgent(commessaCode, collection.name);
            } else {
                // Deselect - clear active collection
                showAgentInactive();
                disableSendButton();
            }
        });

        list.appendChild(card);

        // Info icon opens collection modal (do not propagate to card click)
        const infoIcon = card.querySelector('.collection-icon.clickable');
        if (infoIcon) {
            infoIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                showCollectionDetails(collection, commessaCode);
            });
        }
    });

    section.appendChild(createWrapper);
    section.appendChild(list);

    container.appendChild(section);
}

/**
 * Show selected job in sidebar
 * @param {Object} selectedJob - Job object
 */
export function showSelectedJob(selectedJob) {
    const sidebarContent = document.getElementById('sidebarContent');
    if (!sidebarContent) return;
    sidebarContent.innerHTML = '';

    const jobHeader = document.createElement('div');
    jobHeader.className = 'sidebar-selected-job-header';
    jobHeader.innerHTML = `
        <div class="sidebar-job-code">${selectedJob.code}</div>
        <svg class="sidebar-job-info-icon clickable" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Informazioni Commessa" aria-label="Informazioni Commessa" style="cursor:pointer;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    `;
    sidebarContent.appendChild(jobHeader);

    const container = document.createElement('div');
    container.className = 'collections-container';
    sidebarContent.appendChild(container);

    loadCollections(selectedJob.code, container);

    const infoIcon = jobHeader.querySelector('.sidebar-job-info-icon');
    if (infoIcon) {
        infoIcon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const { showJobDetails } = await import('../modals/jobModal.js');
            showJobDetails(selectedJob);
        });
    }
}
