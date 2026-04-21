// Get greeting on page load
document.addEventListener('DOMContentLoaded', function() {
    try {
        setupEventListeners();
        // disable send until an agent/collection is selected
        disableSendButton();
        initializeDropdown();
        restoreSelectedCommessa();
        setupUserMenu();
        restoreActiveCollectionTasks();

        // Check for any blocking overlays
        setTimeout(() => {
            const modals = document.querySelectorAll('.create-collection-modal, .modal');
            modals.forEach(modal => {
                if (window.getComputedStyle(modal).display !== 'none' && !modal.classList.contains('open')) {
                    modal.style.display = 'none';
                }
            });
            document.body.style.pointerEvents = 'auto';
        }, 50);
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

function initializeDropdown() {
    const veloceOption = document.querySelector('.model-option[data-value="veloce"]');
    if (veloceOption) {
        veloceOption.classList.add('selected');
    }
}

async function loadGreeting() {}

function setupUserMenu() {
    const menuBtn = document.getElementById('userMenuBtn');
    const menu = document.getElementById('userMenu');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!menuBtn || !menu) return;

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'none' ? '' : 'none';
    });

    document.addEventListener('click', () => { menu.style.display = 'none'; });
    menu.addEventListener('click', (e) => e.stopPropagation());

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/logout/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') },
                });
                localStorage.removeItem('docslm_user');
                window.location.href = '/login/';
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }
}

async function restoreSession() {}

async function generateSummary() {
    if (!activeCollection) {
        showAgentInactive();
        return;
    }
    
    // Mostra la modal di upload
    const reportModal = document.getElementById('reportUploadModal');
    if (reportModal) {
        reportModal.classList.add('open');
    }
}

async function handleReportFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reportModal = document.getElementById('reportUploadModal');
    if (reportModal) {
        reportModal.classList.remove('open');
    }

    const summaryBtn = document.getElementById('summaryBtn');
    if (summaryBtn) {
        summaryBtn.disabled = true;
    }

    ensureChatVisible();
    const loaderRow = appendLoader();

    try {
        if (!activeCollection) {
            throw new Error('No collection selected');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('commessa', activeCollection.commessa);
        formData.append('collection', activeCollection.collection);

        const response = await fetch('/api/generate-report/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        });

        if (loaderRow) {
            if (loaderRow._timer) clearInterval(loaderRow._timer);
            loaderRow.remove();
        }

        const data = await response.json();
        
        if (response.ok) {
            // Create banner with download button
            const bannerHTML = `
                <div style="background: white; border-radius: 16px; padding: 24px; margin: 12px 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); border: 1px solid #f0f0f0; backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.95);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
                        <div style="flex: 1;">
                            <div style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; line-height: 1.4;">${data.filename || 'report.xlsx'}</div>
                            <div style="font-size: 13px; color: #888; display: flex; align-items: center; gap: 8px;\">\n                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"></path>\n                                </svg>\n                                ${data.query_count || 0} domande elaborate\n                            </div>\n                        </div>\n                        <button onclick="downloadReportFile('${data.download_token}', '${data.filename}')" style="background: linear-gradient(135deg, var(--accent-color) 0%, rgba(212, 112, 77, 0.8) 100%); color: white; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.3s ease; white-space: nowrap; box-shadow: 0 4px 12px rgba(212, 112, 77, 0.25); flex-shrink: 0;\" onmouseover=\"this.style.boxShadow='0 8px 24px rgba(212, 112, 77, 0.4)'; this.style.transform='translateY(-2px)';\" onmouseout=\"this.style.boxShadow='0 4px 12px rgba(212, 112, 77, 0.25)'; this.style.transform='translateY(0)';\">Download</button>\n                    </div>\n                </div>\n            `;
            appendMessage('assistant', bannerHTML, true);
        } else {
            appendMessage('assistant', `Errore: ${data.error || 'Impossibile elaborare il report'}`);
        }
    } catch (error) {
        console.error('Error generating report:', error);
        if (loaderRow) {
            if (loaderRow._timer) clearInterval(loaderRow._timer);
            loaderRow.remove();
        }
        appendMessage('assistant', `Errore: ${error.message}`);
    } finally {
        if (summaryBtn) {
            summaryBtn.disabled = false;
        }
    }
}

// Download report file when requested
function downloadReportFile(token, filename) {
    const link = document.createElement('a');
    link.href = `/api/download-report/?token=${token}&filename=${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const summaryBtn = document.getElementById('summaryBtn');
    const modelSelect = document.getElementById('modelSelect');
    const modelMenu = document.getElementById('modelMenu');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const searchIconButton = document.getElementById('searchIconButton');
    const sidebarSearchInput = document.getElementById('sidebarSearchInput');
    const jobModal = document.getElementById('jobModal');
    const closeModal = document.getElementById('closeModal');
    const collectionModal = document.getElementById('collectionModal');
    const closeCollectionModal = document.getElementById('closeCollectionModal');
    const createCollectionModal = document.getElementById('createCollectionModal');
    const createCollectionConfirmBtn = document.getElementById('createCollectionConfirmBtn');

    if (sidebarToggle) {
        sidebarToggle.style.display = 'none';
    }

    if (searchIconButton && sidebar && sidebarSearchInput) {
        searchIconButton.addEventListener('click', function() {
            sidebar.classList.remove('closed');
            if (sidebarToggle) {
                sidebarToggle.setAttribute('aria-label', 'Chiudi sidebar');
            }
            setTimeout(() => {
                sidebarSearchInput.focus();
            }, 200);
        });
    }

    if (sidebarSearchInput) {
        let timeout = null;
        sidebarSearchInput.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                performSearch(this.value);
            }, 300);
        });

        sidebarSearchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(timeout);
                performSearch(this.value, false);
            }
        });
    }

    // Modal click outside to close
    if (createCollectionModal) {
        createCollectionModal.addEventListener('click', (e) => {
            if (isProcessing || isCollectionCreating) return;
            if (e.target === createCollectionModal) {
                closeCreateCollectionModalFunc();
            }
        });
    }

    // Enter key to create collection
    const collectionInput = document.getElementById('collectionNameInput');
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

    if (closeModal && jobModal) {
        closeModal.addEventListener('click', () => {
            jobModal.classList.remove('open');
        });
    }

    // Event listeners per i nuovi pulsanti del modal collection
    const deleteAllDocsBtn = document.getElementById('deleteAllDocsBtn');

    if (deleteAllDocsBtn) {
        deleteAllDocsBtn.addEventListener('click', async () => {
            const modalTitle = document.getElementById('modalCollectionTitle');
            const collectionName = modalTitle.textContent.replace('Notebook: ', '');
            
            // Get commessa from current context (from the sidebar or a data attribute)
            // We need to find the current commessa - let's use a different approach
            // by passing it through a data attribute on the modal
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
                
                // Mostra il banner di conferma
                showDeleteConfirmationBanner(collectionName);
                
                // Chiudi il modal
                modal.classList.remove('open');
                
                // Ricarica la pagina dopo un breve delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch (error) {
                console.error('Error deleting collection:', error);
                alert('Errore durante l\'eliminazione del notebook');
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (isProcessing || isCollectionCreating) return;
        
        const createModal = document.getElementById('createCollectionModal');
        const reportModal = document.getElementById('reportUploadModal');
        
        if (e.target === jobModal) {
            if (jobModal.classList.contains('open')) {
                jobModal.classList.remove('open');
            }
        }
        if (collectionModal && e.target === collectionModal) {
            if (collectionModal.classList.contains('open')) {
                collectionModal.classList.remove('open');
            }
        }
        if (createModal && e.target === createModal) {
            if (createModal.classList.contains('open')) {
                createModal.classList.remove('open');
            }
        }
        if (reportModal && e.target === reportModal) {
            if (reportModal.classList.contains('open')) {
                reportModal.classList.remove('open');
            }
        }
    });

    // Allow closing modals with ESC key
    document.addEventListener('keydown', (e) => {
        if (isProcessing || isCollectionCreating) return;
        
        if (e.key === 'Escape') {
            const createModal = document.getElementById('createCollectionModal');
            const reportModal = document.getElementById('reportUploadModal');
            if (createModal && createModal.classList.contains('open')) {
                createModal.classList.remove('open');
            }
            if (jobModal && jobModal.classList.contains('open')) {
                jobModal.classList.remove('open');
            }
            if (collectionModal && collectionModal.classList.contains('open')) {
                collectionModal.classList.remove('open');
            }
            if (reportModal && reportModal.classList.contains('open')) {
                reportModal.classList.remove('open');
            }
        }
    });
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            autoResizeTextarea(messageInput);
        });
        autoResizeTextarea(messageInput);
        messageInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    
    if (summaryBtn) {
        summaryBtn.addEventListener('click', generateSummary);
    }

    // Setup Report Upload Modal
    const reportUploadModal = document.getElementById('reportUploadModal');
    const reportUploadClose = document.getElementById('reportUploadClose');
    const reportUploadBtn = document.getElementById('reportUploadBtn');

    if (reportUploadClose) {
        reportUploadClose.addEventListener('click', () => {
            if (reportUploadModal) {
                reportUploadModal.classList.remove('open');
            }
        });
    }

    if (reportUploadBtn) {
        reportUploadBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.xlsx,.xls';
            
            fileInput.addEventListener('change', (e) => {
                handleReportFileUpload(e);
            });
            fileInput.click();
        });
    }

    if (modelSelect && modelMenu) {
        modelSelect.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (modelMenu.classList.contains('open')) {
                closeModelDropdown();
            } else {
                openModelDropdown();
            }
        });

        document.querySelectorAll('.model-option[data-value]').forEach(option => {
            option.addEventListener('click', function() {
                selectModel(this.dataset.value, this.querySelector('.model-option-title').textContent);
                closeModelDropdown();
            });
        });

        document.addEventListener('click', function(e) {
            if (!modelSelect.contains(e.target) && !modelMenu.contains(e.target)) {
                closeModelDropdown();
            }
        });
    }
}

async function performSearch(query, autoOpen = false) {
    const resultsContainer = document.getElementById('searchResults');
    if (!query.trim()) {
        resultsContainer.innerHTML = '';
        updateSelectedCommessaParam(null);
        resultsContainer.classList.remove('job-selected');
        return;
    }
    
    try {
        const response = await fetch(`/api/search-commesse/?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results) {
            if (autoOpen) {
                const normalizedQuery = query.replace(/\s+/g, '').toLowerCase();
                const match = data.results.find(job => job.code && job.code.replace(/\s+/g, '').toLowerCase() === normalizedQuery);
                if (match) {
                    const searchInput = document.getElementById('sidebarSearchInput');
                    if (searchInput) {
                        searchInput.value = match.code;
                    }
                    showSelectedJob(match);
                    return;
                }
            }
            renderSearchResults(data.results);
        } else if (data.error) {
            console.error('Search error:', data.error);
            resultsContainer.innerHTML = `<div style="padding: 12px; color: red;">Errore: ${data.error}</div>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        resultsContainer.innerHTML = `<div style="padding: 12px; color: red;">Errore di connessione</div>`;
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    container.innerHTML = '';
    container.classList.remove('job-selected');
    results.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <span class="job-card-number">${job.code}</span>
            <button class="job-info-btn" title="Informazioni">i</button>
        `;
        
        // Click handler per selezionare la commessa
        card.addEventListener('click', (e) => {
            // Evita che il click si propaghi se è stato cliccato il pulsante info
            if (e.target.classList.contains('job-info-btn')) return;
            
            const searchInput = document.getElementById('sidebarSearchInput');
            if (searchInput) {
                searchInput.value = job.code;
                // Mostra solo la commessa selezionata
                showSelectedJob(job);
            }
        });
        
        card.querySelector('.job-info-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showJobDetails(job);
        });
        container.appendChild(card);
    });
}

