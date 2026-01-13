// Get greeting on page load
document.addEventListener('DOMContentLoaded', function() {
    loadGreeting();
    setupEventListeners();
    initializeDropdown();
});

function initializeDropdown() {
    // Set initial selected model
    const firstOption = document.querySelector('.model-option[data-value]');
    if (firstOption) {
        firstOption.classList.add('selected');
    }
}

// Load greeting message
async function loadGreeting() {
    try {
        const response = await fetch('/api/greeting/');
        const data = await response.json();
        const greetingElement = document.getElementById('greeting');
        greetingElement.textContent = `${data.greeting}, ${data.name}`;
    } catch (error) {
        console.error('Error loading greeting:', error);
        document.getElementById('greeting').textContent = 'Buongiorno, paolol';
    }
}

// Setup event listeners
function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const modelSelect = document.getElementById('modelSelect');
    const modelMenu = document.getElementById('modelMenu');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    // Sidebar toggle
    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const isClosed = sidebar.classList.toggle('closed');
            sidebarToggle.setAttribute('aria-label', isClosed ? 'Apri sidebar' : 'Chiudi sidebar');
        });
    }

    // Auto-resize message field
    messageInput.addEventListener('input', function() {
        autoResizeTextarea(messageInput);
    });
    autoResizeTextarea(messageInput);

    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);

    // Send message on Enter key
    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // Attach button
    attachBtn.addEventListener('click', function() {
        console.log('Attach clicked');
        // TODO: Implement attach functionality
    });

    // Settings button
    settingsBtn.addEventListener('click', function() {
        console.log('Settings clicked');
        // TODO: Implement settings
    });

    // Custom dropdown functionality
    if (modelSelect && modelMenu) {
        modelSelect.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Model select clicked');
            const isOpen = modelMenu.classList.contains('open');
            if (isOpen) {
                closeModelDropdown();
            } else {
                openModelDropdown();
            }
        });

        // Model option selection
        const modelOptions = document.querySelectorAll('.model-option[data-value]');
        modelOptions.forEach(option => {
            option.addEventListener('click', function() {
                const value = this.dataset.value;
                const title = this.querySelector('.model-option-title').textContent;
                selectModel(value, title);
                closeModelDropdown();
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!modelSelect.contains(e.target) && !modelMenu.contains(e.target)) {
                closeModelDropdown();
            }
        });
    }
}

function openModelDropdown() {
    const modelSelect = document.getElementById('modelSelect');
    const modelMenu = document.getElementById('modelMenu');
    
    modelSelect.classList.add('open');
    modelMenu.classList.add('open');
}

function closeModelDropdown() {
    const modelSelect = document.getElementById('modelSelect');
    const modelMenu = document.getElementById('modelMenu');
    
    modelSelect.classList.remove('open');
    modelMenu.classList.remove('open');
}

function selectModel(value, title) {
    const modelSelected = document.querySelector('.model-selected');
    const currentSelected = document.querySelector('.model-option.selected');
    const newSelected = document.querySelector(`[data-value="${value}"]`);
    
    // Update selected text
    modelSelected.textContent = title;
    
    // Update selected option
    if (currentSelected) {
        currentSelected.classList.remove('selected');
    }
    if (newSelected) {
        newSelected.classList.add('selected');
    }
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const modelSelected = document.querySelector('.model-selected');
    const message = messageInput.value.trim();
    const model = modelSelected.textContent;

    if (!message) {
        return;
    }

    try {
        const response = await fetch('/api/send-message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                message: message,
                model: model
            })
        });

        const data = await response.json();
        
        if (data.success) {
            // Clear input
            messageInput.value = '';
            autoResizeTextarea(messageInput);
            console.log('Message sent:', data);
            // TODO: Handle message response and display in chat
        } else {
            console.error('Error:', data.error);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Get CSRF token
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

function autoResizeTextarea(field) {
    if (!field) {
        return;
    }
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
}
