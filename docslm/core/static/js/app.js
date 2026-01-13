// Get greeting on page load
document.addEventListener('DOMContentLoaded', function() {
    loadGreeting();
    setupEventListeners();
    initializeDropdown();
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
        return;
    }
    
    console.log('Searching for:', query); // Debug log
    
    try {
        const response = await fetch(`/api/search-commesse/?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        console.log('Search response:', data); // Debug log
        
        if (data.results) {
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
    results.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <span class="job-card-number">${job.code}</span>
            <button class="job-info-btn" title="Informazioni">i</button>
        `;
        card.querySelector('.job-info-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            showJobDetails(job);
        });
        container.appendChild(card);
    });
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
