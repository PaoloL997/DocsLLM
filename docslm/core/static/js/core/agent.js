/**
 * Agent Module - Handles agent initialization, message sending, and status management
 */

import { getCookie } from './utils.js';
import { appendMessage, appendLoader, ensureChatVisible } from './chat.js';
import { openSourceModal } from '../modals/sourceModal.js';

// Active collection state
let _activeCollection = null;

export function getActiveCollection() {
    return _activeCollection;
}

export function setActiveCollection(value) {
    _activeCollection = value;
}

// Export a getter for backward compatibility
export const activeCollection = {
    get value() { return _activeCollection; },
    set value(v) { _activeCollection = v; }
};

/**
 * Initialize an agent for a specific collection
 * @param {string} commessa - Commessa code
 * @param {string} collectionName - Collection name
 */
export async function initializeAgent(commessa, collectionName) {
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
            _activeCollection = {
                commessa: commessa,
                collection: collectionName,
                mode: mode
            };
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

/**
 * Send a message to the active agent
 */
export async function sendMessage() {
    if (!_activeCollection) {
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
        const { autoResizeTextarea } = await import('./utils.js');
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

/**
 * Show agent loading status
 */
export function showAgentLoading() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'flex';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

/**
 * Show agent success status
 */
export function showAgentSuccess() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'flex';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

/**
 * Show agent error status
 */
export function showAgentError() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'flex';
    if (inactive) inactive.style.display = 'none';
}

/**
 * Show agent inactive status
 */
export function showAgentInactive() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'flex';
}

/**
 * Hide all agent status indicators
 */
export function hideAgentStatus() {
    const loading = document.querySelector('.agent-loading');
    const success = document.querySelector('.agent-success');
    const error = document.querySelector('.agent-error');
    const inactive = document.querySelector('.agent-inactive');
    if (loading) loading.style.display = 'none';
    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';
    if (inactive) inactive.style.display = 'none';
}

/**
 * Enable send button
 */
export function enableSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    const summaryBtn = document.getElementById('summaryBtn');
    if (!sendBtn) return;
    sendBtn.removeAttribute('disabled');
    sendBtn.classList.remove('disabled');
    if (summaryBtn) {
        summaryBtn.disabled = false;
    }
}

/**
 * Disable send button
 */
export function disableSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    const summaryBtn = document.getElementById('summaryBtn');
    if (!sendBtn) return;
    sendBtn.setAttribute('disabled', 'true');
    sendBtn.classList.add('disabled');
    if (summaryBtn) {
        summaryBtn.disabled = true;
    }
}