function showSelectedJob(selectedJob) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.add('job-selected');
    const jobInfo = document.createElement('div');
    jobInfo.className = 'selected-job-info';
    
    const title = document.createElement('div');
    title.className = 'selected-job-title';
    title.textContent = `Commessa: ${selectedJob.code}`;
    
    const description = document.createElement('div');
    description.className = 'selected-job-description';
    description.innerHTML = `Commessa destinata a <span class="field-value">${selectedJob.customer}</span> in carico allo stabilimento di <span class="field-value">${selectedJob.site}</span>. Scopo: <span class="field-value">${selectedJob.goal}</span> Project Manager incaricato: <span class="field-value">${selectedJob.project_manager}</span>. Stato: <span class="field-value">${selectedJob.status}</span> (<span class="field-value">${selectedJob.end_date}</span>).`;
    
    jobInfo.appendChild(title);
    jobInfo.appendChild(description);
    container.appendChild(jobInfo);

    updateSelectedCommessaParam(selectedJob.code);
    
    // Load and display collections for this job
    loadCollections(selectedJob.code, container);
}

async function loadCollections(commessaCode, container) {
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
            mergeProcessingTasks(commessaCode, data.processing || []);
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

function renderCollections(collections, container, commessaCode) {
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
                activeCollection = null;
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

// Global variable for current commessa
let currentCommessaCode = null;
// Selected files in the create-collection modal
let modalSelectedFiles = [];
// Active collection
let activeCollection = null;
// Flag to track if documents are being processed
let isProcessing = false;
// Flag to lock the create-collection modal while the creation request is in flight
let isCollectionCreating = false;
// Active Celery collection processing tasks
let activeCollectionTasks = [];
let collectionTaskPollInterval = null;

function mergeProcessingTasks(commessa, processing) {
    // Drop any previously tracked tasks for this commessa and replace with the
    // fresh server-side snapshot. Tasks from other commesse are kept intact.
    activeCollectionTasks = activeCollectionTasks.filter(t => t.commessa !== commessa);
    (processing || []).forEach(p => activeCollectionTasks.push({
        id: p.id,
        commessa: p.commessa,
        collection_name: p.collection_name,
        status: p.status,
        files_done: p.files_done ?? 0,
        files_total: p.files_total ?? 0,
    }));
    updateCollectionProcessingBadge();
    const hasInProgress = activeCollectionTasks.some(
        t => t.status === 'pending' || t.status === 'processing'
    );
    if (hasInProgress) startCollectionPolling();
}

async function restoreActiveCollectionTasks() {
    try {
        const res = await fetch('/api/collection-tasks/active/');
        if (!res.ok) return;
        const data = await res.json();
        const tasks = data.tasks || [];
        if (tasks.length === 0) return;
        activeCollectionTasks = tasks;
        updateCollectionProcessingBadge();
        startCollectionPolling();
    } catch (e) {
        console.warn('Could not restore active collection tasks:', e);
    }
}
// User is always authenticated on this page (protected by @login_required)
let isLoggedIn = true;

function showAgentLoading() {
    const root = document.getElementById('agentStatus');
    if (!root) return;
    const loading = root.querySelector('.agent-loading');
    const success = root.querySelector('.agent-success');
    const error = root.querySelector('.agent-error');
    const inactive = root.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'flex';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

function showAgentSuccess() {
    const root = document.getElementById('agentStatus');
    if (!root) return;
    const loading = root.querySelector('.agent-loading');
    const success = root.querySelector('.agent-success');
    const error = root.querySelector('.agent-error');
    const inactive = root.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

function showAgentError() {
    const root = document.getElementById('agentStatus');
    if (!root) return;
    const loading = root.querySelector('.agent-loading');
    const success = root.querySelector('.agent-success');
    const error = root.querySelector('.agent-error');
    const inactive = root.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (inactive) inactive.style.display = 'none';
}

function showAgentInactive() {
    const root = document.getElementById('agentStatus');
    if (!root) return;
    const loading = root.querySelector('.agent-loading');
    const success = root.querySelector('.agent-success');
    const error = root.querySelector('.agent-error');
    const inactive = root.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'flex';
}

function hideAgentStatus() {
    const root = document.getElementById('agentStatus');
    if (!root) return;
    const loading = root.querySelector('.agent-loading');
    const success = root.querySelector('.agent-success');
    const error = root.querySelector('.agent-error');
    const inactive = root.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

function isUserLoggedIn() {
    const userInfo = document.getElementById('userInfo');
    return userInfo && userInfo.style.display !== 'none';
}

function enableSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    const summaryBtn = document.getElementById('summaryBtn');
    if (!sendBtn) return;
    
    // Abilita solo se loggato E con collezione attiva
    if (!isUserLoggedIn() || !activeCollection) {
        disableSendButton();
        return;
    }
    
    sendBtn.removeAttribute('disabled');
    sendBtn.classList.remove('disabled');
    if (summaryBtn) {
        summaryBtn.disabled = false;
    }
}

function disableSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    const summaryBtn = document.getElementById('summaryBtn');
    if (!sendBtn) return;
    sendBtn.setAttribute('disabled', 'true');
    sendBtn.classList.add('disabled');
    if (summaryBtn) {
        summaryBtn.disabled = true;
    }
}

async function initializeAgent(commessa, collectionName) {
    try {
        // Show loading state
        showAgentLoading();
        
        // Get selected mode from UI
        const modelSelected = document.querySelector('.model-selected');
        const mode = modelSelected ? modelSelected.textContent.trim().toLowerCase() : 'veloce';
        
        const response = await fetch('/api/initialize-agent/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                commessa: commessa,
                collection_name: collectionName,
                mode: mode
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            activeCollection = {
                commessa: commessa,
                collection: collectionName,
                mode: mode
            };
            // Dispatch event for other pages (e.g. ricerca) to react
            document.dispatchEvent(new CustomEvent('collectionSelected', {
                detail: { commessa, collection: collectionName, mode }
            }));
            // Show success message
            showAgentSuccess();
            // enable sending now that an agent is active
            enableSendButton();
        } else {
            console.error('Error initializing agent:', data.error);
            alert('Errore nell\'inizializzazione dell\'agent: ' + data.error);
            showAgentError();
            // keep send disabled
            disableSendButton();
        }
    } catch (error) {
        console.error('Error initializing agent:', error);
        alert('Errore di connessione: ' + error.message);
        showAgentError();
        disableSendButton();
    }
}

function sanitizeCollectionName(name) {
    const sanitized = name.trim().replace(/\s+/g, '_');
    return sanitized.length ? sanitized : '';
}

function submitCreateCollection() {
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

function updateSelectedCommessaParam(commessaCode) {
    const url = new URL(window.location.href);
    if (commessaCode) {
        url.searchParams.set('commessa', commessaCode);
    } else {
        url.searchParams.delete('commessa');
    }
    window.history.replaceState({}, '', url);
}

function restoreSelectedCommessa() {
    const params = new URLSearchParams(window.location.search);
    const commessa = params.get('commessa');
    if (!commessa) {
        return;
    }

    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) {
        searchInput.value = commessa;
    }

    performSearch(commessa, true);
}

// Functions for Create Collection Modal
function openCreateCollectionModal(commessaCode) {
    currentCommessaCode = commessaCode;
    const modal = document.getElementById('createCollectionModal');
    const input = document.getElementById('collectionNameInput');
    
    if (modal && input) {
        input.value = '';
        input.disabled = false;
        input.style.opacity = '1';
        input.style.cursor = 'text';
        // reset selected files and update counter
        modalSelectedFiles = [];
        renderSelectedFilesCounter();
        // load job files for this commessa into the modal browser
        loadJobFiles(commessaCode, '');
        modal.classList.add('open');
        if (!collectionName) {
            setTimeout(() => input.focus(), 200);
        }
    }
}

function closeCreateCollectionModalFunc() {
    const modal = document.getElementById('createCollectionModal');
    if (modal) {
        modal.classList.remove('open');
    }
    currentCommessaCode = null;
    modalSelectedFiles = [];
}

async function createCollection(commessaCode, collectionName) {
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
            files: modalSelectedFiles
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
        console.log('Create collection response:', JSON.stringify(data));
        
        if (data.success) {
            // Show success message
            if (body) {
                body.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px 40px;height:100%;text-align:center;">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <div>
                            <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:4px;">${successLabel}</div>
                            <div style="font-size:13px;color:var(--text-light);">${successDesc}</div>
                        </div>
                    </div>
                `;
            }
            
            setTimeout(() => {
                closeCreateCollectionModalFunc();
                window.location.reload();
            }, 1500);
        } else {
            // Show error message
            isProcessing = false; // Allow closing modal on error
            if (body) {
                const errorMsg = data.error || data.message || JSON.stringify(data) || 'Errore sconosciuto nella creazione della collection';
                body.innerHTML = `<div style="padding:20px;color:red;text-align:center;font-size:14px;"><strong>Errore:</strong> ${errorMsg}</div>`;
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        isProcessing = false; // Allow closing modal on error
        if (body) {
            body.innerHTML = `<div style="padding:20px;color:red;text-align:center;font-size:14px;"><strong>Errore di connessione:</strong> ${error.message}</div>`;
        }
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }
}

function showJobDetails(job) {
    const modal = document.getElementById('jobModal');
    const title = document.getElementById('modalJobTitle');
    const details = document.getElementById('modalDetails');
    if (!modal || !title || !details) return;
    title.textContent = `Commessa ${job.code}`;
    const fields = [
        { label: 'Cliente', value: job.customer },
        { label: 'Società', value: job.company },
        { label: 'Tipo', value: job.typeof },
        { label: 'PM', value: job.project_manager },
        { label: 'Stato', value: job.status },
        { label: 'Consegna', value: job.end_date },
        { label: 'Stabilimento', value: job.site },
        { label: 'Resa', value: job.output },
        { label: 'Scopo', value: job.goal, fullWidth: true }
    ];
    details.innerHTML = fields.map(f => `
        <div class="detail-item" style="${f.fullWidth ? 'grid-column: 1 / -1' : ''}">
            <span class="detail-label">${f.label}</span>
            <span class="detail-value">${f.value}</span>
        </div>
    `).join('');
    modal.classList.add('open');
}

async function showCollectionDetails(collection, commessa) {
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

async function deleteCollectionFile(commessa, collectionName, filename) {
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

function showDeleteConfirmationBanner(filename) {
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

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// --- Job files browser in modal ---
async function loadJobFiles(commessa, subpath = '') {
    const body = document.querySelector('.create-collection-body');
    if (!body) return;
    body.innerHTML = `<div style="padding:12px;color:var(--text-light)">Caricamento file...</div>`;
    try {
        const url = `/api/list-job-files/?commessa=${encodeURIComponent(commessa)}&subpath=${encodeURIComponent(subpath)}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.error) {
            body.innerHTML = `<div style="padding:12px;color:red">Errore: ${data.error}</div>`;
            return;
        }
        renderJobFileBrowser(data);
    } catch (err) {
        console.error('loadJobFiles error', err);
        body.innerHTML = `<div style="padding:12px;color:red">Errore di connessione</div>`;
    }
}

function renderSelectedFilesCounter() {
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

function renderJobFileBrowser(data) {
    const body = document.querySelector('.create-collection-body');
    if (!body) return;
    body.innerHTML = '';

    const subpath = data.subpath || '';

    // Breadcrumbs
    const bc = document.createElement('div');
    bc.className = 'jobfiles-breadcrumbs';
    bc.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:16px;padding:8px 12px;background:var(--secondary-color);border-radius:6px;font-size:13px;font-weight:500;color:var(--text-color);border:1px solid var(--border-color);flex-wrap:wrap;';

    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.textContent = data.commessa;
    rootLink.style.cssText = 'color:var(--accent-color);text-decoration:none;transition:opacity 0.2s;';
    rootLink.addEventListener('click', (e) => { e.preventDefault(); loadJobFiles(data.commessa, ''); });
    rootLink.addEventListener('mouseenter', (e) => e.target.style.opacity = '0.7');
    rootLink.addEventListener('mouseleave', (e) => e.target.style.opacity = '1');
    bc.appendChild(rootLink);

    if (subpath) {
        const parts = subpath.split('/').filter(Boolean);
        let accum = '';
        parts.forEach((p) => {
            accum = accum ? (accum + '/' + p) : p;
            const sep = document.createElement('span');
            sep.textContent = '/';
            sep.style.cssText = 'color:var(--text-light);margin:0 2px;';
            bc.appendChild(sep);
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = p;
            link.style.cssText = 'color:var(--accent-color);text-decoration:none;transition:opacity 0.2s;';
            link.addEventListener('click', (e) => { e.preventDefault(); loadJobFiles(data.commessa, accum); });
            link.addEventListener('mouseenter', (e) => e.target.style.opacity = '0.7');
            link.addEventListener('mouseleave', (e) => e.target.style.opacity = '1');
            bc.appendChild(link);
        });
    }

    body.appendChild(bc);

    if (!data.entries || data.entries.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:40px 12px;color:var(--text-light);font-size:14px;';
        empty.textContent = 'Nessun file o cartella in questa posizione.';
        body.appendChild(empty);
        return;
    }

    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    // Folders first
    data.entries.filter(e => e.is_dir).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jobfile-row jobfile-folder';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);cursor:pointer;transition:all 0.2s;';
        
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--button-bg)';
            row.style.borderColor = 'var(--accent-color)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'var(--secondary-color)';
            row.style.borderColor = 'var(--border-color)';
            row.style.transform = 'translateX(0)';
        });

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;';
        left.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span style="font-size:14px;font-weight:500;color:var(--text-color);">${entry.name}</span>`;
        row.appendChild(left);

        const arrow = document.createElement('div');
        arrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>';
        arrow.style.cssText = 'display:flex;align-items:center;transition:transform 0.2s;';
        row.appendChild(arrow);

        row.addEventListener('click', () => {
            const newSub = subpath ? (subpath + '/' + entry.name) : entry.name;
            loadJobFiles(data.commessa, newSub);
        });
        
        listWrap.appendChild(row);
    });

    // Files
    data.entries.filter(e => !e.is_dir).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jobfile-row jobfile-file';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);transition:all 0.2s;';
        
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--button-bg)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'var(--secondary-color)';
        });

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;';
        left.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span style="font-size:14px;color:var(--text-color);">${entry.name}</span>`;
        row.appendChild(left);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:var(--accent-color);';
        const relPath = subpath ? (subpath + '/' + entry.name) : entry.name;
        checkbox.dataset.path = relPath;
        checkbox.addEventListener('change', (e) => {
            const p = e.target.dataset.path;
            if (e.target.checked) {
                if (!modalSelectedFiles.includes(p)) modalSelectedFiles.push(p);
            } else {
                modalSelectedFiles = modalSelectedFiles.filter(x => x !== p);
            }
            renderSelectedFilesCounter();
        });
        checkbox.addEventListener('click', (e) => e.stopPropagation());

        row.appendChild(checkbox);
        listWrap.appendChild(row);
    });

    body.appendChild(listWrap);
    renderSelectedFilesCounter();
}

function openModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    const chatCard = document.querySelector('.chat-card');
    
    if (modelMenu && modelSelect) {
        // Decide direction based on available viewport space under the select
        modelMenu.classList.remove('open-upward');

        // Temporarily make it visible (offscreen) to measure height if needed
        const prevDisplay = modelMenu.style.display;
        modelMenu.style.display = 'block';
        modelMenu.style.visibility = 'hidden';

        const rect = modelSelect.getBoundingClientRect();
        const availableBelow = window.innerHeight - rect.bottom;
        const menuHeight = modelMenu.scrollHeight || 200;

        // If not enough space below, open upward
        if (availableBelow < menuHeight + 8) {
            modelMenu.classList.add('open-upward');
        }

        // restore visibility and open
        modelMenu.style.visibility = '';
        modelMenu.style.display = prevDisplay || '';

        modelMenu.classList.add('open');
        modelSelect.classList.add('active');
    }
}

function closeModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    if (modelMenu && modelSelect) {
        modelMenu.classList.remove('open');
        modelMenu.classList.remove('open-upward');
        modelSelect.classList.remove('active');
    }
}

function selectModel(value, title) {
    const selectedSpan = document.querySelector('.model-selected');
    if (selectedSpan) selectedSpan.textContent = title;
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    // If there's an active agent, reinitialize it with the new mode
    if (activeCollection) {
        initializeAgent(activeCollection.commessa, activeCollection.collection);
    }
}

// Settings modal functions
function selectSettingsOption(value, title) {
    // Remove previous selection
    document.querySelectorAll('.settings-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked option
    const selectedOption = document.querySelector(`.settings-option[data-value="${value}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Here you can add logic to handle different settings options
    // For now, we just close the modal
    closeSettingsModal();
}

function ensureChatVisible() {
    const chatHistory = document.getElementById('chatHistory');
    const greetingSection = document.querySelector('.greeting-section');
    const chatCard = document.querySelector('.chat-card');
    if (greetingSection) greetingSection.style.display = 'none';
    if (chatHistory) chatHistory.classList.add('active');
    if (chatCard) {
        chatCard.classList.add('fixed');
        // align composer with the center of the `.container` so messages and textarea stay aligned
        const container = document.querySelector('.container');
        function alignChatCard() {
            if (!chatCard) return;
            if (container) {
                const rect = container.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                // set left in viewport pixels and translate to center
                chatCard.style.left = `${centerX}px`;
                chatCard.style.transform = 'translateX(-50%)';
            } else {
                chatCard.style.left = '50%';
                chatCard.style.transform = 'translateX(-50%)';
            }
        }

        // Store globally so sidebar toggle can call it
        window.alignChatCardGlobal = alignChatCard;

        // align now and on resize (keeps centered if window/container changes)
        alignChatCard();
        window.addEventListener('resize', alignChatCard);
    }
}

function appendMessage(role, text, isHtml) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;
    const row = document.createElement('div');
    row.className = `chat-row ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    // render markdown only for assistant, plain text for user
    if (role === 'assistant') {
        if (isHtml) {
            bubble.innerHTML = text || '';
        } else {
            bubble.innerHTML = renderMarkdown(text || '');
        }
    } else {
        bubble.textContent = text;
    }
    row.appendChild(bubble);
    chatHistory.appendChild(row);
    
    // Scroll to show the new message at the top of the viewport
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 100);
    
    return row;
}

// Basic, safe Markdown -> HTML renderer (supports headings, bold, italic, inline code, code blocks, lists, links)
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
}

