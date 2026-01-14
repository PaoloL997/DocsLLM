// Get greeting on page load
document.addEventListener('DOMContentLoaded', function() {
    loadGreeting();
    setupEventListeners();
    initializeDropdown();
    restoreSelectedCommessa();
});

function initializeDropdown() {
    const firstOption = document.querySelector('.model-option[data-value]');
    if (firstOption) {
        firstOption.classList.add('selected');
    }
}

async function loadGreeting() {
    const greetingElement = document.getElementById('greeting');
    if (greetingElement) {
        greetingElement.textContent = 'Accedi al tuo account';
    }
}

function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const modelSelect = document.getElementById('modelSelect');
    const modelMenu = document.getElementById('modelMenu');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const searchIconButton = document.getElementById('searchIconButton');
    const sidebarSearchInput = document.getElementById('sidebarSearchInput');
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('usernameInput');
    const jobModal = document.getElementById('jobModal');
    const closeModal = document.getElementById('closeModal');
    const createCollectionModal = document.getElementById('createCollectionModal');
    const createCollectionConfirmBtn = document.getElementById('createCollectionConfirmBtn');

    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const isClosed = sidebar.classList.toggle('closed');
            sidebarToggle.setAttribute('aria-label', isClosed ? 'Apri sidebar' : 'Chiudi sidebar');
        });
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

    if (loginBtn && usernameInput) {
        loginBtn.addEventListener('click', async function() {
            const username = usernameInput.value.trim();
            if (!username) return;
            try {
                const response = await fetch('/api/login/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({ username: username })
                });
                const data = await response.json();
                if (data.success) {
                    document.getElementById('loginForm').style.display = 'none';
                    document.getElementById('userInfo').style.display = 'flex';
                    document.getElementById('userNameDisplay').textContent = data.name;
                    document.getElementById('userRoleDisplay').textContent = data.role;
                    document.getElementById('userAvatar').textContent = data.initial;
                    const greetingElement = document.getElementById('greeting');
                    if (greetingElement) {
                        greetingElement.textContent = `Benvenuto, ${data.name}`;
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
            }
        });
        usernameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') loginBtn.click();
        });
    }

    // Modal click outside to close
    if (createCollectionModal) {
        createCollectionModal.addEventListener('click', (e) => {
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

    window.addEventListener('click', (e) => {
        if (e.target === jobModal) {
            if (jobModal.classList.contains('open')) {
                jobModal.classList.remove('open');
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

    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            console.log('Settings clicked');
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
        }
        const response = await fetch(`/api/list-collections/?commessa=${encodeURIComponent(commessaCode)}`);
        const data = await response.json();
        
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
            <svg class="collection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
        `;

        card.addEventListener('click', () => {
            // Check if this card is already selected BEFORE removing
            const wasSelected = card.classList.contains('selected');
            
            // Remove selection from all cards
            document.querySelectorAll('.collection-card').forEach((c) => c.classList.remove('selected'));
            
            // If it wasn't selected, select it now
            if (!wasSelected) {
                card.classList.add('selected');
                console.log('Selected collection:', collection.name);
            } else {
                console.log('Deselected collection:', collection.name);
            }
        });

        list.appendChild(card);
    });

    section.appendChild(createWrapper);
    section.appendChild(list);

    container.appendChild(section);
}

// Global variable for current commessa
let currentCommessaCode = null;
// Selected files in the create-collection modal
let modalSelectedFiles = [];

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
            // Show error message
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
    if (modelMenu && modelSelect) {
        modelMenu.classList.add('open');
        modelSelect.classList.add('active');
    }
}

function closeModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    if (modelMenu && modelSelect) {
        modelMenu.classList.remove('open');
        modelSelect.classList.remove('active');
    }
}

function selectModel(value, title) {
    const selectedSpan = document.querySelector('.model-selected');
    if (selectedSpan) selectedSpan.textContent = title;
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const modelSelected = document.querySelector('.model-selected');
    const message = messageInput ? messageInput.value.trim() : '';
    const model = modelSelected ? modelSelected.textContent : '';

    if (!message) return;

    try {
        const response = await fetch('/api/send-message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ message: message, model: model })
        });
        const data = await response.json();
        if (data.success) {
            messageInput.value = '';
            autoResizeTextarea(messageInput);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
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
