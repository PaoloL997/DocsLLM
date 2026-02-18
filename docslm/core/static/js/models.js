/**
 * Models Module - Handles model dropdown and selection
 */

import { initializeAgent, getActiveCollection } from './core/agent.js';

/**
 * Open model dropdown menu
 */
export function openModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    
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

/**
 * Close model dropdown menu
 */
export function closeModelDropdown() {
    const modelMenu = document.getElementById('modelMenu');
    const modelSelect = document.getElementById('modelSelect');
    if (modelMenu && modelSelect) {
        modelMenu.classList.remove('open');
        modelMenu.classList.remove('open-upward');
        modelSelect.classList.remove('active');
    }
}

/**
 * Select a model
 * @param {string} value - Model value
 * @param {string} title - Model title
 */
export function selectModel(value, title) {
    const selectedSpan = document.querySelector('.model-selected');
    if (selectedSpan) selectedSpan.textContent = title;
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    // If there's an active agent, reinitialize it with the new mode
    const activeCollection = getActiveCollection();
    if (activeCollection) {
        initializeAgent(activeCollection.commessa, activeCollection.collection);
    }
}

/**
 * Setup model dropdown event listeners
 */
export function setupModelsListeners() {
    const modelSelect = document.getElementById('modelSelect');
    const modelMenu = document.getElementById('modelMenu');
    
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