function renderMarkdown(md) {
    if (!md) return '';
    
    // Normalize line endings
    md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Step 1: Extract and protect code blocks
    const codeBlocks = [];
    md = md.replace(/```([\s\S]*?)```/g, function(_, code) {
        const id = `@@CODEBLOCK${codeBlocks.length}@@`;
        codeBlocks.push(code);
        return '\n' + id + '\n';
    });

    // Step 2: Extract and protect inline code spans
    const inlineCode = [];
    md = md.replace(/`([^`]+)`/g, function(_, code) {
        const id = `@@INLINECODE${inlineCode.length}@@`;
        inlineCode.push(code);
        return id;
    });

    // Step 3: Escape HTML
    md = escapeHtml(md);

    // Step 4: Parse block-level elements (tables, lists, headings, paragraphs)
    const lines = md.split('\n');
    let html = '';
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }
        
        // Table detection (| header | ... | on current line and separator on next)
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|\-]+\|?\s*$/.test(lines[i + 1])) {
            const tableLines = [line, lines[i + 1]];
            i += 2;
            // Collect remaining table rows
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                tableLines.push(lines[i]);
                i++;
            }
            html += parseTable(tableLines);
            continue;
        }
        
        // Heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            html += `<h${level}>${content}</h${level}>`;
            i++;
            continue;
        }
        
        // Ordered list item
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (olMatch) {
            const listItems = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\s*)(\d+)\.\s+(.+)$/);
                if (!m) break;
                listItems.push({ indent: m[1].length, content: m[3] });
                i++;
            }
            html += buildNestedList(listItems, 'ol');
            continue;
        }
        
        // Unordered list item
        const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
        if (ulMatch) {
            const listItems = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\s*)([-*+])\s+(.+)$/);
                if (!m) break;
                listItems.push({ indent: m[1].length, content: m[3] });
                i++;
            }
            html += buildNestedList(listItems, 'ul');
            continue;
        }
        
        // Blockquote
        if (line.match(/^>\s*/)) {
            const quoteLines = [];
            while (i < lines.length && lines[i].match(/^>\s*/)) {
                quoteLines.push(lines[i].replace(/^>\s*/, ''));
                i++;
            }
            html += `<blockquote>${quoteLines.join(' ')}</blockquote>`;
            continue;
        }
        
        // Regular paragraph - collect consecutive non-special lines
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== '' && 
               !lines[i].match(/^#{1,6}\s/) && 
               !lines[i].match(/^\s*(\d+\.|-|\*|\+)\s/) && 
               !lines[i].match(/^>\s*/) &&
               !lines[i].includes('@@CODEBLOCK')) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            html += `<p>${paraLines.join(' ')}</p>`;
        }
    }

    // Step 5: Inline formatting (bold, italic, links) - process within HTML
    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_) - careful not to conflict with bold
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Step 6: Restore inline code
    html = html.replace(/@@INLINECODE(\d+)@@/g, function(_, idx) {
        return `<code>${inlineCode[parseInt(idx, 10)]}</code>`;
    });

    // Step 7: Restore code blocks
    html = html.replace(/@@CODEBLOCK(\d+)@@/g, function(_, idx) {
        const code = codeBlocks[parseInt(idx, 10)];
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });

    return html;
}

// Helper: Parse markdown table into HTML
function parseTable(lines) {
    if (lines.length < 2) return '';
    
    // Parse header
    const headerCells = lines[0].split('|').map(c => c.trim()).filter(c => c !== '');
    
    // Parse data rows (skip separator at index 1)
    const dataRows = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== '');
        if (cells.length > 0) {
            dataRows.push(cells);
        }
    }
    
    let table = '<table class="md-table"><thead><tr>';
    headerCells.forEach(cell => {
        table += `<th>${cell}</th>`;
    });
    table += '</tr></thead>';
    
    if (dataRows.length > 0) {
        table += '<tbody>';
        dataRows.forEach(row => {
            table += '<tr>';
            row.forEach(cell => {
                table += `<td>${cell}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody>';
    }
    
    table += '</table>';
    return table;
}

// Helper: Build nested list from items with indentation
function buildNestedList(items, type) {
    if (items.length === 0) return '';
    
    let html = '';
    const stack = [];
    
    items.forEach((item, idx) => {
        const indent = item.indent;
        const content = item.content;
        
        // Close lists if we dedent
        while (stack.length > 0 && stack[stack.length - 1] > indent) {
            stack.pop();
            html += `</${type}>`;
        }
        
        // Open new list if we indent
        if (stack.length === 0 || indent > stack[stack.length - 1]) {
            html += `<${type}>`;
            stack.push(indent);
        }
        
        html += `<li>${content}</li>`;
    });
    
    // Close remaining lists
    while (stack.length > 0) {
        stack.pop();
        html += `</${type}>`;
    }
    
    return html;
}

function appendLoader() {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;
    const row = document.createElement('div');
    row.className = 'chat-row assistant';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble loader';

    // small pulsing icon using same visual language as .greeting-icon
    const icon = document.createElement('span');
    icon.className = 'bubble-think-icon';
    icon.textContent = '✱';

    const timer = document.createElement('span');
    timer.className = 'loader-timer';
    timer.textContent = '0s';

    bubble.appendChild(icon);
    bubble.appendChild(timer);
    row.appendChild(bubble);
    chatHistory.appendChild(row);

    // start timer (seconds)
    const start = Date.now();
    // update every 50ms to include milliseconds in display
    const interval = setInterval(() => {
        const elapsedMs = Date.now() - start;
        const elapsedSec = (elapsedMs / 1000).toFixed(3);
        timer.textContent = `${elapsedSec}s`;
    }, 50);
    // store reference so callers can clear it
    row._timer = interval;

    // ensure newest loader is visible (we scroll main so loader is in view)
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 50);

    return row;
}

function appendSummaryDownloadBanner(filename, blob) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;
    
    const row = document.createElement('div');
    row.className = 'chat-row assistant';
    
    const banner = document.createElement('div');
    banner.className = 'summary-banner';
    banner.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 24px;
        background-color: #faf8f6;
        border-radius: 14px;
        border: 1px solid #e8e0d8;
        gap: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    `;
    
    // Icona PDF e nome file
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = 'display: flex; align-items: center; gap: 12px;';
    iconContainer.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <line x1="10" y1="9" x2="8" y2="9"></line>
        </svg>
    `;
    
    const text = document.createElement('span');
    text.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-color);';
    text.textContent = filename;
    
    iconContainer.appendChild(text);
    banner.appendChild(iconContainer);
    
    // Pulsante download
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'summary-download-btn';
    downloadBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background-color: var(--accent-color);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    `;
    downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Download</span>
    `;
    
    downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.backgroundColor = '#c25f3f';
        downloadBtn.style.transform = 'translateY(-2px)';
    });
    
    downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.backgroundColor = 'var(--accent-color)';
        downloadBtn.style.transform = 'translateY(0)';
    });
    
    downloadBtn.addEventListener('click', () => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });
    
    banner.appendChild(downloadBtn);
    row.appendChild(banner);
    chatHistory.appendChild(row);
    
    // Scroll to show the banner
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 50);
    
    return row;
}

