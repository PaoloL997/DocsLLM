/**
 * Authentication Module - Handles user login and greeting
 */

import { getCookie } from './utils.js';

/**
 * Load greeting based on user session
 */
export async function loadGreeting() {
    const greetingElement = document.getElementById('greeting');
    if (greetingElement) {
        greetingElement.textContent = 'Accedi al tuo account';
    }
}

/**
 * Initialize dropdown selection
 */
export function initializeDropdown() {
    const veloceOption = document.querySelector('.model-option[data-value="veloce"]');
    if (veloceOption) {
        veloceOption.classList.add('selected');
    }
}

/**
 * Update URL parameter for selected commessa
 * @param {string} commessaCode - Commessa code
 */
export function updateSelectedCommessaParam(commessaCode) {
    const url = new URL(window.location.href);
    if (commessaCode) {
        url.searchParams.set('commessa', commessaCode);
    } else {
        url.searchParams.delete('commessa');
    }
    window.history.replaceState({}, '', url);
}

/**
 * Restore selected commessa from URL parameter
 */
export function restoreSelectedCommessa() {
    const url = new URL(window.location.href);
    const commessaCode = url.searchParams.get('commessa');
    if (commessaCode) {
        // Find and select the commessa in the sidebar
        setTimeout(() => {
            const allJobCards = document.querySelectorAll('.sidebar-job-item');
            allJobCards.forEach(card => {
                if (card.dataset.code === commessaCode) {
                    card.click();
                }
            });
        }, 500);
    }
}

/**
 * Setup login-related event listeners
 */
export function setupAuthListeners() {
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('usernameInput');
    
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
}
