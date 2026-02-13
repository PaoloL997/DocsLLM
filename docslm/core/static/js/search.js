/**
 * Search Module - Handles sidebar search functionality
 */

import { showSelectedJob } from '../collections/manager.js';
import { updateSelectedCommessaParam } from '../core/auth.js';

/**
 * Perform search across jobs
 * @param {string} query - Search query
 * @param {boolean} autoOpen - Whether to auto-open first result
 */
export async function performSearch(query, autoOpen = false) {
    const sidebarResults = document.getElementById('sidebarResults');
    if (!sidebarResults) return;

    if (!query || query.trim() === '') {
        sidebarResults.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/job-search/?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            renderSearchResults(data.results);
            sidebarResults.style.display = 'block';
            
            if (autoOpen && data.results.length > 0) {
                const firstResult = data.results[0];
                showSelectedJob(firstResult);
                updateSelectedCommessaParam(firstResult.code);
            }
        } else {
            sidebarResults.style.display = 'none';
        }
    } catch (error) {
        console.error('Search error:', error);
        sidebarResults.style.display = 'none';
    }
}

/**
 * Render search results in sidebar
 * @param {Array} results - Search results
 */
export function renderSearchResults(results) {
    const sidebarResults = document.getElementById('sidebarResults');
    if (!sidebarResults) return;

    sidebarResults.innerHTML = '';

    results.forEach((job) => {
        const jobItem = document.createElement('div');
        jobItem.className = 'sidebar-job-item';
        jobItem.dataset.code = job.code;

        jobItem.innerHTML = `
            <span class="sidebar-job-code">${job.code}</span>
            <span class="sidebar-job-customer">${job.customer}</span>
        `;

        jobItem.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-job-item').forEach((item) => {
                item.classList.remove('selected');
            });
            jobItem.classList.add('selected');
            showSelectedJob(job);
            updateSelectedCommessaParam(job.code);
        });

        sidebarResults.appendChild(jobItem);
    });
}

/**
 * Setup search-related event listeners
 */
export function setupSearchListeners() {
    const sidebarSearchInput = document.getElementById('sidebarSearchInput');
    const searchIconButton = document.getElementById('searchIconButton');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
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
}