async function sendMessage() {
    if (!activeCollection) {
        showAgentInactive();
        return;
    }
    const messageInput = document.getElementById('messageInput');
    const modelSelected = document.querySelector('.model-selected');
    const message = messageInput ? messageInput.value.trim() : '';
    const mode = modelSelected ? modelSelected.textContent.toLowerCase() : 'veloce';

    if (!message) return;

    ensureChatVisible();
    const userRow = appendMessage('user', message);
    // clear input immediately after sending so the textarea shows placeholder
    if (messageInput) {
        messageInput.value = '';
        autoResizeTextarea(messageInput);
        messageInput.blur();
    }
    const loaderRow = appendLoader();

    try {
        const response = await fetch('/api/send-message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ message: message, mode: mode })
        });
        const data = await response.json();
            if (data.success) {
            // input already cleared earlier
            if (loaderRow) {
                if (loaderRow._timer) clearInterval(loaderRow._timer);
                loaderRow.remove();
            }
            // Append assistant response and capture the row element
            const assistantRow = appendMessage('assistant', data.response || '');

            // If backend returned context_buttons, render them inside the assistant bubble
            if (Array.isArray(data.context_buttons) && assistantRow) {
                try {
                    const bubbleEl = assistantRow.querySelector('.chat-bubble');
                    if (bubbleEl) {
                        const controls = document.createElement('div');
                            controls.className = 'assistant-controls';
                            controls.style.cssText = 'margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

                            // Label placed before the buttons
                            const labelEl = document.createElement('div');
                            labelEl.className = 'assistant-sources-label';
                            labelEl.textContent = 'Fonti:';
                            controls.appendChild(labelEl);

                            data.context_buttons.forEach((btnDef) => {
                                const btn = document.createElement('button');
                                btn.className = 'sources-btn';
                                btn.type = 'button';
                                btn.textContent = btnDef.label || btnDef.name || 'Fonte';
                                btn.title = (btnDef.name ? btnDef.name + ' - ' : '') + (btnDef.type || '');
                                btn.dataset.index = btnDef.index;
                                btn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    openSourceModal(btnDef);
                                });
                                controls.appendChild(btn);
                            });

                            // Append controls inside the bubble so they sit at bottom-left
                            bubbleEl.appendChild(controls);
                    }
                } catch (err) {
                    console.error('Error rendering context buttons:', err);
                }
            }

            // after assistant response, ensure the user's question is the first visible
            if (userRow) {
                setTimeout(() => {
                    const rect = userRow.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetScroll = scrollTop + rect.top - 40; // 40px top offset
                    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }, 100);
            }
        } else {
            if (loaderRow) {
                if (loaderRow._timer) clearInterval(loaderRow._timer);
                loaderRow.remove();
            }
            appendMessage('assistant', data.error || 'Errore durante la richiesta');
            if (userRow) {
                setTimeout(() => {
                    const rect = userRow.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetScroll = scrollTop + rect.top - 40;
                    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        if (loaderRow) {
            if (loaderRow._timer) clearInterval(loaderRow._timer);
            loaderRow.remove();
        }
        appendMessage('assistant', 'Errore di rete, riprova.');
        if (userRow) {
            setTimeout(() => {
                const rect = userRow.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const targetScroll = scrollTop + rect.top - 40;
                window.scrollTo({ top: targetScroll, behavior: 'smooth' });
            }, 100);
        }
    }
}

function openSourceModal(btnDef) {
    // create overlay
    const overlay = document.createElement('div');
    overlay.className = 'source-modal-overlay';

    // modal container
    const modal = document.createElement('div');
    modal.className = 'source-modal';

    // close button (top-right)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'source-modal-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';

    // content area (below header) populated with metadata
    const content = document.createElement('div');
    content.className = 'source-modal-content';

    // Header panel with formatted title
    const header = document.createElement('div');
    header.className = 'source-modal-header';

    const meta = btnDef.metadata || {};
    const rawName = btnDef.name || meta.name || 'Fonte';
    const rawType = (btnDef.type || meta.type || '').toString().toLowerCase();
    const ps = (btnDef.page_start !== undefined && btnDef.page_start !== null) ? btnDef.page_start : meta.page_start;
    const pe = (btnDef.page_end !== undefined && btnDef.page_end !== null) ? btnDef.page_end : meta.page_end;

    let headerTitle = rawName;
    if (rawType === 'text') {
        if (ps !== undefined && ps !== null) {
            const s = String(ps);
            const e = (pe !== undefined && pe !== null) ? String(pe) : null;
            if (e && e === s) {
                headerTitle += ` (pag. ${s})`;
            } else if (e) {
                headerTitle += ` (pag. ${s}-${e})`;
            } else {
                headerTitle += ` (pag. ${s})`;
            }
        }
    } else if (rawType === 'draw' || rawType === 'image') {
        // just the name (already set)
    }

    header.textContent = headerTitle;

    // attach header at top of modal
    modal.appendChild(header);

    // Only show the formatted title and the visual preview below
    const info = document.createElement('div');
    info.className = 'source-modal-info';

    const loading = document.createElement('div');
    loading.className = 'source-modal-loading';
    loading.textContent = 'Caricamento anteprima...';
    info.appendChild(loading);
    content.appendChild(info);

    const pathVal = (meta && (meta.path || meta.source)) || btnDef.name || '';
    if (!pathVal) {
        loading.textContent = 'Anteprima non disponibile.';
    } else {
        fetch('/api/check-path/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ 
                path: pathVal, 
                type: rawType,  // Add the type to the request
                page_start: ps !== undefined ? ps : null, 
                page_end: pe !== undefined ? pe : null 
            })
        }).then(r => r.json()).then(res => {
            loading.remove();
            if (res && (res.preview !== undefined || res.pdf_data_uri || res.data_uri || res.download_url || res.listing)) {
                // If server returned a text preview, show it
                if (res.preview !== undefined && res.preview !== null) {
                    const pre = document.createElement('pre');
                    pre.className = 'source-preview';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.maxHeight = '60vh';
                    pre.style.overflow = 'auto';
                    pre.textContent = res.preview;
                    content.appendChild(pre);
                }

                // If server returned a PDF data URI, embed it visually
                else if (res.pdf_data_uri) {
                    const iframe = document.createElement('iframe');
                    iframe.src = res.pdf_data_uri;
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.title = 'Anteprima PDF';
                    content.appendChild(iframe);
                }

                // If server returned an image data URI, show it
                else if (res.data_uri) {
                    const img = document.createElement('img');
                    img.src = res.data_uri;
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '60vh';
                    img.alt = 'Anteprima immagine';
                    content.appendChild(img);
                }

                // Excel: show download button
                else if (res.download_url) {
                    const a = document.createElement('a');
                    a.href = res.download_url;
                    a.download = '';
                    a.className = 'excel-download-btn';
                    a.textContent = '⬇ Scarica file Excel';
                    content.appendChild(a);
                }

                // If directory listing
                else if (res.listing && Array.isArray(res.listing)) {
                    const ul = document.createElement('ul');
                    res.listing.forEach((it) => {
                        const li = document.createElement('li');
                        li.textContent = it.name + (it.is_dir ? ' (cartella)' : '');
                        ul.appendChild(li);
                    });
                    content.appendChild(ul);
                }

                else if (res.error) {
                    const e = document.createElement('p');
                    e.textContent = 'Errore: ' + res.error;
                    content.appendChild(e);
                }

            } else if (res && res.error) {
                const e = document.createElement('p');
                e.textContent = 'Errore: ' + res.error;
                content.appendChild(e);
            } else {
                const e = document.createElement('p');
                e.textContent = 'Anteprima non disponibile.';
                content.appendChild(e);
            }
        }).catch(() => {
            loading.textContent = 'Errore durante il caricamento dell\'anteprima.';
        });
    }

    modal.appendChild(closeBtn);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // handlers
    function closeModal() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
        if (e.key === 'Escape') closeModal();
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', onKey);
}
async function performSearch(query, autoOpen = false) {
    const resultsContainer = document.getElementById('searchResults');
    if (!query.trim()) {
        resultsContainer.innerHTML = '';
        updateSelectedCommessaParam(null);
        resultsContainer.classList.remove('job-selected');
        return;
    }
    
    console.log('Searching for:', query); // Debug log
    
    try {
        const response = await fetch(`/api/search-commesse/?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        console.log('Search response:', data); // Debug log
        
        if (data.results) {
            if (autoOpen) {
                const normalizedQuery = query.replace(/\s+/g, '').toLowerCase();
                const match = data.results.find(job => job.code && job.code.replace(/\s+/g, '').toLowerCase() === normalizedQuery);
                if (match) {
                    const searchInput = document.getElementById('sidebarSearchInput');
                    if (searchInput) {
                        searchInput.value = match.code;
                    }
                    showSelectedJob(match);
                    return;
                }
            }
            renderSearchResults(data.results);
        } else if (data.error) {
            console.error('Search error:', data.error);
            resultsContainer.innerHTML = `<div style="padding: 12px; color: red;">Errore: ${data.error}</div>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        resultsContainer.innerHTML = `<div style="padding: 12px; color: red;">Errore di connessione</div>`;
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    container.innerHTML = '';
    container.classList.remove('job-selected');
    results.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <span class="job-card-number">${job.code}</span>
            <button class="job-info-btn" title="Informazioni">i</button>
        `;
        
        // Click handler per selezionare la commessa
        card.addEventListener('click', (e) => {
            // Evita che il click si propaghi se è stato cliccato il pulsante info
            if (e.target.classList.contains('job-info-btn')) return;
            
            const searchInput = document.getElementById('sidebarSearchInput');
            if (searchInput) {
                searchInput.value = job.code;
                // Mostra solo la commessa selezionata
                showSelectedJob(job);
            }
        });
        
        card.querySelector('.job-info-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showJobDetails(job);
        });
        container.appendChild(card);
    });
}

function showSelectedJob(selectedJob) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.add('job-selected');
    const jobInfo = document.createElement('div');
    jobInfo.className = 'selected-job-info';
    
    const title = document.createElement('div');
    title.className = 'selected-job-title';
    title.textContent = `Commessa: ${selectedJob.code}`;
    
    const description = document.createElement('div');
    description.className = 'selected-job-description';
    description.innerHTML = `Commessa destinata a <span class="field-value">${selectedJob.customer}</span> in carico allo stabilimento di <span class="field-value">${selectedJob.site}</span>. Scopo: <span class="field-value">${selectedJob.goal}</span> Project Manager incaricato: <span class="field-value">${selectedJob.project_manager}</span>. Stato: <span class="field-value">${selectedJob.status}</span> (<span class="field-value">${selectedJob.end_date}</span>).`;
    
    jobInfo.appendChild(title);
    jobInfo.appendChild(description);
    container.appendChild(jobInfo);

    updateSelectedCommessaParam(selectedJob.code);
    
    // Load and display collections for this job
    loadCollections(selectedJob.code, container);
}

async function loadCollections(commessaCode, container) {
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
            mergeProcessingTasks(commessaCode, data.processing || []);
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

function renderCollections(collections, container, commessaCode) {
    const section = document.createElement('div');
    section.className = 'collections-section';

    const isRicerca = window.location.pathname.includes('/ricerca');

    if (!isRicerca) {
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
        section.appendChild(createWrapper);
    }

    const list = document.createElement('div');
    list.className = 'collections-list';

    if (isRicerca && !collections.length) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'collections-empty-msg';
        emptyMsg.textContent = 'Crea un Notebook nella sezione Chiedi';
        section.appendChild(emptyMsg);
    }

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
                console.log('Selected collection:', collection.name);
                
                // Initialize agent
                await initializeAgent(commessaCode, collection.name);
            } else {
                console.log('Deselected collection:', collection.name);
                activeCollection = null;
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

    section.appendChild(list);

    container.appendChild(section);
}

// Global variable for current commessa
currentCommessaCode = null;
// Selected files in the create-collection modal
modalSelectedFiles = [];
// Active collection
activeCollection = null;

function showAgentLoading() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'flex';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

function showAgentSuccess() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

function showAgentError() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (inactive) inactive.style.display = 'none';
}

function showAgentInactive() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'flex';
}

function hideAgentStatus() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

function enableSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    if (!sendBtn) return;
    sendBtn.removeAttribute('disabled');
    sendBtn.classList.remove('disabled');
}

function disableSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    if (!sendBtn) return;
    sendBtn.setAttribute('disabled', 'true');
    sendBtn.classList.add('disabled');
}

async function initializeAgent(commessa, collectionName) {
    try {
        // Show loading state
        showAgentLoading();
        
        // Get selected mode from UI
        const modelSelected = document.querySelector('.model-selected');
        const mode = modelSelected ? modelSelected.textContent.trim().toLowerCase() : 'veloce';
        
        console.log('Initializing agent with:', { commessa, collectionName, mode });
        
        const response = await fetch('/api/initialize-agent/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                commessa: commessa,
                collection_name: collectionName,
                mode: mode
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            activeCollection = {
                commessa: commessa,
                collection: collectionName,
                mode: mode
            };
            console.log('Agent initialized successfully:', data);
            // Dispatch event for other pages (e.g. ricerca) to react
            document.dispatchEvent(new CustomEvent('collectionSelected', {
                detail: { commessa, collection: collectionName, mode }
            }));
            // Show success message
            showAgentSuccess();
            // enable sending now that an agent is active
            enableSendButton();
        } else {
            console.error('Error initializing agent:', data.error);
            alert('Errore nell\'inizializzazione dell\'agent: ' + data.error);
            showAgentError();
            // keep send disabled
            disableSendButton();
        }
    } catch (error) {
        console.error('Error initializing agent:', error);
        alert('Errore di connessione: ' + error.message);
        showAgentError();
        disableSendButton();
    }
}

function sanitizeCollectionName(name) {
    const sanitized = name.trim().replace(/\s+/g, '_');
    return sanitized.length ? sanitized : '';
}

function submitCreateCollection() {
    const input = document.getElementById('collectionNameInput');
    const confirmBtn = document.getElementById('createCollectionConfirmBtn');
    const body = document.querySelector('.create-collection-body');
    
    console.log('submitCreateCollection called');
    
    if (!input || !currentCommessaCode) {
        console.log('Missing input or commessa code');
        return;
    }

    const rawName = input.value.trim();
    if (!rawName) {
        console.log('Empty collection name');
        return;
    }

    const sanitizedName = sanitizeCollectionName(rawName);
    if (!sanitizedName) {
        console.log('Invalid sanitized name');
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

function updateSelectedCommessaParam(commessaCode) {
    const url = new URL(window.location.href);
    if (commessaCode) {
        url.searchParams.set('commessa', commessaCode);
    } else {
        url.searchParams.delete('commessa');
    }
    window.history.replaceState({}, '', url);
}

function restoreSelectedCommessa() {
    const params = new URLSearchParams(window.location.search);
    const commessa = params.get('commessa');
    if (!commessa) {
        return;
    }

    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) {
        searchInput.value = commessa;
    }

    performSearch(commessa, true);
}

// Functions for Create Collection Modal
function openCreateCollectionModal(commessaCode) {
    currentCommessaCode = commessaCode;
    const modal = document.getElementById('createCollectionModal');
    const input = document.getElementById('collectionNameInput');
    
    if (modal && input) {
        input.value = '';
        // reset selected files and update counter
        modalSelectedFiles = [];
        renderSelectedFilesCounter();
        // load job files for this commessa into the modal browser
        loadJobFiles(commessaCode, '');
        modal.classList.add('open');
        setTimeout(() => input.focus(), 200);
    }
}

function closeCreateCollectionModalFunc() {
    const modal = document.getElementById('createCollectionModal');
    if (modal) {
        modal.classList.remove('open');
    }
    currentCommessaCode = null;
    modalSelectedFiles = [];
}

async function createCollection(commessaCode, collectionName) {
    console.log('createCollection called with:', { commessaCode, collectionName, files: modalSelectedFiles });
    
    const confirmBtn = document.getElementById('createCollectionConfirmBtn');
    const body = document.querySelector('.create-collection-body');
    
    console.log('Elements found:', { confirmBtn: !!confirmBtn, body: !!body });
    
    try {
        isCollectionCreating = true;

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
            console.log('Loading spinner shown');
        }
        
        const response = await fetch('/api/create-collection/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                commessa: commessaCode,
                collection_name: collectionName,
                files: modalSelectedFiles
            })
        });
        
        console.log('Response received:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.status === 202 && data.collection_task_id) {
            // Async path: task dispatched — close modal immediately and show badge
            closeCreateCollectionModalFunc();
            activeCollectionTasks.push({
                id: data.collection_task_id,
                commessa: data.commessa,
                collection_name: data.collection_name,
                status: data.status || 'pending',
                files_done: 0,
                files_total: (data.selected_files || []).length,
            });
            updateCollectionProcessingBadge();
            startCollectionPolling();
        } else if (data.success) {
            // Sync path: empty collection created (no files)
            if (body) {
                body.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px 40px;height:100%;text-align:center;">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <div>
                            <div style="font-size:16px;font-weight:600;color:var(--text-color);margin-bottom:4px;">Creazione completata!</div>
                            <div style="font-size:13px;color:var(--text-light);">Notebook creato con successo</div>
                        </div>
                    </div>
                `;
            }
            setTimeout(() => {
                closeCreateCollectionModalFunc();
                window.location.reload();
            }, 1500);
        } else {
            // Show error message — unlock modal so user can close it
            isCollectionCreating = false;
            if (body) {
                body.innerHTML = `<div style="padding:20px;color:red;text-align:center;font-size:14px;"><strong>Errore:</strong> ${data.error}</div>`;
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        isCollectionCreating = false;
        if (body) {
            body.innerHTML = `<div style="padding:20px;color:red;text-align:center;font-size:14px;"><strong>Errore di connessione:</strong> ${error.message}</div>`;
        }
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }
}

function showJobDetails(job) {
    const modal = document.getElementById('jobModal');
    const title = document.getElementById('modalJobTitle');
    const details = document.getElementById('modalDetails');
    if (!modal || !title || !details) return;
    title.textContent = `Commessa ${job.code}`;
    const fields = [
        { label: 'Cliente', value: job.customer },
        { label: 'Società', value: job.company },
        { label: 'Tipo', value: job.typeof },
        { label: 'PM', value: job.project_manager },
        { label: 'Stato', value: job.status },
        { label: 'Consegna', value: job.end_date },
        { label: 'Stabilimento', value: job.site },
        { label: 'Resa', value: job.output },
        { label: 'Scopo', value: job.goal, fullWidth: true }
    ];
    details.innerHTML = fields.map(f => `
        <div class="detail-item" style="${f.fullWidth ? 'grid-column: 1 / -1' : ''}">
            <span class="detail-label">${f.label}</span>
            <span class="detail-value">${f.value}</span>
        </div>
    `).join('');
    modal.classList.add('open');
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// --- Job files browser in modal ---
async function loadJobFiles(commessa, subpath = '') {
    const body = document.querySelector('.create-collection-body');
    if (!body) return;
    console.log('loadJobFiles called', { commessa, subpath });
    body.innerHTML = `<div style="padding:12px;color:var(--text-light)">Caricamento file...</div>`;
    try {
        const url = `/api/list-job-files/?commessa=${encodeURIComponent(commessa)}&subpath=${encodeURIComponent(subpath)}`;
        console.log('fetch url', url);
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('list-job-files response', data);
        if (data.error) {
            body.innerHTML = `<div style="padding:12px;color:red">Errore: ${data.error}</div>`;
            return;
        }
        renderJobFileBrowser(data);
    } catch (err) {
        console.error('loadJobFiles error', err);
        body.innerHTML = `<div style="padding:12px;color:red">Errore di connessione</div>`;
    }
}

function renderSelectedFilesCounter() {
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

function renderJobFileBrowser(data) {
    const body = document.querySelector('.create-collection-body');
    if (!body) return;
    body.innerHTML = '';

    const subpath = data.subpath || '';

    // Breadcrumbs
    const bc = document.createElement('div');
    bc.className = 'jobfiles-breadcrumbs';
    bc.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:16px;padding:8px 12px;background:var(--secondary-color);border-radius:6px;font-size:13px;font-weight:500;color:var(--text-color);border:1px solid var(--border-color);flex-wrap:wrap;';

    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.textContent = data.commessa;
    rootLink.style.cssText = 'color:var(--accent-color);text-decoration:none;transition:opacity 0.2s;';
    rootLink.addEventListener('click', (e) => { e.preventDefault(); loadJobFiles(data.commessa, ''); });
    rootLink.addEventListener('mouseenter', (e) => e.target.style.opacity = '0.7');
    rootLink.addEventListener('mouseleave', (e) => e.target.style.opacity = '1');
    bc.appendChild(rootLink);

    if (subpath) {
        const parts = subpath.split('/').filter(Boolean);
        let accum = '';
        parts.forEach((p) => {
            accum = accum ? (accum + '/' + p) : p;
            const sep = document.createElement('span');
            sep.textContent = '/';
            sep.style.cssText = 'color:var(--text-light);margin:0 2px;';
            bc.appendChild(sep);
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = p;
            link.style.cssText = 'color:var(--accent-color);text-decoration:none;transition:opacity 0.2s;';
            link.addEventListener('click', (e) => { e.preventDefault(); loadJobFiles(data.commessa, accum); });
            link.addEventListener('mouseenter', (e) => e.target.style.opacity = '0.7');
            link.addEventListener('mouseleave', (e) => e.target.style.opacity = '1');
            bc.appendChild(link);
        });
    }

    body.appendChild(bc);

    if (!data.entries || data.entries.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:40px 12px;color:var(--text-light);font-size:14px;';
        empty.textContent = 'Nessun file o cartella in questa posizione.';
        body.appendChild(empty);
        return;
    }

    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    // Folders first
    data.entries.filter(e => e.is_dir).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jobfile-row jobfile-folder';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);cursor:pointer;transition:all 0.2s;';
        
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--button-bg)';
            row.style.borderColor = 'var(--accent-color)';
            row.style.transform = 'translateX(2px)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'var(--secondary-color)';
            row.style.borderColor = 'var(--border-color)';
            row.style.transform = 'translateX(0)';
        });

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;';
        left.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span style="font-size:14px;font-weight:500;color:var(--text-color);">${entry.name}</span>`;
        row.appendChild(left);

        const arrow = document.createElement('div');
        arrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>';
        arrow.style.cssText = 'display:flex;align-items:center;transition:transform 0.2s;';
        row.appendChild(arrow);

        row.addEventListener('click', () => {
            const newSub = subpath ? (subpath + '/' + entry.name) : entry.name;
            loadJobFiles(data.commessa, newSub);
        });
        
        listWrap.appendChild(row);
    });

    // Files
    data.entries.filter(e => !e.is_dir).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'jobfile-row jobfile-file';
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--border-color);border-radius:6px;background:var(--secondary-color);transition:all 0.2s;';
        
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--button-bg)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'var(--secondary-color)';
        });

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;';
        left.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span style="font-size:14px;color:var(--text-color);">${entry.name}</span>`;
        row.appendChild(left);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:var(--accent-color);';
        const relPath = subpath ? (subpath + '/' + entry.name) : entry.name;
        checkbox.dataset.path = relPath;
        checkbox.addEventListener('change', (e) => {
            const p = e.target.dataset.path;
            if (e.target.checked) {
                if (!modalSelectedFiles.includes(p)) modalSelectedFiles.push(p);
            } else {
                modalSelectedFiles = modalSelectedFiles.filter(x => x !== p);
            }
            renderSelectedFilesCounter();
        });
        checkbox.addEventListener('click', (e) => e.stopPropagation());

        row.appendChild(checkbox);
        listWrap.appendChild(row);
    });

    body.appendChild(listWrap);
    renderSelectedFilesCounter();
}

function openModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    const chatCard = document.querySelector('.chat-card');
    
    if (modelMenu && modelSelect) {
        // Decide direction based on available viewport space under the select
        modelMenu.classList.remove('open-upward');

        // Temporarily make it visible (offscreen) to measure height if needed
        const prevDisplay = modelMenu.style.display;
        modelMenu.style.display = 'block';
        modelMenu.style.visibility = 'hidden';

        const rect = modelSelect.getBoundingClientRect();
        const availableBelow = window.innerHeight - rect.bottom;
        const menuHeight = modelMenu.scrollHeight || 200;

        // If not enough space below, open upward
        if (availableBelow < menuHeight + 8) {
            modelMenu.classList.add('open-upward');
        }

        // restore visibility and open
        modelMenu.style.visibility = '';
        modelMenu.style.display = prevDisplay || '';

        modelMenu.classList.add('open');
        modelSelect.classList.add('active');
    }
}

function closeModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    if (modelMenu && modelSelect) {
        modelMenu.classList.remove('open');
        modelMenu.classList.remove('open-upward');
        modelSelect.classList.remove('active');
    }
}

function selectModel(value, title) {
    const selectedSpan = document.querySelector('.model-selected');
    if (selectedSpan) selectedSpan.textContent = title;
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    // If there's an active agent, reinitialize it with the new mode
    if (activeCollection) {
        console.log('Reinitializing agent with new mode:', value);
        initializeAgent(activeCollection.commessa, activeCollection.collection);
    }
}

