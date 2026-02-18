/**
 * Main Application Orchestrator
 * This file coordinates all modules and handles initialization
 */

// Core modules
import { loadGreeting, initializeDropdown, restoreSelectedCommessa, setupAuthListeners } from './core/auth.js';
import { setupChatListeners } from './core/chat.js';
import { sendMessage, disableSendButton } from './core/agent.js';

// Feature modules
import { setupSearchListeners } from './search.js';
import { setupReportListeners } from './report.js';
import { setupModelsListeners } from './models.js';

// Modal modules
import { setupJobModalListeners } from './modals/jobModal.js';
import { setupCollectionModalListeners } from './modals/collectionModal.js';
import { setupCreateCollectionModalListeners, isProcessing } from './modals/createCollectionModal.js';

/**
 * Setup sidebar toggle functionality
 */
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const isClosed = sidebar.classList.toggle('closed');
            sidebarToggle.setAttribute('aria-label', isClosed ? 'Apri sidebar' : 'Chiudi sidebar');
            
            // Animate chat card position during sidebar transition
            const chatCard = document.querySelector('.chat-card.fixed');
            if (chatCard && window.alignChatCardGlobal) {
                const startTime = performance.now();
                const duration = 200; // Match sidebar transition duration (0.2s = 200ms)
                
                function animatePosition(currentTime) {
                    const elapsed = currentTime - startTime;
                    
                    // Keep updating position during transition
                    window.alignChatCardGlobal();
                    
                    if (elapsed < duration) {
                        requestAnimationFrame(animatePosition);
                    }
                }
                
                requestAnimationFrame(animatePosition);
            }
        });
    }
}

/**
 * Setup modal close handlers
 */
function setupModalHandlers() {
    const jobModal = document.getElementById('jobModal');
    const collectionModal = document.getElementById('collectionModal');
    const createCollectionModal = document.getElementById('createCollectionModal');
    const reportUploadModal = document.getElementById('reportUploadModal');
    
    // Click outside modals to close
    window.addEventListener('click', (e) => {
        // Check if processing flag from createCollectionModal
        if (isProcessing) return;
        
        if (e.target === jobModal && jobModal.classList.contains('open')) {
            jobModal.classList.remove('open');
        }
        if (collectionModal && e.target === collectionModal && collectionModal.classList.contains('open')) {
            collectionModal.classList.remove('open');
        }
        if (createCollectionModal && e.target === createCollectionModal && createCollectionModal.classList.contains('open')) {
            createCollectionModal.classList.remove('open');
        }
        if (reportUploadModal && e.target === reportUploadModal && reportUploadModal.classList.contains('open')) {
            reportUploadModal.classList.remove('open');
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (isProcessing) return;
        
        if (e.key === 'Escape') {
            if (createCollectionModal && createCollectionModal.classList.contains('open')) {
                createCollectionModal.classList.remove('open');
            }
            if (jobModal && jobModal.classList.contains('open')) {
                jobModal.classList.remove('open');
            }
            if (collectionModal && collectionModal.classList.contains('open')) {
                collectionModal.classList.remove('open');
            }
            if (reportUploadModal && reportUploadModal.classList.contains('open')) {
                reportUploadModal.classList.remove('open');
            }
        }
    });
}

/**
 * Setup message input handlers
 */
function setupMessageInput() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (messageInput) {
        messageInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
}

/**
 * Clean up any lingering overlays on page load
 */
function cleanupOverlays() {
    setTimeout(() => {
        const modals = document.querySelectorAll('.create-collection-modal, .modal');
        modals.forEach(modal => {
            if (window.getComputedStyle(modal).display !== 'none' && !modal.classList.contains('open')) {
                modal.style.display = 'none';
            }
        });
        document.body.style.pointerEvents = 'auto';
    }, 50);
}

/**
 * Initialize application
 */
async function initializeApp() {
    try {
        // Load user greeting
        await loadGreeting();
        
        // Initialize dropdown (veloce as default)
        initializeDropdown();
        
        // Disable send button until agent is selected
        disableSendButton();
        
        // Setup all event listeners
        setupAuthListeners();
        setupChatListeners();
        setupSearchListeners();
        setupReportListeners();
        setupModelsListeners();
        setupSidebarToggle();
        setupModalHandlers();
        setupMessageInput();
        
        // Setup modal-specific listeners
        setupJobModalListeners();
        setupCollectionModalListeners();
        setupCreateCollectionModalListeners();
        
        // Restore selected commessa from URL if present
        restoreSelectedCommessa();
        
        // Clean up any lingering overlays
        cleanupOverlays();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