// Settings modal functions
function selectSettingsOption(value, title) {
    // Remove previous selection
    document.querySelectorAll('.settings-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked option
    const selectedOption = document.querySelector(`.settings-option[data-value="${value}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    console.log('Settings option selected:', value, title);
    
    // Here you can add logic to handle different settings options
    // For now, we just close the modal
    closeSettingsModal();
}

function ensureChatVisible() {
    const chatHistory = document.getElementById('chatHistory');
    const greetingSection = document.querySelector('.greeting-section');
    const chatCard = document.querySelector('.chat-card');
    if (greetingSection) greetingSection.style.display = 'none';
    if (chatHistory) chatHistory.classList.add('active');
    if (chatCard) {
        chatCard.classList.add('fixed');
        // align composer with the center of the `.container` so messages and textarea stay aligned
        const container = document.querySelector('.container');
        function alignChatCard() {
            if (!chatCard) return;
            if (container) {
                const rect = container.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                // set left in viewport pixels and translate to center
                chatCard.style.left = `${centerX}px`;
                chatCard.style.transform = 'translateX(-50%)';
            } else {
                chatCard.style.left = '50%';
                chatCard.style.transform = 'translateX(-50%)';
            }
        }

        // Store globally so sidebar toggle can call it
        window.alignChatCardGlobal = alignChatCard;

        // align now and on resize (keeps centered if window/container changes)
        alignChatCard();
        window.addEventListener('resize', alignChatCard);
    }
}

function appendMessage(role, text) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;
    const row = document.createElement('div');
    row.className = `chat-row ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    // render markdown only for assistant, plain text for user
    if (role === 'assistant') {
        bubble.innerHTML = renderMarkdown(text || '');
    } else {
        bubble.textContent = text;
    }
    row.appendChild(bubble);
    chatHistory.appendChild(row);
    
    // Scroll to show the new message at the top of the viewport
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 100);
    
    return row;
}

// Basic, safe Markdown -> HTML renderer (supports headings, bold, italic, inline code, code blocks, lists, links)
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
}

function renderMarkdown(md) {
    if (!md) return '';
    
    // Normalize line endings
    md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    // Step 1: Extract and protect code blocks
    const codeBlocks = [];
    md = md.replace(/```([\s\S]*?)```/g, function(_, code) {
        const id = `@@CODEBLOCK${codeBlocks.length}@@`;
        codeBlocks.push(code);
        return '\n' + id + '\n';
    });

    // Step 2: Extract and protect inline code spans
    const inlineCode = [];
    md = md.replace(/`([^`]+)`/g, function(_, code) {
        const id = `@@INLINECODE${inlineCode.length}@@`;
        inlineCode.push(code);
        return id;
    });

    // Step 3: Escape HTML
    md = escapeHtml(md);

    // Step 4: Parse block-level elements (tables, lists, headings, paragraphs)
    const lines = md.split('\n');
    let html = '';
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }
        
        // Table detection (| header | ... | on current line and separator on next)
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|\-]+\|?\s*$/.test(lines[i + 1])) {
            const tableLines = [line, lines[i + 1]];
            i += 2;
            // Collect remaining table rows
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                tableLines.push(lines[i]);
                i++;
            }
            html += parseTable(tableLines);
            continue;
        }
        
        // Heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            html += `<h${level}>${content}</h${level}>`;
            i++;
            continue;
        }
        
        // Ordered list item
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (olMatch) {
            const listItems = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\s*)(\d+)\.\s+(.+)$/);
                if (!m) break;
                listItems.push({ indent: m[1].length, content: m[3] });
                i++;
            }
            html += buildNestedList(listItems, 'ol');
            continue;
        }
        
        // Unordered list item
        const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
        if (ulMatch) {
            const listItems = [];
            while (i < lines.length) {
                const m = lines[i].match(/^(\s*)([-*+])\s+(.+)$/);
                if (!m) break;
                listItems.push({ indent: m[1].length, content: m[3] });
                i++;
            }
            html += buildNestedList(listItems, 'ul');
            continue;
        }
        
        // Blockquote
        if (line.match(/^>\s*/)) {
            const quoteLines = [];
            while (i < lines.length && lines[i].match(/^>\s*/)) {
                quoteLines.push(lines[i].replace(/^>\s*/, ''));
                i++;
            }
            html += `<blockquote>${quoteLines.join(' ')}</blockquote>`;
            continue;
        }
        
        // Regular paragraph - collect consecutive non-special lines
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== '' && 
               !lines[i].match(/^#{1,6}\s/) && 
               !lines[i].match(/^\s*(\d+\.|-|\*|\+)\s/) && 
               !lines[i].match(/^>\s*/) &&
               !lines[i].includes('@@CODEBLOCK')) {
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            html += `<p>${paraLines.join(' ')}</p>`;
        }
    }

    // Step 5: Inline formatting (bold, italic, links) - process within HTML
    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_) - careful not to conflict with bold
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });

    // Step 6: Restore inline code
    html = html.replace(/@@INLINECODE(\d+)@@/g, function(_, idx) {
        return `<code>${inlineCode[parseInt(idx, 10)]}</code>`;
    });

    // Step 7: Restore code blocks
    html = html.replace(/@@CODEBLOCK(\d+)@@/g, function(_, idx) {
        const code = codeBlocks[parseInt(idx, 10)];
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });

    return html;
}

// Helper: Parse markdown table into HTML
function parseTable(lines) {
    if (lines.length < 2) return '';
    
    // Parse header
    const headerCells = lines[0].split('|').map(c => c.trim()).filter(c => c !== '');
    
    // Parse data rows (skip separator at index 1)
    const dataRows = [];
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== '');
        if (cells.length > 0) {
            dataRows.push(cells);
        }
    }
    
    let table = '<table class="md-table"><thead><tr>';
    headerCells.forEach(cell => {
        table += `<th>${cell}</th>`;
    });
    table += '</tr></thead>';
    
    if (dataRows.length > 0) {
        table += '<tbody>';
        dataRows.forEach(row => {
            table += '<tr>';
            row.forEach(cell => {
                table += `<td>${cell}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody>';
    }
    
    table += '</table>';
    return table;
}

// Helper: Build nested list from items with indentation
function buildNestedList(items, type) {
    if (items.length === 0) return '';
    
    let html = '';
    const stack = [];
    
    items.forEach((item, idx) => {
        const indent = item.indent;
        const content = item.content;
        
        // Close lists if we dedent
        while (stack.length > 0 && stack[stack.length - 1] > indent) {
            stack.pop();
            html += `</${type}>`;
        }
        
        // Open new list if we indent
        if (stack.length === 0 || indent > stack[stack.length - 1]) {
            html += `<${type}>`;
            stack.push(indent);
        }
        
        html += `<li>${content}</li>`;
    });
    
    // Close remaining lists
    while (stack.length > 0) {
        stack.pop();
        html += `</${type}>`;
    }
    
    return html;
}

function appendLoader() {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;
    const row = document.createElement('div');
    row.className = 'chat-row assistant';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble loader';

    // small pulsing icon using same visual language as .greeting-icon
    const icon = document.createElement('span');
    icon.className = 'bubble-think-icon';
    icon.textContent = '✱';

    const timer = document.createElement('span');
    timer.className = 'loader-timer';
    timer.textContent = '0s';

    bubble.appendChild(icon);
    bubble.appendChild(timer);
    row.appendChild(bubble);
    chatHistory.appendChild(row);

    // start timer (seconds)
    const start = Date.now();
    // update every 50ms to include milliseconds in display
    const interval = setInterval(() => {
        const elapsedMs = Date.now() - start;
        const elapsedSec = (elapsedMs / 1000).toFixed(3);
        timer.textContent = `${elapsedSec}s`;
    }, 50);
    // store reference so callers can clear it
    row._timer = interval;

    // ensure newest loader is visible (we scroll main so loader is in view)
    setTimeout(() => {
        const rect = row.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetScroll = scrollTop + rect.top - 40;
        window.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 50);

    return row;
}

async function sendMessage() {
    if (!activeCollection) {
        showAgentInactive();
        return;
    }
    const messageInput = document.getElementById('messageInput');
    const modelSelected = document.querySelector('.model-selected');
    const message = messageInput ? messageInput.value.trim() : '';
    const mode = modelSelected ? modelSelected.textContent.toLowerCase() : 'veloce';

    if (!message) return;

    ensureChatVisible();
    const userRow = appendMessage('user', message);
    // clear input immediately after sending so the textarea shows placeholder
    if (messageInput) {
        messageInput.value = '';
        autoResizeTextarea(messageInput);
        messageInput.blur();
    }
    const loaderRow = appendLoader();

    try {
        const response = await fetch('/api/send-message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ message: message, mode: mode })
        });
        const data = await response.json();
            if (data.success) {
            // input already cleared earlier
            if (loaderRow) {
                if (loaderRow._timer) clearInterval(loaderRow._timer);
                loaderRow.remove();
            }
            // Append assistant response and capture the row element
            const assistantRow = appendMessage('assistant', data.response || '');

            // If backend returned context_buttons, render them inside the assistant bubble
            if (Array.isArray(data.context_buttons) && assistantRow) {
                try {
                    const bubbleEl = assistantRow.querySelector('.chat-bubble');
                    if (bubbleEl) {
                        const controls = document.createElement('div');
                            controls.className = 'assistant-controls';
                            controls.style.cssText = 'margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

                            // Label placed before the buttons
                            const labelEl = document.createElement('div');
                            labelEl.className = 'assistant-sources-label';
                            labelEl.textContent = 'Fonti:';
                            controls.appendChild(labelEl);

                            data.context_buttons.forEach((btnDef) => {
                                const btn = document.createElement('button');
                                btn.className = 'sources-btn';
                                btn.type = 'button';
                                btn.textContent = btnDef.label || btnDef.name || 'Fonte';
                                btn.title = (btnDef.name ? btnDef.name + ' - ' : '') + (btnDef.type || '');
                                btn.dataset.index = btnDef.index;
                                btn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    openSourceModal(btnDef);
                                });
                                controls.appendChild(btn);
                            });

                            // Append controls inside the bubble so they sit at bottom-left
                            bubbleEl.appendChild(controls);
                    }
                } catch (err) {
                    console.error('Error rendering context buttons:', err);
                }
            }

            // after assistant response, ensure the user's question is the first visible
            if (userRow) {
                setTimeout(() => {
                    const rect = userRow.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetScroll = scrollTop + rect.top - 40; // 40px top offset
                    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }, 100);
            }
        } else {
            if (loaderRow) {
                if (loaderRow._timer) clearInterval(loaderRow._timer);
                loaderRow.remove();
            }
            appendMessage('assistant', data.error || 'Errore durante la richiesta');
            if (userRow) {
                setTimeout(() => {
                    const rect = userRow.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetScroll = scrollTop + rect.top - 40;
                    window.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        if (loaderRow) {
            if (loaderRow._timer) clearInterval(loaderRow._timer);
            loaderRow.remove();
        }
        appendMessage('assistant', 'Errore di rete, riprova.');
        if (userRow) {
            setTimeout(() => {
                const rect = userRow.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const targetScroll = scrollTop + rect.top - 40;
                window.scrollTo({ top: targetScroll, behavior: 'smooth' });
            }, 100);
        }
    }
}

function openSourceModal(btnDef) {
    // create overlay
    const overlay = document.createElement('div');
    overlay.className = 'source-modal-overlay';

    // modal container
    const modal = document.createElement('div');
    modal.className = 'source-modal';

    // close button (top-right)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'source-modal-close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';

    // content area (below header) populated with metadata
    const content = document.createElement('div');
    content.className = 'source-modal-content';

    // Header panel with formatted title
    const header = document.createElement('div');
    header.className = 'source-modal-header';

    const meta = btnDef.metadata || {};
    const rawName = btnDef.name || meta.name || 'Fonte';
    const rawType = (btnDef.type || meta.type || '').toString().toLowerCase();
    const ps = (btnDef.page_start !== undefined && btnDef.page_start !== null) ? btnDef.page_start : meta.page_start;
    const pe = (btnDef.page_end !== undefined && btnDef.page_end !== null) ? btnDef.page_end : meta.page_end;

    let headerTitle = rawName;
    if (rawType === 'text') {
        if (ps !== undefined && ps !== null) {
            const s = String(ps);
            const e = (pe !== undefined && pe !== null) ? String(pe) : null;
            if (e && e === s) {
                headerTitle += ` (pag. ${s})`;
            } else if (e) {
                headerTitle += ` (pag. ${s}-${e})`;
            } else {
                headerTitle += ` (pag. ${s})`;
            }
        }
    } else if (rawType === 'draw' || rawType === 'image') {
        // just the name (already set)
    }

    header.textContent = headerTitle;

    // attach header at top of modal
    modal.appendChild(header);

    // Only show the formatted title and the visual preview below
    const info = document.createElement('div');
    info.className = 'source-modal-info';

    const loading = document.createElement('div');
    loading.className = 'source-modal-loading';
    loading.textContent = 'Caricamento anteprima...';
    info.appendChild(loading);
    content.appendChild(info);

    const pathVal = (meta && (meta.path || meta.source)) || btnDef.name || '';
    if (!pathVal) {
        loading.textContent = 'Anteprima non disponibile.';
    } else {
        fetch('/api/check-path/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ path: pathVal, page_start: ps !== undefined ? ps : null, page_end: pe !== undefined ? pe : null })
        }).then(r => r.json()).then(res => {
            loading.remove();
            if (res && (res.preview !== undefined || res.pdf_data_uri || res.data_uri || res.download_url || res.listing)) {
                // If server returned a text preview, show it
                if (res.preview !== undefined && res.preview !== null) {
                    const pre = document.createElement('pre');
                    pre.className = 'source-preview';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.maxHeight = '60vh';
                    pre.style.overflow = 'auto';
                    pre.textContent = res.preview;
                    content.appendChild(pre);
                }

                // If server returned a PDF data URI, embed it visually
                else if (res.pdf_data_uri) {
                    const iframe = document.createElement('iframe');
                    iframe.src = res.pdf_data_uri;
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.title = 'Anteprima PDF';
                    content.appendChild(iframe);
                }

                // If server returned an image data URI, show it
                else if (res.data_uri) {
                    const img = document.createElement('img');
                    img.src = res.data_uri;
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '60vh';
                    img.alt = 'Anteprima immagine';
                    content.appendChild(img);
                }

                // Excel: show download button
                else if (res.download_url) {
                    const a = document.createElement('a');
                    a.href = res.download_url;
                    a.download = '';
                    a.className = 'excel-download-btn';
                    a.textContent = '⬇ Scarica file Excel';
                    content.appendChild(a);
                }

                // If directory listing
                else if (res.listing && Array.isArray(res.listing)) {
                    const ul = document.createElement('ul');
                    res.listing.forEach((it) => {
                        const li = document.createElement('li');
                        li.textContent = it.name + (it.is_dir ? ' (cartella)' : '');
                        ul.appendChild(li);
                    });
                    content.appendChild(ul);
                }

                else if (res.error) {
                    const e = document.createElement('p');
                    e.textContent = 'Errore: ' + res.error;
                    content.appendChild(e);
                }

            } else if (res && res.error) {
                const e = document.createElement('p');
                e.textContent = 'Errore: ' + res.error;
                content.appendChild(e);
            } else {
                const e = document.createElement('p');
                e.textContent = 'Anteprima non disponibile.';
                content.appendChild(e);
            }
        }).catch(() => {
            loading.textContent = 'Errore durante il caricamento dell\'anteprima.';
        });
    }

    modal.appendChild(closeBtn);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // handlers
    function closeModal() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
        if (e.key === 'Escape') closeModal();
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', onKey);
}

function getCookie(name) {
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

// ── Collection processing badge & modal ───────────────────────────────────────

function updateCollectionProcessingBadge() {
    const badge = document.getElementById('processingBadge');
    if (!badge) return;

    if (activeCollectionTasks.length === 0) {
        badge.style.display = 'none';
        closeProcessingModal();
        return;
    }

    const inProgress = activeCollectionTasks.filter(t => t.status === 'pending' || t.status === 'processing');
    const withError = activeCollectionTasks.filter(t => t.status === 'error');

    badge.style.display = 'flex';

    const spinner = document.getElementById('processingSpinner');
    if (spinner) {
        if (inProgress.length > 0) {
            spinner.className = 'processing-spinner';
            spinner.style.cssText = '';
            spinner.textContent = '';
        } else if (withError.length > 0) {
            spinner.className = '';
            spinner.style.cssText = 'font-size:14px;line-height:1;flex-shrink:0;';
            spinner.textContent = '⚠️';
        } else {
            spinner.className = '';
            spinner.style.cssText = 'font-size:14px;line-height:1;flex-shrink:0;';
            spinner.textContent = '✅';
        }
    }

    const parts = [];
    if (inProgress.length > 0) {
        parts.push(inProgress.length === 1
            ? '1 collection in elaborazione'
            : `${inProgress.length} collection in elaborazione`);
    }
    if (withError.length > 0) {
        parts.push(withError.length === 1 ? '1 con errore' : `${withError.length} con errore`);
    }
    if (inProgress.length === 0 && withError.length === 0) {
        parts.push('Elaborazione completata');
    }
    document.getElementById('processingBadgeText').textContent = parts.join(', ');

    const processingModal = document.getElementById('processingModal');
    if (processingModal && processingModal.style.display === 'flex') {
        renderCollectionProcessingModal();
    }
}

function openProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (!modal) return;
    renderCollectionProcessingModal();
    modal.style.display = 'flex';
}

function closeProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) modal.style.display = 'none';
}

function renderCollectionProcessingModal() {
    const body = document.getElementById('processingModalBody');
    if (!body) return;

    if (!activeCollectionTasks || activeCollectionTasks.length === 0) {
        body.innerHTML = '<p style="font-size:13px;color:var(--text-light);margin:0;">Nessuna collection in elaborazione.</p>';
        return;
    }

    body.innerHTML = activeCollectionTasks.map(t => {
        const isError = t.status === 'error';
        const isReady = t.status === 'ready';
        const label = t.collection_name.replace(/_/g, ' ');

        let statusEl;
        if (isError) {
            statusEl = `<span style="color:#e74c3c;font-size:12px;font-weight:500;">⚠ Errore</span>`;
        } else if (isReady) {
            statusEl = `<span style="color:#27ae60;font-size:12px;font-weight:500;">✓ Completato</span>`;
        } else {
            const done = t.files_done ?? 0;
            const total = t.files_total ?? 0;
            const progress = total > 0 ? `${done}/${total} file` : 'In attesa...';
            statusEl = `<span style="color:var(--text-light);font-size:12px;display:flex;align-items:center;gap:6px;">
                <div style="width:10px;height:10px;border:2px solid rgba(212,112,77,0.2);border-top:2px solid var(--accent-color);border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0;"></div>
                ${progress}
            </span>`;
        }

        return `
            <div class="processing-item" style="${isError ? 'border-color:#e74c3c40;' : ''}">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div>
                        <div class="processing-item-name">${escapeHtml(label)}</div>
                        <div style="font-size:11px;color:var(--text-light);">${escapeHtml(t.commessa)}</div>
                    </div>
                    ${statusEl}
                </div>
            </div>
        `;
    }).join('');
}

function startCollectionPolling() {
    if (collectionTaskPollInterval) return;
    collectionTaskPollInterval = setInterval(pollCollectionTasks, 2000);
}

function stopCollectionPolling() {
    if (collectionTaskPollInterval) {
        clearInterval(collectionTaskPollInterval);
        collectionTaskPollInterval = null;
    }
}

async function pollCollectionTasks() {
    const pending = activeCollectionTasks.filter(t => t.status === 'pending' || t.status === 'processing');
    if (pending.length === 0) {
        stopCollectionPolling();
        return;
    }

    for (const task of pending) {
        try {
            const res = await fetch(
                `/api/collection-task-status/?commessa=${encodeURIComponent(task.commessa)}&collection=${encodeURIComponent(task.collection_name)}`
            );
            if (!res.ok) continue;
            const data = await res.json();
            if (data.status && data.status !== task.status) {
                task.status = data.status;
            }
            if (typeof data.files_done === 'number') task.files_done = data.files_done;
            if (typeof data.files_total === 'number') task.files_total = data.files_total;
        } catch (e) {
            console.warn('Collection poll error:', e);
        }
    }

    updateCollectionProcessingBadge();

    const allDone = activeCollectionTasks.every(t => t.status === 'ready' || t.status === 'error');
    if (allDone && activeCollectionTasks.length > 0) {
        stopCollectionPolling();
        const hasErrors = activeCollectionTasks.some(t => t.status === 'error');
        if (!hasErrors) {
            // All completed successfully — reload after a brief pause
            setTimeout(() => {
                activeCollectionTasks = [];
                window.location.reload();
            }, 2000);
        }
        // On errors: keep badge visible so user can see what failed
    }
}
